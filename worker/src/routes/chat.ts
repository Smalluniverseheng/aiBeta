import { json, stream } from '../router';
import type { Env } from '../index';

// 23 家厂商配置（与前端 providers.js 对应）
const PROVIDERS: Record<string, {
  baseURL: string;
  getHeaders: (key: string) => Record<string, string>;
  transformBody: (body: any) => any;
  transformStream: (chunk: string) => string | null;
}> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    getHeaders: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }),
    transformBody: (b) => b,
    transformStream: (c) => c,
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    getHeaders: (k) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }),
    transformBody: (b) => ({ ...b, model: b.model.replace('anthropic/', ''), max_tokens: 4096 }),
    transformStream: (c) => c,
  },
  google: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    getHeaders: (k) => ({ 'Content-Type': 'application/json' }),
    transformBody: (b) => ({
      contents: b.messages.map((m: any) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.7 },
    }),
    transformStream: (c) => c,
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    getHeaders: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }),
    transformBody: (b) => b,
    transformStream: (c) => c,
  },
  moonshot: {
    baseURL: 'https://api.moonshot.cn/v1',
    getHeaders: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }),
    transformBody: (b) => b,
    transformStream: (c) => c,
  },
  alibaba: {
    baseURL: 'https://dashscope.aliyuncs.com/api/v1',
    getHeaders: (k) => ({ 'Authorization': `Bearer ${k}`, 'Content-Type': 'application/json' }),
    transformBody: (b) => ({ model: b.model, input: { messages: b.messages }, parameters: {} }),
    transformStream: (c) => c,
  },
  // ... 其他厂商可按同样模式扩展
};

function getApiKey(env: Env, provider: string, userKey?: string): string | null {
  // 优先级1：前端传来的用户真实 Key
  if (userKey && userKey.length > 10) {
    return userKey;
  }

  // 优先级2：Worker 环境变量（预存的，可能是假的/旧的，作为 fallback）
  const map: Record<string, string | undefined> = {
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    google: env.GOOGLE_API_KEY,
    deepseek: env.DEEPSEEK_API_KEY,
    moonshot: env.MOONSHOT_API_KEY,
    alibaba: env.ALIBABA_API_KEY,
    baichuan: env.BAICHUAN_API_KEY,
    zhipu: env.ZHIPU_API_KEY,
    minimax: env.MINIMAX_API_KEY,
    spark: env.SPARK_API_KEY,
    ernie: env.ERNIE_API_KEY,
    hunyuan: env.HUNYUAN_API_KEY,
    doubao: env.DOUBAO_API_KEY,
    qwen: env.QWEN_API_KEY,
    coze: env.COZE_API_KEY,
    groq: env.GROQ_API_KEY,
    cohere: env.COHERE_API_KEY,
    mistral: env.MISTRAL_API_KEY,
    perplexity: env.PERPLEXITY_API_KEY,
    together: env.TOGETHER_API_KEY,
    fireworks: env.FIREWORKS_API_KEY,
    novita: env.NOVITA_API_KEY,
    siliconflow: env.SILICONFLOW_API_KEY,
  };
  return map[provider] || null;
}

export async function chatRoute(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const { provider, model, messages, stream: useStream = true, temperature = 0.7 } = body;

  if (!provider || !model || !messages) {
    return json({ error: 'Missing provider, model or messages' }, 400);
  }

  const userApiKey = body.apiKey;
  const apiKey = getApiKey(env, provider, userApiKey);
  if (!apiKey) {
    return json({ error: `未配置 ${provider} 的 API Key，请在前端设置` }, 400);
  }

  const cfg = PROVIDERS[provider] || PROVIDERS.openai;
  const url = `${cfg.baseURL}/chat/completions`;

  const payload = cfg.transformBody({
    model,
    messages,
    temperature,
    stream: useStream,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: cfg.getHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error');
    return json({ error: `Provider error: ${res.status}`, detail: err }, res.status);
  }

  if (useStream) {
    return stream(res);
  }

  const data = await res.json();
  return json({
    content: data.choices?.[0]?.message?.content || '',
    thinking: data.choices?.[0]?.message?.reasoning_content || '',
    usage: data.usage,
  });
}
