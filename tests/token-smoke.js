/* ==================== Token 统计冒烟测试 ====================
 * 运行：node tests/token-smoke.js
 * 在 vm 沙箱中模拟浏览器环境加载 store.js → models.js → modelsync.js →
 * providers.js → token.js → api.js，验证：
 *   1) TokenStats.estimate / fmt / record / byProvider / grand / reset
 *   2) store.js 老数据 tokenStats 兜底与持久化
 *   3) API.chat 三种格式的流式/非流式 usage 捕获与自动记账（estimated 标记）
 *   4) OpenAI 流式请求体注入 stream_options.include_usage
 *   5) SSE 30s 无数据熔断（测试中将 CONFIG.SSE_WATCHDOG 调小）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------- 浏览器环境最小桩 ---------- */
const storage = {};
const localStorage = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: k => { delete storage[k]; }
};
const fetchCalls = [];
const sandbox = {
  console, localStorage,
  setTimeout, clearTimeout, setInterval, clearInterval,
  TextDecoder, TextEncoder, AbortController,
  fetch: (url, options) => { fetchCalls.push({ url, options }); return sandbox.__fetchImpl(url, options); },
  __fetchImpl: null
};
vm.createContext(sandbox);

['store.js', 'models.js', 'modelsync.js', 'providers.js', 'token.js', 'api.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), sandbox, { filename: f });
});
const { Store, TokenStats, API } = vm.runInContext('({ Store, TokenStats, API })', sandbox);

/* ---------- 断言工具 ---------- */
let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.error('  ✗ ' + label + '\n    期望: ' + e + '\n    实际: ' + a); }
}
function ok(cond, label) { eq(!!cond, true, label); }
function section(name) { console.log('\n[' + name + ']'); }

/* ---------- 假 SSE 响应 ---------- */
function sseResponse(chunks) {
  const enc = new TextEncoder();
  let i = 0;
  return Promise.resolve({
    ok: true,
    body: {
      getReader: () => ({
        read() {
          if (i < chunks.length) return Promise.resolve({ done: false, value: enc.encode(chunks[i++]) });
          return Promise.resolve({ done: true, value: undefined });
        },
        cancel() { i = chunks.length; return Promise.resolve(); }
      })
    }
  });
}
/* 只发首块后永久挂起的响应（用于熔断测试） */
function hangingResponse(firstChunk) {
  const enc = new TextEncoder();
  let pending = null, delivered = false, cancelled = false;
  return Promise.resolve({
    ok: true,
    body: {
      getReader: () => ({
        read() {
          if (cancelled) return Promise.resolve({ done: true, value: undefined });
          if (!delivered) { delivered = true; return Promise.resolve({ done: false, value: enc.encode(firstChunk) }); }
          return new Promise(resolve => { pending = resolve; });
        },
        cancel() {
          cancelled = true;
          if (pending) pending({ done: true, value: undefined });
          return Promise.resolve();
        }
      })
    }
  });
}

/* ---------- 记账间谍（验证 estimated 标记） ---------- */
const recCalls = [];
const origRecord = TokenStats.record;
TokenStats.record = (m, u) => { recCalls.push({ modelId: m, usage: Object.assign({}, u) }); origRecord(m, u); };

