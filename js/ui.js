/* ==================== UI · 渲染层 ==================== */
const UI = (() => {

  // 全局日期格式化工具（供多选、回收站等使用）
  if (!window.fmtDate) {
    window.fmtDate = function(ts) {
      if (!ts) return '-';
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '-';
      const pad = n => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    };
  }

  let msgObserverBound = false;
  const scheduleRender = {}; // msgId -> rAF 调度器

  /* ==================== 页面切换 ==================== */
  function showLogin() {
    $('#loginPage').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    document.title = '第三方科技 · AI 智能聚合平台';
  }

  function showApp() {
    $('#loginPage').classList.add('hidden');
    $('#appShell').classList.remove('hidden');
    // 手表端：强制单模型模式（界面为极简单栏设计）
    if (window.DeviceInfo && DeviceInfo.isWatch() && Store.state.currentMode !== 'single') {
      Store.state.currentMode = 'single';
      Store.save();
    }
    navigate(Store.state.currentPage || 'chat');
    renderSidebar();
    renderChat();
    updateModelSel();
    updateModeSel();
    renderModeConfig();
  }

  function navigate(page) {
    Store.state.currentPage = page;
    $$('.page').forEach(p => p.classList.remove('active'));
    const target = $('#page' + page.charAt(0).toUpperCase() + page.slice(1));
    if (target) target.classList.add('active');
    $$('[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    if (page === 'models') Pages.renderModels();
    if (page === 'discover') Pages.renderDiscover();
    if (page === 'profile') Pages.renderProfile();
    closeSidebarMobile();
  }

  /* ==================== 侧边栏 ==================== */
  /* 头像来源统一解析：云端 avatar → 本地 userInfo.avatar → state.avatar 图片 → 预设渐变首字 */
  function avatarView() {
    const cu = Store.state.cloudUser;
    const ui = Store.state.userInfo || {};
    const av = Store.state.avatar;
    if (cu && cu.avatar) return { img: cu.avatar };
    if (ui.avatar) return { img: ui.avatar };
    if (av && av.type === 'image' && av.data) return { img: av.data };
    return { grad: AVATAR_GRADS[(av && av.idx) || 0] || AVATAR_GRADS[0] };
  }

  /* 侧边栏用户卡 */
  function renderSidebarUser() {
    const u = Store.state.userInfo || {};
    const av = avatarView();
    const box = $('#sidebarUserAvatar');
    if (box) {
      if (av.img) box.innerHTML = '<img src="' + av.img + '">';
      else box.innerHTML = esc((u.name || 'U').charAt(0).toUpperCase());
      box.style.background = av.img ? 'transparent' : av.grad;
    }
    const nm = $('#sidebarUserName');
    if (nm) nm.textContent = u.name || '用户';
  }

  function renderSidebar(filter) {
    renderSidebarUser();
    const list = $('#sidebarList');
    const kw = (filter !== undefined ? filter : ($('#sidebarSearchInput').value || '')).trim();
    const chats = (Store.state.chats || []).filter(c => !kw || (c.title || '').toLowerCase().includes(kw.toLowerCase()));
    if (!chats.length) {
      list.innerHTML = '<div class="sidebar-empty">' + icon('messages', 34) + '<div>' + (kw ? '没有匹配的对话' : '暂无对话<br>点击右上角 + 开始新对话') + '</div></div>';
      return;
    }
    list.innerHTML = chats.map(c => {
      const active = c.id === Store.state.currentChatId ? ' active' : '';
      return '<div class="chat-item' + active + '" data-id="' + c.id + '">' +
        '<span class="item-icon">' + icon(MODE_META[c.mode] ? MODE_META[c.mode].icon : 'message', 15) + '</span>' +
        '<span class="chat-item-title">' + esc(c.title || '新对话') + '</span>' +
        '<span class="chat-item-meta">' + fmtTime(c.updatedAt) + '</span>' +
        '<button class="chat-item-del" data-del="' + c.id + '" title="删除">' + icon('trash', 13) + '</button>' +
        '</div>';
    }).join('');
  }

  function bindSidebarEvents() {
    /* ---------- 历史记录：点击切换 / 长按菜单 ---------- */
    const sidebarList = $('#sidebarList');
    let longPressTimer = null;
    let longPressTarget = null;
    let isLongPress = false;

    // 手表端：touch 事件（长按菜单 + 点击切换）
    sidebarList.addEventListener('touchstart', e => {
      const item = e.target.closest('.chat-item');
      if (!item) return;
      isLongPress = false;
      longPressTarget = item;
      longPressTimer = setTimeout(() => {
        isLongPress = true;
        if (longPressTarget) longPressTarget.classList.add('long-press');
        showWatchActionSheet(item.dataset.id);
      }, 500);
    }, { passive: true });

    sidebarList.addEventListener('touchmove', () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (longPressTarget) { longPressTarget.classList.remove('long-press'); longPressTarget = null; }
    }, { passive: true });

    sidebarList.addEventListener('touchend', e => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      const item = e.target.closest('.chat-item');
      if (longPressTarget) { longPressTarget.classList.remove('long-press'); }
      longPressTarget = null;
      if (isLongPress) { e.preventDefault(); isLongPress = false; return; }
      if (item) { Chat.load(item.dataset.id); closeSidebarMobile(); }
    });

    sidebarList.addEventListener('touchcancel', () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (longPressTarget) { longPressTarget.classList.remove('long-press'); longPressTarget = null; }
    }, { passive: true });

    // 桌面端：保留原有 click 逻辑
    sidebarList.addEventListener('click', e => {
      if (window.DeviceInfo && DeviceInfo.isWatch()) return;
      const del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        confirmDialog('删除对话', '删除后无法恢复，确定删除该对话吗？', true).then(ok => { if (ok) Chat.del(del.dataset.del); });
        return;
      }
      const item = e.target.closest('.chat-item');
      if (item) Chat.load(item.dataset.id);
    });
    $('#sidebarSearchInput').addEventListener('input', debounce(e => renderSidebar(e.target.value), 180));
    $('#sidebarNewBtn').addEventListener('click', e => { e.stopPropagation(); Chat.new(); });
    $('#sidebarUser').addEventListener('click', e => {
      if (e.target.closest('#sidebarNewBtn')) return;
      navigate('profile');
      closeSidebarMobile();
    });
    $('#exportHistoryBtn').addEventListener('click', () => {
      if (!Store.state.chats.length) return Toast.warning('暂无对话可导出');
      download('对话记录-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(Store.state.chats, null, 2), 'application/json');
      Toast.success('已导出 ' + Store.state.chats.length + ' 条对话');
    });
    $('#importHistoryBtn').addEventListener('click', () => $('#importHistoryFile').click());
    $('#importHistoryFile').addEventListener('change', async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await readFileAsText(file));
        const arr = Array.isArray(data) ? data : (data.chats || []);
        if (!arr.length) throw new Error('empty');
        Store.state.chats = arr.concat(Store.state.chats);
        Store.save();
        renderSidebar();
        Toast.success('已导入 ' + arr.length + ' 条对话');
      } catch (err) { Toast.error('导入失败：文件格式不正确'); }
    });
    $('#clearHistoryBtn').addEventListener('click', () => {
      if (!Store.state.chats.length) return Toast.warning('暂无对话');
      confirmDialog('清空全部对话', '将删除所有历史对话且无法恢复，确定继续吗？', true).then(ok => {
        if (ok) {
          Store.patch({ chats: [], currentChatId: null });
          renderSidebar(); renderChat();
          Toast.success('已清空');
        }
      });
    });
    // 桌面端折叠
    $('#sidebarToggle').addEventListener('click', () => {
      const sb = $('#sidebar');
      const collapsed = !sb.classList.contains('collapsed');
      sb.classList.toggle('collapsed', collapsed);
      $('#sidebarToggle').classList.toggle('collapsed', collapsed);
      Store.state.sidebarCollapsed = collapsed;
      Store.save();
    });
    // 移动端抽屉
    $('#hamburgerBtn').addEventListener('click', () => {
      $('#sidebar').classList.add('open');
      $('#sidebarOverlay').classList.add('show');
    });
    $('#sidebarOverlay').addEventListener('click', closeSidebarMobile);
  }

  function closeSidebarMobile() {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('show');
  }

  /* 手表端专用事件绑定 */
  (function bindWatchEvents() {
    const watchSearch = $('#sidebarSearchInputWatch');
    if (watchSearch) watchSearch.addEventListener('input', debounce(e => renderSidebar(e.target.value), 180));
    const watchNewBtn = $('#sidebarNewBtnWatch');
    if (watchNewBtn) watchNewBtn.addEventListener('click', () => Chat.new());
    const scanBtn = $('#sidebarScanBtn');
    if (scanBtn) scanBtn.addEventListener('click', () => Toast.info('扫一扫功能即将开放'));
  })();

  /* ---------- 手表端长按菜单 ---------- */
  function showWatchActionSheet(chatId) {
    let sheet = $('#watchActionSheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'watchActionSheet';
      sheet.className = 'watch-action-sheet';
      sheet.innerHTML = '<button class="watch-action-sheet-item" data-act="rename"><span class="icon">' + icon('edit', 20) + '</span>重命名</button>' +
        '<button class="watch-action-sheet-item" data-act="pin"><span class="icon">' + icon('pin', 20) + '</span>置顶</button>' +
        '<button class="watch-action-sheet-item" data-act="multi"><span class="icon">' + icon('checkSquare', 20) + '</span>多选</button>' +
        '<button class="watch-action-sheet-item danger" data-act="del"><span class="icon">' + icon('trash', 20) + '</span>删除</button>' +
        '<div class="watch-action-sheet-cancel" data-act="cancel">取消</div>';
      document.body.appendChild(sheet);
      sheet.addEventListener('click', e => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        const id = sheet.dataset.chatId;
        sheet.classList.remove('show');
        if (act === 'cancel') return;
        if (act === 'rename') {
          const chat = (Store.state.chats || []).find(c => c.id === id);
          const name = prompt('重命名对话', chat ? chat.title : '');
          if (name !== null && chat) { chat.title = name.trim() || chat.title; Store.save(); renderSidebar(); }
        } else if (act === 'pin') {
          const idx = (Store.state.chats || []).findIndex(c => c.id === id);
          if (idx > 0) { const c = Store.state.chats.splice(idx, 1)[0]; Store.state.chats.unshift(c); Store.save(); renderSidebar(); Toast.success('已置顶'); }
          else if (idx === 0) { Toast.info('已经在最顶部'); }
        } else if (act === 'multi') {
          openMultiSelectPage(id);
        } else if (act === 'del') {
          confirmDialog('删除对话', '删除后移入回收站，确定删除该对话吗？', true).then(ok => { if (ok) Chat.del(id); });
        }
      });
    }
    sheet.dataset.chatId = chatId;
    sheet.classList.add('show');
  }

  /* ==================== 模型选择器 ==================== */
  function updateModelSel() {
    const m = getModel(Store.state.currentModelId);
    $('#modelSelIcon').innerHTML = m ? providerIconHtml(m.provider, 19) : icon('cpu', 19);
    $('#modelSelLabel').textContent = m ? m.name : '选择模型';
    syncAttachBtn();
  }

  function renderModelDD(filter) {
    const body = $('#modelDDBody');
    const kw = (filter || '').trim().toLowerCase();
    // 已下架 / 专用（语音等）模型不可选：选择器只列出对话类在售模型
    const recent = (Store.state.recentModels || []).map(getModel).filter(isSelectableModel);
    let html = '';

    if (!kw && recent.length) {
      html += '<div class="dd-group-title">' + icon('history', 13) + ' 最近使用</div>';
      html += recent.map(m => ddItemHtml(m)).join('');
    }

    getProvidersInOrder().forEach(p => {
      const models = getProviderModels(p).filter(m => isSelectableModel(m) &&
        (!kw || m.name.toLowerCase().includes(kw) || m.id.toLowerCase().includes(kw) || p.toLowerCase().includes(kw)));
      if (!models.length) return;
      html += '<div class="dd-group-title">' + providerIconHtml(p, 15) + ' ' + esc(p) + '</div>';
      html += models.map(m => ddItemHtml(m)).join('');
    });

    body.innerHTML = html || '<div class="dd-empty">没有匹配的模型</div>';
  }

  function ddItemHtml(m) {
    const active = m.id === Store.state.currentModelId ? ' active' : '';
    let tags = '';
    if (m.status === 'new') tags += '<span class="tag new">' + I18n.t('models.new') + '</span>';
    if (m.vision) tags += '<span class="tag">' + I18n.t('tag.vision') + '</span>';
    if (m.thinking) tags += '<span class="tag">' + I18n.t('tag.thinking') + '</span>';
    if (m.ctx >= 512) tags += '<span class="tag">' + I18n.t('tag.long') + '</span>';
    return '<button class="dd-item' + active + '" data-model="' + m.id + '">' +
      providerIconHtml(m.provider, 20) +
      '<span class="dd-item-name">' + esc(m.name) + '</span>' +
      '<span class="dd-item-tags">' + tags + '</span></button>';
  }

  /* 排序：在售/新模型在前，已下架沉底 */
  function sortModels(models) {
    return models.slice().sort((a, b) => (a.status === 'deprecated' ? 1 : 0) - (b.status === 'deprecated' ? 1 : 0));
  }

  function bindModelDD() {
    const btn = $('#modelSelBtn'), dd = $('#modelDD');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const willOpen = !dd.classList.contains('show');
      closeAllDropdowns();
      if (willOpen) {
        dd.classList.add('show');
        btn.classList.add('open');
        renderModelDD();
        $('#modelSearchInput').value = '';
        setTimeout(() => $('#modelSearchInput').focus(), 60);
      }
    });
    $('#modelSearchInput').addEventListener('input', debounce(e => renderModelDD(e.target.value), 150));
    $('#modelDDBody').addEventListener('click', e => {
      const item = e.target.closest('[data-model]');
      if (!item) return;
      Chat.selectModel(item.dataset.model);
      closeAllDropdowns();
    });
  }

  /* ==================== 模式选择器 ==================== */
  function updateModeSel() {
    const meta = MODE_META[Store.state.currentMode] || MODE_META.single;
    $('#modeIcon').innerHTML = icon(meta.icon, 16);
    $('#modeLabel').textContent = I18n.t('mode.' + (Store.state.currentMode || 'single'));
    $$('#modeDD .mode-dd-item').forEach(el => el.classList.toggle('active', el.dataset.mode === Store.state.currentMode));
  }

  function bindModeDD() {
    const btn = $('#modeSelBtn'), dd = $('#modeDD');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const willOpen = !dd.classList.contains('show');
      closeAllDropdowns();
      if (willOpen) { dd.classList.add('show'); btn.classList.add('open'); }
    });
    $$('#modeDD .mode-dd-item').forEach(el => {
      el.addEventListener('click', () => {
        Chat.selectMode(el.dataset.mode);
        closeAllDropdowns();
      });
    });
  }

  function closeAllDropdowns() {
    $$('.dropdown').forEach(d => d.classList.remove('show'));
    $$('.selector-btn').forEach(b => b.classList.remove('open'));
    $('#modelPickerDD').classList.remove('show');
  }

  /* ==================== 模式配置条 ==================== */
  function renderModeConfig() {
    const mode = Store.state.currentMode;
    const bar = $('#modeConfig');
    if (mode === 'single') { bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    $('#multiConfig').style.display = mode === 'multi' ? 'block' : 'none';
    $('#debateConfig').style.display = mode === 'debate' ? 'block' : 'none';
    $('#collabConfig').style.display = mode === 'collab' ? 'block' : 'none';
    if (mode === 'multi') renderChips('multi');
    if (mode === 'debate') { renderChips('pro'); renderChips('con'); renderChips('judge'); }
    if (mode === 'collab') renderChips('collab');
    $('#debateRounds').value = Store.state.debateRounds;
    $('#debateFormat').value = Store.state.debateFormat;
    $('#collabRounds').value = Store.state.collabRounds;
  }

  const ROLE_STATE_KEY = { multi: 'multiModels', pro: 'debatePro', con: 'debateCon', judge: 'debateJudge', collab: 'collabModels' };
  const ROLE_CHIPS_ID = { multi: 'multiModelChips', pro: 'debateProChips', con: 'debateConChips', judge: 'debateJudgeChips', collab: 'collabModelChips' };

  function renderChips(role) {
    const box = $('#' + ROLE_CHIPS_ID[role]);
    const ids = Store.state[ROLE_STATE_KEY[role]] || [];
    box.innerHTML = ids.map(id => {
      const m = getModel(id);
      if (!m) return '';
      return '<span class="chip">' + providerIconHtml(m.provider, 16) + esc(m.name) +
        '<button class="chip-x" data-role="' + role + '" data-model="' + id + '" title="移除">' + icon('x', 10) + '</button></span>';
    }).join('');
    syncAttachBtn();
  }

  let pickerRole = null;
  function openModelPicker(role) {
    pickerRole = role;
    const dd = $('#modelPickerDD');
    dd.classList.add('show');
    renderModelPicker('');
    setTimeout(() => $('#modelPickerSearch').focus(), 60);
  }

  function renderModelPicker(kw) {
    const body = $('#modelPickerBody');
    kw = (kw || '').trim().toLowerCase();
    let html = '';
    getProvidersInOrder().forEach(p => {
      const models = getProviderModels(p).filter(m => isSelectableModel(m) &&
        (!kw || m.name.toLowerCase().includes(kw) || p.toLowerCase().includes(kw)));
      if (!models.length) return;
      html += '<div class="dd-group-title">' + providerIconHtml(p, 15) + ' ' + esc(p) + '</div>';
      html += models.map(m => {
        const picked = (Store.state[ROLE_STATE_KEY[pickerRole]] || []).includes(m.id);
        let tags = '';
        if (m.status === 'new') tags += '<span class="tag new">' + I18n.t('models.new') + '</span>';
        return '<button class="dd-item' + (picked ? ' active' : '') + '" data-pick="' + m.id + '">' +
          providerIconHtml(m.provider, 20) + '<span class="dd-item-name">' + esc(m.name) + '</span>' +
          '<span class="dd-item-tags">' + tags + '</span>' + (picked ? icon('check', 15) : '') + '</button>';
      }).join('');
    });
    body.innerHTML = html || '<div class="dd-empty">没有匹配的模型</div>';
  }

  function bindModeConfigEvents() {
    document.addEventListener('click', e => {
      const addBtn = e.target.closest('.add-model-btn');
      if (addBtn) { e.stopImmediatePropagation(); openModelPicker(addBtn.dataset.role); return; }
      const chipX = e.target.closest('.chip-x');
      if (chipX) { e.stopImmediatePropagation(); Chat.removeFromRole(chipX.dataset.role, chipX.dataset.model); return; }
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        e.stopImmediatePropagation();
        Chat.addToRole(pickerRole, pick.dataset.pick);
        renderModelPicker($('#modelPickerSearch').value);
      }
    });
    $('#modelPickerSearch').addEventListener('input', debounce(e => renderModelPicker(e.target.value), 150));
    $('#debateRounds').addEventListener('change', e => { Store.state.debateRounds = Math.max(1, Math.min(10, +e.target.value || 2)); Store.save(); });
    $('#debateFormat').addEventListener('change', e => { Store.state.debateFormat = e.target.value; Store.save(); });
    $('#collabRounds').addEventListener('change', e => { Store.state.collabRounds = Math.max(1, Math.min(5, +e.target.value || 2)); Store.save(); });
  }

  /* ==================== 对话渲染 ==================== */
  function renderWelcome() {
    const box = $('#chatContainer');
    const cards = [
      { icon: 'message', t: I18n.t('welcome.c1t'), d: I18n.t('welcome.c1d'), act: 'focus' },
      { icon: 'grid', t: I18n.t('welcome.c2t'), d: I18n.t('welcome.c2d'), act: 'multi' },
      { icon: 'sword', t: I18n.t('welcome.c3t'), d: I18n.t('welcome.c3d'), act: 'debate' },
      { icon: 'sparkles', t: I18n.t('welcome.c4t'), d: I18n.t('welcome.c4d'), act: 'discover' }
    ];
    box.innerHTML = '<div class="welcome"><div class="welcome-logo">' + icon('sparkles', 32) + '</div>' +
      '<h2>' + I18n.t('welcome.title') + '</h2>' +
      '<p>' + I18n.t('welcome.sub') + '</p>' +
      '<div class="welcome-cards">' + cards.map(c =>
        '<button class="welcome-card" data-act="' + c.act + '">' + icon(c.icon, 17) + '<span>' + c.t + '<small>' + c.d + '</small></span></button>').join('') +
      '</div></div>';
    $$('.welcome-card', box).forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'focus') $('#chatInput').focus();
      else if (act === 'discover') navigate('discover');
      else Chat.selectMode(act);
    }));
  }

  /* 预设角色横幅：显示当前会话的角色，可清除 */
  function syncPresetBanner() {
    const bar = $('#presetBanner');
    if (!bar) return;
    const chat = Chat.getCurrentChat();
    const preset = chat && chat.presetId && typeof findPreset === 'function' ? findPreset(chat.presetId) : null;
    if (!preset) { bar.hidden = true; return; }
    bar.hidden = false;
    $('#presetBannerIcon').innerHTML = icon(preset.icon, 14);
    $('#presetBannerIcon').style.background = preset.grad;
    $('#presetBannerName').textContent = preset.name;
  }

  function renderChat() {
    const box = $('#chatContainer');
    const chat = Chat.getCurrentChat();
    syncPresetBanner();
    Object.keys(scheduleRender).forEach(k => delete scheduleRender[k]);
    if (!chat || !chat.messages || !chat.messages.length) { box.className = 'chat-container'; renderWelcome(); return; }

    const chatMode = chat.mode || 'single';
    box.className = 'chat-container mode-' + chatMode;
    let html = '';
    let i = 0;
    let lastStage = '';
    const msgs = chat.messages;
    while (i < msgs.length) {
      const m = msgs[i];
      if (m.role === 'assistant' && m.batchId) {
        // 多模型批次：收集同批次消息渲染网格
        const batch = [];
        let j = i;
        while (j < msgs.length && msgs[j].role === 'assistant' && msgs[j].batchId === m.batchId) { batch.push(msgs[j]); j++; }
        html += multiGridHtml(batch);
        i = j;
        continue;
      }
      // 辩论/协同：阶段变化时插入分隔条
      if ((chatMode === 'debate' || chatMode === 'collab') && m.role === 'assistant' && m.stage && m.stage !== lastStage) {
        html += '<div class="stage-divider"><span>' + icon(chatMode === 'debate' ? 'sword' : 'handshake', 13) + ' ' + esc(m.stage) + '</span></div>';
        lastStage = m.stage;
      }
      html += msgHtml(m);
      i++;
    }
    box.innerHTML = html;
    box.dataset.lastStage = lastStage;
    afterRender(box);
    scrollToBottom(true);
  }

  function msgHtml(m) {
    if (m.role === 'user') {
      const av = userAvatarHtml();
      return '<div class="msg user" data-id="' + m.id + '">' +
        '<div class="msg-avatar">' + av + '</div>' +
        '<div class="msg-body"><div class="msg-head"><span class="msg-author">' + esc(Store.state.userInfo && Store.state.userInfo.name || '我') + '</span><span class="msg-time">' + fmtTime(m.ts) + '</span></div>' +
        (m.image ? '<img class="msg-image" src="' + m.image + '" alt="图片">' : '') +
        '<div class="msg-content">' + esc(m.content) + '</div>' +
        '<div class="msg-actions">' +
        '<button class="msg-action" data-act="copy" title="复制">' + icon('copy', 14) + '</button>' +
        '<button class="msg-action" data-act="edit" title="编辑重发">' + icon('edit', 14) + '</button>' +
        '<button class="msg-action danger" data-act="del" title="删除">' + icon('trash', 14) + '</button>' +
        '</div></div></div>';
    }
    // assistant
    const model = getModel(m.modelId);
    const name = model ? model.name : 'AI';
    let sideTag = '';
    if (m.debateRole === 'pro') sideTag = '<span class="side-tag pro">正方</span>';
    if (m.debateRole === 'con') sideTag = '<span class="side-tag con">反方</span>';
    if (m.debateRole === 'judge') sideTag = '<span class="side-tag judge">裁判</span>';
    if (m.collabRole === 'leader') sideTag = '<span class="side-tag judge">主持</span>';
    if (m.collabRole === 'worker') sideTag = '<span class="side-tag pro">协作者</span>';
    const roleCls = m.debateRole ? ' debate-' + m.debateRole : (m.collabRole ? ' collab-' + m.collabRole : '');

    return '<div class="msg assistant' + roleCls + '" data-id="' + m.id + '">' +
      '<div class="msg-avatar">' + (model ? providerIconHtml(model.provider, 22) : icon('bot', 18)) + '</div>' +
      '<div class="msg-body"><div class="msg-head"><span class="msg-author">' + esc(name) + '</span>' + sideTag +
      '<span class="msg-time">' + fmtTime(m.ts) + '</span></div>' +
      (m.stage ? '<div class="debate-stage">' + esc(m.stage) + '</div>' : '') +
      '<div class="thinking-slot">' + (m.thinking ? thinkingHtml(m.thinking, false) : '') + '</div>' +
      '<div class="toolcalls-slot">' + (m.toolCalls && m.toolCalls.length ? toolCallsHtml(m.toolCalls, false) : '') + '</div>' +
      '<div class="msg-content-slot">' + (m.error ? errorHtml(m.error) : (m.content ? renderMd(m.content) : '')) + '</div>' +
      '<div class="msg-actions">' +
      '<button class="msg-action" data-act="copy" title="复制">' + icon('copy', 14) + '</button>' +
      '<button class="msg-action" data-act="regen" title="重新生成">' + icon('refresh', 14) + '</button>' +
      '<button class="msg-action" data-act="speak" title="朗读">' + icon('volume', 14) + '</button>' +
      '<button class="msg-action danger" data-act="del" title="删除">' + icon('trash', 14) + '</button>' +
      '</div></div></div>';
  }

  function multiGridHtml(batch) {
    return '<div class="msg assistant"><div class="msg-body"><div class="multi-grid">' +
      batch.map(m => {
        const model = getModel(m.modelId);
        return '<div class="multi-card" data-id="' + m.id + '">' +
          '<div class="multi-card-head">' + (model ? providerIconHtml(model.provider, 18) : icon('bot', 16)) +
          '<span>' + esc(model ? model.name : 'AI') + '</span>' +
          '<div class="msg-actions always">' +
          '<button class="msg-action" data-act="copy" title="复制">' + icon('copy', 13) + '</button>' +
          '<button class="msg-action" data-act="regen" title="重新生成">' + icon('refresh', 13) + '</button>' +
          '</div></div>' +
          '<div class="thinking-slot">' + (m.thinking ? thinkingHtml(m.thinking, false) : '') + '</div>' +
          '<div class="toolcalls-slot">' + (m.toolCalls && m.toolCalls.length ? toolCallsHtml(m.toolCalls, false) : '') + '</div>' +
          '<div class="multi-card-body msg-content-slot">' + (m.error ? errorHtml(m.error) : (m.content ? renderMd(m.content) : '')) + '</div>' +
          '</div>';
      }).join('') + '</div></div></div>';
  }

  function thinkingHtml(text, live) {
    return '<div class="thinking-box' + (live ? ' live' : '') + '">' +
      '<button class="thinking-toggle">' +
      '<span class="thinking-brain">' + icon('brain', 14) + '</span>' +
      '<span class="thinking-label">' + (live ? '思考中…' : '思考已完成') + '</span>' +
      '<span class="thinking-copy" title="复制思考内容">' + icon('copy', 12) + '<span>复制</span></span>' +
      '<span class="chevron">' + icon('chevronDown', 13) + '</span></button>' +
      '<div class="thinking-content">' + esc(text) + '</div></div>';
  }

  /* 思考盒事件绑定：折叠切换 + 复制（阻止冒泡，点复制不触发折叠） */
  function bindThinking(toggle) {
    if (!toggle || toggle.dataset.bound) return;
    toggle.dataset.bound = '1';
    toggle.addEventListener('click', e => {
      if (e.target.closest('.thinking-copy')) return;
      toggle.closest('.thinking-box').classList.toggle('open');
    });
    const copyBtn = $('.thinking-copy', toggle);
    if (copyBtn) {
      copyBtn.addEventListener('click', e => {
        e.stopPropagation();
        const box = toggle.closest('.thinking-box');
        const content = box && $('.thinking-content', box);
        copyText(content ? content.textContent : '').then(() => {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = icon('check', 12) + '<span>已复制</span>';
          setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.innerHTML = icon('copy', 12) + '<span>复制</span>'; }, 1600);
        }).catch(() => {});
      });
    }
  }

  /* ==================== 工具调用卡片 ==================== */
  /* 按 function.name 智能匹配卡片类型（忽略大小写、包含匹配） */
  const TC_TYPES = [
    { type: 'terminal', re: /terminal|shell|bash|run_command|exec/i, icon: 'terminal', label: '运行终端' },
    { type: 'edit', re: /edit_file|write_file|apply_patch|str_replace|patch/i, icon: 'edit', label: '编辑文件' },
    { type: 'read', re: /read_file|open_file|view_file|cat/i, icon: 'fileText', label: '读取文件' },
    { type: 'search', re: /search|web_search|browser|google/i, icon: 'search', label: '搜索' }
  ];

  function tcType(name) {
    const hit = TC_TYPES.find(t => t.re.test(name || ''));
    return hit || { type: 'generic', icon: 'wand', label: '工具调用' };
  }

  /* arguments 为 JSON 字符串，流式时可能不完整，容错解析 */
  function tcParseArgs(tc) {
    if (!tc || !tc.arguments) return null;
    try { return JSON.parse(tc.arguments); } catch (e) { return null; }
  }

  function tcStatusHtml(live) {
    return live
      ? '<span class="toolcall-status running"><span class="tc-dot"></span>执行中…</span>'
      : '<span class="toolcall-status done">' + icon('check', 12) + '已完成</span>';
  }

  function toolCallsHtml(toolCalls, live) {
    return toolCalls.map((tc, i) => toolCardHtml(tc, live, tc.id || ('idx' + i))).join('');
  }

  function toolCardHtml(tc, live, key) {
    const meta = tcType(tc.name);
    return '<div class="toolcall-card tc-' + meta.type + (live ? ' live' : '') + '" data-tc="' + esc(key) + '">' +
      '<div class="toolcall-head">' + icon(meta.icon, 14) +
      '<span class="toolcall-name">' + esc(meta.label) + '</span>' +
      (tc.name ? '<span class="toolcall-fname">' + esc(tc.name) + '</span>' : '') +
      tcStatusHtml(live) +
      '</div>' +
      '<div class="toolcall-body">' + toolCardBodyHtml(tc, meta.type) + '</div>' +
      '<button class="tc-expand-btn" hidden>展开</button>' +
      '</div>';
  }

  function toolCardBodyHtml(tc, type) {
    const args = tcParseArgs(tc);
    const raw = '<pre class="tc-raw">' + esc(tc.arguments || '') + '</pre>';
    const resultNote = tc.result ? '<div class="tc-note">' + esc(tc.result) + '</div>' : '';
    const pathOf = a => a && (a.path || a.file_path || a.file || a.filename || a.target_file);
    const pathHtml = p => p ? '<div class="tc-path">' + icon('fileText', 12) + '<span>' + esc(p) + '</span></div>' : '';

    if (type === 'terminal') {
      let html = '<div class="tc-terminal">';
      const cmd = args && (args.command || args.cmd || args.script || args.code);
      html += '<div class="tc-cmd"><span class="tc-prompt">$</span> ' + esc(cmd != null ? String(cmd) : (tc.arguments || '')) + '</div>';
      if (args) {
        Object.keys(args).forEach(k => {
          if (/^(command|cmd|script|code)$/i.test(k)) return;
          const isErr = /^(stderr|error)$/i.test(k) || (/^exit_?code$/i.test(k) && +args[k] !== 0);
          const val = typeof args[k] === 'string' ? args[k] : JSON.stringify(args[k]);
          html += '<div class="tc-out' + (isErr ? ' tc-err' : '') + '">' + esc(k + ': ' + val) + '</div>';
        });
      }
      if (tc.result) html += '<div class="tc-out">' + esc(tc.result) + '</div>';
      return html + '</div>';
    }

    if (type === 'edit') {
      let html = pathHtml(pathOf(args));
      let diffText = '';
      if (args) {
        if (args.old_str != null || args.new_str != null || args.old_string != null || args.new_string != null) {
          const oldS = String(args.old_str != null ? args.old_str : (args.old_string || ''));
          const newS = String(args.new_str != null ? args.new_str : (args.new_string || ''));
          diffText = oldS.split('\n').map(l => '- ' + l).join('\n') + '\n' + newS.split('\n').map(l => '+ ' + l).join('\n');
        } else {
          diffText = String(args.content != null ? args.content : (args.patch != null ? args.patch : (args.diff != null ? args.diff : '')));
        }
      }
      if (diffText) html += '<div class="tc-diff">' + diffLinesHtml(diffText) + '</div>';
      else html += args ? '<pre class="tc-raw">' + esc(JSON.stringify(args, null, 2)) + '</pre>' : raw;
      return html + resultNote;
    }

    if (type === 'read') {
      let html = pathHtml(pathOf(args));
      const content = tc.result || (args && (args.content != null ? String(args.content) : '')) || '';
      if (content) html += '<div class="tc-code">' + codeLinesHtml(content) + '</div>';
      else if (!args) html += raw;
      return html;
    }

    if (type === 'search') {
      let html = '';
      const q = args && (args.query || args.keyword || args.keywords || args.q);
      if (q) html += '<div class="tc-query">' + icon('search', 12) + '<span>' + esc(q) + '</span></div>';
      else if (!args) html += raw;
      let list = null;
      if (tc.result) {
        try {
          const r = JSON.parse(tc.result);
          if (Array.isArray(r)) list = r;
          else if (r && Array.isArray(r.results)) list = r.results;
        } catch (e) {}
      }
      if (list && list.length) {
        html += '<div class="tc-results">' + list.slice(0, 8).map(r =>
          '<div class="tc-result-item">' +
          '<div class="tc-result-title">' + esc(r.title || r.name || r.url || '（无标题）') + '</div>' +
          (r.url ? '<div class="tc-result-url">' + esc(r.url) + '</div>' : '') +
          ((r.snippet || r.content) ? '<div class="tc-result-snippet">' + esc(String(r.snippet || r.content).slice(0, 160)) + '</div>' : '') +
          '</div>').join('') + '</div>';
      } else if (tc.result) {
        html += '<div class="tc-note">' + esc(tc.result) + '</div>';
      }
      return html;
    }

    // 未知工具：通用卡片，格式化 JSON（2 空格缩进）
    return (args ? '<pre class="tc-raw">' + esc(JSON.stringify(args, null, 2)) + '</pre>' : raw) + resultNote;
  }

  /* diff 渲染：+ 开头绿底、- 开头红底 */
  function diffLinesHtml(text) {
    return String(text).split('\n').map(line => {
      const cls = line.startsWith('+') ? ' diff-add' : line.startsWith('-') ? ' diff-del' : '';
      return '<span class="tc-diff-line' + cls + '">' + (esc(line) || ' ') + '</span>';
    }).join('');
  }

  /* 带行号代码块（读取文件卡片用，超长截断防卡顿） */
  function codeLinesHtml(text) {
    const lines = String(text).split('\n');
    const MAX = 400;
    const shown = lines.slice(0, MAX);
    let html = shown.map((l, i) =>
      '<div class="tc-code-line"><span class="tc-lno">' + (i + 1) + '</span><span class="tc-ltxt">' + (esc(l) || ' ') + '</span></div>').join('');
    if (lines.length > MAX) html += '<div class="tc-code-line"><span class="tc-lno">…</span><span class="tc-ltxt">（其余 ' + (lines.length - MAX) + ' 行省略）</span></div>';
    return html;
  }

  /* 超长内容默认折叠（>200px 显示「展开/收起」） */
  function syncTcCollapse(card) {
    const body = $('.toolcall-body', card);
    const btn = $('.tc-expand-btn', card);
    if (!body || !btn) return;
    const expanded = card.classList.contains('expanded');
    const need = body.scrollHeight > 210;
    btn.hidden = !need;
    card.classList.toggle('collapsed', need && !expanded);
    btn.textContent = expanded ? '收起' : '展开';
  }

  function errorHtml(err) {
    return '<div class="msg-error">' + icon('zap', 16) + '<span>' + esc(err) + '</span></div>';
  }

  /* 渲染后处理：思考折叠、工具卡片折叠、数学公式、灯箱、GitHub 推送卡片 */
  function afterRender(root) {
    $$('.thinking-toggle', root).forEach(bindThinking);
    $$('.toolcall-card', root).forEach(syncTcCollapse);
    $$('.msg-content-slot', root).forEach(el => MD.renderMath(el));
    $$('.msg-image', root).forEach(img => {
      if (img.dataset.bound) return;
      img.dataset.bound = '1';
      img.addEventListener('click', () => openLightbox(img.src));
    });
    scanGhWrite(root);
  }

  /* ==================== github-write 指令卡片 ====================
   * AI 回复中的 ```github-write 代码块：第一行 `path: 仓库内路径`，其余为文件内容。
   * GitHub 插件已启用时在代码块下方渲染推送操作卡片；未启用则代码块原样保留。
   * 注：MD 渲染器的围栏语言名不支持连字符（```github-write 无法成块），
   * 故渲染前先把该块抽出为占位符，MD 渲染后换回等价代码块 HTML。
   * 占位符必须纯字母（MD 行内代码占位符会吞掉数字）。 */
  const GHWRITE_RE = /(^|\n)```github-write[ \t]*\n([\s\S]*?)(?:\n[ \t]*```[ \t]*(\n|$)|$(?![\s\S]))/g;

  function ghLetters(n) {
    let s = '';
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
  }
  function ghLettersNum(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }

  /* 替代 MD.render：额外支持 github-write 指令块 */
  function renderMd(content) {
    const src0 = String(content == null ? '' : content).replace(/\r\n?/g, '\n');
    if (src0.indexOf('```github-write') < 0) return MD.render(src0);
    const blocks = [];
    const src = src0.replace(GHWRITE_RE, (m, lead, raw) => {
      blocks.push(raw);
      return lead + '\nGHWRITEBLOCK' + ghLetters(blocks.length - 1) + '\n\n';
    });
    return MD.render(src).replace(/<p>GHWRITEBLOCK([A-Z]+)<\/p>|GHWRITEBLOCK([A-Z]+)/g,
      (m, a, b) => ghWriteBlockHtml(blocks[ghLettersNum(a || b)] || ''));
  }

  function ghWriteBlockHtml(raw) {
    return '<div class="code-block gh-write-block"><div class="code-block-head"><span class="code-lang">github-write</span>' +
      '<button class="code-copy" data-code="' + encodeURIComponent(raw) + '">' + icon('copy', 13) + '<span>复制</span></button></div>' +
      '<pre><code>' + esc(raw) + '</code></pre></div>';
  }

  function ghConfig() {
    if (typeof Plugins === 'undefined' || typeof Plugins.getGithub !== 'function') return null;
    const cfg = Plugins.getGithub();
    return cfg && cfg.enabled ? cfg : null;
  }

  function scanGhWrite(root) {
    if (!root) return;
    $$('.code-block', root).forEach(block => {
      if (block.dataset.ghBound) return;
      const langEl = $('.code-lang', block);
      if (!langEl || langEl.textContent.trim().toLowerCase() !== 'github-write') return;
      const cfg = ghConfig();
      if (!cfg) return; // 插件未配置：不标记，后续渲染可再触发
      const copyBtn = $('.code-copy', block);
      let raw = '';
      try { raw = decodeURIComponent((copyBtn && copyBtn.dataset.code) || ''); } catch (e) { return; }
      const lines = raw.split('\n');
      const pm = (lines[0] || '').match(/^\s*path:\s*(\S+)\s*$/i);
      if (!pm) return;
      block.dataset.ghBound = '1';
      block.insertAdjacentHTML('afterend', ghCardHtml(pm[1], lines.slice(1).join('\n'), cfg.repo));
    });
  }

  function ghCardHtml(path, content, repo) {
    return '<div class="gh-write-card" data-path="' + esc(path) + '" data-content="' + esc(encodeURIComponent(content)) + '">' +
      '<span class="gh-file">' + icon('fileText', 15) + '<span class="gh-path">' + esc(path) + '</span></span>' +
      '<button class="gh-push-btn" type="button">' + icon('upload', 14) +
      '<span>推送到 GitHub' + (repo ? ' (' + esc(repo) + ')' : '') + '</span></button></div>';
  }

  function doGhPush(cardEl) {
    const cfg = ghConfig();
    if (!cfg || typeof Plugins.githubPush !== 'function') { Toast.warning('请先在「我的 → 插件」中配置 GitHub'); return; }
    let content = '';
    try { content = decodeURIComponent(cardEl.dataset.content || ''); } catch (e) {}
    setGhState(cardEl, 'loading');
    Plugins.githubPush(cardEl.dataset.path, content, 'AI 助手提交')
      .then(url => setGhState(cardEl, 'done', url))
      .catch(err => setGhState(cardEl, 'error', null, (err && err.message) || '推送失败'));
  }

  function setGhState(cardEl, state, url, errMsg) {
    const btn = $('.gh-push-btn', cardEl);
    if (!btn) return;
    btn.disabled = state === 'loading';
    if (state === 'loading') {
      btn.innerHTML = '<span class="gh-spinner"></span><span>推送中…</span>';
    } else if (state === 'done') {
      btn.className = 'gh-push-btn gh-done';
      btn.innerHTML = icon('check', 14) + '<span>已推送</span>' + icon('external', 12);
      btn.title = '在 GitHub 打开';
      btn.dataset.url = url || '';
    } else if (state === 'error') {
      btn.className = 'gh-push-btn gh-error';
      btn.innerHTML = icon('refresh', 13) + '<span>' + esc(errMsg || '推送失败') + '，点击重试</span>';
      btn.title = '推送失败，点击重试';
    }
  }

  function openLightbox(src) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<img src="' + src + '">';
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
  }

  /* ==================== 流式更新 ==================== */
  function appendMsg(m) {
    // 欢迎页 → 清空
    if ($('.welcome')) $('#chatContainer').innerHTML = '';
    if (m.role === 'assistant' && m.batchId) {
      // 多模型：找到/创建批次网格
      let grid = $('#chatContainer [data-batch="' + m.batchId + '"] .multi-grid');
      if (!grid) {
        $('#chatContainer').insertAdjacentHTML('beforeend', '<div class="msg assistant" data-batch="' + m.batchId + '"><div class="msg-body"><div class="multi-grid"></div></div></div>');
        grid = $('#chatContainer [data-batch="' + m.batchId + '"] .multi-grid');
      }
      grid.insertAdjacentHTML('beforeend', multiCardHtml(m));
    } else {
      // 辩论/协同：流式追加时同步插入阶段分隔条
      const box = $('#chatContainer');
      if (m.role === 'assistant' && m.stage && box.dataset.lastStage !== m.stage) {
        const cm = (Chat.getCurrentChat() || {}).mode || 'single';
        if (cm === 'debate' || cm === 'collab') {
          box.insertAdjacentHTML('beforeend', '<div class="stage-divider"><span>' + icon(cm === 'debate' ? 'sword' : 'handshake', 13) + ' ' + esc(m.stage) + '</span></div>');
          box.dataset.lastStage = m.stage;
        }
      }
      box.insertAdjacentHTML('beforeend', msgHtml(m));
    }
    scrollToBottom();
  }

  function multiCardHtml(m) {
    const model = getModel(m.modelId);
    return '<div class="multi-card" data-id="' + m.id + '">' +
      '<div class="multi-card-head">' + (model ? providerIconHtml(model.provider, 18) : icon('bot', 16)) +
      '<span>' + esc(model ? model.name : 'AI') + '</span>' +
      '<div class="msg-actions always">' +
      '<button class="msg-action" data-act="copy" title="复制">' + icon('copy', 13) + '</button>' +
      '<button class="msg-action" data-act="regen" title="重新生成">' + icon('refresh', 13) + '</button>' +
      '</div></div>' +
      '<div class="thinking-slot"></div><div class="toolcalls-slot"></div><div class="multi-card-body msg-content-slot"><span class="loading-dots"><span></span><span></span><span></span></span></div></div>';
  }

  function setMsgContent(id, text) {
    if (!scheduleRender[id]) {
      scheduleRender[id] = makeRafScheduler((el, t) => {
        el.innerHTML = renderMd(t) + '<span class="stream-cursor"></span>';
        scrollToBottom();
      });
    }
    const slot = $('#chatContainer [data-id="' + id + '"] .msg-content-slot');
    if (slot) scheduleRender[id](slot, text);
  }

  function setMsgThinking(id, text) {
    const slot = $('#chatContainer [data-id="' + id + '"] .thinking-slot');
    if (!slot) return;
    const existing = $('.thinking-box', slot);
    if (existing) {
      $('.thinking-content', existing).textContent = text;
    } else {
      slot.innerHTML = thinkingHtml(text, true);
      bindThinking($('.thinking-toggle', slot));
    }
    scrollToBottom();
  }

  /* 流式更新工具调用卡片：已存在则局部更新内容与状态，不存在则创建 */
  function setMsgToolCalls(id, toolCalls, live) {
    const slot = $('#chatContainer [data-id="' + id + '"] .toolcalls-slot');
    if (!slot || !toolCalls || !toolCalls.length) return;
    toolCalls.forEach((tc, i) => {
      const key = tc.id || ('idx' + i);
      const existing = $$('.toolcall-card', slot).find(c => c.dataset.tc === key);
      if (existing) {
        existing.classList.toggle('live', !!live);
        const st = $('.toolcall-status', existing);
        if (st) st.outerHTML = tcStatusHtml(live);
        const nameEl = $('.toolcall-fname', existing);
        if (nameEl && tc.name) nameEl.textContent = tc.name;
        const body = $('.toolcall-body', existing);
        if (body) {
          body.innerHTML = toolCardBodyHtml(tc, tcType(tc.name).type);
          syncTcCollapse(existing);
        }
      } else {
        slot.insertAdjacentHTML('beforeend', toolCardHtml(tc, live, key));
        const card = $$('.toolcall-card', slot).find(c => c.dataset.tc === key);
        if (card) syncTcCollapse(card);
      }
    });
    scrollToBottom();
  }

  /* 工具卡片定态：移除执行中样式，状态置为已完成 */
  function settleToolCards(card) {
    $$('.toolcall-card.live', card).forEach(c => {
      c.classList.remove('live');
      const st = $('.toolcall-status', c);
      if (st) st.outerHTML = tcStatusHtml(false);
    });
  }

  function finishMsg(id, content) {
    delete scheduleRender[id];
    const card = $('#chatContainer [data-id="' + id + '"]');
    if (!card) return;
    const slot = $('.msg-content-slot', card);
    if (slot) {
      slot.innerHTML = content ? renderMd(content) : '<span style="color:var(--text-3);font-size:13px">（无内容）</span>';
      MD.renderMath(slot);
      $$('.msg-image', slot).forEach(img => img.addEventListener('click', () => openLightbox(img.src)));
    }
    const think = $('.thinking-box', card);
    if (think) {
      think.classList.remove('live');
      const label = $('.thinking-label', think);
      if (label) label.textContent = '思考已完成';
    }
    settleToolCards(card);
    scanGhWrite(card);
    scrollToBottom();
  }

  function setMsgError(id, err) {
    delete scheduleRender[id];
    const card = $('#chatContainer [data-id="' + id + '"]');
    const slot = card && $('.msg-content-slot', card);
    if (slot) slot.innerHTML = errorHtml(err);
    if (card) {
      const think = $('.thinking-box', card);
      if (think) {
        think.classList.remove('live');
        const label = $('.thinking-label', think);
        if (label) label.textContent = '思考已完成';
      }
      settleToolCards(card);
    }
    scrollToBottom();
  }

  /* ==================== 消息操作 ==================== */
  function bindChatEvents() {
    const box = $('#chatContainer');
    MD.bindCopy(box);
    box.addEventListener('click', e => {
      // 工具卡片「展开/收起」
      const tcBtn = e.target.closest('.tc-expand-btn');
      if (tcBtn) {
        const tcCard = tcBtn.closest('.toolcall-card');
        if (tcCard) {
          const open = tcCard.classList.toggle('expanded');
          tcCard.classList.toggle('collapsed', !open);
          tcBtn.textContent = open ? '收起' : '展开';
        }
        return;
      }
      // GitHub 推送卡片：推送 / 重试 / 成功后打开链接
      const ghBtn = e.target.closest('.gh-push-btn');
      if (ghBtn) {
        if (ghBtn.disabled) return;
        if (ghBtn.dataset.url) { window.open(ghBtn.dataset.url, '_blank'); return; }
        const ghCard = ghBtn.closest('.gh-write-card');
        if (ghCard) doGhPush(ghCard);
        return;
      }
      // 用户消息内联编辑：保存并重新发送 / 取消
      const editBtn = e.target.closest('[data-edit-act]');
      if (editBtn) {
        const editingEl = editBtn.closest('.msg.user.editing');
        if (editingEl) {
          if (editBtn.dataset.editAct === 'save') {
            const ta = $('.msg-edit-area', editingEl);
            Chat.editAndResend(editingEl.dataset.id, ta ? ta.value : '');
          } else {
            renderChat(); // 取消编辑：数据未变，直接重绘恢复
          }
        }
        return;
      }
      const btn = e.target.closest('.msg-action');
      if (!btn) return;
      const card = btn.closest('[data-id]');
      if (!card) return;
      const id = card.dataset.id;
      const act = btn.dataset.act;
      const chat = Chat.getCurrentChat();
      const msg = chat && chat.messages.find(x => x.id === id);
      if (!msg) return;

      if (act === 'copy') copyText(msg.content || '').then(() => Toast.success('已复制'));
      else if (act === 'del') Chat.delMsg(id);
      else if (act === 'regen') Chat.regenerate(id);
      else if (act === 'edit') enterEditMode(card, msg);
      else if (act === 'speak') {
        if (Voice.isSpeaking(id)) Voice.stopSpeak();
        else Voice.speak(msg.content || '', id);
      }
    });
  }

  /* 用户消息内联编辑（Kimi 式）：气泡变为 textarea + 保存/取消 */
  function enterEditMode(card, msg) {
    if (!card || !msg || msg.role !== 'user') return;
    if (Chat.isSending()) return Toast.warning('正在生成中，请先停止');
    if ($('#chatContainer .msg.editing')) renderChat(); // 同时只保留一个编辑器
    const el = $('#chatContainer [data-id="' + msg.id + '"]');
    const contentEl = el && $('.msg-content', el);
    if (!contentEl) return;
    el.classList.add('editing');
    contentEl.innerHTML = '<textarea class="msg-edit-area" rows="3" placeholder="编辑消息内容…"></textarea>' +
      '<div class="msg-edit-btns">' +
      '<button class="btn btn-sm btn-ghost" data-edit-act="cancel">取消</button>' +
      '<button class="btn btn-sm btn-primary" data-edit-act="save">保存并重新发送</button>' +
      '</div>';
    const ta = $('.msg-edit-area', contentEl);
    ta.value = msg.content || '';
    autoResize(ta);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.addEventListener('input', () => autoResize(ta));
    ta.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); renderChat(); }
      else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); Chat.editAndResend(msg.id, ta.value); }
    });
  }

  function updateSpeakButtons() {
    $$('#chatContainer .msg-action[data-act="speak"]').forEach(btn => {
      const card = btn.closest('[data-id]');
      const speaking = card && Voice.isSpeaking(card.dataset.id);
      btn.classList.toggle('speaking', !!speaking);
      btn.innerHTML = icon(speaking ? 'volumeOff' : 'volume', 14);
      btn.title = speaking ? '停止朗读' : '朗读';
    });
    // 翻译空间结果卡片朗读按钮同步
    $$('#trResults [data-act="speak"]').forEach(btn => {
      const card = btn.closest('[data-tlang]');
      const speaking = card && Voice.isSpeaking('tr:' + card.dataset.tlang);
      btn.classList.toggle('speaking', !!speaking);
      btn.innerHTML = icon(speaking ? 'volumeOff' : 'volume', 13);
    });
  }

  /* ==================== 输入区 ==================== */
  /* 实时 token 估算（300ms 防抖；TokenStats 未加载时隐藏） */
  const updateTokenEst = debounce(() => {
    const el = $('#tokenEst');
    if (!el) return;
    if (typeof TokenStats === 'undefined') { el.hidden = true; return; }
    const v = $('#chatInput').value;
    if (!v) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = '≈ ' + TokenStats.fmt(TokenStats.estimate(v)) + ' tokens';
  }, 300);

  function bindInputEvents() {
    const input = $('#chatInput');
    input.addEventListener('input', () => {
      autoResize(input);
      $('#charCount').textContent = input.value.length + ' 字';
      updateTokenEst();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        Chat.send();
        updateTokenEst();
      }
    });
    input.addEventListener('paste', e => {
      const items = e.clipboardData && e.clipboardData.items;
      if (items) {
        for (const it of items) {
          if (it.type.startsWith('image/')) {
            e.preventDefault();
            const file = it.getAsFile();
            if (file) Chat.addAttachment(file);
            return;
          }
        }
      }
      // 长文本自动转文件附件（Kimi 式）：>800 字符，或 >300 字符且含 ≥10 个换行
      const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (text && (text.length > 800 || (text.length > 300 && (text.match(/\n/g) || []).length >= 10))) {
        e.preventDefault();
        Chat.addPastedText(text);
      }
    });

    $('#sendBtn').addEventListener('click', () => { Chat.isSending() ? Chat.stop() : Chat.send(); updateTokenEst(); });
    $('#attachBtn').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', e => {
      Array.from(e.target.files).forEach(f => Chat.addAttachment(f));
      e.target.value = '';
    });

    // 语音输入
    $('#micBtn').addEventListener('click', () => {
      if (Voice.isRecognizing()) { Voice.stopInput(); return; }
      const input = $('#chatInput');
      let baseText = input.value;
      const ok = Voice.startInput(
        (final, interim) => {
          input.value = baseText + final + interim;
          if (final) baseText += final;
          autoResize(input);
          $('#charCount').textContent = input.value.length + ' 字';
          updateTokenEst();
        },
        () => updateMicBtn()
      );
      if (ok) updateMicBtn();
    });

    // 联网开关（支持 Tavily 或厂商原生联网）
    $('#webSearchBtn').addEventListener('click', () => {
      const ws = Store.state.webSearch;
      const native = hasNativeSearch(getModel(Store.state.currentModelId));
      if (!ws.enabled && !ws.tavilyKey && !native) {
        Toast.warning('当前模型不支持厂商内置联网，请在「我的 → 插件」中配置 Tavily 搜索 Key');
        return;
      }
      ws.enabled = !ws.enabled;
      Store.save();
      updateWebSearchBtn();
      Toast.info(ws.enabled ? (ws.tavilyKey ? '联网搜索已开启' : '已开启厂商内置联网搜索') : '联网搜索已关闭');
    });

    // 深度思考开关（仅支持思考的模型显示）
    $('#thinkBtn').addEventListener('click', () => {
      Store.state.thinkingOn = !(Store.state.thinkingOn !== false);
      Store.save();
      syncThinkBtn();
      Toast.info(Store.state.thinkingOn ? '深度思考已开启' : '深度思考已关闭（响应更快）');
    });

    // 预设角色横幅：清除角色
    $('#presetBannerClear').addEventListener('click', () => {
      const chat = Chat.getCurrentChat();
      if (!chat) return;
      chat.presetId = '';
      chat.system = '';
      Store.save();
      syncPresetBanner();
      Toast.info('已清除角色设定，恢复为普通对话');
    });
  }

  /* 当前选择是否支持识图（决定附件按钮显隐） */
  function currentVisionOk() {
    const mode = Store.state.currentMode;
    const anyVision = ids => (ids || []).map(getModel).some(m => m && m.vision);
    if (mode === 'multi') return anyVision(Store.state.multiModels);
    if (mode === 'debate') return anyVision((Store.state.debatePro || []).concat(Store.state.debateCon || [], Store.state.debateJudge || []));
    if (mode === 'collab') return anyVision(Store.state.collabModels);
    const m = getModel(Store.state.currentModelId);
    return !!(m && m.vision);
  }

  function syncAttachBtn() {
    const btn = $('#attachBtn');
    if (btn) btn.style.display = currentVisionOk() ? '' : 'none';
    syncThinkBtn();
  }

  function syncThinkBtn() {
    const btn = $('#thinkBtn');
    if (!btn) return;
    const m = getModel(Store.state.currentModelId);
    const show = (Store.state.currentMode === 'single') && !!(m && m.thinking);
    btn.style.display = show ? '' : 'none';
    btn.classList.toggle('think-on', show && Store.state.thinkingOn !== false);
    btn.title = show ? (Store.state.thinkingOn !== false ? '深度思考：开（点击关闭）' : '深度思考：关（点击开启）') : '深度思考开关';
  }

  function updateMicBtn() {
    $('#micBtn').classList.toggle('recording', Voice.isRecognizing());
    $('#micBtn').innerHTML = icon(Voice.isRecognizing() ? 'micOff' : 'mic', 19);
  }

  function updateWebSearchBtn() {
    const on = Store.state.webSearch.enabled;
    $('#webSearchBtn').classList.toggle('toggled', on);
    $('#webSearchBadge').classList.toggle('hidden', !on);
  }

  function setSending(sending) {
    const btn = $('#sendBtn');
    btn.classList.toggle('stop', sending);
    btn.innerHTML = icon(sending ? 'stop' : 'send', 18);
    btn.title = sending ? '停止生成 (Esc)' : '发送';
    $('#chatInput').placeholder = sending ? 'AI 正在回复中，点击 ⏹ 可停止…' : '输入消息… (Enter 发送, Shift+Enter 换行)';
  }

  function renderAttachments() {
    const bar = $('#attachPreview');
    const at = Chat.attachments;
    let html = '';
    if (at.image) {
      html += '<div class="attach-item"><img src="' + at.image.dataUrl + '"><span class="attach-item-name">' + esc(at.image.name) + '</span>' +
        '<button class="attach-item-x" data-remove="image">' + icon('x', 10) + '</button></div>';
    }
    at.files.forEach((f, i) => {
      html += '<div class="attach-item">' + icon('fileText', 16) + '<span class="attach-item-name">' + esc(f.name) + '</span>' +
        (f.size ? '<span class="attach-item-size">' + fmtBytes(f.size) + '</span>' : '') +
        '<button class="attach-item-x" data-remove="file:' + i + '">' + icon('x', 10) + '</button></div>';
    });
    bar.innerHTML = html;
    $$('.attach-item-x', bar).forEach(b => b.addEventListener('click', () => Chat.removeAttachment(b.dataset.remove)));
  }

  /* ==================== 滚动 ==================== */
  let userScrolledUp = false;
  let jumpBtn = null; // 回到底部悬浮按钮（Kimi 式）
  function bindScroll() {
    const el = $('#chatScroll');
    el.addEventListener('scroll', () => {
      userScrolledUp = el.scrollHeight - el.scrollTop - el.clientHeight > 120;
      syncJumpBtn();
    }, { passive: true });
    ensureJumpBtn();
  }

  /* 回到底部悬浮按钮：距底部 >400px 时浮出，点击平滑回底并恢复跟随 */
  function ensureJumpBtn() {
    if (jumpBtn || !$('#pageChat')) return;
    jumpBtn = document.createElement('button');
    jumpBtn.id = 'jumpBottomBtn';
    jumpBtn.className = 'jump-bottom-btn';
    jumpBtn.title = '回到底部';
    jumpBtn.innerHTML = icon('chevronDown', 20);
    jumpBtn.addEventListener('click', () => {
      userScrolledUp = false;
      jumpBtn.classList.remove('show');
      const el = $('#chatScroll');
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
    $('#pageChat').appendChild(jumpBtn);
  }

  function syncJumpBtn() {
    const el = $('#chatScroll');
    if (!el || !jumpBtn) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    jumpBtn.classList.toggle('show', dist > 400);
  }

  function scrollToBottom(force) {
    const el = $('#chatScroll');
    if (!el) return;
    if (force || !userScrolledUp) {
      requestAnimationFrame(() => {
        // 强制回底（渲染/切会话）瞬时到位，避免平滑动画中途误判距离
        if (force) el.style.scrollBehavior = 'auto';
        el.scrollTop = el.scrollHeight;
        if (force) el.style.scrollBehavior = '';
        syncJumpBtn();
      });
    }
  }

  /* ==================== 头像 ==================== */
  function userAvatarHtml() {
    const av = avatarView();
    if (av.img) return '<img src="' + av.img + '" alt="">';
    const name = (Store.state.userInfo && Store.state.userInfo.name) || '我';
    return '<span style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:' + av.grad + ';color:#fff;font-weight:800;font-size:14px;border-radius:11px">' + esc(name.charAt(0).toUpperCase()) + '</span>';
  }

  const AVATAR_GRADS = [
    'linear-gradient(135deg,#6366F1,#8B5CF6)', 'linear-gradient(135deg,#0EA5E9,#38BDF8)',
    'linear-gradient(135deg,#10B981,#34D399)', 'linear-gradient(135deg,#F59E0B,#F97316)',
    'linear-gradient(135deg,#EC4899,#F472B6)', 'linear-gradient(135deg,#EF4444,#F87171)',
    'linear-gradient(135deg,#14B8A6,#2DD4BF)', 'linear-gradient(135deg,#64748B,#94A3B8)'
  ];

  /* ==================== 主题 ==================== */
  function applyTheme() {
    const t = Store.state.theme || 'system';
    const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0D0E13' : '#F5F6F8');
    const btn = $('#themeBtn');
    if (btn) btn.innerHTML = icon(dark ? 'sun' : 'moon', 19);
  }

  /* ==================== 移动端侧滑手势（Kimi 式） ====================
   * 对话页：左边缘（≤24px）右滑打开历史侧栏；侧栏打开时左滑关闭。
   * 仅移动端断点（与 layout.css 一致 max-width:860px）且非手表端启用；
   * 水平位移 >60px 且 >垂直位移*1.5 才触发，纵向滚动不受影响。 */
  function bindSwipeGesture() {
    const EDGE = 24, TRIGGER = 60, DECIDE = 8;
    let tracking = false, decided = false, startX = 0, startY = 0, mode = null; // mode: 'open' | 'close'
    const sb = () => $('#sidebar');
    const ov = () => $('#sidebarOverlay');
    const mobile = () => window.matchMedia('(max-width: 860px)').matches || (window.DeviceInfo && DeviceInfo.isWatch());
    const blocked = () => document.querySelector('.subpage.show') || document.querySelector('.modal-overlay.show');

    function cleanup() {
      tracking = false; decided = false; mode = null;
      const s = sb(), o = ov();
      s.classList.remove('swiping');
      s.style.transform = '';
      o.style.opacity = '';
      o.style.animation = '';
    }

    function endDrag(dx) {
      const s = sb(), o = ov();
      if (decided) {
        if (mode === 'open' && dx > TRIGGER) { s.classList.add('open'); o.classList.add('show'); }
        else if (mode === 'close' && dx < -TRIGGER) { s.classList.remove('open'); o.classList.remove('show'); }
        else if (mode === 'open') { o.classList.remove('show'); }
      } else if (mode === 'open') { o.classList.remove('show'); }
      cleanup();
    }

    document.addEventListener('touchstart', e => {
      if (!mobile() || blocked() || e.touches.length !== 1) return;
      const open = sb().classList.contains('open');
      const x = e.touches[0].clientX;
      if (!open) {
        if (x > EDGE || Store.state.currentPage !== 'chat') return; // 仅对话页左边缘起步可打开
        mode = 'open';
      } else {
        mode = 'close'; // 侧栏打开时，任意位置左滑可关闭
      }
      tracking = true; decided = false;
      startX = x; startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!tracking) return;
      if (e.touches.length !== 1) { endDrag(0); return; } // 多指介入：放弃手势并回弹
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < DECIDE && Math.abs(dy) < DECIDE) return;
        decided = true;
        // 水平意图（水平位移 > 垂直位移*1.5）才接管；否则交还列表纵向滚动
        if (Math.abs(dx) <= Math.abs(dy) * 1.5) { tracking = false; mode = null; return; }
        sb().classList.add('swiping'); // 拖拽期间关掉过渡，跟随手指
        ov().classList.add('show');
        ov().style.animation = 'none'; // 避免 fadeIn 覆盖拖拽中的内联透明度
      }
      e.preventDefault();
      const w = sb().getBoundingClientRect().width || 288;
      if (mode === 'open') {
        const p = Math.min(Math.max(dx / w, 0), 1);
        sb().style.transform = 'translateX(' + (-104 + p * 104) + '%)';
        ov().style.opacity = String(p);
      } else {
        const p = Math.min(Math.max(-dx / w, 0), 1);
        sb().style.transform = 'translateX(' + (-p * 104) + '%)';
        ov().style.opacity = String(1 - p);
      }
    }, { passive: false });

    document.addEventListener('touchend', e => {
      if (!tracking) return;
      endDrag(e.changedTouches[0].clientX - startX);
    }, { passive: true });

    document.addEventListener('touchcancel', () => { if (tracking) endDrag(0); }, { passive: true });
  }

  /* ==================== 顶栏右侧：自动播报 + 新对话（Kimi 式） ==================== */
  /* 自动播报双实例（同一 Store.state.autoSpeak，各自只绑一次事件）：
     - #autoSpeakBtn：顶栏右侧独立圆形按钮，仅桌面端显示（≤860px 由 CSS 隐藏）
     - #autoSpeakInputBtn：输入栏工具区（attach/mic/web/think 同排），仅 ≤860px 显示 */
  function injectTopbarActions() {
    const right = $('.topbar-right');
    const themeBtn = $('#themeBtn');
    if (!right || !themeBtn || $('#autoSpeakBtn')) return;

    const speakBtn = document.createElement('button');
    speakBtn.className = 'topbar-btn';
    speakBtn.id = 'autoSpeakBtn';
    speakBtn.addEventListener('click', toggleAutoSpeak);

    const newBtn = document.createElement('button');
    newBtn.className = 'topbar-btn';
    newBtn.id = 'newChatTopBtn';
    newBtn.title = '新对话';
    newBtn.innerHTML = icon('messagePlus', 19);
    newBtn.addEventListener('click', () => Chat.new());

    right.insertBefore(speakBtn, themeBtn);
    right.insertBefore(newBtn, themeBtn);

    // 移动端实例：注入输入栏工具区（thinkBtn 之后、输入框之前）
    const inputBox = $('.input-box');
    if (inputBox && !$('#autoSpeakInputBtn')) {
      const speakInBtn = document.createElement('button');
      speakInBtn.className = 'input-btn';
      speakInBtn.id = 'autoSpeakInputBtn';
      speakInBtn.addEventListener('click', toggleAutoSpeak);
      const thinkBtn = $('#thinkBtn');
      inputBox.insertBefore(speakInBtn, thinkBtn ? thinkBtn.nextSibling : $('#chatInput'));
    }
    syncAutoSpeakBtn();
  }

  function toggleAutoSpeak() {
    Store.state.autoSpeak = !Store.state.autoSpeak;
    Store.save();
    syncAutoSpeakBtn();
    if (!Store.state.autoSpeak) Voice.stopSpeak();
    Toast.info(Store.state.autoSpeak ? '自动播报已开启：AI 回复完成后自动朗读' : '自动播报已关闭');
  }

  function syncAutoSpeakBtn() {
    const on = !!Store.state.autoSpeak;
    const title = on ? '自动播报：开（点击关闭）' : '自动播报：关（点击开启）';
    [['#autoSpeakBtn', 'active'], ['#autoSpeakInputBtn', 'toggled']].forEach(pair => {
      const btn = $(pair[0]);
      if (!btn) return;
      btn.classList.toggle(pair[1], on);
      btn.innerHTML = icon(on ? 'volume' : 'volumeOff', 19);
      btn.title = title;
    });
  }

  /* ==================== 初始化绑定 ==================== */
  function init() {
    bindSidebarEvents();
    bindModelDD();
    bindModeDD();
    bindModeConfigEvents();
    bindChatEvents();
    bindInputEvents();
    bindScroll();
    bindSwipeGesture();
    injectTopbarActions();

    // 全局点击关闭下拉
    document.addEventListener('click', e => {
      if (!e.target.closest('.selector') && !e.target.closest('.mode-config')) closeAllDropdowns();
      else if (!e.target.closest('.selector') && !e.target.closest('#modelPickerDD') && !e.target.closest('.add-model-btn')) {
        $('#modelPickerDD').classList.remove('show');
      }
    });

    // 主题
    $('#themeBtn').addEventListener('click', () => {
      const order = ['light', 'dark', 'system'];
      const cur = Store.state.theme || 'system';
      const next = order[(order.indexOf(cur) + 1) % order.length];
      Store.state.theme = next;
      Store.save();
      applyTheme();
      Toast.info('主题：' + (next === 'light' ? '亮色' : next === 'dark' ? '暗色' : '跟随系统'));
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

    // 导航（底部 + 顶栏）
    $$('[data-page]').forEach(n => n.addEventListener('click', () => navigate(n.dataset.page)));

    // 快捷键
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { Chat.stop(); Voice.stopInput(); closeAllDropdowns(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); Chat.new(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); $('#chatInput').focus(); }
    });
  }

  return {
    showLogin, showApp, navigate, init,
    renderSidebar, renderChat, renderWelcome, appendMsg,
    setMsgContent, setMsgThinking, setMsgToolCalls, finishMsg, setMsgError,
    updateModelSel, updateModeSel, renderModeConfig, renderChips, syncAttachBtn,
    setSending, renderAttachments, updateMicBtn, updateWebSearchBtn, updateSpeakButtons,
    scrollToBottom, applyTheme, userAvatarHtml, avatarView, AVATAR_GRADS, openLightbox
  };

  /* ==================== 多选管理 ==================== */
  function openMultiSelectPage(initialId) {
    let page = $('#multiSelectPage');
    if (!page) {
      page = document.createElement('div');
      page.id = 'multiSelectPage';
      page.className = 'page multi-select-page';
      page.innerHTML =
        '<div class="page-header">' +
          '<button class="page-back" id="multiSelectBack"><span data-icon="chevronRight"></span></button>' +
          '<h2>多选管理</h2>' +
          '<button class="page-action" id="multiSelectAll">全选</button>' +
        '</div>' +
        '<div class="page-body" id="multiSelectBody"></div>' +
        '<div class="multi-select-bar" id="multiSelectBar">' +
          '<span id="multiSelectCount">已选择 0 条</span>' +
          '<button class="btn btn-sm" id="multiSelectPin">置顶</button>' +
          '<button class="btn btn-sm btn-danger" id="multiSelectDel">删除</button>' +
        '</div>';
      document.body.appendChild(page);
      $('#multiSelectBack').addEventListener('click', () => page.classList.remove('show'));
      $('#multiSelectAll').addEventListener('click', toggleSelectAll);
      $('#multiSelectDel').addEventListener('click', batchDelete);
      $('#multiSelectPin').addEventListener('click', batchPin);
    }
    renderMultiSelectList(initialId);
    page.classList.add('show');
  }

  function renderMultiSelectList(initialId) {
    const body = $('#multiSelectBody');
    const chats = Store.state.chats || [];
    if (!chats.length) {
      body.innerHTML = '<div class="empty" style="padding:40px;text-align:center;color:var(--text-3);">暂无对话</div>';
      updateSelectCount();
      return;
    }
    body.innerHTML = chats.map(c => {
      const size = estimateChatSize(c);
      const lastTime = c.messages && c.messages.length ? fmtDate(c.messages[c.messages.length - 1].time || c.updatedAt) : fmtDate(c.updatedAt);
      const checked = initialId && c.id === initialId ? 'checked' : '';
      return '<label class="multi-select-item" data-id="' + c.id + '">' +
        '<input type="checkbox" class="multi-select-check" ' + checked + '>' +
        '<span class="multi-select-info">' +
          '<span class="multi-select-title">' + esc(c.title || '未命名对话') + '</span>' +
          '<span class="multi-select-meta">' + size + ' · 最近使用 ' + lastTime + '</span>' +
        '</span>' +
      '</label>';
    }).join('');
    body.querySelectorAll('.multi-select-check').forEach(cb => {
      cb.addEventListener('change', updateSelectCount);
    });
    updateSelectCount();
  }

  function estimateChatSize(chat) {
    try {
      const json = JSON.stringify(chat);
      const bytes = new Blob([json]).size;
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    } catch (e) { return '0 B'; }
  }

  function toggleSelectAll() {
    const checks = document.querySelectorAll('.multi-select-check');
    const allChecked = Array.from(checks).every(c => c.checked);
    checks.forEach(c => { c.checked = !allChecked; });
    updateSelectCount();
  }

  function updateSelectCount() {
    const checked = document.querySelectorAll('.multi-select-check:checked').length;
    const countEl = $('#multiSelectCount');
    const barEl = $('#multiSelectBar');
    if (countEl) countEl.textContent = '已选择 ' + checked + ' 条';
    if (barEl) barEl.style.display = checked > 0 ? 'flex' : 'none';
  }

  function batchDelete() {
    const ids = Array.from(document.querySelectorAll('.multi-select-item')).filter(item => {
      return item.querySelector('.multi-select-check').checked;
    }).map(item => item.dataset.id);
    if (!ids.length) return Toast.warning('未选择任何对话');
    confirmDialog('批量删除', '将 ' + ids.length + ' 条对话移入回收站，确定继续吗？', true).then(ok => {
      if (!ok) return;
      ids.forEach(id => Chat.del(id));
      renderMultiSelectList();
      Toast.success('已移至回收站');
    });
  }

  function batchPin() {
    const ids = Array.from(document.querySelectorAll('.multi-select-item')).filter(item => {
      return item.querySelector('.multi-select-check').checked;
    }).map(item => item.dataset.id);
    if (!ids.length) return Toast.warning('未选择任何对话');
    const chats = Store.state.chats;
    const pinned = [];
    const rest = [];
    chats.forEach(c => {
      if (ids.includes(c.id)) pinned.push(c);
      else rest.push(c);
    });
    Store.state.chats = [...pinned, ...rest];
    Store.save();
    UI.renderSidebar();
    renderMultiSelectList();
    Toast.success('已置顶 ' + ids.length + ' 条');
  }

})();
