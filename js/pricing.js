/* ==================== PRICING · 各厂商模型定价数据 ====================
 * 价格单位：美元/百万Tokens（$ / 1M tokens）
 * 字段说明：
 *   input: 标准输入价格
 *   output: 标准输出价格
 *   cacheHit: 缓存命中输入价格（支持缓存的厂商）
 *   cacheMiss: 缓存未命中输入价格（支持缓存的厂商）
 *   currency: 计价货币（usd/cny）
 *   note: 特殊说明
 * 
 * 数据来源：各厂商官方API文档（2026-07）
 * 缓存机制：Anthropic/DeepSeek/OpenAI/Google 支持Prompt Cache
 */

const MODEL_PRICING = {
  // OpenAI
  'gpt-5.5': { input: 5.00, output: 30.00, cacheHit: 0.50, cacheMiss: 5.00, currency: 'usd', note: '>272K tokens 价格翻倍' },
  'gpt-5.5-pro': { input: 30.00, output: 180.00, currency: 'usd', note: 'Pro版本无缓存' },
  'gpt-5.4': { input: 2.50, output: 15.00, cacheHit: 0.25, cacheMiss: 2.50, currency: 'usd', note: '>272K tokens 价格翻倍' },
  'gpt-5.4-pro': { input: 30.00, output: 180.00, currency: 'usd', note: 'Pro版本无缓存' },
  'gpt-5.4-nano': { input: 0.20, output: 1.25, cacheHit: 0.02, cacheMiss: 0.20, currency: 'usd' },
  'gpt-5.4-mini': { input: 0.75, output: 4.50, cacheHit: 0.075, cacheMiss: 0.75, currency: 'usd' },
  'gpt-5.2': { input: 1.75, output: 14.00, cacheHit: 0.175, cacheMiss: 1.75, currency: 'usd' },
  'gpt-5.2-pro': { input: 21.00, output: 168.00, currency: 'usd', note: 'Pro版本无缓存' },
  'gpt-5.1': { input: 1.25, output: 10.00, cacheHit: 0.125, cacheMiss: 1.25, currency: 'usd' },
  'gpt-5.1-pro': { input: 15.00, output: 120.00, currency: 'usd', note: 'Pro版本无缓存' },
  'gpt-5': { input: 1.25, output: 10.00, cacheHit: 0.125, cacheMiss: 1.25, currency: 'usd' },
  'gpt-5-mini': { input: 0.25, output: 2.00, cacheHit: 0.025, cacheMiss: 0.25, currency: 'usd' },
  'gpt-5-nano': { input: 0.05, output: 0.40, cacheHit: 0.005, cacheMiss: 0.05, currency: 'usd' },
  'gpt-4o': { input: 2.50, output: 10.00, cacheHit: 1.25, cacheMiss: 2.50, currency: 'usd' },
  'gpt-4o-mini': { input: 0.15, output: 0.60, cacheHit: 0.075, cacheMiss: 0.15, currency: 'usd' },
  'gpt-4.1': { input: 2.00, output: 8.00, cacheHit: 0.50, cacheMiss: 2.00, currency: 'usd' },
  'gpt-4.1-mini': { input: 0.40, output: 1.60, cacheHit: 0.10, cacheMiss: 0.40, currency: 'usd' },
  'gpt-4.1-nano': { input: 0.10, output: 0.40, cacheHit: 0.025, cacheMiss: 0.10, currency: 'usd' },
  'o3': { input: 2.00, output: 8.00, cacheHit: 0.50, cacheMiss: 2.00, currency: 'usd', note: '推理模型' },
  'o3-mini': { input: 1.10, output: 4.40, cacheHit: 0.55, cacheMiss: 1.10, currency: 'usd', note: '推理模型' },
  'o3-pro': { input: 20.00, output: 80.00, currency: 'usd', note: 'Pro推理模型无缓存' },
  'o1': { input: 15.00, output: 60.00, cacheHit: 7.50, cacheMiss: 15.00, currency: 'usd', note: '推理模型' },
  'o1-mini': { input: 1.10, output: 4.40, cacheHit: 0.55, cacheMiss: 1.10, currency: 'usd', note: '推理模型' },
  'o4-mini': { input: 1.10, output: 4.40, cacheHit: 0.275, cacheMiss: 1.10, currency: 'usd', note: '推理模型' },
  'o4-mini-deep-research': { input: 2.00, output: 8.00, cacheHit: 0.50, cacheMiss: 2.00, currency: 'usd', note: '深度研究' },
  'o3-deep-research': { input: 10.00, output: 40.00, cacheHit: 2.50, cacheMiss: 10.00, currency: 'usd', note: '深度研究' },

  // Anthropic
  'claude-opus-4-7': { input: 5.00, output: 25.00, cacheHit: 0.50, cacheMiss: 5.00, cacheWrite: 6.25, currency: 'usd' },
  'claude-opus-4-8': { input: 5.00, output: 25.00, cacheHit: 0.50, cacheMiss: 5.00, cacheWrite: 6.25, currency: 'usd' },
  'claude-opus-4-1': { input: 15.00, output: 75.00, cacheHit: 1.50, cacheMiss: 15.00, cacheWrite: 18.75, currency: 'usd' },
  'claude-sonnet-5': { input: 2.50, output: 12.50, cacheHit: 0.25, cacheMiss: 2.50, cacheWrite: 3.125, currency: 'usd' },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, cacheHit: 0.30, cacheMiss: 3.00, cacheWrite: 3.75, currency: 'usd' },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00, cacheHit: 0.30, cacheMiss: 3.00, cacheWrite: 3.75, currency: 'usd' },
  'claude-haiku-4-5': { input: 1.00, output: 5.00, cacheHit: 0.10, cacheMiss: 1.00, cacheWrite: 1.25, currency: 'usd' },
  'claude-haiku-3': { input: 0.25, output: 1.25, cacheHit: 0.03, cacheMiss: 0.25, cacheWrite: 0.30, currency: 'usd' },

  // Google
  'gemini-3-5-pro': { input: 2.00, output: 12.00, currency: 'usd' },
  'gemini-3-5-flash': { input: 0.50, output: 3.00, currency: 'usd' },
  'gemini-3-1-pro': { input: 2.00, output: 12.00, currency: 'usd' },
  'gemini-3-0-pro': { input: 2.00, output: 12.00, currency: 'usd' },
  'gemini-3-0-flash': { input: 0.50, output: 3.00, currency: 'usd' },
  'gemini-2-5-flash': { input: 0.50, output: 3.00, currency: 'usd' },

  // DeepSeek
  'deepseek-v4-pro': { input: 0.435, output: 0.87, cacheHit: 0.003625, cacheMiss: 0.435, currency: 'usd', note: '75%折扣价' },
  'deepseek-v4-flash': { input: 0.14, output: 0.28, cacheHit: 0.0028, cacheMiss: 0.14, currency: 'usd' },
  'deepseek-chat': { input: 0.28, output: 0.42, cacheHit: 0.028, cacheMiss: 0.28, currency: 'usd' },
  'deepseek-reasoner': { input: 0.28, output: 0.42, cacheHit: 0.028, cacheMiss: 0.28, currency: 'usd', note: '推理模型' },

  // 阿里通义
  'qwen3-max': { input: 0.36, output: 1.43, currency: 'usd' },
  'qwen3-5-plus': { input: 0.12, output: 0.69, currency: 'usd' },
  'qwen-flash': { input: 0.05, output: 0.40, currency: 'usd' },
  'qwen-plus': { input: 0.114, output: 0.286, currency: 'usd' },
  'qwen-max': { input: 0.343, output: 1.371, currency: 'usd' },
  'qwen-turbo': { input: 0.043, output: 0.086, currency: 'usd' },
  'qwen-long': { input: 0.071, output: 0.286, currency: 'usd' },
  'qwen-coder-plus': { input: 0.571, output: 2.286, currency: 'usd' },
  'qwen-coder-flash': { input: 0.143, output: 0.571, currency: 'usd' },

  // Kimi
  'kimi-k2-6': { input: 0.65, output: 2.70, cacheHit: 0.11, cacheMiss: 0.65, currency: 'usd' },
  'kimi-k2-5': { input: 0.50, output: 2.00, cacheHit: 0.10, cacheMiss: 0.50, currency: 'usd' },
  'kimi-k3': { input: 0.60, output: 2.40, cacheHit: 0.12, cacheMiss: 0.60, currency: 'usd' },

  // 智谱
  'glm-4-plus': { input: 0.50, output: 0.50, currency: 'usd' },
  'glm-4-7': { input: 0.50, output: 0.50, currency: 'usd' },
  'glm-4-6v': { input: 0.50, output: 0.50, currency: 'usd' },
  'glm-4-6v-flash': { input: 0, output: 0, currency: 'usd', note: '免费' },
  'glm-4-flash': { input: 0, output: 0, currency: 'usd', note: '免费' },

  // 腾讯混元
  'hunyuan-2-0-think': { input: 0.3975, output: 1.59, currency: 'usd' },

  // 字节火山
  'doubao-seedream-3': { input: 0.32, output: 1.60, currency: 'usd' },
  'doubao-pro': { input: 0.32, output: 1.60, currency: 'usd' },
  'doubao-lite': { input: 0.08, output: 0.40, currency: 'usd' },

  // MiniMax
  'minimax-m2-7': { input: 0.21, output: 0.84, cacheHit: 0.042, cacheMiss: 0.21, currency: 'usd' },

  // 小米
  'mimo-v2-5-pro': { input: 0.70, output: 2.10, currency: 'usd' },
  'mimo-v2-pro': { input: 0.70, output: 2.10, currency: 'usd' },

  // xAI
  'grok-4-5': { input: 2.00, output: 6.00, currency: 'usd' },
  'grok-4': { input: 3.00, output: 15.00, currency: 'usd' },
  'grok-4-1': { input: 3.00, output: 15.00, currency: 'usd' },
  'grok-3': { input: 3.00, output: 15.00, currency: 'usd' },
  'grok-3-mini': { input: 0.30, output: 0.50, currency: 'usd' },
  'grok-4-fast': { input: 0.20, output: 0.50, cacheHit: 0.05, cacheMiss: 0.20, currency: 'usd' },
  'grok-code-fast': { input: 0.20, output: 0.02, cacheHit: 0.02, cacheMiss: 0.20, currency: 'usd' },

  // Mistral
  'mistral-large': { input: 2.00, output: 6.00, currency: 'usd' },
  'mistral-medium': { input: 1.00, output: 3.00, currency: 'usd' },
  'mistral-small': { input: 0.20, output: 0.60, currency: 'usd' },

  // Cohere
  'cohere-command-r': { input: 0.50, output: 1.50, currency: 'usd' },
  'cohere-command-r-plus': { input: 2.00, output: 8.00, currency: 'usd' },

  // Meta
  'llama-4': { input: 0.50, output: 1.50, currency: 'usd' },
  'llama-3-3': { input: 0.20, output: 0.60, currency: 'usd' },

  // Groq
  'groq-mixtral': { input: 0.20, output: 0.60, currency: 'usd' },
  'groq-llama': { input: 0.10, output: 0.30, currency: 'usd' },
};

