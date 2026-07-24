/* ==================== PROVIDERS · 厂商配置（API / 官方图标 / 区域） ==================== */

/* 图标 CDN（国内优先 npmmirror，失败自动回退 unpkg / simpleicons） */
const LOBE_CDN_PRIMARY = 'https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light/';
const LOBE_CDN_FALLBACK = 'https://unpkg.com/@lobehub/icons-static-png@latest/light/';
const SIMPLE_ICONS_CDN = 'https://cdn.simpleicons.org/';

/*
 * 厂商配置说明
 * format: openai | anthropic | google （请求格式适配）
 * keySlug: 该厂商 API Key 在 store.apiKeys 中对应的字段
 * icon: { lobe: 'slug', color: bool, simple: 'slug' } 官方品牌图标
 * imageModel: 支持 AI 绘画时的绘图模型（OpenAI 兼容 /v1/images/generations）
 * keyHint: Key 获取地址提示
 */
const MIMO_PLANS = {
  tokenPlan: { name: '会员计划', base: 'https://token-plan-cn.xiaomimimo.com' },
  payAsYouGo: { name: '按量付费', base: 'https://api.xiaomimimo.com' }
};

const PROVIDERS = {
  '小米 MiMo': {
    format: 'openai', region: 'cn', keySlug: 'mimo',
    base: () => MIMO_PLANS[(Store.state.apiKeys.mimoPlan || 'tokenPlan')].base,
    headers: k => ({ 'Content-Type': 'application/json', 'api-key': k }),
    transform: (b, m) => { if (m.thinking) b.enable_thinking = true; return b; },
    icon: { lobe: null, color: false, simple: 'xiaomi' }, color: '#FF6900',
    dualKey: true, // 双 Key（会员计划 / 按量付费）
    keyHint: '小米 MiMo 开放平台'
  },
  'OpenAI': {
    format: 'openai', region: 'global', keySlug: 'openai',
    base: () => 'https://api.openai.com',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'openai', color: false, simple: 'openai' }, color: '#10A37F',
    imageModel: 'dall-e-3', keyHint: 'platform.openai.com'
  },
  'Anthropic': {
    format: 'anthropic', region: 'global', keySlug: 'anthropic',
    base: () => 'https://api.anthropic.com',
    headers: k => ({ 'Content-Type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }),
    icon: { lobe: 'anthropic', color: false, simple: 'anthropic' }, color: '#D97757',
    keyHint: 'console.anthropic.com'
  },
  'Google': {
    format: 'google', region: 'global', keySlug: 'google',
    base: () => 'https://generativelanguage.googleapis.com',
    headers: () => ({ 'Content-Type': 'application/json' }),
    icon: { lobe: 'gemini-color', color: true, simple: 'googlegemini' }, color: '#4285F4',
    keyHint: 'aistudio.google.com'
  },
  'DeepSeek': {
    format: 'openai', region: 'cn', keySlug: 'deepseek',
    base: () => 'https://api.deepseek.com',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    transform: (b, m) => { if (m.thinking) b.enable_thinking = true; return b; },
    icon: { lobe: 'deepseek-color', color: true, simple: 'deepseek' }, color: '#0066FF',
    keyHint: 'platform.deepseek.com'
  },
  'Kimi': {
    format: 'openai', region: 'cn', keySlug: 'kimi',
    base: () => 'https://api.moonshot.cn',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    transform: (b, m) => { if (m.thinking) b.enable_thinking = true; return b; },
    icon: { lobe: 'kimi-color', color: true, simple: 'moonshot' }, color: '#6236FF',
    keyHint: 'platform.moonshot.cn'
  },
  '通义千问': {
    format: 'openai', region: 'cn', keySlug: 'qwen',
    base: () => 'https://dashscope.aliyuncs.com/compatible-mode',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'qwen-color', color: true, simple: 'alibabadotcom' }, color: '#FF6A00',
    imageModel: 'wanx2.1-t2i-turbo', keyHint: 'bailian.console.aliyun.com'
  },
  '智谱AI': {
    format: 'openai', region: 'cn', keySlug: 'glm',
    base: () => 'https://open.bigmodel.cn/api/paas',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'chatglm-color', color: true, simple: 'zhipu' }, color: '#2B5CE6',
    keyHint: 'open.bigmodel.cn'
  },
  '文心一言': {
    format: 'openai', region: 'cn', keySlug: 'ernie',
    base: () => 'https://aip.baidubce.com',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'wenxin-color', color: true, simple: 'baidu' }, color: '#2319DC',
    keyHint: 'qianfan.cloud.baidu.com'
  },
  '腾讯混元': {
    format: 'openai', region: 'cn', keySlug: 'hunyuan',
    base: () => 'https://api.hunyuan.cloud.tencent.com',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'hunyuan-color', color: true, simple: 'tencentqq' }, color: '#07C160',
    keyHint: 'cloud.tencent.com'
  },
  'MiniMax': {
    format: 'openai', region: 'cn', keySlug: 'minimax',
    base: () => 'https://api.minimax.chat',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'minimax-color', color: true, simple: null }, color: '#000000',
    keyHint: 'platform.minimaxi.com'
  },
  '火山引擎': {
    format: 'openai', region: 'cn', keySlug: 'doubao',
    base: () => 'https://ark.cn-beijing.volces.com/api',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'doubao-color', color: true, simple: 'bytedance' }, color: '#3B7DF0',
    imageModel: 'doubao-seedream-3-0-t2i-250415', keyHint: 'console.volcengine.com'
  },
  '零一万物': {
    format: 'openai', region: 'cn', keySlug: 'yi',
    base: () => 'https://api.lingyiwanwu.com',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'yi', color: false, simple: null }, color: '#000000',
    keyHint: 'platform.lingyiwanwu.com'
  },
  '阶跃星辰': {
    format: 'openai', region: 'cn', keySlug: 'stepfun',
    base: () => 'https://api.stepfun.com',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'stepfun-color', color: true, simple: null }, color: '#4F46E5',
    keyHint: 'platform.stepfun.com'
  },
  '百川智能': {
    format: 'openai', region: 'cn', keySlug: 'baichuan',
    base: () => 'https://api.baichuan-ai.com',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'baichuan-color', color: true, simple: null }, color: '#2B5CE6',
    keyHint: 'platform.baichuan-ai.com'
  },
  '讯飞星火': {
    format: 'openai', region: 'cn', keySlug: 'spark',
    base: () => 'https://spark-api-open.xf-yun.com',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'spark-color', color: true, simple: 'iflytek' }, color: '#2B5CE6',
    keyHint: 'xinghuo.xfyun.cn'
  },
  '昆仑万维': {
    format: 'openai', region: 'cn', keySlug: 'kunlun',
    base: () => 'https://api.skywork.ai',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: null, color: false, simple: null }, color: '#6D28D9',
    keyHint: 'platform.skywork.ai'
  },
  '商汤': {
    format: 'openai', region: 'cn', keySlug: 'sensetime',
    base: () => 'https://api.sensenova.cn',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: null, color: false, simple: 'sensetime' }, color: '#0052CC',
    keyHint: 'platform.sensenova.cn'
  },
  'Mistral': {
    format: 'openai', region: 'global', keySlug: 'mistral',
    base: () => 'https://api.mistral.ai',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'mistral-color', color: true, simple: 'mistral' }, color: '#FF7000',
    keyHint: 'console.mistral.ai'
  },
  'Meta': {
    format: 'openai', region: 'global', keySlug: 'meta',
    base: () => 'https://api.llama.com',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'meta-color', color: true, simple: 'meta' }, color: '#0668E1',
    keyHint: 'llama.developer.meta.com'
  },
  'Cohere': {
    format: 'openai', region: 'global', keySlug: 'cohere',
    base: () => 'https://api.cohere.com/compatibility',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'cohere', color: false, simple: 'cohere' }, color: '#39594D',
    keyHint: 'dashboard.cohere.com'
  },
  'xAI': {
    format: 'openai', region: 'global', keySlug: 'xai',
    base: () => 'https://api.x.ai',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'xai', color: false, simple: 'x' }, color: '#333333',
    keyHint: 'console.x.ai'
  },
  'Groq': {
    format: 'openai', region: 'global', keySlug: 'groq',
    base: () => 'https://api.groq.com/openai',
    headers: k => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + k }),
    icon: { lobe: 'groq', color: false, simple: 'groq' }, color: '#F55036',
    keyHint: 'console.groq.com'
  }
};

