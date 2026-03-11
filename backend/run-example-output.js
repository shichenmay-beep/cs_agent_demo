/**
 * 用当前提示词和配置，对 Michael 解绑/恢复出厂工单调用大模型，输出实际结果。
 * 用法：cd backend && node run-example-output.js
 * 无额外依赖：仅用 Node 内置 fs + fetch，配置从 .env 或 config.json 读。
 */
const path = require('path');
const fs = require('fs');

// 手动读 .env（不依赖 dotenv）：backend/.env、cs_agent_demo/.env、项目根 .env 都读，后者覆盖
function loadEnv() {
  for (const envPath of [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env'), path.join(__dirname, '..', '..', '.env')]) {
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

const PROMPTS_PATH = path.join(__dirname, '..', 'product_docs', 'prompts.json');
const PROMPTS_FALLBACK = path.join(__dirname, 'prompts.json');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const TARGET_LANG_MAP = { zh: 'Simplified Chinese (中文)', en: 'English', ja: 'Japanese (日本語)' };
const REASON_LANG_MAP = { zh: '中文', en: 'English', ja: '日本語' };

function getConfig() {
  let apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || '';
  let baseURL = (process.env.OPENAI_API_BASE || '').trim();
  let model = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (!apiKey && c.OPENAI_API_KEY) apiKey = c.OPENAI_API_KEY;
      if (!apiKey && c.OPENROUTER_API_KEY) apiKey = c.OPENROUTER_API_KEY;
      if (!baseURL && c.OPENAI_API_BASE) baseURL = c.OPENAI_API_BASE;
      if (c.OPENAI_MODEL) model = c.OPENAI_MODEL;
    }
  } catch (e) {}
  if (!baseURL && (process.env.OPENROUTER_API_KEY || (apiKey && apiKey.startsWith('sk-or-'))))
    baseURL = 'https://openrouter.ai/api/v1';
  if (baseURL && baseURL.includes('openrouter') && model === 'gpt-4o-mini')
    model = 'google/gemini-2.0-flash-exp';
  return { apiKey: apiKey.trim(), baseURL: baseURL || undefined, model };
}

function loadPrompts() {
  const tryPath = fs.existsSync(PROMPTS_PATH) ? PROMPTS_PATH : PROMPTS_FALLBACK;
  try {
    const data = JSON.parse(fs.readFileSync(tryPath, 'utf8'));
    return {
      priority: data.priority || {},
      reply: data.reply || {},
      summary: data.summary || {},
      translate: data.translate || {}
    };
  } catch (e) {
    return { priority: {}, reply: {}, summary: {}, translate: {} };
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

/** 用 fetch 调 OpenAI 兼容 API（不依赖 openai 包） */
async function chat(apiKey, baseURL, model, content, temperature = 0.2) {
  const url = baseURL ? baseURL.replace(/\/$/, '') + '/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature
    })
  });
  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()));
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Michael 工单数据
const CUSTOMER_MSG = `Hi Comulytic Support,

I'm writing because I need help factory resetting and unbinding my Comulytic Note Pro so I can give it to a family member.

Here's what happened:

1. I set up a new Plaud Note Pro device on my phone
2. I deleted the Comulytic app before disconnecting/unbinding my Comulytic Note Pro from my account
3. I reinstalled the Comulytic app, but it no longer shows any devices connected
4. The Comulytic Note Pro itself is fully charged (100%) and powers on fine, but I cannot get it to factory reset
5. I've tried every combination of holding the button down (powered on, powered off, 12-second holds) and nothing works. It only starts/stops recording or the screen goes dark.
6. The device appears to still be bound to my account but I have no way to unbind it through the app since it doesn't recognize the device anymore

What I need:
- The device unbound/released from my account so it can be paired fresh with a new account
- Or instructions for a true factory reset that clears the device binding

Account email: mmarsalisjr@gmail.com

Please let me know what steps you can take on your end. I'd rather not wait for the battery to fully drain as a workaround.

Thank you,
Michael Marsalis`;

const AGENT_REPLY = `Hello,

Thank you for reaching out to us regarding your Comulytic Note Pro. If the app no longer recognizes your device and standard button combinations are not working for unbinding or factory resetting, please follow these steps:

1. Attempt to unbind the device through the app by going to 'Device Management,' selecting your device, and clicking 'Unbind Device.'
2. If this method is not possible due to the app not recognizing your device, please contact our customer service team at support-center@comulytic.ai. When reaching out, kindly provide your device's serial number (SN) so we can assist you with the unbinding or reset process.

We understand how frustrating this situation can be and apologize for any inconvenience. Our team is committed to helping you resolve this issue as quickly as possible.

Thank you for your patience and support.

Best regards,
Comulytic Agent`;

