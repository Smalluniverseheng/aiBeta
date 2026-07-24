/* ==================== API · 统一调用网关 ====================
 * 所有厂商请求都从这里经过。后期接入后端时：
 * 将 BACKEND_URL 设为你的服务端地址，请求即自动改走服务端代理（Key 不再暴露在前端）。
 */
const API = (() => {

  const CONFIG = {
    BACKEND_URL: null,   // 例: 'https://your-server.com'  后期接入后端时填写
    TIMEOUT: 60000,
    SSE_WATCHDOG: 30000  // 流式读取熔断：连续该毫秒数未收到任何字节则判定超时
  };

  let controllers = [];

  function abortAll() {
    controllers.forEach(c => { try { c.abort(); } catch (e) {} });
    controllers = [];
  }

  /* ---------- 错误处理 ---------- */
  function friendlyError(status, text) {
    let msg = text || '';
    try { const j = JSON.parse(text); msg = (j.error && (j.error.message || j.error.msg)) || j.message || msg; } catch (e) {}
    msg = String(msg).slice(0, 300);
    if (status === 401 || status === 403) return 'API Key 无效或已过期，请检查设置中的 Key（' + status + '）';
    if (status === 402) return '账户余额不足，请充值后重试（402）';
    if (status === 404) return '模型不存在或接口地址错误（404）：' + msg;
    if (status === 429) return '请求过于频繁或额度受限，请稍后再试（429）';
    if (status >= 500) return '服务商服务器繁忙，请稍后再试（' + status + '）';
    return '请求失败（' + status + '）：' + msg;
  }

  async function fetchJSON(url, options, ac) {
    const resp = await fetch(url, Object.assign({}, options, { signal: ac ? ac.signal : undefined }));
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(friendlyError(resp.status, t));
    }
    return resp;
  }

  /* ---------- 消息构建（含上下文截断 / 图片 / 系统提示） ---------- */
  function buildMessages(chat, userContent, attachments, opts) {
    opts = opts || {};
    const model = getModel(Store.state.currentModelId);
    const ctxLimit = model ? (model.ctx || 128) * 1024 : 128 * 1024;
    const msgs = [];
    // 系统提示 = 角色预设 + 用户界面语言提示（确保模型按用户语言回复）
    const sysParts = [];
    if (chat.system) sysParts.push(chat.system);
    if (typeof I18n !== 'undefined') sysParts.push(I18n.langHintForModel());
    if (sysParts.length) msgs.push({ role: 'system', content: sysParts.join('\n\n') });

    // excludeId：调用方刚 push 的当前用户消息（已由参数重建），避免重复注入
    const history = (chat.messages || []).filter(m =>
      (m.role === 'user' || m.role === 'assistant') && m.id !== opts.excludeId);
    let userMsg;
    const img = attachments && attachments.image;
    if (img && model && model.vision) {
      userMsg = { role: 'user', content: [
        { type: 'text', text: userContent },
        { type: 'image_url', image_url: { url: img.dataUrl } }
      ] };
    } else {
      let text = userContent;
      if (attachments && attachments.filesText) text = attachments.filesText + '\n\n' + userContent;
      userMsg = { role: 'user', content: text };
    }

    const est = m => (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length) / 2;
    const picked = [userMsg];
    let total = est(userMsg) + (img ? 1200 : 0);
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i];
      if (!m.content || m.error) continue;
      const t = est(m);
      if (total + t > ctxLimit * 0.75) break;
      picked.unshift({ role: m.role, content: m.content });
      total += t;
    }
    return msgs.concat(picked);
  }

  /* ---------- SSE 流式解析 ---------- */
  /* onToolCall：可选第 5 参，OpenAI 格式 tool_calls 更新时回调（参数为快照数组） */
  /* 返回 {content, thinking, toolCalls, usage}；usage 为 {prompt, completion} 或 null（接口未回传） */
  async function streamSSE(resp, format, onChunk, onThinking, onToolCall) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let full = '';
    let fullThink = '';
    let usage = null;
    // tool_calls 累加器：OpenAI 流式按 index 分片，arguments 为增量字符串
    const toolCallsAcc = [];
    const notifyToolCalls = () => {
      if (typeof onToolCall === 'function') onToolCall(toolCallsAcc.map(t => Object.assign({}, t)));
    };

    const handleData = (data) => {
      if (!data || data === '[DONE]') return;
      let json;
      try { json = JSON.parse(data); } catch (e) { return; }

      if (format === 'anthropic') {
        // usage：message_start 带输入 token 数，message_delta 累计输出 token 数（取最新值）
        if (json.type === 'message_start' && json.message && json.message.usage) {
          usage = { prompt: json.message.usage.input_tokens || 0, completion: json.message.usage.output_tokens || 0 };
        } else if (json.type === 'message_delta' && json.usage) {
          if (!usage) usage = { prompt: 0, completion: 0 };
          if (json.usage.output_tokens != null) usage.completion = json.usage.output_tokens;
        }
        if (json.type === 'content_block_delta' && json.delta) {
          if (json.delta.type === 'thinking_delta' && onThinking) { fullThink += json.delta.thinking || ''; onThinking(json.delta.thinking || '', fullThink); }
          else if (json.delta.text) { full += json.delta.text; onChunk(json.delta.text, full); }
        }
      } else if (format === 'google') {
        // usage：usageMetadata 一般在末尾 chunk，取最后一次为准
        const um = json.usageMetadata;
        if (um) usage = { prompt: um.promptTokenCount || 0, completion: um.candidatesTokenCount || 0 };
        const parts = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts;
        if (parts) {
          parts.forEach(p => {
            if (p.thought && onThinking) { fullThink += p.text || ''; onThinking(p.text || '', fullThink); }
            else if (p.text) { full += p.text; onChunk(p.text, full); }
          });
        }
      } else {
        // OpenAI 兼容格式
        // usage：部分厂商最后单独发一个只有 usage、choices 为空的 chunk（需 stream_options.include_usage）
        if (json.usage) {
          usage = {
            prompt: json.usage.prompt_tokens != null ? json.usage.prompt_tokens : (usage ? usage.prompt : 0),
            completion: json.usage.completion_tokens != null ? json.usage.completion_tokens : (usage ? usage.completion : 0)
          };
        }
        const delta = json.choices && json.choices[0] && json.choices[0].delta;
        if (delta) {
          const think = delta.reasoning_content || delta.reasoning;
          if (think && onThinking) { fullThink += think; onThinking(think, fullThink); }
          // role:'tool' 的 delta 是工具结果回传，不计入正文
          if (delta.content && delta.role !== 'tool') { full += delta.content; onChunk(delta.content, full); }
          // 工具调用分片：首片带 function.name，后续 function.arguments 为增量
          if (delta.tool_calls && delta.tool_calls.length) {
            delta.tool_calls.forEach(dtc => {
              const idx = dtc.index != null ? dtc.index : toolCallsAcc.length;
              let acc = toolCallsAcc[idx];
              if (!acc) acc = toolCallsAcc[idx] = { id: '', name: '', arguments: '', result: null, status: 'running' };
              if (dtc.id) acc.id = dtc.id;
              const fn = dtc.function || {};
              if (fn.name) acc.name += fn.name;
              if (fn.arguments != null) acc.arguments += typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments);
            });
            notifyToolCalls();
          }
          // 工具结果回传（部分厂商服务端执行工具后会随流返回 role:'tool'）
          if (delta.role === 'tool' && delta.tool_call_id) {
            const hit = toolCallsAcc.find(t => t.id === delta.tool_call_id);
            if (hit) {
              hit.result = (hit.result || '') + (delta.content || '');
              hit.status = 'done';
              notifyToolCalls();
            }
          }
        }
      }
    };

    // 30s 无数据熔断：每读到字节就重置计时；超时主动取消流并抛错，避免连接挂死后无限等待
    let timedOut = false;
    let watchdog = null;
    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        timedOut = true;
        try { reader.cancel(); } catch (e) {}
      }, CONFIG.SSE_WATCHDOG || 30000);
    };
    armWatchdog();
    try {
      for (;;) {
        let chunk;
        try { chunk = await reader.read(); }
        catch (e) { if (timedOut) throw new Error('网络超时：30 秒未收到数据，请重试'); throw e; }
        if (chunk.done) break;
        armWatchdog();
        buffer += decoder.decode(chunk.value, { stream: true });

        // Anthropic / Google(alt=sse) / OpenAI 都是 `data: ` 行
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (line.startsWith('data:')) handleData(line.slice(5).trim());
        }
      }
      if (timedOut) throw new Error('网络超时：30 秒未收到数据，请重试');
      if (buffer.trim().startsWith('data:')) handleData(buffer.trim().slice(5).trim());
      // 流结束：未收到结果回传的工具调用一律置为已完成
      if (toolCallsAcc.length) {
        toolCallsAcc.forEach(t => { t.status = 'done'; });
        notifyToolCalls();
      }
      return { content: full, thinking: fullThink, toolCalls: toolCallsAcc, usage };
    } finally {
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
    }
  }

  /* ---------- 厂商原生参数：联网搜索 / 深度思考开关 ----------
   * 依据各厂商官方文档注入对应参数；均为服务端执行，无需客户端回环。 */
  function applyProviderExtras(body, model) {
    const searchOn = !!(Store.state.webSearch && Store.state.webSearch.enabled);
    const thinkOn = Store.state.thinkingOn !== false;
    switch (model.provider) {
      case '通义千问': // DashScope 兼容模式
        if (searchOn) body.enable_search = true;
        if (model.thinking) body.enable_thinking = thinkOn;
        break;
      case '智谱AI':
        if (model.thinking) body.thinking = { type: thinkOn ? 'enabled' : 'disabled' };
        if (searchOn) body.tools = [{ type: 'web_search', web_search: { enable: true } }];
        break;
      case 'xAI':
        if (searchOn) body.search_parameters = { mode: 'on' };
        break;
      case '火山引擎': // 豆包
        if (model.thinking) body.thinking = { type: thinkOn ? 'enabled' : 'disabled' };
        break;
      case '腾讯混元':
        if (model.thinking) body.enable_thinking = thinkOn;
        break;
    }
  }

  /* ---------- Token 记账 ----------
   * 成功拿到回复后调用：优先用接口真实 usage；缺失时按请求/返回文本本地估算（estimated=true）。
   * TokenStats 未加载或记账异常时静默跳过，绝不影响对话。 */
  function accountUsage(modelId, messages, result) {
    try {
      if (typeof TokenStats === 'undefined' || !result) return result;
      const u = result.usage;
      if (u && (u.prompt > 0 || u.completion > 0)) {
        TokenStats.record(modelId, { prompt: u.prompt || 0, completion: u.completion || 0, estimated: false });
      } else {
        // 请求侧累加文本（图片按 1200 token 固定折算，与 buildMessages 的口径一致）
        let reqText = '', imgCount = 0;
        (messages || []).forEach(m => {
          if (!m) return;
          if (typeof m.content === 'string') { reqText += m.content + '\n'; return; }
          if (Array.isArray(m.content)) m.content.forEach(c => {
            if (c && c.type === 'text' && c.text) reqText += c.text + '\n';
            else if (c && c.type === 'image_url') imgCount++;
          });
        });
        TokenStats.record(modelId, {
          prompt: TokenStats.estimate(reqText) + imgCount * 1200,
          completion: TokenStats.estimate(result.content || ''),
          estimated: true
        });
      }
    } catch (e) { /* 记账失败不影响对话 */ }
    return result;
  }

  /* ---------- 聊天调用 ---------- */
  function chat(opts) {
    // ===== v3.4: 代理模式切换 =====
    const proxyMode = (typeof Store !== 'undefined' && Store.state) ? (Store.state.proxyMode || 'local') : 'local';
    if (proxyMode === 'server' && CONFIG.BACKEND_URL) {
      // 服务器代理模式
      return fetch(CONFIG.BACKEND_URL + '/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: model.provider, model: modelId, messages, temperature: 0.7, stream: typeof onChunk === 'function' })
      }).then(res => {
        if (!res.ok) throw new Error('Worker error: ' + res.status);
        if (typeof onChunk === 'function') return streamSSE(res, onChunk, onThinking);
        return res.json().then(j => j.content || j.text || '');
      }).catch(err => {
        console.warn('[Worker] 代理失败，回退到本地直连:', err.message);
        // 继续执行下面的本地逻辑（不 return，让代码继续）
      });
    }
    // ===== /代理模式 =====

    const { modelId, messages, onChunk, onThinking } = opts;
    const model = getModel(modelId);
    if (!model) return Promise.reject(new Error('模型不存在: ' + modelId));
    const cfg = PROVIDERS[model.provider];
    if (!cfg) return Promise.reject(new Error('暂不支持该厂商: ' + model.provider));
    const key = getKeyForModel(model);
    if (!key) return Promise.reject(new Error('请先在「我的 → API Key」中配置 ' + model.provider + ' 的 Key'));

    const ac = new AbortController();
    controllers.push(ac);
    const streaming = typeof onChunk === 'function';

    // —— Google Gemini 格式 ——
    if (cfg.format === 'google') {
      const sys = messages.find(m => m.role === 'system');
      const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: Array.isArray(m.content)
          ? m.content.map(c => c.type === 'text' ? { text: c.text } : { inlineData: { mimeType: 'image/jpeg', data: String(c.image_url.url).split(',')[1] } })
          : [{ text: m.content }]
      }));
      const body = { contents };
      if (sys) body.systemInstruction = { parts: [{ text: sys.content }] };
      // Gemini 原生联网搜索（google_search 工具，服务端执行）
      if (Store.state.webSearch && Store.state.webSearch.enabled) body.tools = [{ google_search: {} }];
      const url = cfg.base() + '/v1beta/models/' + encodeURIComponent(modelId) + (streaming ? ':streamGenerateContent?alt=sse&key=' : ':generateContent?key=') + encodeURIComponent(key);
      return fetchJSON(url, { method: 'POST', headers: cfg.headers(key), body: JSON.stringify(body) }, ac)
        .then(resp => {
          if (streaming) return streamSSE(resp, 'google', onChunk, onThinking);
          return resp.json().then(d => {
            const parts = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts || [];
            const um = d.usageMetadata;
            const usage = um ? { prompt: um.promptTokenCount || 0, completion: um.candidatesTokenCount || 0 } : null;
            return { content: parts.map(p => p.text || '').join(''), thinking: '', usage };
          });
        })
        .then(result => accountUsage(modelId, messages, result))
        .finally(() => { controllers = controllers.filter(c => c !== ac); });
    }

    // —— Anthropic 格式 ——
    if (cfg.format === 'anthropic') {
      const sys = messages.find(m => m.role === 'system');
      const msgs = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));
      const body = { model: modelId, max_tokens: 8192, messages: msgs, stream: streaming };
      if (sys) body.system = typeof sys.content === 'string' ? sys.content : '';
      return fetchJSON(cfg.base() + '/v1/messages', { method: 'POST', headers: cfg.headers(key), body: JSON.stringify(body) }, ac)
        .then(resp => {
          if (streaming) return streamSSE(resp, 'anthropic', onChunk, onThinking);
          return resp.json().then(d => ({
            content: (d.content || []).filter(b => b.type === 'text').map(b => b.text).join(''),
            thinking: '',
            usage: d.usage ? { prompt: d.usage.input_tokens || 0, completion: d.usage.output_tokens || 0 } : null
          }));
        })
        .then(result => accountUsage(modelId, messages, result))
        .finally(() => { controllers = controllers.filter(c => c !== ac); });
    }

    // —— OpenAI 兼容格式（默认） ——
    let body = { model: modelId, messages, stream: streaming };
    if (cfg.transform) body = cfg.transform(body, model) || body;
    applyProviderExtras(body, model);
    // 仅流式：要求厂商在流末尾回传 usage（不支持的厂商会忽略该字段）
    if (streaming) body.stream_options = { include_usage: true };
    return fetchJSON(cfg.base() + '/v1/chat/completions', { method: 'POST', headers: cfg.headers(key), body: JSON.stringify(body) }, ac)
      .then(resp => {
        if (streaming) return streamSSE(resp, 'openai', onChunk, onThinking, opts.onToolCall);
        return resp.json().then(d => {
          const m = d.choices && d.choices[0] && d.choices[0].message || {};
          const toolCalls = (m.tool_calls || []).map(tc => ({
            id: tc.id || '',
            name: (tc.function && tc.function.name) || '',
            arguments: tc.function && tc.function.arguments != null
              ? (typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments))
              : '',
            result: null,
            status: 'done'
          }));
          const usage = d.usage ? { prompt: d.usage.prompt_tokens || 0, completion: d.usage.completion_tokens || 0 } : null;
          return { content: m.content || '', thinking: m.reasoning_content || '', toolCalls, usage };
        });
      })
      .then(result => accountUsage(modelId, messages, result))
      .finally(() => { controllers = controllers.filter(c => c !== ac); });
  }

  /* ---------- AI 绘画（OpenAI 兼容图像接口） ---------- */
  function generateImage(opts) {
    const { prompt, provider, size } = opts;
    const cfg = PROVIDERS[provider];
    if (!cfg || !cfg.imageModel) return Promise.reject(new Error('该厂商暂不支持绘画'));
    const key = Store.state.apiKeys[cfg.keySlug] || '';
    if (!key) return Promise.reject(new Error('请先配置 ' + provider + ' 的 API Key'));
    const ac = new AbortController();
    controllers.push(ac);
    const body = { model: cfg.imageModel, prompt, n: 1, size: size || '1024x1024', response_format: 'b64_json' };
    return fetchJSON(cfg.base() + '/v1/images/generations', { method: 'POST', headers: cfg.headers(key), body: JSON.stringify(body) }, ac)
      .then(r => r.json())
      .then(d => {
        const item = d.data && d.data[0];
        if (!item) throw new Error('绘画接口返回为空');
        if (item.b64_json) return 'data:image/png;base64,' + item.b64_json;
        if (item.url) return item.url;
        throw new Error('无法解析绘画结果');
      })
      .finally(() => { controllers = controllers.filter(c => c !== ac); });
  }

  /* ---------- 联网搜索（Tavily，支持浏览器直连） ---------- */
  function webSearch(query) {
    const key = Store.state.webSearch.tavilyKey;
    if (!key) return Promise.reject(new Error('未配置搜索 Key'));
    const ac = new AbortController();
    controllers.push(ac);
    return fetchJSON('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query, max_results: 5, search_depth: 'basic', include_answer: true })
    }, ac)
      .then(r => r.json())
      .then(d => ({
        answer: d.answer || '',
        results: (d.results || []).map(r => ({ title: r.title, url: r.url, snippet: (r.content || '').slice(0, 300) }))
      }))
      .finally(() => { controllers = controllers.filter(c => c !== ac); });
  }

  function buildSearchContext(query, data) {
    let ctx = '【联网搜索结果】用户问题：' + query + '\n\n';
    if (data.answer) ctx += '综合答案：' + data.answer + '\n\n';
    data.results.forEach((r, i) => {
      ctx += '[' + (i + 1) + '] ' + r.title + '\n' + r.snippet + '\n来源：' + r.url + '\n\n';
    });
    ctx += '请基于以上搜索结果回答用户问题，在引用信息处用上标 [1][2] 等标注来源，并在回答末尾列出参考来源。如果搜索结果与问题无关，请忽略并用自身知识回答。';
    return ctx;
  }

  return { CONFIG, abortAll, chat, buildMessages, generateImage, webSearch, buildSearchContext };
})();