/* 根据模型ID获取定价 */
function getModelPricing(modelId) {
  if (!modelId) return null;
  // 精确匹配
  if (MODEL_PRICING[modelId]) return MODEL_PRICING[modelId];
  // 前缀匹配（如 gpt-5.5-xxx 匹配 gpt-5.5）
  const keys = Object.keys(MODEL_PRICING).sort((a,b) => b.length - a.length);
  for (const k of keys) {
    if (modelId.indexOf(k) === 0) return MODEL_PRICING[k];
  }
  return null;
}

/* 计算单次请求成本（美元）
 * promptTokens: 输入token数
 * completionTokens: 输出token数
 * cacheHit: 是否命中缓存（仅对支持缓存的厂商有效）
 */
function calcCost(modelId, promptTokens, completionTokens, cacheHit) {
  const p = getModelPricing(modelId);
  if (!p) return null;
  const inputPrice = (cacheHit && p.cacheHit != null) ? p.cacheHit : (p.cacheMiss != null ? p.cacheMiss : p.input);
  const cost = (promptTokens * inputPrice + completionTokens * p.output) / 1e6;
  return { cost, currency: p.currency || 'usd', inputPrice, outputPrice: p.output };
}

/* 换算为人民币（粗略汇率） */
function usdToCny(usd) { return usd * 7.25; }

window.MODEL_PRICING = MODEL_PRICING;
window.getModelPricing = getModelPricing;
window.calcCost = calcCost;
window.usdToCny = usdToCny;
