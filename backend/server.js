/**
 * CS Agent Backend
 * - POST /evaluate-priority: returns priority (Critical/High/Medium/Low) + reason
 * - POST /suggest-reply: returns suggested reply text in English
 * Set OPENAI_API_KEY to use real LLM; otherwise returns mock responses.
 * 启动时从 backend/.env 加载变量，便于 VM 上 pm2 restart 后仍能读到最新 key。
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// 版本号：每次发版改这里，便于确认 Railway/VM 是否跑的是最新部署
const BACKEND_VERSION = '1.0.2';
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'cs-agent-backend',
    version: BACKEND_VERSION,
    build: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RAILWAY_DEPLOYMENT_ID || 'local'
  });
});

const PRODUCT_DOCS_PATH = path.join(__dirname, '..', 'product_docs', 'faq.json');
const PROMPTS_PATH = path.join(__dirname, '..', 'product_docs', 'prompts.json');
const PROMPTS_FALLBACK_PATH = path.join(__dirname, 'prompts.json');
const CONFIG_DEFAULT_PATH = path.join(__dirname, 'config.default.json');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || ''; // e.g. http://127.0.0.1:5001

let _defaultConfigCache = null;
function loadDefaultConfig() {
  if (_defaultConfigCache !== null) return _defaultConfigCache;
  let config = {};
  try {
    const rawDefault = fs.readFileSync(CONFIG_DEFAULT_PATH, 'utf8');
    config = JSON.parse(rawDefault);
  } catch (e) {
    // ignore
  }
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      const overrides = JSON.parse(raw);
      if (overrides.OPENAI_API_KEY !== undefined) config.OPENAI_API_KEY = overrides.OPENAI_API_KEY;
      if (overrides.OPENAI_MODEL !== undefined) config.OPENAI_MODEL = overrides.OPENAI_MODEL;
      if (overrides.OPENAI_API_BASE !== undefined) config.OPENAI_API_BASE = overrides.OPENAI_API_BASE;
    }
  } catch (e) {
    // ignore
  }
  _defaultConfigCache = config;
  return config;
}

/** 优先使用环境变量（生产/RMS），没有则用 config 中的默认 key。支持 OpenRouter（baseURL）。 */
function getOpenAIConfig() {
  const envKey = process.env.OPENAI_API_KEY;
  const envModel = process.env.OPENAI_MODEL;
  const envBase = process.env.OPENAI_API_BASE;
  const config = loadDefaultConfig();
  const apiKey = (envKey || config.OPENAI_API_KEY || '').trim();
  const model = (envModel || config.OPENAI_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  const baseURL = (envBase || config.OPENAI_API_BASE || '').trim() || undefined;
  return { apiKey, model, baseURL };
}

/** 可选：限制传入模型的会话长度，避免超出上下文。0 表示不截断。保留最近 maxChars 字符。 */
function getMaxConversationChars() {
  const v = process.env.OPENAI_MAX_CONVERSATION_CHARS;
  if (v === undefined || v === '') return 0;
  const n = parseInt(v, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

function truncateConversationTail(text, maxChars) {
  if (!maxChars || !text || typeof text !== 'string') return text || '';
  const t = text.trim();
  if (t.length <= maxChars) return text;
  return '(前文已省略，仅保留最近部分)\n\n' + t.slice(-maxChars);
}

function loadProductDocs() {
  try {
    const raw = fs.readFileSync(PRODUCT_DOCS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { faqs: [], tone: 'Professional, friendly. Reply in English.' };
  }
}

function loadPrompts() {
  const tryPath = fs.existsSync(PROMPTS_PATH) ? PROMPTS_PATH : PROMPTS_FALLBACK_PATH;
  try {
    const raw = fs.readFileSync(tryPath, 'utf8');
    const data = JSON.parse(raw);
    return {
      priority: {
        template: (data.priority && data.priority.template) ? data.priority.template : '',
        instruction: (data.priority && data.priority.instruction) ? data.priority.instruction : ''
      },
      reply: {
        template: (data.reply && data.reply.template) ? data.reply.template : '',
        instruction: (data.reply && data.reply.instruction) ? data.reply.instruction : ''
      },
      summary: {
        template: (data.summary && data.summary.template) ? data.summary.template : '',
        instruction: (data.summary && data.summary.instruction) ? data.summary.instruction : ''
      },
      translate: {
        template: (data.translate && data.translate.template) ? data.translate.template : '',
        instruction: (data.translate && data.translate.instruction) ? data.translate.instruction : ''
      }
    };
  } catch (e) {
    return {
      priority: { template: '', instruction: '' },
      reply: { template: '', instruction: '' },
      summary: { template: '', instruction: '' },
      translate: { template: '', instruction: '' }
    };
  }
}

function applyTemplate(template, vars) {
  if (!template || typeof template !== 'string') return '';
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), v != null ? String(v) : '');
  }
  return out;
}

/** 若配置了 RAG_SERVICE_URL，向 RAG 服务请求检索上下文（FAQ + 历史案例 + 设备状态） */
async function fetchRagContext(query, ticketContext = {}) {
  if (!RAG_SERVICE_URL || !query || !query.trim()) return null;
  try {
    const res = await fetch(RAG_SERVICE_URL + '/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.trim().substring(0, 2000),
        n_faq: 3,
        n_history: 2,
        ticket_context: ticketContext
      })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('RAG fetch error:', e.message);
  }
  return null;
}