/* 官方品牌图标：lobe 彩色/单色 → lobe 备用 CDN → simpleicons → 首字母 */
function providerIconHtml(provider, size, rounded) {
  size = size || 20;
  const cfg = PROVIDERS[provider];
  const color = (cfg && cfg.color) || '#6B7280';
  const letter = (provider || '?').trim().charAt(0);
  const fontSize = Math.round(size * 0.5);
  let urls = [];
  if (cfg && cfg.icon) {
    if (cfg.icon.lobe) {
      urls.push(LOBE_CDN_PRIMARY + cfg.icon.lobe + '.png');
      urls.push(LOBE_CDN_FALLBACK + cfg.icon.lobe + '.png');
    }
    if (cfg.icon.simple) urls.push(SIMPLE_ICONS_CDN + cfg.icon.simple);
  }
  const r = rounded === false ? '' : 'border-radius:' + Math.round(size * 0.28) + 'px;';
  let html = '<span class="brand-icon" style="width:' + size + 'px;height:' + size + 'px;' + r + 'background:' + color + '">';
  if (urls.length) {
    html += '<img src="' + urls[0] + '" data-fallback="' + encodeURIComponent(urls.slice(1).join('|')) + '" onload="brandIconLoaded(this)" onerror="brandIconFallback(this)" loading="lazy" alt="">';
  }
  html += '<span class="brand-letter" style="font-size:' + fontSize + 'px">' + letter + '</span></span>';
  return html;
}