async function main() {
  section('estimate 估算');
  eq(TokenStats.estimate(''), 0, "estimate('') = 0");
  eq(TokenStats.estimate(null), 0, 'estimate(null) = 0');
  eq(TokenStats.estimate('你好世界'), 4, 'CJK 1 token/字');
  eq(TokenStats.estimate('abcd'), 1, 'ASCII ≈1 token/4 字符');
  eq(TokenStats.estimate('hello world'), 3, "estimate('hello world') = ceil(11/4) = 3");
  eq(TokenStats.estimate('你好ab'), 3, '中英混合向上取整');
  eq(TokenStats.estimate('€€'), 1, '其他 unicode ≈1 token/2 字符');
  eq(TokenStats.estimate('你好，世界！'), 6, '中文标点按 CJK 计');

  section('fmt 数字格式化');
  eq(TokenStats.fmt(0), '0', 'fmt(0)');
  eq(TokenStats.fmt(999), '999', 'fmt(999)');
  eq(TokenStats.fmt(1000), '1.0K', 'fmt(1000)');
  eq(TokenStats.fmt(12400), '12.4K', 'fmt(12400)');
  eq(TokenStats.fmt(1234567), '1.23M', 'fmt(1234567)');

  section('record / byProvider / grand / reset');
  origRecord.call(TokenStats, 'deepseek-chat', { prompt: 100, completion: 50, estimated: false });
  origRecord.call(TokenStats, 'deepseek-chat', { prompt: 20, completion: 10, estimated: true });
  origRecord.call(TokenStats, 'gemini-2.5-pro', { prompt: 7, completion: 3, estimated: false });
  origRecord.call(TokenStats, 'ghost-model-xyz', { prompt: 5, completion: 5, estimated: true });

  const b = Store.state.tokenStats.byModel['deepseek-chat'];
  eq([b.prompt, b.completion, b.count], [120, 60, 2], 'byModel 累加 prompt/completion/count');
  ok(b.firstTs > 0 && b.lastTs >= b.firstTs, 'firstTs 首写 / lastTs 更新');
  ok(Store.state.tokenStats.updatedAt > 0, 'updatedAt 已更新');

  const agg = TokenStats.byProvider();
  const ds = agg.find(p => p.provider === 'DeepSeek');
  const gg = agg.find(p => p.provider === 'Google');
  const other = agg.find(p => p.provider === '其他/已移除');
  ok(ds && ds.prompt === 120 && ds.completion === 60 && ds.total === 180 && ds.count === 2, 'byProvider 聚合 DeepSeek');
  ok(ds.models[0].id === 'deepseek-chat' && ds.models[0].name === 'DeepSeek Chat', '模型名取自目录');
  ok(gg && gg.total === 10, 'byProvider 聚合 Google');
  ok(other && other.total === 10 && other.models[0].name === 'ghost-model-xyz', '目录外模型归入「其他/已移除」，name 用 id');
  eq(TokenStats.grand(), { prompt: 132, completion: 68, total: 200, count: 4 }, 'grand 合计');

  Store.state.apiKeys.deepseek = 'keep-me';
  TokenStats.reset();
  eq(TokenStats.grand(), { prompt: 0, completion: 0, total: 0, count: 0 }, 'reset 后 grand 归零');
  eq(Store.state.tokenStats, { byModel: {}, updatedAt: 0 }, 'reset 清空 tokenStats');
  eq(Store.state.apiKeys.deepseek, 'keep-me', 'reset 不影响其他字段');
  recCalls.length = 0;

  section('store.js 老数据兜底 + 持久化');
  storage['ai_chat_state_v5'] = JSON.stringify({ apiKeys: { deepseek: 'k' }, chats: [] });
  Store.load();
  ok(Store.state.tokenStats && typeof Store.state.tokenStats.byModel === 'object', '老数据无 tokenStats → load() 补默认');
  origRecord.call(TokenStats, 'deepseek-chat', { prompt: 3, completion: 2, estimated: false });
  Store.save(true);
  const persisted = JSON.parse(storage['ai_chat_state_v5']);
  eq(persisted.tokenStats.byModel['deepseek-chat'].prompt, 3, 'tokenStats 随 Store.save 持久化');
  TokenStats.reset();

  section('API.chat 自动记账（配置测试 Key）');
  Store.state.apiKeys.deepseek = 'test-key';
  Store.state.apiKeys.anthropic = 'test-key';
  Store.state.apiKeys.google = 'test-key';
  const msgs = [{ role: 'user', content: '你好' }];

  // 1) OpenAI 流式：末尾 usage chunk（choices 为空）
  fetchCalls.length = 0;
  sandbox.__fetchImpl = () => sseResponse([
    'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\ndata: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"，世界"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":8,"total_tokens":20}}\n\ndata: [DONE]\n\n'
  ]);
  let r = await API.chat({ modelId: 'deepseek-chat', messages: msgs, onChunk: () => {} });
  eq(r.content, '你好，世界', '流式正文拼接');
  eq(r.usage, { prompt: 12, completion: 8 }, 'OpenAI 流式 usage 捕获（choices 为空 chunk）');
  eq(recCalls[0], { modelId: 'deepseek-chat', usage: { prompt: 12, completion: 8, estimated: false } }, '真实 usage 记账 estimated=false');
  eq((() => { const x = Store.state.tokenStats.byModel['deepseek-chat']; return { prompt: x.prompt, completion: x.completion, count: x.count }; })(), { prompt: 12, completion: 8, count: 1 }, 'byModel 已累加');
  eq(JSON.parse(fetchCalls[0].options.body).stream_options, { include_usage: true }, '流式请求体注入 stream_options.include_usage');
  recCalls.length = 0;

  // 2) OpenAI 流式：无 usage chunk → 估算记账 estimated=true
  sandbox.__fetchImpl = () => sseResponse(['data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n']);
  r = await API.chat({ modelId: 'deepseek-chat', messages: msgs, onChunk: () => {} });
  eq(r.usage, null, '无 usage chunk 时 usage=null');
  eq(recCalls[0].usage.estimated, true, '估算记账 estimated=true');
  ok(recCalls[0].usage.prompt > 0 && recCalls[0].usage.completion > 0, '估算 prompt/completion > 0');
  recCalls.length = 0;

  // 3) OpenAI 非流式：d.usage
  fetchCalls.length = 0;
  sandbox.__fetchImpl = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content: 'OK' } }], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } })
  });
  r = await API.chat({ modelId: 'deepseek-chat', messages: msgs });
  eq(r.usage, { prompt: 5, completion: 2 }, 'OpenAI 非流式 usage 捕获');
  eq(recCalls[0].usage, { prompt: 5, completion: 2, estimated: false }, '非流式记账 estimated=false');
  ok(!('stream_options' in JSON.parse(fetchCalls[0].options.body)), '非流式不带 stream_options');
  recCalls.length = 0;

  // 4) Anthropic 流式：message_start / message_delta
  sandbox.__fetchImpl = () => sseResponse([
    'data: {"type":"message_start","message":{"id":"m1","usage":{"input_tokens":25,"output_tokens":1}}}\n\n',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
    'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":7}}\n\n'
  ]);
  r = await API.chat({ modelId: 'claude-opus-4.6', messages: msgs, onChunk: () => {} });
  eq(r.content, 'Hello', 'Anthropic 流式正文');
  eq(r.usage, { prompt: 25, completion: 7 }, 'Anthropic message_start/message_delta usage 捕获');
  eq(recCalls[0].usage, { prompt: 25, completion: 7, estimated: false }, 'Anthropic 记账 estimated=false');
  recCalls.length = 0;

  // 5) Google 流式：usageMetadata
  sandbox.__fetchImpl = () => sseResponse([
    'data: {"candidates":[{"content":{"parts":[{"text":"Hi"}],"role":"model"}}]}\n\n',
    'data: {"candidates":[{"content":{"parts":[{"text":" there"}],"role":"model"}}],"usageMetadata":{"promptTokenCount":9,"candidatesTokenCount":3,"totalTokenCount":12}}\n\n'
  ]);
  r = await API.chat({ modelId: 'gemini-2.5-pro', messages: msgs, onChunk: () => {} });
  eq(r.content, 'Hi there', 'Google 流式正文');
  eq(r.usage, { prompt: 9, completion: 3 }, 'Google usageMetadata 捕获');
  eq(recCalls[0].usage, { prompt: 9, completion: 3, estimated: false }, 'Google 记账 estimated=false');
  recCalls.length = 0;

  // 6) SSE 熔断：首块后挂起 → 超时抛错，且不记账
  const savedWatchdog = API.CONFIG.SSE_WATCHDOG;
  API.CONFIG.SSE_WATCHDOG = 60;
  const before = Store.state.tokenStats.byModel['deepseek-chat'].count;
  sandbox.__fetchImpl = () => hangingResponse('data: {"choices":[{"delta":{"content":" partial"}}]}\n\n');
  let errMsg = null;
  try { await API.chat({ modelId: 'deepseek-chat', messages: msgs, onChunk: () => {} }); }
  catch (e) { errMsg = e.message; }
  API.CONFIG.SSE_WATCHDOG = savedWatchdog;
  eq(errMsg, '网络超时：30 秒未收到数据，请重试', '30s 无数据熔断抛错');
  eq(Store.state.tokenStats.byModel['deepseek-chat'].count, before, '超时失败不记账');

  /* ---------- 汇总 ---------- */
  console.log('\n========================================');
  console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('测试执行异常：', e); process.exit(1); });