// 根据客服偏好语言返回 mock 的 reason 文案
function mockReasonByLang(level, lang) {
  const zh = { P0: '非常紧急或存在升级风险，需优先处理。', P1: '涉及退款/订单或核心问题，需尽快处理。', P2: '常见售后或物流类工单，需及时跟进。', P3: '一般咨询或低紧急度。' };
  const en = { P0: 'Very time-sensitive or escalation risk.', P1: 'Refund or order issue; needs prompt handling.', P2: 'Common support topics: return or shipping.', P3: 'General inquiry or low urgency.' };
  const ja = { P0: '緊急またはエスカレーションのリスクあり。', P1: '返金・注文または重要問題。迅速な対応が必要。', P2: '一般的なアフターサポート・配送関連。', P3: '一般的なお問い合わせ。' };
  const m = lang === 'ja' ? ja : lang === 'zh' ? zh : en;
  return m[level] || m.P2;
}

// Mock priority when no LLM (4 levels: P0-P3)
function mockPriority(body) {
  const text = ((body.subject || '') + ' ' + (body.description || '')).toLowerCase();
  const lang = body.lang || 'zh';
  if (/urgent|asap|legal|lawsuit|angry|battery|overheat|a-to-z|defective|danger/.test(text)) return { priority: 'P0', reason: mockReasonByLang('P0', lang) };
  if (/refund|chargeback|not received|missing order|not working|broken/.test(text)) return { priority: 'P1', reason: mockReasonByLang('P1', lang) };
  if (/return|shipping|delay|where is my order/.test(text)) return { priority: 'P2', reason: mockReasonByLang('P2', lang) };
  return { priority: 'P3', reason: mockReasonByLang('P3', lang) };
}

// Mock reply when no LLM
function mockReply(body) {
  const doc = loadProductDocs();
  const tone = doc.tone || 'Professional and friendly.';
  return (
    'Thank you for reaching out.\n\n' +
    'We understand your concern and would like to help. ' +
    'Could you please provide your order ID so we can look into this for you?\n\n' +
    'Best regards,\nSupport Team'
  );
}

const REASON_LANG_MAP = { zh: '中文', en: 'English', ja: '日本語' };
const DEFAULT_PRIORITY_INSTRUCTION = 'Use 4 levels: P0 = legal/very urgent/escalation; P1 = refund/defective/strong complaint; P2 = return/shipping/order query; P3 = general question.';

/** 粗略判断文本是否主要为英文（用于语言兜底） */
function isMostlyEnglish(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.replace(/\s/g, '');
  if (t.length < 2) return false;
  const asciiLetters = (t.match(/[A-Za-z]/g) || []).length;
  return asciiLetters / t.length > 0.5;
}

