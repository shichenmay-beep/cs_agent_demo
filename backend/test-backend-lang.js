/**
 * 后端语言测试：用与前端相同的请求体调用接口，验证传 lang/targetLang=zh 时返回是否为中文。
 * 不依赖前端，可直接测本地或 Railway。
 *
 * 用法：
 *   node test-backend-lang.js                    # 默认 http://localhost:3000
 *   node test-backend-lang.js https://csagentdemo-production.up.railway.app
 *   BASE_URL=https://csagentdemo-production.up.railway.app node test-backend-lang.js
 */
const BASE_URL = (process.env.BASE_URL || process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');

const SAMPLE = {
  subject: 'New Comulytic Note Pro not usable / pairing error',
  description: `Attached you will find the error I get after opening an unopened/new Comulytic note pro I purchased last week. I was anxiously waiting for it to show up, and it did! The day before my big meeting, which is tomorrow. And the whole reason I bought it. I was so excited. I opened the box and tried to pair it to the app only to get the message shown in the picture attached stating it's not usable. And I have to reach out to your customer support to get it fixed. Something tells me I won't have one for my meeting tomorrow. Very interested in how we can make this right please.`,
  requesterEmail: 'Samstafford.88@gmail.com',
  tags: [],
  lastCustomerMsg: 'I was so excited. I opened the box and tried to pair it to the app only to get the message shown in the picture attached stating it\'s not usable.',
  conversationHistory: 'Customer: Attached you will find the error...\nAgent: Thank you for reaching out...\nCustomer: (marked reply as not helpful)'
};

function isMostlyCJK(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.replace(/\s/g, '');
  if (t.length < 1) return false;
  const cjk = (t.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  return cjk / t.length >= 0.25;
}

async function post(path, body) {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: res.ok, status: res.status, raw: text.substring(0, 200) };
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log('=== 后端语言测试 ===');
  console.log('BASE_URL:', BASE_URL);
  console.log('预期：传 lang/targetLang=zh 时，reason、translation、summary、replyPoints 均应为中文\n');

  // 1. 健康检查
  try {
    const health = await fetch(BASE_URL + '/health').then(r => r.json()).catch(() => null);
    if (!health || !health.ok) {
      console.log('⚠ /health 失败，请确认后端已启动或 BASE_URL 正确\n');
    } else {
      console.log('✓ /health OK, version:', health.version || '-');
    }
  } catch (e) {
    console.log('⚠ /health 请求异常:', e.message, '\n');
  }

  // 2. evaluate-priority（传 lang: 'zh'）
  console.log('--- 1. POST /evaluate-priority (lang=zh) ---');
  const priorityBody = {
    subject: SAMPLE.subject,
    description: SAMPLE.description,
    requesterEmail: SAMPLE.requesterEmail,
    tags: SAMPLE.tags,
    lang: 'zh'
  };
  console.log('请求 body.lang:', priorityBody.lang);
  const priorityRes = await post('/evaluate-priority', priorityBody);
  if (priorityRes.data) {
    const reason = priorityRes.data.reason || '';
    const cjk = isMostlyCJK(reason);
    console.log('响应 priority:', priorityRes.data.priority);
    console.log('响应 reason(前120字):', reason.substring(0, 120));
    console.log('reason 是否为中文:', cjk ? '✓ 是' : '✗ 否');
  } else {
    console.log('请求失败:', priorityRes.status, priorityRes.raw);
  }
  console.log('');

  // 3. translate（传 targetLang: 'zh'）
  console.log('--- 2. POST /translate (targetLang=zh) ---');
  const translateBody = {
    text: SAMPLE.lastCustomerMsg,
    targetLang: 'zh'
  };
  console.log('请求 targetLang:', translateBody.targetLang);
  const translateRes = await post('/translate', translateBody);
  if (translateRes.data) {
    const translation = translateRes.data.translation || '';
    const cjk = isMostlyCJK(translation);
    console.log('响应 translation(前120字):', translation.substring(0, 120));
    console.log('translation 是否为中文:', cjk ? '✓ 是' : '✗ 否');
  } else {
    console.log('请求失败:', translateRes.status, translateRes.raw);
  }
  console.log('');

  // 4. summarize（传 lang: 'zh'）
  console.log('--- 3. POST /summarize (lang=zh) ---');
  const summaryBody = {
    subject: SAMPLE.subject,
    description: SAMPLE.description,
    conversationHistory: SAMPLE.conversationHistory,
    lang: 'zh'
  };
  console.log('请求 body.lang:', summaryBody.lang);
  const summaryRes = await post('/summarize', summaryBody);
  if (summaryRes.data) {
    const summary = summaryRes.data.summary || '';
    const points = summaryRes.data.replyPoints || '';
    const summaryCjk = isMostlyCJK(summary);
    const pointsCjk = isMostlyCJK(points);
    console.log('响应 summary(前120字):', summary.substring(0, 120));
    console.log('summary 是否为中文:', summaryCjk ? '✓ 是' : '✗ 否');
    console.log('响应 replyPoints(前120字):', points.substring(0, 120));
    console.log('replyPoints 是否为中文:', pointsCjk ? '✓ 是' : '✗ 否');
  } else {
    console.log('请求失败:', summaryRes.status, summaryRes.raw);
  }

  console.log('\n=== 测试结束 ===');
}

main().catch(e => {
  console.error('脚本异常:', e);
  process.exit(1);
});