const CONVERSATION_HISTORY = `Customer: ${CUSTOMER_MSG}
---
Agent: ${AGENT_REPLY}`;

async function main() {
  const { apiKey, baseURL, model } = getConfig();
  if (!apiKey) {
    console.error('No OPENAI_API_KEY in .env or config.json. Exiting.');
    process.exit(1);
  }
  const prompts = loadPrompts();

  console.log('========== 1. 优先级 evaluate-priority ==========\n');
  const reasonLang = REASON_LANG_MAP['zh'];
  const priorityPrompt = applyTemplate(prompts.priority.template || '', {
    subject: 'Help factory resetting and unbinding Comulytic Note Pro',
    description: CUSTOMER_MSG,
    requesterEmail: 'mmarsalisjr@gmail.com',
    tags: '',
    reasonLang,
    instruction: prompts.priority.instruction || ''
  });
  if (!priorityPrompt) {
    console.log('(no template, skip)\n');
  } else {
    try {
      const text = await chat(apiKey, baseURL, model, priorityPrompt, 0.2);
      const parsed = text.match(/\{[\s\S]*\}/) ? JSON.parse(text.replace(/[\s\S]*?(\{[\s\S]*\})[\s\S]*/, '$1')) : {};
      console.log('priority:', parsed.priority || '(parse fail)');
      console.log('reason:', parsed.reason || '');
      console.log('');
    } catch (e) {
      console.log('Error:', e.message, '\n');
    }
  }

  console.log('========== 2. 翻译 translate (英文→中文) ==========\n');
  const target = TARGET_LANG_MAP['zh'];
  const translatePrompt = applyTemplate(prompts.translate.template || '', {
    target,
    instruction: prompts.translate.instruction || 'Output only the translation.',
    text: CUSTOMER_MSG.substring(0, 800)
  });
  if (translatePrompt) {
    try {
      const out = (await chat(apiKey, baseURL, model, translatePrompt, 0.2)).trim().replace(/^\[[^\]]+\]\s*/, '');
      console.log(out.substring(0, 800) + (out.length > 800 ? '...' : ''));
      console.log('\n');
    } catch (e) {
      console.log('Error:', e.message, '\n');
    }
  }

  console.log('========== 3. 工单总结 + 回复要点 summarize (中文) ==========\n');
  const lang = TARGET_LANG_MAP['zh'];
  const content = `Help factory resetting and unbinding Comulytic Note Pro\n\n${CUSTOMER_MSG}\n\nConversation:\n${CONVERSATION_HISTORY}`;
  const summaryPrompt = applyTemplate(prompts.summary.template || '', {
    lang,
    content,
    instruction: prompts.summary.instruction || ''
  });
  if (summaryPrompt) {
    try {
      const text = await chat(apiKey, baseURL, model, summaryPrompt, 0.2);
      const parsed = text.match(/\{[\s\S]*\}/) ? JSON.parse(text.replace(/[\s\S]*?(\{[\s\S]*\})[\s\S]*/, '$1')) : {};
      console.log('工单总结 summary:\n', parsed.summary || '(parse fail)');
      console.log('\n回复要点 replyPoints:\n', parsed.replyPoints || '');
      console.log('\n');
    } catch (e) {
      console.log('Error:', e.message, '\n');
    }
  }

  console.log('========== 4. 建议回复 suggest-reply (英文，综合全文) ==========\n');
  const docPath = path.join(__dirname, '..', 'product_docs', 'faq.json');
  let context = '';
  try {
    const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));
    context = (doc.faqs || []).map(f => `[${f.topic}] ${f.content}`).join('\n');
  } catch (e) {}
  const agentInstruction = `Reply in the customer's language (use same language as the customer). Tone: Professional and concise. You must reply in the same language as the customer's messages.`;
  const replyPrompt = applyTemplate(prompts.reply.template || '', {
    agentInstruction,
    instruction: prompts.reply.instruction || '',
    context: context || '(无)',
    deviceStatus: '（未提供）',
    subject: 'Help factory resetting and unbinding Comulytic Note Pro',
    description: CUSTOMER_MSG,
    requesterName: 'Michael Marsalis',
    tags: '',
    conversationHistory: CONVERSATION_HISTORY
  });
  if (replyPrompt) {
    try {
      const reply = (await chat(apiKey, baseURL, model, replyPrompt, 0.5)).trim();
      console.log(reply);
      console.log('\n');
    } catch (e) {
      console.log('Error:', e.message, '\n');
    }
  }

  console.log('========== 完成 ==========');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