/** 粗略判断文本是否以中文/日文为主（CJK 字符占相当比例则视为已是目标语言，不再翻译） */
function isMostlyCJK(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.replace(/\s/g, '');
  if (t.length < 1) return false;
  const cjk = (t.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  return cjk / t.length >= 0.25;
}

// Optional: call OpenAI for real priority
async function evaluatePriorityWithLLM(body) {
  const { apiKey, model, baseURL } = getOpenAIConfig();
  if (!apiKey) return mockPriority(body);
  const reasonLang = REASON_LANG_MAP[body.lang || 'zh'] || '中文';
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey, ...(baseURL && { baseURL }) });
    const prompts = loadPrompts();
    const p = prompts.priority;
    const instruction = p.instruction || DEFAULT_PRIORITY_INSTRUCTION;
    let prompt;
    if (p.template) {
      prompt = applyTemplate(p.template, {
        subject: body.subject || '',
        description: body.description || '',
        requesterEmail: body.requesterEmail || '',
        tags: (body.tags || []).join(', '),
        reasonLang,
        instruction
      });
    } else {
      prompt = `你是工单调度员。仅输出一个 JSON，包含 "priority"（P0/P1/P2/P3 之一）和 "reason"。
reason 必须且仅用以下语言书写：${reasonLang}。不要跟随工单内容语言（例如工单是英文但 reasonLang 为中文时，reason 用中文写）。

工单主题：${body.subject || ''}
工单描述：${body.description || ''}
客户邮箱：${body.requesterEmail || ''}
标签：${(body.tags || []).join(', ')}

${instruction}`;
    }
    const res = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    });
    const text = res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
    if (text) {
      const parsed = JSON.parse(text.replace(/[\s\S]*?(\{[\s\S]*\})[\s\S]*/, '$1'));
      const p = (parsed.priority || 'P2').toString().toUpperCase();
      const valid = ['P0', 'P1', 'P2', 'P3'];
      let reason = (parsed.reason || '').trim();
      // 语言兜底：要求中文时，只要输出不是以中文为主就强制翻译成中文
      if (body.lang === 'zh' && reason && !isMostlyCJK(reason)) {
        try {
          const tr = await translateWithLLM({ text: reason, targetLang: 'zh' });
          if (tr && tr.translation) reason = tr.translation.trim();
        } catch (e) { /* 翻译失败则保留原文 */ }
      }
      return { priority: valid.includes(p) ? p : 'P2', reason };
    }
  } catch (e) {
    console.warn('LLM priority error:', e.message);
  }
  return mockPriority(body);
}

// Reply language and tone from sidebar settings
function getReplyLanguageInstruction(replyLanguage) {
  const map = { en: 'Reply in English.', zh: 'Reply in Simplified Chinese (中文).', ja: 'Reply in Japanese (日本語).' };
  return map[replyLanguage] || map.en;
}

function getToneInstruction(tone) {
  const map = {
    professional: 'Professional and concise.',
    friendly: 'Friendly and warm.',
    formal: 'Formal and polite.',
    casual: 'Casual but still helpful.'
  };
  return map[tone] || map.professional;
}

const DEFAULT_REPLY_INSTRUCTION = 'Use the following product/FAQ context when relevant. Do NOT mention that you are an AI. Write only the reply body (no subject, no meta). Keep it concise (2-4 short paragraphs).';

