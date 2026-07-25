/* ==================== API-V2 · Worker 客户端 ====================
 * 前端直接调用 Cloudflare Worker 的封装层。
 * 与 api.js 的区别：api.js 是统一网关（本地直连/代理自动切换），
 * api-v2.js 是显式 Worker 调用（供插件、RAG、独立功能使用）。
 */
const API_BASE = 'https://ai-gateway.1829487897.workers.dev';

const api = {
  /* ---------- SSE 流式解析 ---------- */
  parseSSE: async function(response, onChunk, onThinking) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let fullThink = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            if (delta) {
              const think = delta.reasoning_content || delta.reasoning;
              if (think && onThinking) { fullThink += think; onThinking(think, fullThink); }
              const chunk = delta.content || '';
              if (chunk && onChunk) { full += chunk; onChunk(chunk, full); }
            }
          } catch (e) {}
        }
      }
    }
    return { content: full, thinking: fullThink };
  },

  /* ---------- 单模型对话 ---------- */
  chat: async function({ provider, model, messages, temperature = 0.7, apiKey, onChunk, onThinking, onDone, onError }) {
    try {
      const body = { provider, model, messages, temperature, stream: true };
      if (apiKey) body.apiKey = apiKey;
      const res = await fetch(API_BASE + '/api/v1/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) { onError?.('HTTP ' + res.status); return; }
      if (onChunk || onThinking) {
        await this.parseSSE(res, onChunk, onThinking);
      } else {
        const data = await res.json();
        return data;
      }
      onDone?.();
    } catch (e) { onError?.(e.message); }
  },

  /* ---------- 多模型并行 ---------- */
  multi: async function({ models, messages, temperature = 0.7, onChunk, onModelStart, onModelDone, onError }) {
    try {
      const res = await fetch(API_BASE + '/api/v1/chat/multi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models, messages, temperature })
      });
      if (!res.ok) { onError?.('HTTP ' + res.status); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              if (json.status === 'start') onModelStart?.(json.model);
              else if (json.status === 'done') onModelDone?.(json.model);
              else if (json.content && onChunk) onChunk(json.content, json.model);
              else if (json.error && onError) onError(json.error, json.model);
            } catch (e) {}
          }
        }
      }
    } catch (e) { onError?.(e.message); }
  },

  /* ---------- 联网搜索 ---------- */
  search: async function(query, maxResults = 5) {
    const res = await fetch(API_BASE + '/api/v1/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, maxResults })
    });
    return res.json();
  },

  /* ---------- AI 绘画 ---------- */
  image: async function({ provider = 'openai', prompt, size = '1024x1024', n = 1 }) {
    const res = await fetch(API_BASE + '/api/v1/image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, prompt, size, n })
    });
    return res.json();
  },

  /* ---------- RAG 向量检索 ---------- */
  vectorSearch: async function({ query, documentIds, topK = 5 }) {
    const res = await fetch(API_BASE + '/api/v1/vector/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, documentIds, topK })
    });
    return res.json();
  },

  /* ---------- 文件上传 ---------- */
  upload: async function(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(API_BASE + '/api/v1/storage/upload', {
      method: 'POST', body: form
    });
    return res.json();
  },

  /* ---------- 健康检查 ---------- */
  health: async function() {
    const res = await fetch(API_BASE + '/api/v1/health');
    return res.json();
  },

  /* ---------- API Key 管理 ---------- */
  keys: {
    get: async function(userToken) {
      const res = await fetch(API_BASE + '/api/v1/keys', {
        headers: { 'Authorization': 'Bearer ' + userToken }
      });
      return res.json();
    },
    save: async function({ provider, key, syncToCloud, userToken }) {
      const res = await fetch(API_BASE + '/api/v1/keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key, syncToCloud, userToken })
      });
      return res.json();
    }
  },

  /* ---------- 会话 CRUD ---------- */
  chats: {
    save: async function({ chatId, title, model, mode, messages, userToken }) {
      const res = await fetch(API_BASE + '/api/v1/chats/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, title, model, mode, messages, userToken })
      });
      return res.json();
    },
    list: async function(userToken) {
      const res = await fetch(API_BASE + '/api/v1/chats', {
        headers: { 'Authorization': 'Bearer ' + userToken }
      });
      return res.json();
    },
    delete: async function({ chatId, userToken }) {
      const res = await fetch(API_BASE + '/api/v1/chats/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, userToken })
      });
      return res.json();
    }
  }
};

window.api = api;
