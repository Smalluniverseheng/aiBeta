const API_BASE = 'https://ai-gateway.1829487897.workers.dev';

const api = {
  parseSSE: async function(response, onChunk) {
    const reader = response.body.getReader();
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
            const chunk = json.choices?.[0]?.delta?.content || json.content || '';
            const thinking = json.choices?.[0]?.delta?.reasoning_content || json.thinking || '';
            if (chunk || thinking) onChunk(chunk, { thinking, model: json.model });
          } catch (e) {}
        }
      }
    }
  },

  chat: async function({ provider, model, messages, temperature = 0.7, apiKey, onChunk, onDone, onError }) {
    try {
      const body = { provider, model, messages, temperature, stream: true };
      if (apiKey) body.apiKey = apiKey;
      const res = await fetch(API_BASE + '/api/v1/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) { onError?.('HTTP ' + res.status); return; }
      await this.parseSSE(res, onChunk);
      onDone?.();
    } catch (e) { onError?.(e.message); }
  },

  search: async function(query, maxResults = 5) {
    const res = await fetch(API_BASE + '/api/v1/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, maxResults })
    });
    return res.json();
  },

  image: async function({ prompt, size = '1024x1024', n = 1 }) {
    const res = await fetch(API_BASE + '/api/v1/image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size, n })
    });
    return res.json();
  },

  health: async function() {
    const res = await fetch(API_BASE + '/api/v1/health');
    return res.json();
  }
};

window.api = api;