// Optional: call OpenAI for real reply
async function suggestReplyWithLLM(body) {
  const { apiKey, model, baseURL } = getOpenAIConfig();
  if (!apiKey) return mockReply(body);
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey, ...(baseURL && { baseURL }) });
    const doc = loadProductDocs();
    let context = (doc.faqs || []).map(f => `[${f.topic}] ${f.content}`).join('\n');
    let deviceStatusText = '';
    const ticketContext = {
      device_sn: body.device_sn,
      battery: body.battery,
      firmware_version: body.firmware_version,
      ai_minutes_balance: body.ai_minutes_balance
    };
    const ragQuery = ((body.subject || '') + ' ' + (body.description || '') + ' ' + (body.conversationHistory || '')).trim().substring(0, 1500);
    const rag = await fetchRagContext(ragQuery, ticketContext);
    if (rag) {
      if (rag.faq_chunks && rag.faq_chunks.length) context += '\n\n[RAG FAQ]\n' + rag.faq_chunks.join('\n---\n');
      if (rag.history_cases && rag.history_cases.length) context += '\n\n[RAG 历史案例]\n' + rag.history_cases.join('\n---\n');
      if (rag.device_status && typeof rag.device_status === 'object') {
        const ds = rag.device_status;
        deviceStatusText = [ds.device_sn && `SN: ${ds.device_sn}`, ds.battery && `电量: ${ds.battery}`, ds.firmware_version && `固件: ${ds.firmware_version}`, ds.ai_minutes_balance !== undefined && ds.ai_minutes_balance !== '' && `AI 余额: ${ds.ai_minutes_balance}`].filter(Boolean).join('; ') || '无';
      }
    }
    if (!deviceStatusText && (body.device_sn || body.ai_minutes_balance !== undefined)) {
      deviceStatusText = [body.device_sn && `SN: ${body.device_sn}`, body.battery && `电量: ${body.battery}`, body.firmware_version && `固件: ${body.firmware_version}`, body.ai_minutes_balance !== undefined && `AI 余额: ${body.ai_minutes_balance}`].filter(Boolean).join('; ') || '无';
    }
    if (!deviceStatusText) deviceStatusText = '（未提供）';
    const prompts = loadPrompts();
    const customInstr = (body.customInstruction || '').trim();
    // 建议回复必须使用用户原始语言；未传则用客服偏好语言
    const replyLang = body.customerLanguage || body.replyLanguage || 'en';
    const langInstr = getReplyLanguageInstruction(replyLang);
    const toneInstr = getToneInstruction(body.tone || 'professional');
    const agentInstruction = customInstr
      ? `Reply in the customer's language (use same language as the customer). ${customInstr}`
      : `${langInstr} Tone: ${toneInstr}. You must reply in the same language as the customer's messages.`;
    const r = prompts.reply;
    const instruction = r.instruction || DEFAULT_REPLY_INSTRUCTION;
    const maxConv = getMaxConversationChars();
    const conversationHistory = truncateConversationTail(
      body.conversationHistory || 'No previous messages.',
      maxConv || 1e6
    );
    let prompt;
    if (r.template) {
      prompt = applyTemplate(r.template, {
        agentInstruction,
        instruction,
        context,
        deviceStatus: deviceStatusText,
        subject: body.subject || '',
        description: body.description || '',
        requesterName: body.requesterName || '',
        tags: (body.tags || []).join(', ') || '（无）',
        conversationHistory
      });
    } else {
      prompt = `You are a customer support agent. ${agentInstruction}. ${instruction}

Product/FAQ context:
${context}

Ticket subject: ${body.subject || ''}
Ticket description: ${body.description || ''}
Requester: ${body.requesterName || ''}

Conversation history (if any):
${conversationHistory}`;
    }
    const res = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5
    });
    const text = res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
    if (text) return { reply: text.trim() };
  } catch (e) {
    console.warn('LLM reply error:', e.message);
  }
  return { reply: mockReply(body) };
}

app.post('/evaluate-priority', async (req, res) => {
  try {
    const result = await evaluatePriorityWithLLM(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ priority: 'P2', reason: '评估失败。' });
  }
});

app.post('/suggest-reply', async (req, res) => {
  try {
    const result = await suggestReplyWithLLM(req.body);
    res.json(result);
  } catch (e) {
    console.error('suggest-reply error:', e.message || e);
    // 返回 200 + 备用回复，避免前端只看到“无反应”；前端可根据 fallback 提示
    res.status(200).json({ reply: mockReply(req.body), fallback: true });
  }
});

const TARGET_LANG_MAP = { zh: 'Simplified Chinese (中文)', en: 'English', ja: 'Japanese (日本語)' };

function mockTranslate(body) {
  const text = (body.text || '').trim();
  if (!text) return { translation: '' };
  const lang = body.targetLang || 'zh';
  // 不返回 [语言名] 前缀，与 LLM 返回格式一致
  return { translation: text.substring(0, 200) + (text.length > 200 ? '...' : '') };
}

const DEFAULT_TRANSLATE_INSTRUCTION = '仅输出译文，不要解释。';

async function translateWithLLM(body) {
  const { apiKey, model, baseURL } = getOpenAIConfig();
  if (!apiKey) return mockTranslate(body);
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey, ...(baseURL && { baseURL }) });
    const text = (body.text || '').trim();
    if (!text) return { translation: '' };
    const target = TARGET_LANG_MAP[body.targetLang || 'zh'] || 'Simplified Chinese';
    const prompts = loadPrompts();
    const t = prompts.translate;
    let instruction = t.instruction || DEFAULT_TRANSLATE_INSTRUCTION;
    if (body.targetLang === 'zh') instruction += '\n【必须】你的回复必须全部是简体中文，不得输出英文或其他语言。';
    let content;
    if (t.template) {
      content = applyTemplate(t.template, { target, instruction, text });
    } else {
      content = 'Translate the following text to ' + target + '. ' + instruction + '\n\n' + text;
    }
    const res = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content }],
      temperature: 0.2
    });
    const out = res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
    if (out) {
      let translation = out.trim();
      // 去掉 LLM 可能返回的 [语言名] 前缀，避免界面显示「默认中文」
      translation = translation.replace(/^\[[^\]]+\]\s*/, '');
      // 语言兜底：要求中文时若结果仍不是以中文为主，把当前结果当「待译英文」再翻一次
      if (body.targetLang === 'zh' && translation && !isMostlyCJK(translation)) {
        try {
          const retry = await translateWithLLM({ text: translation, targetLang: 'zh' });
          if (retry && retry.translation && isMostlyCJK(retry.translation))
            translation = retry.translation.trim();
          else {
            console.warn('Translate zh fallback still not Chinese:', (retry && retry.translation) ? retry.translation.substring(0, 80) : 'no retry');
            translation = '（原文为英文，自动翻译暂不可用，请稍后重试）';
          }
        } catch (e) {
          translation = '（原文为英文，自动翻译暂不可用，请稍后重试）';
        }
      }
      return { translation };
    }
  } catch (e) {
    console.warn('Translate error:', e.message);
  }
  return mockTranslate(body);
}

