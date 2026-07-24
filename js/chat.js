/* ==================== CHAT · 对话编排（单模型/多模型/辩论/协同） ==================== */
const Chat = (() => {
  // 初始化：清理历史记录中已有的空白对话（没有任何消息）
  (function cleanupEmptyChats() {
    const before = Store.state.chats.length;
    Store.state.chats = Store.state.chats.filter(c => c.messages && c.messages.length > 0);
    const removed = before - Store.state.chats.length;
    if (removed > 0) { Store.save(); console.log("[Chat] 清理了", removed, "个空白对话"); }
  })();

  let sending = false;
  let stopFlag = false;

  const attachments = { image: null, files: [] };

  /* ==================== 基础操作 ==================== */
  function getCurrentChat() {
    return Store.state.chats.find(c => c.id === Store.state.currentChatId) || null;
  }

  function ensureChat() {
    let chat = getCurrentChat();
    if (!chat) { create(); chat = getCurrentChat(); }
    return chat;
  }

  let lastCreateTime = 0;
  function create(opts) {
    opts = opts || {};
    // 防抖：300ms 内重复点击忽略
    const now = Date.now();
    if (now - lastCreateTime < 300) return;
    lastCreateTime = now;
    // 自动删除上一个空对话（没有任何消息）
    const current = getCurrentChat();
    if (current && (!current.messages || current.messages.length === 0)) {
      Store.state.chats = Store.state.chats.filter(c => c.id !== current.id);
    }
    const id = genId();
    const chat = {
      id,
      title: opts.title || '新对话',
      modelId: Store.state.currentModelId,
      mode: opts.mode || Store.state.currentMode,
      system: opts.system || '',
      presetId: opts.presetId || '',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    Store.state.chats.unshift(chat);
    Store.state.currentChatId = id;
    Store.save();
    UI.renderSidebar();
    UI.renderChat();
    UI.syncAttachBtn();
    return chat;
  }

  function load(id) {
    API.abortAll(); Voice.stopSpeak();
    sending = false; stopFlag = false;
    UI.setSending(false);
    Store.state.currentChatId = id;
    const chat = getCurrentChat();
    if (chat && chat.modelId && getModel(chat.modelId)) {
      Store.state.currentModelId = chat.modelId;
      UI.updateModelSel();
    }
    Store.save();
    UI.renderSidebar();
    UI.renderChat();
    UI.syncAttachBtn();
  }

  function del(id) {
    const chat = Store.state.chats.find(c => c.id === id);
    if (chat) {
      if (!Store.state.trash) Store.state.trash = { chats: [], apiKeys: [], items: [], clearedAt: 0 };
      chat.deletedAt = Date.now();
      Store.state.trash.chats.unshift(chat);
    }
    Store.state.chats = Store.state.chats.filter(c => c.id !== id);
    if (Store.state.currentChatId === id) Store.state.currentChatId = null;
    Store.save();
    UI.renderSidebar();
    UI.renderChat();
    Toast.success('已移至回收站');
  }

  function selectModel(id) {
    const m = getModel(id);
    if (m && !isSelectableModel(m)) {
      Toast.warning(isChatModel(m) ? I18n.t('toast.modelOff') : I18n.t('toast.modelSpecial'));
      return;
    }
    Store.state.currentModelId = id;
    // 最近使用
    const rec = Store.state.recentModels || [];
    Store.state.recentModels = [id].concat(rec.filter(x => x !== id)).slice(0, 4);
    const chat = getCurrentChat();
    if (chat) chat.modelId = id;
    Store.save();
    UI.updateModelSel();
    if (m) Toast.info(I18n.t('toast.switched') + m.name);
  }

  function selectMode(mode) {
    // 手表端仅支持单模型
    if (window.DeviceInfo && DeviceInfo.isWatch() && mode !== 'single') {
      Toast.info('手表端仅支持单模型对话');
      return;
    }
    const cur = getCurrentChat();
    // 已有内容的会话切换模式：开启新会话承载新模式，原会话完整保留
    if (cur && cur.messages && cur.messages.length && (cur.mode || 'single') !== mode) {
      Store.state.currentMode = mode;
      create({ mode });
      Toast.info('已在新会话中开启「' + I18n.t('mode.' + mode) + '」，原会话已保留');
    } else {
      Store.state.currentMode = mode;
      if (cur && (!cur.messages || !cur.messages.length)) cur.mode = mode;
      Store.save();
      UI.renderChat();
    }
    UI.updateModeSel();
    UI.renderModeConfig();
    UI.syncAttachBtn();
  }

  function addToRole(role, modelId) {
    const key = { multi: 'multiModels', pro: 'debatePro', con: 'debateCon', judge: 'debateJudge', collab: 'collabModels' }[role];
    const arr = Store.state[key];
    const idx = arr.indexOf(modelId);
    if (idx >= 0) arr.splice(idx, 1);
    else {
      if (role === 'judge' && arr.length >= 2) return Toast.warning('裁判最多 2 个');
      if (arr.length >= 8) return Toast.warning('最多选择 8 个模型');
      arr.push(modelId);
    }
    Store.save();
    UI.renderChips(role);
  }

  function removeFromRole(role, modelId) {
    const key = { multi: 'multiModels', pro: 'debatePro', con: 'debateCon', judge: 'debateJudge', collab: 'collabModels' }[role];
    Store.state[key] = Store.state[key].filter(x => x !== modelId);
    Store.save();
    UI.renderChips(role);
  }

  /* ==================== 附件 ==================== */
  async function addAttachment(file) {
    try {
      const parsed = await Files.parse(file);
      if (parsed.kind === 'image') {
        const model = getModel(Store.state.currentModelId);
        if (model && !model.vision && Store.state.currentMode === 'single') {
          Toast.warning('当前模型不支持识图，图片将以链接形式占位；建议切换带「识图」标签的模型');
        }
        attachments.image = { name: parsed.name, dataUrl: parsed.dataUrl };
      } else {
        attachments.files.push(parsed);
        Toast.success('已解析：' + parsed.name + (parsed.truncated ? '（已截断）' : ''));
      }
      UI.renderAttachments();
    } catch (e) {
      Toast.error(e.message || '文件解析失败');
    }
  }

  function removeAttachment(key) {
    if (key === 'image') attachments.image = null;
    else if (key.startsWith('file:')) attachments.files.splice(+key.slice(5), 1);
    UI.renderAttachments();
  }

  function clearAttachments() {
    attachments.image = null;
    attachments.files = [];
    UI.renderAttachments();
  }

  /* 粘贴长文本自动转文件附件（Kimi 式）：与上传文件走同一条 files 链路 */
  function addPastedText(text) {
    const MAX = 24000; // 与 Files 文本注入上限一致
    text = String(text || '');
    let truncated = false;
    if (text.length > MAX) { text = text.slice(0, MAX); truncated = true; }
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
    const name = '粘贴文本-' + stamp + (looksLikeMarkdown(text) ? '.md' : '.txt');
    attachments.files.push({ kind: 'text', name, text, truncated, size: text.length });
    UI.renderAttachments();
    Toast.success('已将粘贴内容转为附件：' + name + (truncated ? '（已截断）' : ''));
  }

  /* 简单判断粘贴内容是否像 Markdown（标题/列表/引用/代码块/链接/表格） */
  function looksLikeMarkdown(text) {
    return /(^|\n)#{1,6}\s+\S/.test(text) || /```/.test(text) || /\[[^\]\n]+\]\([^)\n]+\)/.test(text) ||
      /(^|\n)\s*([-*+] |\d+\. )/.test(text) || /(^|\n)\s*> /.test(text) || /(^|\n)\s*\|[^\n]+\|/.test(text);
  }

  /* ==================== 发送 ==================== */
  function isSending() { return sending; }

  function stop() {
    if (!sending) return;
    stopFlag = true;
    API.abortAll();
  }

  async function send(rawContent) {
    if (sending) return;
    const input = $('#chatInput');
    const content = (rawContent !== undefined ? rawContent : input.value).trim();
    if (!content && !attachments.image && !attachments.files.length) return;

    const mode = Store.state.currentMode;
    // 模式前置校验
    if (mode === 'multi' && !Store.state.multiModels.length) return Toast.warning('请先在上方配置多模型（至少 1 个）');
    if (mode === 'debate' && (!Store.state.debatePro.length || !Store.state.debateCon.length)) return Toast.warning('请先配置正方和反方模型');
    if (mode === 'collab' && Store.state.collabModels.length < 2) return Toast.warning('协同模式至少需要 2 个模型');

    const chat = ensureChat();
    // 手表端仅支持单模型
    if (window.DeviceInfo && DeviceInfo.isWatch() && mode !== 'single') {
      Store.state.currentMode = 'single';
      UI.updateModeSel(); UI.renderModeConfig();
      Toast.info('手表端已切换为单模型模式');
      chat.mode = 'single';
    } else {
      chat.mode = mode;
    }

    // 附件打包
    const filesText = Files.wrapAsContext(attachments.files);
    const img = attachments.image;
    const at = { image: img, filesText };

    const userMsg = { id: genId(), role: 'user', content, ts: Date.now(), image: img ? img.dataUrl : null, files: attachments.files.map(f => f.name) };
    if (filesText) userMsg.filesText = filesText; // 文件文本上下文持久化，编辑重发时附件不丢失（老数据无此字段则退化为纯文本）
    chat.messages.push(userMsg);
    if (!chat.title || chat.title === '新对话') chat.title = makeTitle(content || (img ? '图片对话' : '文件分析'));
    chat.updatedAt = Date.now();
    Store.save();

    UI.appendMsg(userMsg);
    UI.renderSidebar();
    input.value = '';
    autoResize(input);
    $('#charCount').textContent = '0 字';
    clearAttachments();

    await runPipeline(chat, content, at, mode, { excludeId: userMsg.id });
  }

  /* 发送管线（send / 编辑重发共用）：按模式分发到各 runner */
  async function runPipeline(chat, content, at, mode, runnerOpts) {
    sending = true;
    stopFlag = false;
    UI.setSending(true);

    try {
      if (mode === 'multi') await runMulti(chat, content, at, runnerOpts);
      else if (mode === 'debate') await runDebate(chat, content);
      else if (mode === 'collab') await runCollab(chat, content, at, runnerOpts);
      else await runSingle(chat, content, at, runnerOpts);
    } catch (e) {
      if (e && e.name !== 'AbortError') Toast.error(e.message || '出错了');
    }

    sending = false;
    UI.setSending(false);
    UI.renderSidebar();
    Store.save();
  }

  function makeTitle(text) {
    return text.replace(/\s+/g, ' ').slice(0, 24) || '新对话';
  }

  /* 流式工具调用回调：快照写入 msg 并实时渲染卡片 */
  function toolCallHandler(msg) {
    return tcs => { if (!stopFlag) { msg.toolCalls = tcs; UI.setMsgToolCalls(msg.id, tcs, true); } };
  }

  /* 自动播报：开启后 AI 回复完成自动朗读全文（辩论/协同不调用，即不自动播） */
  function autoSpeak(content, msgId) {
    if (!Store.state.autoSpeak || !content) return;
    Voice.speak(content, msgId);
  }

  /* 结束（含中止）时将所有工具卡片定态为已完成，避免持久化后仍显示执行中 */
  function settleToolCalls(msg) {
    (msg.toolCalls || []).forEach(t => { t.status = 'done'; });
  }

  /* ==================== 单模型 ==================== */
  async function buildSendMessages(chat, content, at, opts) {
    opts = opts || {};
    const msgs = API.buildMessages(chat, content, at, { excludeId: opts.excludeId });
    // 联网搜索注入
    if (opts.webSearch !== false && Store.state.webSearch.enabled && Store.state.webSearch.tavilyKey && content) {
      try {
        Toast.info('正在联网搜索…');
        const data = await API.webSearch(content);
        if (data.results.length) {
          msgs.unshift({ role: 'system', content: API.buildSearchContext(content, data) });
          Toast.success('已获取 ' + data.results.length + ' 条搜索结果');
        }
      } catch (e) {
        Toast.warning('搜索失败，将离线回答：' + e.message);
      }
    }
    return msgs;
  }

  async function runSingle(chat, content, at, opts) {
    opts = opts || {};
    const modelId = opts.modelId || chat.modelId || Store.state.currentModelId;
    const msg = { id: genId(), role: 'assistant', modelId, content: '', thinking: '', toolCalls: [], ts: Date.now() };
    chat.messages.push(msg);
    UI.appendMsg(msg);

    const msgs = await buildSendMessages(chat, content, at, opts);
    // buildMessages 用了刚 push 的空消息，剔除
    const cleanMsgs = msgs.filter(m => !(m.role === 'assistant' && !m.content));

    try {
      const result = await API.chat({
        modelId, messages: cleanMsgs,
        onChunk: (chunk, full) => { if (!stopFlag) { msg.content = full; UI.setMsgContent(msg.id, full); } },
        onThinking: (t, fullT) => { if (!stopFlag) { msg.thinking = fullT; UI.setMsgThinking(msg.id, fullT); } },
        onToolCall: toolCallHandler(msg)
      });
      msg.content = result.content;
      msg.thinking = result.thinking || msg.thinking;
      if (result.toolCalls && result.toolCalls.length) msg.toolCalls = result.toolCalls;
      settleToolCalls(msg);
      UI.finishMsg(msg.id, msg.content);
      autoSpeak(msg.content, msg.id);
    } catch (e) {
      if (stopFlag || e.name === 'AbortError') {
        msg.content = msg.content || '';
        settleToolCalls(msg);
        UI.finishMsg(msg.id, msg.content);
      } else {
        msg.error = e.message;
        msg.content = '';
        settleToolCalls(msg);
        UI.setMsgError(msg.id, e.message);
      }
    }
    chat.updatedAt = Date.now();
  }

  /* ==================== 多模型并行 ==================== */
  async function runMulti(chat, content, at, opts) {
    opts = opts || {};
    const ids = Store.state.multiModels.slice(0, 8);
    const batchId = genId();
    let spoken = false; // 自动播报：多模型只读第一个完成的
    const tasks = ids.map(modelId => {
      const msg = { id: genId(), role: 'assistant', modelId, batchId, content: '', thinking: '', toolCalls: [], ts: Date.now() };
      chat.messages.push(msg);
      UI.appendMsg(msg);
      const msgs = API.buildMessages(chat, content, at, { excludeId: opts.excludeId }).filter(m => !(m.role === 'assistant' && !m.content));
      return API.chat({
        modelId, messages: msgs,
        onChunk: (c, full) => { if (!stopFlag) { msg.content = full; UI.setMsgContent(msg.id, full); } },
        onThinking: (t, fullT) => { if (!stopFlag) { msg.thinking = fullT; UI.setMsgThinking(msg.id, fullT); } },
        onToolCall: toolCallHandler(msg)
      }).then(r => {
        msg.content = r.content;
        msg.thinking = r.thinking || msg.thinking;
        if (r.toolCalls && r.toolCalls.length) msg.toolCalls = r.toolCalls;
        settleToolCalls(msg);
        UI.finishMsg(msg.id, msg.content);
        if (!spoken && Store.state.autoSpeak && msg.content) { spoken = true; autoSpeak(msg.content, msg.id); }
      }).catch(e => {
        settleToolCalls(msg);
        if (stopFlag || e.name === 'AbortError') { UI.finishMsg(msg.id, msg.content); }
        else { msg.error = e.message; msg.content = ''; UI.setMsgError(msg.id, e.message); }
      });
    });
    await Promise.all(tasks);
    chat.updatedAt = Date.now();
  }

  /* ==================== 辩论模式 ==================== */
  const DEBATE_ROLE_PROMPT = {
    pro: '你是辩论赛正方辩手。围绕辩题坚定支持正方立场，论据充分、逻辑严密、表达有感染力。每次发言控制在 250 字以内。',
    con: '你是辩论赛反方辩手。围绕辩题坚定支持反方立场，犀利反驳正方观点，论据充分、逻辑严密。每次发言控制在 250 字以内。',
    judge: '你是辩论赛裁判。客观中立地分析双方表现，指出亮点与漏洞，并最终给出评判结果。'
  };

  async function debateSpeak(chat, modelId, role, stage, topic, transcript) {
    if (stopFlag) throw new Error('__stopped__');
    const msg = { id: genId(), role: 'assistant', modelId, debateRole: role, stage, content: '', thinking: '', toolCalls: [], ts: Date.now() };
    chat.messages.push(msg);
    UI.appendMsg(msg);

    const historyText = transcript.slice(-14).map(t => '【' + t.who + '】' + t.text).join('\n\n');
    const userPrompt = '辩题：' + topic + (historyText ? '\n\n以下是目前的辩论记录：\n' + historyText : '') + '\n\n轮到你发言（' + stage + '），请直接输出发言内容：';
    const msgs = [
      { role: 'system', content: DEBATE_ROLE_PROMPT[role] },
      { role: 'user', content: userPrompt }
    ];

    try {
      const result = await API.chat({
        modelId, messages: msgs,
        onChunk: (c, full) => { if (!stopFlag) { msg.content = full; UI.setMsgContent(msg.id, full); } },
        onThinking: (t, fullT) => { if (!stopFlag) { msg.thinking = fullT; UI.setMsgThinking(msg.id, fullT); } },
        onToolCall: toolCallHandler(msg)
      });
      msg.content = result.content;
      if (result.toolCalls && result.toolCalls.length) msg.toolCalls = result.toolCalls;
      settleToolCalls(msg);
      UI.finishMsg(msg.id, msg.content);
      transcript.push({ who: (role === 'pro' ? '正方' : role === 'con' ? '反方' : '裁判') + '·' + stage, text: result.content });
    } catch (e) {
      settleToolCalls(msg);
      if (stopFlag || e.name === 'AbortError') { UI.finishMsg(msg.id, msg.content); throw new Error('__stopped__'); }
      msg.error = e.message;
      UI.setMsgError(msg.id, e.message);
      transcript.push({ who: stage, text: '（发言失败：' + e.message + '）' });
    }
    chat.updatedAt = Date.now();
  }

  async function runDebate(chat, topic) {
    const pros = Store.state.debatePro.slice(0, 3);
    const cons = Store.state.debateCon.slice(0, 3);
    const judges = Store.state.debateJudge.length ? Store.state.debateJudge : [Store.state.currentModelId];
    const rounds = Store.state.debateRounds;
    const format = Store.state.debateFormat;
    const transcript = [];

    const cycle = async (stageName, firstSpeaker) => {
      for (let r = 0; r < rounds; r++) {
        for (const m of (firstSpeaker === 'pro' ? pros : cons)) await debateSpeak(chat, m, firstSpeaker, stageName + ' 第' + (r + 1) + '轮', topic, transcript);
        for (const m of (firstSpeaker === 'pro' ? cons : pros)) await debateSpeak(chat, m, firstSpeaker === 'pro' ? 'con' : 'pro', stageName + ' 第' + (r + 1) + '轮', topic, transcript);
      }
    };

    if (format === 'battle') {
      await cycle('观点交锋', 'pro');
    } else if (format === 'fast') {
      for (const m of pros) await debateSpeak(chat, m, 'pro', '立论', topic, transcript);
      for (const m of cons) await debateSpeak(chat, m, 'con', '立论', topic, transcript);
      await cycle('自由辩论', 'con');
    } else {
      // standard：立论 → 攻辩 → 自由辩 → 总结
      for (const m of pros) await debateSpeak(chat, m, 'pro', '开篇立论', topic, transcript);
      for (const m of cons) await debateSpeak(chat, m, 'con', '开篇立论', topic, transcript);
      await cycle('攻辩', 'con');
      await cycle('自由辩论', 'pro');
      for (const m of cons) await debateSpeak(chat, m, 'con', '总结陈词', topic, transcript);
      for (const m of pros) await debateSpeak(chat, m, 'pro', '总结陈词', topic, transcript);
    }
    for (const m of judges.slice(0, 1)) await debateSpeak(chat, m, 'judge', '裁判点评', topic, transcript);
    chat.updatedAt = Date.now();
  }

  /* ==================== 协同合作 ==================== */
  async function collabSpeak(chat, modelId, role, stage, prompt, sysPrompt) {
    if (stopFlag) throw new Error('__stopped__');
    const msg = { id: genId(), role: 'assistant', modelId, collabRole: role, stage, content: '', thinking: '', toolCalls: [], ts: Date.now() };
    chat.messages.push(msg);
    UI.appendMsg(msg);
    const msgs = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: prompt }
    ];
    try {
      const result = await API.chat({
        modelId, messages: msgs,
        onChunk: (c, full) => { if (!stopFlag) { msg.content = full; UI.setMsgContent(msg.id, full); } },
        onThinking: (t, fullT) => { if (!stopFlag) { msg.thinking = fullT; UI.setMsgThinking(msg.id, fullT); } },
        onToolCall: toolCallHandler(msg)
      });
      msg.content = result.content;
      if (result.toolCalls && result.toolCalls.length) msg.toolCalls = result.toolCalls;
      settleToolCalls(msg);
      UI.finishMsg(msg.id, msg.content);
      return result.content;
    } catch (e) {
      settleToolCalls(msg);
      if (stopFlag || e.name === 'AbortError') { UI.finishMsg(msg.id, msg.content); throw new Error('__stopped__'); }
      msg.error = e.message;
      UI.setMsgError(msg.id, e.message);
      return '（执行失败：' + e.message + '）';
    } finally {
      chat.updatedAt = Date.now();
    }
  }

  async function runCollab(chat, task, at) {
    const models = Store.state.collabModels.slice(0, 6);
    const leader = models[0];
    const workers = models.slice(1);
    const rounds = Store.state.collabRounds;
    const leaderModel = getModel(leader);
    const filesNote = at && at.filesText ? '\n\n随附资料：\n' + at.filesText : '';

    // ① 主持人拆解任务
    const plan = await collabSpeak(chat, leader, 'leader', '任务拆解',
      '任务：' + task + filesNote + '\n\n你是项目主持人，请将任务拆解为 ' + workers.length + ' 个子任务，分配给 ' + workers.length + ' 位协作者（按序号 1-' + workers.length + ' 编号）。输出格式：\n总体思路：...\n子任务1：...\n子任务2：...\n（每个子任务一句话说明）',
      '你是一位项目主持人，擅长把复杂任务拆解成可并行执行的子任务。输出简洁、结构清晰。');

    // ② 协作者并行执行
    const workSys = '你是一位专业协作者，负责完成分配给你的子任务。输出高质量、可直接使用的内容，使用 Markdown 排版。';
    const doWork = (w, idx, extra) => {
      const m = getModel(w);
      return collabSpeak(chat, w, 'worker', '协作执行' + (extra ? '（修订）' : ''),
        '总任务：' + task + '\n\n主持人方案：\n' + plan + '\n\n你是协作者 ' + (idx + 1) + ' 号（' + (m ? m.name : '') + '），请完成分配给你的子任务部分：' + (extra || ''),
        workSys);
    };
    let results = await Promise.all(workers.map((w, i) => doWork(w, i)));

    // ③ 修订轮（主持人点评 → 协作者改进）
    for (let r = 1; r < rounds; r++) {
      const review = await collabSpeak(chat, leader, 'leader', '评审 第' + r + '轮',
        '总任务：' + task + '\n\n各协作者当前成果：\n' + results.map((t, i) => '【协作者' + (i + 1) + '】\n' + t).join('\n\n') + '\n\n请指出每份成果的不足之处与具体修改建议（分点、简短）。',
        '你是严格的评审专家，提出具体可执行的修改意见。');
      results = await Promise.all(workers.map((w, i) => doWork(w, i,
        '\n\n你上一版的成果：\n' + results[i] + '\n\n评审意见：\n' + review + '\n\n请输出修订后的完整版本：')));
    }

    // ④ 主持人汇总
    await collabSpeak(chat, leader, 'leader', '成果汇总',
      '总任务：' + task + '\n\n各协作者最终成果：\n' + results.map((t, i) => '【协作者' + (i + 1) + '】\n' + t).join('\n\n') + '\n\n请将所有成果整合为一份完整、连贯、高质量的最终交付内容。',
      '你是项目主持人，负责把多人成果整合为统一风格的最终交付物。输出完整内容，而非摘要。');
    chat.updatedAt = Date.now();
  }

  /* ==================== 消息操作 ==================== */
  async function regenerate(id) {
    if (sending) return Toast.warning('正在生成中，请先停止');
    const chat = getCurrentChat();
    if (!chat) return;
    const idx = chat.messages.findIndex(m => m.id === id);
    if (idx < 0) return;
    const msg = chat.messages[idx];

    // 找到前面的用户消息
    let userMsg = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'user') { userMsg = chat.messages[i]; break; }
    }
    if (!userMsg) return Toast.warning('找不到对应的提问');

    if (msg.batchId) {
      // 多模型单条重试
      chat.messages.splice(idx, 1);
      Store.save();
      UI.renderChat();
      sending = true; stopFlag = false; UI.setSending(true);
      const newMsg = { id: genId(), role: 'assistant', modelId: msg.modelId, batchId: msg.batchId, content: '', thinking: '', toolCalls: [], ts: Date.now() };
      chat.messages.splice(idx, 0, newMsg);
      UI.renderChat();
      const msgs = API.buildMessages(chat, userMsg.content, {}).filter(m => !(m.role === 'assistant' && !m.content));
      try {
        const r = await API.chat({
          modelId: newMsg.modelId, messages: msgs,
          onChunk: (c, full) => { if (!stopFlag) { newMsg.content = full; UI.setMsgContent(newMsg.id, full); } },
          onToolCall: toolCallHandler(newMsg)
        });
        newMsg.content = r.content;
        if (r.toolCalls && r.toolCalls.length) newMsg.toolCalls = r.toolCalls;
        settleToolCalls(newMsg);
        UI.finishMsg(newMsg.id, newMsg.content);
      } catch (e) {
        settleToolCalls(newMsg);
        if (!(stopFlag || e.name === 'AbortError')) { newMsg.error = e.message; UI.setMsgError(newMsg.id, e.message); }
      }
      sending = false; UI.setSending(false); Store.save();
      return;
    }

    // 单条重生成：删除该消息及其后所有 assistant 消息，重发
    chat.messages = chat.messages.slice(0, idx);
    Store.save();
    UI.renderChat();
    await send(userMsg.content);
  }

  /* 用户消息编辑重发（Kimi 式）：更新内容 → 截断其后所有消息 → 复用发送管线重跑。
   * 附件保留：图片与文件文本上下文从消息自身恢复（filesText 为 v5.6+ 新增字段，老数据无则退化为纯文本）。 */
  async function editAndResend(id, newContent) {
    if (sending) return Toast.warning('正在生成中，请先停止');
    const chat = getCurrentChat();
    if (!chat) return;
    const idx = chat.messages.findIndex(m => m.id === id);
    if (idx < 0) return;
    const msg = chat.messages[idx];
    if (msg.role !== 'user') return;
    const content = String(newContent == null ? '' : newContent).trim();
    if (!content && !msg.image && !(msg.files && msg.files.length)) return Toast.warning('内容不能为空');

    msg.content = content;
    chat.messages = chat.messages.slice(0, idx + 1); // 删除此消息之后的所有消息
    chat.updatedAt = Date.now();
    Store.save();
    UI.renderChat();
    UI.scrollToBottom(true);

    const at = { image: msg.image ? { name: '图片', dataUrl: msg.image } : null, filesText: msg.filesText || '' };
    const mode = chat.mode || 'single';
    // 模式前置校验（与 send 一致）
    if (mode === 'multi' && !Store.state.multiModels.length) return Toast.warning('请先在上方配置多模型（至少 1 个）');
    if (mode === 'debate' && (!Store.state.debatePro.length || !Store.state.debateCon.length)) return Toast.warning('请先配置正方和反方模型');
    if (mode === 'collab' && Store.state.collabModels.length < 2) return Toast.warning('协同模式至少需要 2 个模型');
    await runPipeline(chat, content, at, mode, { excludeId: msg.id });
  }

  function delMsg(id) {
    const chat = getCurrentChat();
    if (!chat) return;
    chat.messages = chat.messages.filter(m => m.id !== id);
    Store.save();
    UI.renderChat();
  }

  return {
    attachments, isSending, getCurrentChat,
    new: create, load, del, selectModel, selectMode,
    addToRole, removeFromRole,
    addAttachment, removeAttachment, clearAttachments, addPastedText,
    send, stop, regenerate, editAndResend, delMsg
  };
})();