/* 图片加载成功 → 隐藏首字母兜底层，避免双层重叠 */
function brandIconLoaded(img) {
  const box = img.closest('.brand-icon');
  if (box) box.classList.add('loaded');
}

function brandIconFallback(img) {
  const rest = decodeURIComponent(img.dataset.fallback || '').split('|').filter(Boolean);
  if (rest.length) {
    img.dataset.fallback = encodeURIComponent(rest.slice(1).join('|'));
    img.src = rest[0];
  } else {
    img.style.display = 'none';
  }
}

/* 目录访问统一走 ModelCatalog（嵌入式 MODELS + 同步合并层） */
function getProvidersInOrder() { return ModelCatalog.providers(); }

function getProviderModels(provider) { return ModelCatalog.byProvider(provider); }

function getModel(id) { return ModelCatalog.get(id); }

/* 对话类模型（tts/asr/voiceclone/voicedesign 等为专用模型，不可对话） */
function isChatModel(m) { return m && (m.type || 'chat') === 'chat'; }

/* 可被选择对话的模型：对话类、未下架，且非内测/审核资格（需资格无法直接调用的不列入选择器） */
function isSelectableModel(m) {
  return isChatModel(m) && m.status !== 'deprecated' &&
    !(m.note && (m.note.indexOf('内测') >= 0 || m.note.indexOf('审核') >= 0));
}

/* 厂商内置联网搜索（服务端执行，无需客户端回环） */
const NATIVE_SEARCH_PROVIDERS = ['通义千问', '智谱AI', 'Google', 'xAI'];
function hasNativeSearch(m) { return !!m && NATIVE_SEARCH_PROVIDERS.indexOf(m.provider) >= 0; }

function getKeyForModel(model) {
  const k = Store.state.apiKeys;
  const cfg = PROVIDERS[model.provider];
  if (!cfg) return k.general || '';
  if (cfg.dualKey) {
    const plan = k.mimoPlan || 'tokenPlan';
    // 当前方案无 Key 时回退到另一方案的 Key
    const primary = plan === 'tokenPlan' ? k.mimoTokenPlan : k.mimoPayAsYouGo;
    const fallback = plan === 'tokenPlan' ? k.mimoPayAsYouGo : k.mimoTokenPlan;
    return primary || fallback || k.general || '';
  }
  return k[cfg.keySlug] || k.general || '';
}

/* 应用信息（更新日志数据在 js/changelog.js，添加式维护） */
const APP_VERSION = '4.2';

const MODE_META = {
  single: { icon: 'message', label: '单模型', desc: '与单个 AI 对话' },
  multi: { icon: 'grid', label: '多模型', desc: '多个 AI 同时回答' },
  debate: { icon: 'sword', label: '辩论模式', desc: '立论 · 攻辩 · 总结' },
  collab: { icon: 'handshake', label: '协同合作', desc: '多 AI 协作完成任务' }
};