app.post('/translate', async (req, res) => {
  try {
    const result = await translateWithLLM(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ translation: (req.body.text || '').substring(0, 300) });
  }
});

function mockSummarize(body) {
  const raw = ((body.subject || '') + ' ' + (body.description || '')).trim();
  if (!raw) return { summary: '', replyPoints: '' };
  return {
    summary: raw.substring(0, 120) + (raw.length > 120 ? '…' : ''),
    replyPoints: 'Address customer request; ask for order ID if needed; mention return/refund policy if relevant.'
  };
}

const DEFAULT_SUMMARY_INSTRUCTION = "summary = key points of the ticket (what the customer said, main issue); replyPoints = key points for the agent's reply (what to address, policy to mention, tone or actions). Use bullet or short lines.";

async function summarizeWithLLM(body) {
  const { apiKey, model, baseURL } = getOpenAIConfig();
  if (!apiKey) return mockSummarize(body);
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey, ...(baseURL && { baseURL }) });
    const lang = TARGET_LANG_MAP[body.lang || 'zh'] || 'Simplified Chinese';
    const maxConv = getMaxConversationChars();
    const convPart = body.conversationHistory
      ? '\n\nConversation:\n' + truncateConversationTail(body.conversationHistory, maxConv || 1e6)
      : '';
    const content = (body.subject || '') + '\n\n' + (body.description || '') + convPart;
    if (!content.trim()) return { summary: '', replyPoints: '' };
    const prompts = loadPrompts();
    const s = prompts.summary;
    const instruction = s.instruction || DEFAULT_SUMMARY_INSTRUCTION;
    let promptContent;
    if (s.template) {
      promptContent = applyTemplate(s.template, { lang, content, instruction });
    } else {
      promptContent = `Based on the full ticket below, output a JSON object with two keys (both in ${lang}):
1. "summary": key points of the ticket.
2. "replyPoints": key points for the agent's reply.

${instruction}
Output only the JSON, no other text.

Ticket:
${content}`;
    }
    const res = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: promptContent }],
      temperature: 0.2
    });
    const out = res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
    if (out) {
      const parsed = JSON.parse(out.replace(/[\s\S]*?(\{[\s\S]*\})[\s\S]*/, '$1'));
      let summary = (parsed.summary || '').trim();
      let replyPoints = (parsed.replyPoints || '').trim();
      // 语言兜底：要求中文时，只要输出不是以中文为主就强制翻译成中文
      if (body.lang === 'zh') {
        if (summary && !isMostlyCJK(summary)) {
          try {
            const tr = await translateWithLLM({ text: summary, targetLang: 'zh' });
            if (tr && tr.translation) summary = tr.translation.trim();
          } catch (e) { /* 保留原文 */ }
        }
        if (replyPoints && !isMostlyCJK(replyPoints)) {
          try {
            const tr = await translateWithLLM({ text: replyPoints, targetLang: 'zh' });
            if (tr && tr.translation) replyPoints = tr.translation.trim();
          } catch (e) { /* 保留原文 */ }
        }
      }
      return { summary, replyPoints };
    }
  } catch (e) {
    console.warn('Summarize error:', e.message);
  }
  return mockSummarize(body);
}

app.post('/summarize', async (req, res) => {
  try {
    const result = await summarizeWithLLM(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json(mockSummarize(req.body));
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  const { apiKey } = getOpenAIConfig();
  console.log('CS Agent backend running on http://localhost:' + PORT);
  console.log(apiKey ? 'Using OpenAI (key from env or config).' : 'No API key set; using mock responses. Set OPENAI_API_KEY or edit backend/config.default.json / config.json.');
});
