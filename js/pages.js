/* ==================== PAGES · 模型 / 发现 / 我的 ==================== */
const Pages = (() => {

  /* ==================== 模型列表页 ==================== */
  /* 排序：在售/新模型在前，已下架沉底 */
  function sortModels(models) {
    return models.slice().sort((a, b) => (a.status === 'deprecated' ? 1 : 0) - (b.status === 'deprecated' ? 1 : 0));
  }

  /* 「不可用」模型：已下架，或标注需内测/审核资格（无法直接调用），统一进折叠区 */
  function isUnavailableModel(m) {
    return m.status === 'deprecated' || (!!m.note && (m.note.indexOf('内测') >= 0 || m.note.indexOf('审核') >= 0));
  }

  function modelCardHtml(m) {
    const dep = m.status === 'deprecated';
    const nonChat = !isChatModel(m);
    let tags = '';
    if (m.status === 'new') tags += '<span class="tag new">' + I18n.t('models.new') + '</span>';
    if (dep) tags += '<span class="tag deprecated">' + I18n.t('models.dep') + '</span>';
    if (m.note) tags += '<span class="tag beta">' + esc(m.note) + '</span>';
    if (m.vision) tags += '<span class="tag vision">' + I18n.t('tag.vision') + '</span>';
    if (m.thinking) tags += '<span class="tag thinking">' + I18n.t('tag.thinking') + '</span>';
    if (m.ctx >= 512) tags += '<span class="tag long">' + I18n.t('tag.long') + '</span>';
    if (!nonChat && m.stream !== false) tags += '<span class="tag stream">' + I18n.t('tag.stream') + '</span>';
    if (nonChat) tags += '<span class="tag">' + esc(m.type) + '</span>';
    const cls = isUnavailableModel(m) ? ' deprecated' : (nonChat ? ' special' : '');
    return '<button class="model-card' + cls + '" data-model="' + m.id + '">' +
      providerIconHtml(m.provider, 34) +
      '<span class="model-card-info"><span class="model-card-name">' + esc(m.name) + '</span>' +
      '<span class="model-card-tags">' + tags + '</span></span>' +
      icon('arrowRight', 15) + '</button>';
  }

  function renderModels() {
    const kw = ($('#modelsSearchInput').value || '').trim().toLowerCase();
    const box = $('#modelsList');
    let html = '';
    if (!kw && typeof MODEL_RANK !== "undefined") html += renderRankSection();
    getProvidersInOrder().forEach(p => {
      const models = getProviderModels(p).filter(m =>
        !kw || m.name.toLowerCase().includes(kw) || m.id.toLowerCase().includes(kw) || p.toLowerCase().includes(kw));
      if (!models.length) return;
      const active = sortModels(models.filter(m => !isUnavailableModel(m)));
      const dep = sortModels(models.filter(isUnavailableModel));
      const keySet = !!getKeyForModel({ provider: p });
      html += '<div class="provider-section">' +
        '<div class="provider-head">' + providerIconHtml(p, 26) +
        '<span class="provider-name">' + esc(p) + '</span>' +
        '<span class="provider-count">' + models.length + ' 个模型</span>' +
        (keySet
          ? '<span class="badge success">Key 已配置</span>'
          : '<button class="badge key-link" data-keylink="' + esc(p) + '" title="点击去配置">Key 未配置 →</button>') +
        '</div><div class="model-grid">' +
        active.map(modelCardHtml).join('') + '</div>' +
        (dep.length
          ? '<button class="dep-fold" data-depfold>' + icon('chevronDown', 13) + ' 已下架 / 无法使用 ' + dep.length + ' 个模型（点击展开）</button>' +
            '<div class="model-grid dep-grid" hidden>' + dep.map(modelCardHtml).join('') + '</div>'
          : '') +
        '</div>';
    });
    box.innerHTML = html || '<div class="empty-state">' + icon('search', 44) + '<div class="empty-title">没有找到匹配的模型</div></div>';
    updateSyncHint();
  }

  /* ==================== 模型排行榜（置顶，柱状/雷达可切换） ==================== */
  const RANK_COLORS = ['#6366F1', '#F59E0B', '#10B981', '#EC4899', '#0EA5E9'];

  function renderRankSection() {
    return '<div class="settings-row clickable" id="rankEntryRow">' +
      '<span class="row-icon" data-icon="trophy"></span>' +
      '<span class="row-label"><span class="row-title">模型排行榜</span><span class="row-desc">公开榜单综合 · ' + esc(MODEL_RANK.updated) + ' 期</span></span>' +
      '<span class="chev" data-icon="chevronRight"></span></div>';
  }

  function drawRankChart() {
    const tab = Store.state.rankTab || 'overall';
    const list = MODEL_RANK[tab] || [];
    const chartBox = $('#rankChart'), listBox = $('#rankList');
    if (!chartBox || !listBox) return;
    const inCatalog = id => !!getModel(id);
    const axes = MODEL_RANK.axes || ['综合','推理','代码','长文本','多模态','速度'];
    const n = axes.length;

    if (tab === 'overall') {
      const top = list.filter(e => e.dims).slice(0, 5);
      const C = 150, R = 90, cx = C, cy = 125;
      const pt = (i, v) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / n;
        return [cx + Math.cos(a) * R * v / 100, cy + Math.sin(a) * R * v / 100];
      };
      let svg = '<svg viewBox="0 0 300 250" class="rank-svg radar">';
      [25, 50, 75, 100].forEach(r => {
        svg += '<polygon points="' + axes.map((_, i) => pt(i, r).join(',')).join(' ') + '" class="rk-ring"></polygon>';
      });
      axes.forEach((ax, i) => {
        const p = pt(i, 100), lp = pt(i, 115);
        svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" class="rk-axis"></line>' +
          '<text x="' + lp[0] + '" y="' + lp[1] + '" class="rk-axlabel" text-anchor="middle" dominant-baseline="middle">' + ax + '</text>';
      });
      top.forEach((e, k) => {
        svg += '<polygon points="' + e.dims.map((v, i) => pt(i, v).join(',')).join(' ') +
          '" fill="' + RANK_COLORS[k] + '" fill-opacity="0.10" stroke="' + RANK_COLORS[k] + '" stroke-width="1.8"></polygon>';
      });
      svg += '</svg>';
      chartBox.innerHTML = svg +
        '<div class="rk-legend">' + top.map((e, k) =>
          '<span class="rk-legend-item"><i style="background:' + RANK_COLORS[k] + '"></i>' + esc(e.name) + '</span>').join('') + '</div>';
    } else {
      const top = list.slice(0, 10);
      const min = Math.min.apply(null, top.map(e => e.score)) - 12;
      const max = Math.max.apply(null, top.map(e => e.score)) + 4;
      const W = 640, rowH = 30, labelW = 150, scoreW = 52;
      const barW = s => Math.max(6, (s - min) / (max - min) * (W - labelW - scoreW));
      let svg = '<svg viewBox="0 0 ' + W + ' ' + (top.length * rowH + 8) + '" class="rank-svg">';
      top.forEach((e, i) => {
        const y = i * rowH + 5;
        svg += '<text x="' + (labelW - 8) + '" y="' + (y + 16) + '" class="rk-label" text-anchor="end">' + esc(e.name) + '</text>' +
          '<rect x="' + labelW + '" y="' + (y + 3) + '" width="' + barW(e.score) + '" height="17" rx="4" fill="' + RANK_COLORS[i % 5] + '" fill-opacity="' + (0.95 - i * 0.055) + '"></rect>' +
          '<text x="' + (labelW + barW(e.score) + 7) + '" y="' + (y + 16) + '" class="rk-score">' + e.score + '</text>';
      });
      chartBox.innerHTML = svg + '</svg>';
    }

    listBox.innerHTML = list.map((e, i) => {
      const m = inCatalog(e.id);
      let radarHtml = '';
      if (e.dims && e.dims.length === 6) {
        const sz = 48, cx = sz/2, cy = sz/2, R = sz/2 - 4;
        const pt = (i, v) => {
          const a = -Math.PI / 2 + i * 2 * Math.PI / 6;
          return [cx + Math.cos(a) * R * v / 100, cy + Math.sin(a) * R * v / 100];
        };
        let svg = '<svg viewBox="0 0 ' + sz + ' ' + sz + '" class="rk-mini-radar">';
        [50, 100].forEach(r => {
          svg += '<polygon points="' + [0,1,2,3,4,5].map(i => pt(i, r).join(',')).join(' ') + '" class="rk-mini-ring"></polygon>';
        });
        svg += '<polygon points="' + e.dims.map((v, i) => pt(i, v).join(',')).join(' ') +
          '" fill="var(--accent)" fill-opacity="0.25" stroke="var(--accent)" stroke-width="1"></polygon>';
        svg += '</svg>';
        radarHtml = svg;
      }
      return '<button class="rank-row" data-rankmodel="' + e.id + '"' + (m ? '' : ' disabled') + ' title="' + (m ? '点击查看详情' : '本站暂未收录') + '">' +
        '<span class="rk-no' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span>' +
        providerIconHtml(e.provider, 20) +
        '<span class="rk-name">' + esc(e.name) + '</span>' +
        '<span class="rk-provider">' + esc(e.provider) + '</span>' +
        (radarHtml ? '<span class="rk-radar-wrap">' + radarHtml + '</span>' : '') +
        '<span class="rk-score-badge">' + e.score + '</span></button>';
    }).join('');
  }

  function bindRankEvents() {
    $('#modelsList').addEventListener('click', e => {
      const entry = e.target.closest('#rankEntryRow');
      if (entry) { openRankPage(); return; }
      const row = e.target.closest('[data-rankmodel]');
      if (row && !row.disabled) { openModelInfo(row.dataset.rankmodel); return; }
      const fold = e.target.closest('[data-depfold]');
      if (fold) {
        const grid = fold.nextElementSibling;
        const open = grid.hidden;
        grid.hidden = !open;
        fold.classList.toggle('open', open);
        fold.innerHTML = icon('chevronDown', 13) + (open ? ' 收起' : ' 已下架 / 无法使用 ' + grid.querySelectorAll('.model-card').length + ' 个模型（点击展开）');
        return;
      }
      const keyLink = e.target.closest('[data-keylink]');
      if (keyLink) {
        const p = keyLink.dataset.keylink;
        UI.navigate('profile');
        setTimeout(() => {
          openSub('subKeys');
          setTimeout(() => {
            const block = document.querySelector('.key-provider-block[data-provider="' + p + '"]');
            if (block) {
              block.classList.add('open');
              block.scrollIntoView({ behavior: 'smooth', block: 'center' });
              block.classList.add('flash');
              setTimeout(() => block.classList.remove('flash'), 1600);
            }
          }, 80);
        }, 120);
      }
    });
  }

  function openRankPage() {
    let page = $('#rankPage');
    if (!page) {
      page = document.createElement('div');
      page.id = 'rankPage';
      page.className = 'page rank-page';
      page.innerHTML =
        '<div class="page-header">' +
          '<button class="page-back" id="rankPageBack"><span data-icon="chevronRight"></span></button>' +
          '<h2>模型排行榜</h2>' +
        '</div>' +
        '<div class="page-body rank-page-body" id="rankPageBody"></div>';
      document.body.appendChild(page);
      $('#rankPageBack').addEventListener('click', () => page.classList.remove('show'));
    }
    Store.state.rankTab = Store.state.rankTab || 'overall';
    renderRankPageContent();
    page.classList.add('show');
  }

  function renderRankPageContent() {
    const tab = Store.state.rankTab || 'overall';
    const body = $('#rankPageBody');
    if (!body) return;
    const tabs = [
      {key:'overall', label:'综合榜'},
      {key:'coding', label:'代码榜'},
      {key:'english', label:'英文榜'},
      {key:'hard', label:'困难提示'},
      {key:'chinese', label:'中文榜'},
      {key:'multiturn', label:'多轮对话'},
      {key:'creative', label:'创意写作'},
      {key:'math', label:'数学榜'},
      {key:'instruct', label:'指令遵循'},
      {key:'japanese', label:'日语榜'},
      {key:'korean', label:'韩语榜'},
    ];
    const nav = tabs.map(t => '<button class="rank-nav-item' + (tab === t.key ? ' active' : '') + '" data-ranktab="' + t.key + '">' + t.label + '</button>').join('');
    body.innerHTML =
      '<div class="rank-layout">' +
        '<div class="rank-sidebar">' + nav + '</div>' +
        '<div class="rank-main">' +
          '<div class="rank-chart" id="rankChart"></div>' +
          '<div class="rank-list" id="rankList"></div></div></div>';
    drawRankChart();
    // 绑定导航点击
    body.querySelectorAll('[data-ranktab]').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.state.rankTab = btn.dataset.ranktab;
        Store.save();
        renderRankPageContent();
      });
    });
    // 绑定模型行点击
    const listBox = $('#rankList');
    if (listBox) {
      listBox.addEventListener('click', e => {
        const row = e.target.closest('[data-rankmodel]');
        if (row && !row.disabled) {
          const id = row.dataset.rankmodel;
          const m = getModel(id);
          if (m) openModelInfo(id);
        }
      });
    }
  }

  /* ==================== 模型详情弹窗 ==================== */
  function openModelInfo(id) {
    const m = getModel(id);
    if (!m) return;
    const dep = m.status === 'deprecated';
    const nonChat = !isChatModel(m);
    const keySet = !!getKeyForModel(m);
    // 榜单名次
    let rankHtml = '';
    if (typeof MODEL_RANK !== "undefined") {
      const oi = MODEL_RANK.overall.findIndex(e => e.id === id);
      const ci = MODEL_RANK.coding.findIndex(e => e.id === id);
      const parts = [];
      if (oi >= 0) parts.push('综合榜 #' + (oi + 1) + '（' + MODEL_RANK.overall[oi].score + ' 分）');
      if (ci >= 0) parts.push('代码榜 #' + (ci + 1) + '（' + MODEL_RANK.coding[ci].score + ' 分）');
      if (parts.length) rankHtml = '<div class="mi-rank">' + icon('trophy', 14) + ' ' + parts.join(' · ') + '</div>';
    }
    // 能力网格
    const caps = [
      { k: '上下文', v: (m.ctx >= 1024 ? (m.ctx / 1024).toFixed(m.ctx % 1024 ? 1 : 0) + 'M' : m.ctx + 'K') + ' tokens' },
      { k: '识图', v: m.vision ? '支持' : '不支持', on: !!m.vision },
      { k: '深度思考', v: m.thinking ? '支持' : '不支持', on: !!m.thinking },
      { k: '流式输出', v: m.stream === false ? '不支持' : '支持', on: m.stream !== false },
      { k: '类型', v: nonChat ? ({ tts: '语音合成', asr: '语音识别', voiceclone: '声音克隆', voicedesign: '音色设计' }[m.type] || m.type) : '文本对话' },
      { k: '状态', v: dep ? '已下架' : (m.status === 'new' ? '新上线' : '在售'), on: !dep }
    ];
    let tags = '';
    if (m.status === 'new') tags += '<span class="tag new">新上线</span>';
    if (dep) tags += '<span class="tag deprecated">已下架</span>';
    if (m.note) tags += '<span class="tag beta">' + esc(m.note) + '</span>';

    // 主按钮
    let actionHtml = '';
    if (dep) {
      actionHtml = '<div class="mi-note-bar">' + icon('info', 15) + ' 该模型已下架，仅供欣赏</div>';
    } else if (nonChat) {
      const target = (m.type || '').startsWith('tts') || m.type === 'voiceclone' || m.type === 'voicedesign' ? 'studio' : 'asr';
      actionHtml = '<button class="btn btn-primary btn-block" id="miAction" data-target="' + target + '">' +
        icon(target === 'studio' ? 'mic' : 'waveform', 16) + (target === 'studio' ? ' 打开语音工坊使用' : ' 去使用语音识别') + '</button>';
    } else if (isUnavailableModel(m)) {
      // 需内测/审核资格的对话模型：不出「开始使用」，避免选了也无法调用
      actionHtml = '<div class="mi-note-bar warn">' + icon('info', 15) + ' 该模型' + esc(m.note) + '，暂无法直接对话，需到厂商平台申请开通</div>';
    } else if (!keySet) {
      actionHtml = '<div class="mi-note-bar warn">' + icon('key', 15) + ' 尚未配置 ' + esc(m.provider) + ' 的 API Key</div>' +
        '<div class="mi-btns"><button class="btn btn-secondary" id="miGoKey">' + icon('key', 15) + ' 去配置 Key</button>' +
        '<button class="btn btn-primary" id="miAction" data-target="chat">' + icon('message', 16) + ' 仍要开始对话</button></div>';
    } else {
      actionHtml = '<button class="btn btn-primary btn-block" id="miAction" data-target="chat">' + icon('message', 16) + ' 开始使用</button>';
    }

    $('#modelInfoBody').innerHTML =
      '<div class="mi-head">' + providerIconHtml(m.provider, 52) +
        '<div class="mi-title"><div class="mi-name">' + esc(m.name) + '</div>' +
        '<div class="mi-provider">' + esc(m.provider) + '</div>' +
        (tags ? '<div class="mi-tags">' + tags + '</div>' : '') + '</div></div>' +
      (m.note ? '<div class="mi-note-bar warn">' + icon('zap', 15) + ' 该模型' + esc(m.note) + '，需到厂商平台申请开通后才能调用</div>' : '') +
      (m.desc ? '<p class="mi-desc">' + esc(m.desc) + '</p>' : '') +
      rankHtml +
      '<div class="mi-caps">' + caps.map(c =>
        '<div class="mi-cap' + (c.on === false ? ' off' : '') + '"><span class="mi-cap-k">' + c.k + '</span><span class="mi-cap-v">' + c.v + '</span></div>').join('') + '</div>' +
      actionHtml;

    $('#modelInfoModal').classList.add('show');
    const act = $('#miAction');
    if (act) act.addEventListener('click', () => {
      $('#modelInfoModal').classList.remove('show');
      const t = act.dataset.target;
      if (t === 'chat') {
        Chat.new();
        Chat.selectModel(m.id);
        Chat.selectMode('single');
        UI.navigate('chat');
        setTimeout(() => $('#chatInput').focus(), 250);
      } else if (t === 'studio') {
        openVoiceStudio(m.type === 'voiceclone' ? 'clone' : (m.type === 'voicedesign' ? 'design' : 'preset'));
      } else {
        UI.navigate('profile');
        setTimeout(() => openSub('subAsr'), 120);
        Toast.info('语音识别模型已就绪，在输入框点麦克风即可使用');
      }
    });
    const goKey = $('#miGoKey');
    if (goKey) goKey.addEventListener('click', () => {
      $('#modelInfoModal').classList.remove('show');
      UI.navigate('profile');
      setTimeout(() => {
        openSub('subKeys');
        setTimeout(() => {
          const block = document.querySelector('.key-provider-block[data-provider="' + m.provider + '"]');
          if (block) { block.classList.add('open'); block.scrollIntoView({ behavior: 'smooth', block: 'center' }); block.classList.add('flash'); setTimeout(() => block.classList.remove('flash'), 1600); }
        }, 80);
      }, 120);
    });
  }

  /* 同步按钮下方显示最后同步时间 */
  function updateSyncHint() {
    const el = $('#modelsSyncHint');
    if (!el) return;
    const data = ModelSync.getSyncData();
    const tsList = Object.keys(data).map(k => data[k].ts).filter(Boolean);
    if (!tsList.length) { el.textContent = '从已配置 Key 的厂商实时拉取最新模型列表'; return; }
    const last = new Date(Math.max.apply(null, tsList));
    const pad = n => String(n).padStart(2, '0');
    el.textContent = '上次同步：' + last.getFullYear() + '-' + pad(last.getMonth() + 1) + '-' + pad(last.getDate()) +
      ' ' + pad(last.getHours()) + ':' + pad(last.getMinutes()) + '（' + tsList.length + ' 家厂商）';
  }

  /* 同步全部已配置 Key 的厂商模型列表 */
  async function runModelSync() {
    const btn = $('#modelsSyncBtn');
    const keyed = Object.keys(PROVIDERS).filter(p => { try { return !!getKeyForModel({ provider: p }); } catch (e) { return false; } });
    if (!keyed.length) {
      Toast.warning('还没有配置任何 API Key，请先到「我的 → API Key」添加');
      return;
    }
    btn.disabled = true;
    btn.classList.add('syncing');
    const label = btn.querySelector('.sync-label');
    const oldText = label.textContent;
    const results = await ModelSync.syncAll(p => { label.textContent = '同步 ' + p + '…'; });
    let okCount = 0, failCount = 0;
    const fails = [];
    Object.keys(results).forEach(p => {
      if (results[p].ok) okCount++; else { failCount++; fails.push(p + '：' + results[p].error); }
    });
    btn.disabled = false;
    btn.classList.remove('syncing');
    label.textContent = oldText;
    renderModels();
    if (failCount) Toast.warning('同步完成：' + okCount + ' 家成功，' + failCount + ' 家失败（' + fails[0] + '）');
    else Toast.success('同步完成：' + okCount + ' 家厂商模型列表已更新');
  }

  function bindModelsEvents() {
    $('#modelsSearchInput').addEventListener('input', debounce(renderModels, 160));
    $('#modelsSyncBtn').addEventListener('click', runModelSync);
    bindRankEvents();
    $('#modelsList').addEventListener('click', e => {
      const card = e.target.closest('[data-model]');
      if (!card) return;
      openModelInfo(card.dataset.model); // 先进入详情页，再决定是否开始使用
    });
    $('#modelInfoClose').addEventListener('click', () => $('#modelInfoModal').classList.remove('show'));
    $('#modelInfoModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
  }

  /* ==================== 其他页（微信发现式条目） ==================== */
  function renderDiscover() {
    // 插件库条目描述随状态变化
    const row = $('#toolPlugins .row-desc');
    if (row) {
      const n = typeof Plugins !== 'undefined' ? Plugins.list().filter(p => p.enabled).length : 0;
      row.textContent = n ? n + ' ' + I18n.t('plg.rowOn') : I18n.t('more.pluginsD');
    }
    renderDiscoverTools();
  }

  /* 发现页工具区：动态渲染（数据源 Skills.listEnabled()，开关写回 Skills/toolsEnabled） */
  function renderDiscoverTools() {
    const box = $('#toolList');
    if (!box || typeof Skills === 'undefined') return;
    box.innerHTML = Skills.listEnabled().map(s =>
      '<div class="settings-row clickable tool-row' + (s.active ? '' : ' tool-off') + '" data-skill="' + s.id + '">' +
      '<span class="row-icon">' + icon(s.icon || 'wand', 17) + '</span>' +
      '<span class="row-label"><span class="row-title">' + esc(s.name) + '</span>' +
      '<span class="row-desc">' + esc(s.desc) + ' · 右侧开关启用/停用</span></span>' +
      '<label class="switch" title="启用/停用该工具"><input type="checkbox" data-skill-toggle="' + s.id + '"' + (s.active ? ' checked' : '') + '><span class="track"></span></label>' +
      '</div>').join('');
  }

  /* ==================== 效率工具（润色/摘要/代码解释，可开关；翻译已迁入独立空间） ==================== */
  const TOOLS = {
    polish: { name: '文本润色', icon: 'wand', btn: '开始润色', ph: '粘贴需要润色的文字…',
      sys: '你是一位文字润色专家。1）在保留原意与个人风格的前提下修改病句、优化表达；2）先给出润色后的全文；3）再用列表说明每处重要修改的理由。不要过度改写。' },
    summary: { name: '文章摘要', icon: 'fileText', btn: '生成摘要', ph: '粘贴长文（文章/报告/论文…）…',
      sys: '你是一位摘要专家。输出格式：1）「一句话总结」；2）「核心要点」3-7 条（每条一行，附关键数据）；3）「值得注意的细节」（可选）。忠实原文，不添加原文没有的观点。' },
    codeExplain: { name: '代码解释', icon: 'code', btn: '开始解释', ph: '粘贴代码片段…',
      sys: '你是一位代码讲解专家。1）先用一两句话概括这段代码的作用；2）分块逐行讲解关键逻辑；3）指出潜在问题与优化建议；4）涉及的概念简要科普。使用 Markdown 排版。' }
  };
  let currentTool = null;

  /* TOOLS 查不到时从 Skills 取（库技能 / 自定义技能走同一弹窗管线） */
  function getToolDef(id) {
    if (TOOLS[id]) return TOOLS[id];
    if (typeof Skills !== 'undefined') {
      const s = Skills.get(id);
      if (s) return { name: s.name, icon: s.icon || 'wand', btn: s.btn || '开始生成', ph: s.ph || '输入内容…', sys: s.promptTemplate };
    }
    return null;
  }

  function openTool(id) {
    const t = getToolDef(id);
    if (!t) return;
    currentTool = id;
    $('#toolModalTitle').textContent = t.name;
    $('#toolModalIcon').innerHTML = icon(t.icon, 17);
    $('#toolInput').placeholder = t.ph;
    $('#toolInput').value = '';
    $('#toolResult').innerHTML = '';
    $('#toolSendChat').style.display = 'none';
    $('#toolRun').innerHTML = icon(t.icon, 15) + ' ' + t.btn;
    $('#toolModal').classList.add('show');
    setTimeout(() => $('#toolInput').focus(), 150);
  }

  async function runTool() {
    const t = getToolDef(currentTool);
    if (!t) return;
    const input = $('#toolInput').value.trim();
    if (!input) return Toast.warning('请先输入内容');
    const model = getModel(Store.state.currentModelId);
    if (!model) return Toast.warning('请先在对话页选择一个模型');
    if (!getKeyForModel(model)) return Toast.warning('请先配置 ' + model.provider + ' 的 API Key（我的 → API Key）');
    const btn = $('#toolRun');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 处理中…';
    const box = $('#toolResult');
    box.innerHTML = '<div class="tool-result-body msg-content-slot"><span class="loading-dots"><span></span><span></span><span></span></span></div>';
    const body = box.firstElementChild;
    let full = '';
    try {
      const r = await API.chat({
        modelId: model.id,
        messages: [{ role: 'system', content: t.sys + '\n\n' + I18n.langHintForModel() }, { role: 'user', content: input }],
        onChunk: (c, f) => { full = f; body.innerHTML = MD.render(full); }
      });
      full = r.content || full;
      body.innerHTML = MD.render(full || '（无返回内容）');
      MD.renderMath(body);
      $('#toolSendChat').style.display = '';
    } catch (e) {
      body.innerHTML = '<div class="msg-error">' + icon('zap', 16) + '<span>' + esc(e.message) + '</span></div>';
    }
    btn.disabled = false;
    btn.innerHTML = icon(t.icon, 15) + ' ' + t.btn;
  }

  function bindToolEvents() {
    // 万能翻译：点击进入独立翻译空间（无开关）
    $('#toolTranslate').addEventListener('click', () => openSub('subTranslate'));
    // 发现页工具区（动态行，事件委托；行为与原三工具一致）
    $('#toolList').addEventListener('click', e => {
      if (e.target.closest('.switch')) return; // 点击开关区域不打开工具
      const row = e.target.closest('[data-skill]');
      if (!row || typeof Skills === 'undefined') return;
      const id = row.dataset.skill;
      if (!Skills.isEnabled(id)) return Toast.info('该工具已停用，点击右侧开关重新启用');
      openTool(id);
    });
    $('#toolList').addEventListener('change', e => {
      const tg = e.target.closest('[data-skill-toggle]');
      if (!tg || typeof Skills === 'undefined') return;
      const id = tg.dataset.skillToggle;
      Skills.toggle(id, tg.checked);
      const s = Skills.get(id);
      Toast.info(tg.checked ? '「' + s.name + '」已开启' : '「' + s.name + '」已停用' + (s.builtin ? '' : '，可从「技能库」重新添加'));
      renderDiscoverTools();
    });
    $('#toolModalClose').addEventListener('click', () => $('#toolModal').classList.remove('show'));
    $('#toolModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
    $('#toolRun').addEventListener('click', runTool);
    $('#toolSendChat').addEventListener('click', () => {
      const t = getToolDef(currentTool);
      if (!t) return;
      const text = $('#toolInput').value.trim();
      $('#toolModal').classList.remove('show');
      Chat.new({ title: t.name, mode: 'single' });
      UI.navigate('chat');
      $('#chatInput').value = '【' + t.name + '】\n' + text;
      autoResize($('#chatInput'));
      setTimeout(() => $('#chatInput').focus(), 250);
    });
  }

  /* ==================== Token 用量统计（数据来自 js/token.js 的 TokenStats） ==================== */
  function renderTokens() {
    const box = $('#tokenBody');
    if (!box) return;
    if (typeof TokenStats === 'undefined') {
      box.innerHTML = '<div class="empty-state">' + icon('zap', 44) + '<div class="empty-title">' + I18n.t('tk.empty') + '</div></div>';
      return;
    }
    const period = Store.state.tokenPeriod || 'all';
    const sort = Store.state.tokenSort || 'total';
    const cell = (v, k) => '<div class="tk-cell"><b>' + esc(v) + '</b><span>' + I18n.t(k) + '</span></div>';
    let html =
      '<div class="tk-total">' +
      cell(TokenStats.fmt(TokenStats.grand().total), 'tk.total') +
      cell(TokenStats.fmt(TokenStats.grand().prompt), 'tk.input') +
      cell(TokenStats.fmt(TokenStats.grand().completion), 'tk.output') +
      cell(TokenStats.fmt(TokenStats.grand().count), 'tk.calls') +
      '</div>' +
      '<div class="seg-btns tk-period" style="margin:8px 0;">' +
      '<button class="seg-btn' + (period === 'all' ? ' active' : '') + '" data-tkperiod="all">全部</button>' +
      '<button class="seg-btn' + (period === 'day' ? ' active' : '') + '" data-tkperiod="day">今日</button>' +
      '<button class="seg-btn' + (period === 'week' ? ' active' : '') + '" data-tkperiod="week">本周</button>' +
      '<button class="seg-btn' + (period === 'month' ? ' active' : '') + '" data-tkperiod="month">本月</button>' +
      '</div>' +
      '<div class="seg-btns tk-sort">' +
      '<button class="seg-btn' + (sort === 'total' ? ' active' : '') + '" data-tksort="total">' + I18n.t('tk.sortTotal') + '</button>' +
      '<button class="seg-btn' + (sort === 'recent' ? ' active' : '') + '" data-tksort="recent">' + I18n.t('tk.sortRecent') + '</button>' +
      '<button class="seg-btn' + (sort === 'count' ? ' active' : '') + '" data-tksort="count">' + I18n.t('tk.sortCount') + '</button>' +
      '</div>';
    // v5.3: 按周期聚合数据
    let groups = TokenStats.byProvider();
    let grand = TokenStats.grand();
    if (period !== 'all' && typeof aggregateTokenStats === 'function') {
      const agg = aggregateTokenStats(period);
      if (agg && Object.keys(agg.byModel).length) {
        const providerMap = {};
        Object.entries(agg.byModel).forEach(([modelId, stat]) => {
          const m = getModel(modelId);
          const p = m ? m.provider : '其他';
          if (!providerMap[p]) providerMap[p] = { provider: p, models: [], total: 0, prompt: 0, completion: 0, count: 0, lastTs: 0 };
          providerMap[p].models.push({ name: m ? m.name : modelId, id: modelId, prompt: stat.input, completion: stat.output, total: stat.input + stat.output, count: stat.count, lastTs: Date.now() });
          providerMap[p].total += stat.input + stat.output;
          providerMap[p].prompt += stat.input;
          providerMap[p].completion += stat.output;
          providerMap[p].count += stat.count;
        });
        groups = Object.values(providerMap);
        grand = { total: agg.totalInput + agg.totalOutput, prompt: agg.totalInput, completion: agg.totalOutput, count: Object.values(agg.byModel).reduce((a,v)=>a+v.count,0) };
      } else {
        groups = [];
        grand = { total: 0, prompt: 0, completion: 0, count: 0 };
      }
    }
    if (!groups.length || !grand.count) {
      html += '<div class="empty-state">' + icon('zap', 44) + '<div class="empty-title">' + I18n.t('tk.empty') + '</div></div>';
    } else {
      // 排序作用于厂商组与组内模型（字段同名，共用比较器）
      const sorters = {
        total: (a, b) => b.total - a.total,
        recent: (a, b) => (b.lastTs || 0) - (a.lastTs || 0),
        count: (a, b) => b.count - a.count
      };
      const by = sorters[sort] || sorters.total;
      html += groups.slice().sort(by).map(g =>
        '<div class="tk-group">' +
        '<div class="tk-provider">' + providerIconHtml(g.provider, 26) +
        '<span class="tk-pname">' + esc(g.provider) + '</span>' +
        '<span class="tk-ptotal">' + esc(TokenStats.fmt(g.total)) + '</span>' +
        '<span class="tk-pcount">' + g.count + ' ' + I18n.t('tk.times') + '</span></div>' +
        (g.models || []).slice().sort(by).map(m =>
          '<div class="tk-model">' +
          '<span class="tk-mname" title="' + esc(m.id) + '">' + esc(m.name || m.id) + '</span>' +
          '<span class="tk-mnums">' + I18n.t('tk.in') + ' ' + esc(TokenStats.fmt(m.prompt)) + ' · ' + I18n.t('tk.out') + ' ' + esc(TokenStats.fmt(m.completion)) + ' · ' + I18n.t('tk.sum') + ' ' + esc(TokenStats.fmt(m.total)) + '</span>' +
          '<span class="tk-mmeta">' + m.count + ' ' + I18n.t('tk.times') + ' · ' + (m.lastTs ? fmtTime(m.lastTs) : '-') + '</span>' +
          '</div>').join('') +
        '</div>').join('');
      html += '<button class="btn btn-danger btn-block tk-clear" id="tkClear">' + icon('trash', 15) + ' ' + I18n.t('tk.clear') + '</button>';
    }
    box.innerHTML = html;
  }

  function bindTokenEvents() {
    $('#tokenBody').addEventListener('click', e => {
      const sortBtn = e.target.closest('[data-tksort]');
      if (sortBtn) {
        Store.state.tokenSort = sortBtn.dataset.tksort;
        Store.save();
        renderTokens();
        return;
      }
      const periodBtn = e.target.closest('[data-tkperiod]');
      if (periodBtn) {
        Store.state.tokenPeriod = periodBtn.dataset.tkperiod;
        Store.save();
        renderTokens();
        return;
      }
      if (e.target.closest('#tkClear')) {
        confirmDialog(I18n.t('tk.clear'), I18n.t('tk.clearQ'), true).then(ok => {
          if (!ok) return;
          if (typeof TokenStats !== 'undefined') TokenStats.reset();
          renderTokens();
          Toast.success(I18n.t('tk.cleared'));
        });
      }
    });
  }

  /* ==================== 万能翻译（独立翻译空间，支持一对多） ==================== */
  const TR_LANGS = [
    { id: 'auto', name: '自动检测', en: 'Auto detect' },
    { id: 'zh', name: '中文', en: 'Chinese', prompt: '简体中文' },
    { id: 'en', name: '英语', en: 'English', prompt: '英语' },
    { id: 'ja', name: '日语', en: 'Japanese', prompt: '日语' },
    { id: 'ko', name: '韩语', en: 'Korean', prompt: '韩语' },
    { id: 'fr', name: '法语', en: 'French', prompt: '法语' },
    { id: 'de', name: '德语', en: 'German', prompt: '德语' },
    { id: 'es', name: '西语', en: 'Spanish', prompt: '西班牙语' },
    { id: 'ru', name: '俄语', en: 'Russian', prompt: '俄语' },
    { id: 'yue', name: '粤语', en: 'Cantonese', prompt: '粤语' }
  ];
  const TR_TARGET_IDS = ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'ru'];
  let trRunning = false;

  function trLang(id) { return TR_LANGS.find(l => l.id === id); }
  function trLangName(l) { return I18n.lang().startsWith('zh') ? l.name : l.en; }
  function trTargets() {
    const t = Store.state.trTargets;
    const list = (Array.isArray(t) && t.length ? t : ['en']).filter(id => TR_TARGET_IDS.indexOf(id) >= 0);
    return list.length ? list : ['en'];
  }

  function renderTranslate() {
    const src = Store.state.trSrc || 'auto';
    $('#trSrc').innerHTML = TR_LANGS.map(l =>
      '<option value="' + l.id + '"' + (l.id === src ? ' selected' : '') + '>' + esc(trLangName(l)) + '</option>').join('');
    $('#trSwap').disabled = src === 'auto';
    $('#trSwap').title = I18n.t('tr.swap');
    renderTrTargets();
    const eng = Store.state.trVoiceEngine || 'browser';
    $('#trVoiceEngine').innerHTML =
      '<option value="browser"' + (eng === 'browser' ? ' selected' : '') + '>' + I18n.t('tr.voiceBrowser') + '</option>' +
      '<option value="mimo"' + (eng === 'mimo' ? ' selected' : '') + '>' + I18n.t('tr.voiceMimo') + '</option>' +
      '<option value="clone"' + (eng === 'clone' ? ' selected' : '') + '>' + I18n.t('tr.voiceClone') + '</option>';
    $('#trMimoVoice').innerHTML = Voice.MIMO_VOICES.map(v =>
      '<option value="' + esc(v.id) + '"' + ((Store.state.trMimoVoice || 'mimo_default') === v.id ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('');
    syncTrVoiceRow();
    $('#trRun').innerHTML = icon('translate', 15) + ' ' + I18n.t('tr.run');
    updateTrCount();
  }

  function renderTrTargets() {
    const targets = trTargets();
    $('#trTargets').innerHTML = TR_TARGET_IDS.map(id =>
      '<button class="tr-chip' + (targets.indexOf(id) >= 0 ? ' active' : '') + '" data-trt="' + id + '">' + esc(trLangName(trLang(id))) + '</button>').join('');
  }

  function updateTrCount() {
    $('#trCount').textContent = $('#trInput').value.length + ' ' + I18n.t('input.chars');
  }

  function syncTrVoiceRow() {
    const eng = Store.state.trVoiceEngine || 'browser';
    $('#trMimoVoice').hidden = eng !== 'mimo';
    const btn = $('#trSampleBtn');
    btn.hidden = eng !== 'clone';
    if (eng === 'clone') {
      const s = Store.state.voiceSettings && Store.state.voiceSettings.cloneSample;
      btn.innerHTML = icon('mic', 13) + ' ' + esc(s && s.name ? s.name : I18n.t('tr.uploadSample'));
    }
  }

  /* 单语言独立调用，错误隔离：失败只影响该卡片并可重试 */
  async function translateOne(tid, text, src, modelId) {
    const target = trLang(tid);
    let card = $('#trResults .tr-card[data-tlang="' + tid + '"]');
    if (!card) {
      $('#trResults').insertAdjacentHTML('beforeend',
        '<div class="tr-card" data-tlang="' + tid + '">' +
        '<div class="tr-card-head"><span class="tr-card-lang">' + esc(trLangName(target)) + '</span>' +
        '<span class="tr-card-act">' +
        '<button class="tr-act" data-act="copy" title="' + I18n.t('tr.copy') + '">' + icon('copy', 13) + '</button>' +
        '<button class="tr-act" data-act="speak" title="' + I18n.t('tr.speak') + '">' + icon('volume', 13) + '</button>' +
        '</span></div>' +
        '<div class="tr-card-body"></div></div>');
      card = $('#trResults .tr-card[data-tlang="' + tid + '"]');
    }
    card.classList.add('loading');
    card.dataset.text = '';
    const body = card.querySelector('.tr-card-body');
    body.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
    const sys = '你是一位专业翻译。' +
      (src && src.id !== 'auto'
        ? '请将用户输入的' + src.prompt + '文本翻译成' + target.prompt + '。'
        : '请先自动判断用户输入文本的语言，再将其翻译成' + target.prompt + '。') +
      '规则：1）译文准确地道，符合目标语言母语表达习惯；2）只输出译文本身，不要解释、不要注音、不要寒暄；3）保留原文的段落与换行格式。';
    let full = '';
    try {
      const r = await API.chat({
        modelId,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: text }],
        onChunk: (c, f) => { full = f; body.textContent = f; }
      });
      full = String(r.content || full || '').trim();
      card.dataset.text = full;
      body.textContent = full || I18n.t('tr.noResult');
    } catch (err) {
      body.innerHTML = '<div class="msg-error">' + icon('zap', 16) + '<span>' + esc(err.message) + '</span></div>' +
        '<button class="btn btn-secondary btn-sm tr-retry" data-act="retry">' + icon('refresh', 13) + ' ' + I18n.t('tr.retry') + '</button>';
    }
    card.classList.remove('loading');
  }

  /* 无 Key / 未选模型引导（与效率工具同款 Toast） */
  function checkTrReady() {
    const model = getModel(Store.state.currentModelId);
    if (!model) { Toast.warning(I18n.t('tr.noModel')); return null; }
    if (!getKeyForModel(model)) { Toast.warning('请先配置 ' + model.provider + ' 的 API Key（我的 → API Key）'); return null; }
    return model;
  }

  async function runTranslate() {
    if (trRunning) return;
    const text = $('#trInput').value.trim();
    if (!text) return Toast.warning(I18n.t('tr.emptyInput'));
    const model = checkTrReady();
    if (!model) return;
    const targets = trTargets();
    const src = trLang(Store.state.trSrc || 'auto');
    trRunning = true;
    const btn = $('#trRun');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> ' + I18n.t('tr.running');
    $('#trResults').innerHTML = '';
    // 多目标语言并行流式渲染，单语言失败互不影响
    await Promise.allSettled(targets.map(tid => translateOne(tid, text, src, model.id)));
    trRunning = false;
    btn.disabled = false;
    btn.innerHTML = icon('translate', 15) + ' ' + I18n.t('tr.run');
    // v5.3: 保存翻译历史
    const history = Store.state.translateHistory || [];
    const results = [];
    document.querySelectorAll('.tr-result-card').forEach(card => {
      const lang = card.dataset.lang;
      const text = card.querySelector('.tr-result-text');
      if (lang && text) results.push({ lang, text: text.textContent });
    });
    if (results.length) {
      history.unshift({ src: text, targets: results, ts: Date.now() });
      if (history.length > 50) history.length = 50;
      Store.state.translateHistory = history;
      Store.save();
      renderTrHistory();
    }
  }

  /* 朗读：浏览器本地（跟随全局引擎）/ MiMo 音色 / 克隆我的声音 */
  function trSpeak(text, key) {
    if (Voice.isSpeaking(key)) { Voice.stopSpeak(); return; }
    const eng = Store.state.trVoiceEngine || 'browser';
    if (eng === 'mimo') { Voice.speakMimo(text, Store.state.trMimoVoice || 'mimo_default', key); return; }
    if (eng === 'clone') {
      const s = Store.state.voiceSettings && Store.state.voiceSettings.cloneSample;
      if (!s || !s.dataUrl) { Toast.warning(I18n.t('tr.needSample')); $('#trSampleFile').click(); return; }
      Voice.speakClone(text, s.dataUrl, key);
      return;
    }
    Voice.speak(text, key);
  }


  /* v5.3 翻译历史记录渲染 */
  function renderTrHistory() {
    const box = document.getElementById('trHistory');
    if (!box) return;
    const history = Store.state.translateHistory || [];
    if (!history.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="tr-history-title">最近翻译</div>' +
      history.slice(0, 10).map((h, i) => 
        '<div class="tr-history-item" data-idx="' + i + '">' +
        '<div class="tr-history-text">' + esc(h.src.slice(0, 60)) + (h.src.length > 60 ? '…' : '') + '</div>' +
        '<div class="tr-history-meta">' + fmtDate(h.ts) + ' · ' + h.targets.length + ' 语种</div>' +
        '</div>').join('');
  }
  function bindTranslateEvents() {
    // v5.3: 历史记录点击复用
    const histBox = document.getElementById('trHistory');
    if (histBox) {
      histBox.addEventListener('click', e => {
        const item = e.target.closest('.tr-history-item');
        if (!item) return;
        const idx = +item.dataset.idx;
        const h = (Store.state.translateHistory || [])[idx];
        if (!h) return;
        document.getElementById('trInput').value = h.src;
        updateTrCount();
      });
    }
    // v5.3: 收藏按钮
    const favBtn = document.getElementById('trFavBtn');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        const src = document.getElementById('trInput').value.trim();
        if (!src) return Toast.warning('请先输入要翻译的内容');
        const favs = Store.state.translateFavorites || [];
        if (favs.find(f => f.src === src)) return Toast.info('已在收藏中');
        favs.unshift({ src, ts: Date.now() });
        if (favs.length > 30) favs.length = 30;
        Store.state.translateFavorites = favs;
        Store.save();
        Toast.success('已收藏');
      });
    }
    $('#trSrc').addEventListener('change', e => {
      Store.state.trSrc = e.target.value;
      Store.save();
      $('#trSwap').disabled = e.target.value === 'auto';
    });
    $('#trTargets').addEventListener('click', e => {
      const chip = e.target.closest('[data-trt]');
      if (!chip) return;
      let targets = trTargets();
      const id = chip.dataset.trt;
      if (targets.indexOf(id) >= 0) {
        if (targets.length === 1) return Toast.info(I18n.t('tr.keepOne'));
        targets = targets.filter(t => t !== id);
      } else targets.push(id);
      Store.state.trTargets = targets;
      Store.save();
      renderTrTargets();
    });
    // 交换：源语言与第一个目标语言互换（自动检测时禁用）
    $('#trSwap').addEventListener('click', () => {
      const src = Store.state.trSrc || 'auto';
      if (src === 'auto') return Toast.info(I18n.t('tr.noAutoSwap'));
      const targets = trTargets();
      const first = targets[0];
      if (!first || first === src) return;
      const rest = targets.slice(1).filter(t => t !== src);
      rest.unshift(src);
      Store.state.trSrc = first;
      Store.state.trTargets = rest;
      Store.save();
      renderTranslate();
    });
    $('#trInput').addEventListener('input', updateTrCount);
    $('#trClear').addEventListener('click', () => {
      $('#trInput').value = '';
      updateTrCount();
      $('#trResults').innerHTML = '';
      $('#trInput').focus();
    });
    $('#trRun').addEventListener('click', runTranslate);
    $('#trVoiceEngine').addEventListener('change', e => {
      Store.state.trVoiceEngine = e.target.value;
      Store.save();
      syncTrVoiceRow();
      if (e.target.value === 'clone' && !(Store.state.voiceSettings && Store.state.voiceSettings.cloneSample)) $('#trSampleFile').click();
      if (e.target.value === 'mimo' && !Voice.engineKey('mimo', Voice.TTS_ENGINES)) Toast.warning('小米 MiMo ' + I18n.t('voice.needKey'));
    });
    $('#trMimoVoice').addEventListener('change', e => { Store.state.trMimoVoice = e.target.value; Store.save(); });
    $('#trSampleBtn').addEventListener('click', () => $('#trSampleFile').click());
    $('#trSampleFile').addEventListener('change', async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) return Toast.warning(I18n.t('tr.sampleTooBig'));
      const dataUrl = await readFileAsDataURL(file);
      Store.state.voiceSettings.cloneSample = { name: file.name, dataUrl };
      Store.save();
      syncTrVoiceRow();
      Toast.success(I18n.t('tr.sampleSaved'));
    });
    // 结果卡片：复制 / 朗读 / 重试（事件委托）
    $('#trResults').addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const card = btn.closest('[data-tlang]');
      if (!card) return;
      const tid = card.dataset.tlang;
      const text = card.dataset.text || card.querySelector('.tr-card-body').textContent;
      if (btn.dataset.act === 'copy') {
        copyText(text).then(() => Toast.success(I18n.t('tr.copied')));
      } else if (btn.dataset.act === 'speak') {
        trSpeak(text, 'tr:' + tid);
      } else if (btn.dataset.act === 'retry') {
        const input = $('#trInput').value.trim();
        if (!input) return Toast.warning(I18n.t('tr.emptyInput'));
        const model = checkTrReady();
        if (!model) return;
        translateOne(tid, input, trLang(Store.state.trSrc || 'auto'), model.id);
      }
    });
  }

  function bindDiscoverEvents() {
    $('#toolPaint').addEventListener('click', openPaintModal);
    $('#toolNovel') && $('#toolNovel').addEventListener('click', () => openSub('subBookshelf'));
    $('#toolComic') && $('#toolComic').addEventListener('click', () => openSub('subBookshelf'));
    $('#toolVoiceStudio').addEventListener('click', () => openVoiceStudio());
    $('#toolPresets').addEventListener('click', () => {
      renderPresetGrid();
      $('#presetsModal').classList.add('show');
    });
    $('#toolPlugins').addEventListener('click', () => openSub('subPlugins'));
    $('#presetsClose').addEventListener('click', () => $('#presetsModal').classList.remove('show'));
    $('#presetsModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
    $('#presetDetailClose').addEventListener('click', () => $('#presetDetailModal').classList.remove('show'));
    $('#presetDetailModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
    $('#presetCreateClose').addEventListener('click', () => $('#presetCreateModal').classList.remove('show'));
    $('#presetCreateModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
    $('#presetGrid').addEventListener('click', e => {
      const createCard = e.target.closest('[data-preset-create]');
      if (createCard) { $('#presetCreateModal').classList.add('show'); setTimeout(() => $('#pcName').focus(), 120); return; }
      const card = e.target.closest('[data-preset]');
      if (!card) return;
      const preset = findPreset(card.dataset.preset);
      if (!preset) return;
      openPresetDetail(preset);
    });
    $('#pcSave').addEventListener('click', saveCustomPreset);
  }

  function renderPresetGrid() {
    const customs = Store.state.customPresets || [];
    $('#presetGrid').innerHTML =
      PRESETS.map(p => presetCardHtml(p)).join('') +
      customs.map(p => presetCardHtml(p, true)).join('') +
      '<button class="preset-card create" data-preset-create>' +
      '<span class="p-icon" style="background:var(--bg);color:var(--text-3);border:1px dashed var(--border)">' + icon('plus', 21) + '</span>' +
      '<span><span class="p-name">创建角色</span><span class="p-desc">自定义提示词，打造专属助手</span></span></button>';
  }

  function presetCardHtml(p, custom) {
    return '<button class="preset-card" data-preset="' + p.id + '">' +
      '<span class="p-icon" style="background:' + p.grad + '">' + icon(p.icon, 21) + '</span>' +
      '<span><span class="p-name">' + esc(p.name) + (custom ? ' <em class="p-custom">自建</em>' : '') + '</span><span class="p-desc">' + esc(p.desc) + '</span></span></button>';
  }

  /* 角色详情：介绍 + 完整提示词 + 追加提示词（本地保存）+ 开启对话 */
  function openPresetDetail(p) {
    const extra = (Store.state.presetExtra || {})[p.id] || '';
    $('#presetDetailBody').innerHTML =
      '<div class="pd-head"><span class="p-icon" style="background:' + p.grad + '">' + icon(p.icon, 24) + '</span>' +
        '<div><div class="pd-name">' + esc(p.name) + '</div><div class="pd-desc">' + esc(p.desc) + '</div></div></div>' +
      '<div class="pd-how">' + icon('info', 14) + ' <b>角色如何起作用：</b>开启对话后，下方提示词会作为「系统提示」随每条消息一起发给模型，' +
        '模型会始终扮演该角色并按规则回答；你之后追加的要求会与原提示词合并生效。</div>' +
      '<div class="pd-label">角色提示词（System Prompt）</div>' +
      '<div class="pd-system">' + esc(p.system) + '</div>' +
      '<div class="pd-label">追加提示词（可选，仅保存在本机，与原提示词合并生效）</div>' +
      '<textarea class="textarea" id="pdExtra" rows="3" placeholder="例：回答尽量简短；每次结尾给我出一道练习题…">' + esc(extra) + '</textarea>' +
      '<div class="pd-btns">' +
        (p.custom ? '<button class="btn btn-secondary danger" id="pdDelete">' + icon('trash', 14) + ' 删除角色</button>' : '') +
        '<button class="btn btn-primary" id="pdStart">' + icon('message', 15) + ' 开启对话</button></div>';

    $('#presetDetailModal').classList.add('show');

    $('#pdStart').addEventListener('click', () => {
      const ex = $('#pdExtra').value.trim();
      Store.state.presetExtra = Store.state.presetExtra || {};
      if (ex) Store.state.presetExtra[p.id] = ex; else delete Store.state.presetExtra[p.id];
      Store.save();
      const system = p.system + (ex ? '\n\n【用户追加要求】\n' + ex : '');
      $('#presetDetailModal').classList.remove('show');
      $('#presetsModal').classList.remove('show');
      Chat.new({ title: p.name, system, presetId: p.id, mode: 'single' });
      Chat.selectMode('single');
      UI.navigate('chat');
      Toast.success('已开启「' + p.name + '」对话' + (ex ? '（含追加提示词）' : ''));
      setTimeout(() => $('#chatInput').focus(), 250);
    });

    const del = $('#pdDelete');
    if (del) del.addEventListener('click', () => {
      Store.state.customPresets = (Store.state.customPresets || []).filter(x => x.id !== p.id);
      Store.save();
      $('#presetDetailModal').classList.remove('show');
      renderPresetGrid();
      Toast.success('角色已删除');
    });
  }

  const PC_GRADS = ['linear-gradient(135deg,#6366F1,#8B5CF6)', 'linear-gradient(135deg,#0EA5E9,#38BDF8)', 'linear-gradient(135deg,#10B981,#34D399)', 'linear-gradient(135deg,#F59E0B,#F97316)', 'linear-gradient(135deg,#EC4899,#F472B6)', 'linear-gradient(135deg,#14B8A6,#2DD4BF)'];
  const PC_ICONS = ['sparkles', 'bot', 'star', 'lightbulb', 'wand', 'heart'];

  function saveCustomPreset() {
    const name = $('#pcName').value.trim();
    const desc = $('#pcDesc').value.trim();
    const system = $('#pcSystem').value.trim();
    if (!name) return Toast.warning('请填写角色名称');
    if (system.length < 10) return Toast.warning('提示词太短了，请详细描述角色（至少 10 字）');
    const i = (Store.state.customPresets || []).length;
    const preset = {
      id: 'custom-' + Date.now(), name, desc: desc || '自定义角色', system,
      icon: PC_ICONS[i % PC_ICONS.length], grad: PC_GRADS[i % PC_GRADS.length], custom: true
    };
    Store.state.customPresets = (Store.state.customPresets || []).concat(preset);
    Store.save();
    $('#pcName').value = ''; $('#pcDesc').value = ''; $('#pcSystem').value = '';
    $('#presetCreateModal').classList.remove('show');
    renderPresetGrid();
    Toast.success('角色「' + name + '」已创建');
  }

  /* ==================== 设置子页管理 ==================== */
  function openSub(id) {
    try {
      renderSubContent(id);
      $('#' + id).classList.add('show');
    } catch(e) {
      console.error('[openSub] 打开子页面失败:', id, e);
      Toast.warning('页面加载失败: ' + e.message);
    }
  }
  function closeSubs() {
    $$('.subpage').forEach(s => s.classList.remove('show'));
    // 返回时刷新发现页（插件计数 / 技能列表可能已变）
    if (Store.state.currentPage === 'discover') renderDiscover();
  }

  function renderSubContent(id) {
    if (id === 'subKeys') renderKeyManagement();
    else if (id === 'subPlugins') renderPlugins();
    else if (id === 'subSkills') renderSkills();
    else if (id === 'subPlugin') renderPluginSection();
    else if (id === 'subData') renderDataSection();
    else if (id === 'subVoice') renderVoiceSection();
    else if (id === 'subAsr') renderAsrSection();
    else if (id === 'subLang') renderLangList();
    else if (id === 'subHelp') renderHelp();
    else if (id === 'subAbout') $('#aboutVersionSub').textContent = 'v' + APP_VERSION;
    else if (id === 'subTheme') syncThemeCards();
    else if (id === 'subTokens') renderTokens();
    else if (id === 'subSync') renderSyncSection();
    else if (id === 'subProfileEdit') renderProfileEdit();
    else if (id === 'subTranslate') renderTranslate();
    else if (id === 'subProxy') renderProxySection();
    else if (id === 'subNavSettings') renderNavSettings();
    else if (id === 'subTrash') renderTrash();
    else if (id === 'subNovel') { if (typeof renderNovel === 'function') renderNovel(); else console.warn('renderNovel 未定义'); if (typeof bindNovelEvents === 'function') bindNovelEvents(); }
    else if (id === 'subComic') { if (typeof renderComic === 'function') renderComic(); else console.warn('renderComic 未定义'); if (typeof bindComicEvents === 'function') bindComicEvents(); }
    else if (id === 'subMembership') renderMembership();
    else if (id === 'subStorage') renderStorage();
    else if (id === 'subBookshelf') renderBookshelf();
  }

  function bindSubpageEvents() {
    document.addEventListener('click', function(e) {
      const row = e.target.closest('[data-sub]');
      if (row) { openSub(row.dataset.sub); return; }
      const back = e.target.closest('.subpage-back');
      if (back) { closeSubs(); return; }
    });
    $('#feedbackRow').addEventListener('click', () => {
      window.open('https://github.com/Smalluniverseheng/AI/issues', '_blank');
    });
  }

  /* ==================== AI 绘画 ==================== */
  function openPaintModal() {
    const providers = Object.keys(PROVIDERS).filter(p => PROVIDERS[p].imageModel);
    const modal = $('#paintModal');
    $('#paintProvider').innerHTML = providers.map(p => '<option value="' + p + '">' + p + '</option>').join('');
    modal.classList.add('show');
    $('#paintResult').innerHTML = '';
  }

  function bindPaintEvents() {
    $('#paintClose').addEventListener('click', () => $('#paintModal').classList.remove('show'));
    $('#paintModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
    $('#paintBtn').addEventListener('click', async () => {
      const prompt = $('#paintPrompt').value.trim();
      if (!prompt) return Toast.warning('请输入画面描述');
      const provider = $('#paintProvider').value;
      const size = $('#paintSize').value;
      const btn = $('#paintBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> 生成中…';
      $('#paintResult').innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3)"><div class="spinner" style="margin:0 auto 10px"></div>AI 正在作画，通常需要 10-30 秒…</div>';
      try {
        const url = await API.generateImage({ prompt, provider, size });
        $('#paintResult').innerHTML =
          '<img src="' + url + '" class="ai-generated msg-image" style="width:100%" id="paintImg">' +
          '<div class="paint-actions"><button class="btn btn-secondary btn-sm" id="paintDownload">' + icon('download', 14) + ' 下载图片</button>' +
          '<button class="btn btn-secondary btn-sm" id="paintSendChat">' + icon('message', 14) + ' 发到对话讨论</button></div>';
        $('#paintDownload').addEventListener('click', async () => {
          const a = document.createElement('a');
          a.href = $('#paintImg').src;
          a.download = 'AI绘画-' + Date.now() + '.png';
          a.click();
        });
        $('#paintSendChat').addEventListener('click', () => {
          Chat.attachments.image = { name: 'AI绘画.png', dataUrl: $('#paintImg').src };
          UI.renderAttachments();
          $('#paintModal').classList.remove('show');
          UI.navigate('chat');
          $('#chatInput').value = '请描述/评价这幅 AI 画作：' + prompt;
          autoResize($('#chatInput'));
        });
      } catch (e) {
        $('#paintResult').innerHTML = '<div class="msg-error">' + icon('zap', 16) + '<span>' + esc(e.message) + '</span></div>';
      }
      btn.disabled = false;
      btn.innerHTML = icon('wand', 16) + ' 开始生成';
    });
  }

  /* ==================== 我的页面 ==================== */
  function renderProfile() {
    const u = Store.state.userInfo || {};
    const stats = Store.stats();

    // 顶部卡片（头像来源统一走 UI.avatarView：云端 → userInfo → state.avatar）
    const av = UI.avatarView();
    let avatarInner;
    if (av.img) avatarInner = '<img src="' + av.img + '">';
    else avatarInner = esc((u.name || 'U').charAt(0).toUpperCase());
    $('#profileAvatar').innerHTML = avatarInner;
    $('#profileAvatar').style.background = av.img ? 'transparent' : av.grad;
    $('#profileName').textContent = u.name || '未登录';
    $('#profileTag').textContent = u.account ? '@' + u.account + (u.remark ? ' · ' + u.remark : '') : '';
    // 简介一行（云端取 cloudUser.bio，本地取 userInfo.bio）
    const cu = Store.state.cloudUser;
    const bio = (cu ? cu.bio : u.bio) || '';
    const bioEl = $('#profileBio');
    if (bioEl) {
      bioEl.textContent = bio;
      bioEl.style.display = bio ? '' : 'none';
    }
    // 云端身份徽标 / 游客提示
    const cloudBox = $('#profileCloud');
    if (cloudBox) {
      if (cu) cloudBox.innerHTML = '<span class="cloud-badge' + (cu.isAdmin ? ' admin' : '') + '">' + icon(cu.isAdmin ? 'shield' : 'check', 12) + esc(cu.isAdmin ? I18n.t('cld.adminBadge') : I18n.t('cld.userBadge')) + '</span>';
      else if (u.guest) cloudBox.innerHTML = '<span class="cloud-badge guest">' + icon('info', 12) + esc(I18n.t('cld.guestHint')) + '</span>';
      else cloudBox.innerHTML = '';
    }
    $('#profileStats').innerHTML =
      '<span class="profile-stat"><b>' + stats.chats + '</b> 对话</span>' +
      '<span class="profile-stat"><b>' + stats.messages + '</b> 消息</span>' +
      '<span class="profile-stat"><b>' + stats.keys + '</b> Key</span>';

    renderRowDescs();
    renderAboutSection();
    updateInstallRow();
  }

  /* 我的页条目右侧状态描述 */
  
  function renderMembership() {
    const container = $('#subMembershipBody');
    if (!container) return;
    const m = Store.state.membership || {};
    const tier = m.tier || 'guest';
    const tierMap = {
      guest:    { icon: '🌑', name: '游客',    color: '#888',    storage: 50,      price: '免费',    devices: 1 },
      satellite:{ icon: '🛰️', name: '卫星',    color: '#4a90d9', storage: 500,     price: '¥9/月',   devices: 2 },
      planet:   { icon: '🪐', name: '行星',    color: '#7b68ee', storage: 2048,    price: '¥29/月',  devices: 3 },
      star:     { icon: '☀️', name: '恒星',    color: '#ff9500', storage: 10240,   price: '¥69/月',  devices: 5 },
      galaxy:   { icon: '🌌', name: '星系',    color: '#ff2d55', storage: 51200,   price: '¥199/月', devices: 10 },
      universe: { icon: '🌠', name: '宇宙',    color: '#af52de', storage: -1,      price: '¥499/月', devices: '无限' }
    };
    const t = tierMap[tier] || tierMap.guest;
    const expires = m.expires_at ? new Date(m.expires_at).toLocaleDateString('zh-CN') : '永久有效';
    const usedMB = m.storage_used ? Math.round(m.storage_used / 1024 / 1024 * 10) / 10 : 0;
    const pct = t.storage > 0 ? Math.min(100, Math.round(usedMB / t.storage * 100)) : 0;
    const barColor = t.color;

    let html = '<div style="padding:24px 16px;text-align:center;background:linear-gradient(180deg,rgba(0,0,0,0.02),transparent);">';
    html += '<div style="font-size:56px;line-height:1;margin-bottom:12px;">' + t.icon + '</div>';
    html += '<div style="font-size:22px;font-weight:700;color:' + barColor + ';margin-bottom:4px;">' + t.name + '</div>';
    html += '<div style="font-size:12px;color:#999;">到期时间：' + expires + '</div>';
    html += '</div>';

    html += '<div style="padding:0 16px 16px;">';
    html += '<div style="font-size:14px;font-weight:600;margin-bottom:8px;color:#333;">存储用量</div>';
    html += '<div style="background:#eee;border-radius:99px;height:6px;overflow:hidden;">';
    html += '<div style="width:' + pct + '%;background:' + barColor + ';height:100%;border-radius:99px;transition:width .4s ease;"></div>';
    html += '</div>';
    html += '<div style="font-size:12px;color:#666;margin-top:6px;display:flex;justify-content:space-between;">';
    html += '<span>' + usedMB + ' MB 已用</span><span>' + (t.storage > 0 ? t.storage + ' MB 总量' : '无限') + '</span></div>';
    html += '</div>';

    html += '<div style="padding:16px;border-top:8px solid #f5f5f5;">';
    html += '<div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#333;">卡密激活</div>';
    html += '<input type="text" id="cardKeyInput" placeholder="请输入50位卡密" maxlength="50" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:10px;font-size:14px;box-sizing:border-box;outline:none;-webkit-appearance:none;">';
    html += '<button id="cardVerifyBtn" style="width:100%;margin-top:10px;padding:12px;background:' + barColor + ';color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:500;-webkit-appearance:none;">验证并激活</button>';
    html += '</div>';

    html += '<div style="padding:16px;border-top:8px solid #f5f5f5;">';
    html += '<div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#333;">会员计划对比</div>';
    html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">';
    html += '<table style="width:100%;font-size:12px;border-collapse:collapse;min-width:320px;">';
    html += '<thead><tr style="background:#f8f8f8;"><th style="padding:10px 8px;text-align:left;font-weight:600;color:#666;border-bottom:1px solid #eee;">等级</th>';
    html += '<th style="padding:10px 8px;text-align:center;font-weight:600;color:#666;border-bottom:1px solid #eee;">价格</th>';
    html += '<th style="padding:10px 8px;text-align:center;font-weight:600;color:#666;border-bottom:1px solid #eee;">存储</th>';
    html += '<th style="padding:10px 8px;text-align:center;font-weight:600;color:#666;border-bottom:1px solid #eee;">设备</th></tr></thead><tbody>';
    Object.keys(tierMap).forEach(function(k) {
      const p = tierMap[k];
      const isActive = k === tier;
      const bg = isActive ? 'background:' + p.color + '08;' : '';
      const fw = isActive ? 'font-weight:600;' : '';
      const col = isActive ? 'color:' + p.color + ';' : 'color:#333;';
      html += '<tr style="' + bg + 'border-bottom:1px solid #f5f5f5;">';
      html += '<td style="padding:10px 8px;' + fw + col + '">' + p.icon + ' ' + p.name + (isActive ? ' <span style="font-size:10px;background:' + p.color + ';color:#fff;padding:1px 5px;border-radius:99px;">当前</span>' : '') + '</td>';
      html += '<td style="padding:10px 8px;text-align:center;color:#666;' + fw + '">' + p.price + '</td>';
      html += '<td style="padding:10px 8px;text-align:center;color:#666;' + fw + '">' + (p.storage > 0 ? (p.storage >= 1024 ? (p.storage/1024).toFixed(0) + 'GB' : p.storage + 'MB') : '无限') + '</td>';
      html += '<td style="padding:10px 8px;text-align:center;color:#666;' + fw + '">' + p.devices + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';

    container.innerHTML = html;

    const verifyBtn = $('#cardVerifyBtn');
    const cardInput = $('#cardKeyInput');
    if (verifyBtn && cardInput) {
      verifyBtn.onclick = async function() {
        const key = cardInput.value.trim().replace(/\s/g, '');
        if (!key || key.length !== 50) { Toast.error('请输入50位卡密'); return; }
        Toast.info('正在验证卡密...');
        try {
          const data = await api.membership.verifyCard(key);
          if (!data.valid) { Toast.error(data.error || '卡密无效或已被使用'); return; }
          if (!confirm('卡密有效：' + (data.plan_name || '会员计划') + '\n确认立即激活吗？')) return;
          const rData = await api.membership.redeemCard(key);
          if (rData.success) {
            Toast.success('激活成功！');
            Store.patch({ membership: rData.membership || { tier: data.plan_tier || 'satellite', expires_at: rData.expires_at } });
            renderMembership();
            if (typeof renderSidebarUser === 'function') renderSidebarUser();
          } else {
            Toast.error(rData.error || '激活失败，请重试');
          }
        } catch (e) { Toast.error('网络错误，请检查连接'); }
      };
    }
  }


  function renderStorage() {
    const container = $('#subStorageBody');
    if (!container) return;
    const mode = Store.state.storageMode || 'cloud';
    const isCloud = mode === 'cloud';
    const m = Store.state.membership || {};
    const used = m.storage_used || 0;
    const limit = m.storage_limit || 50;
    const usedMB = used ? (used / 1024 / 1024).toFixed(1) : '0.0';
    const pct = limit > 0 ? Math.min(100, Math.round(used / limit * 100)) : 0;
    let html = '<div style="padding:16px;">';
    html += '<div style="background:#f8f8f8;border-radius:12px;padding:16px;margin-bottom:16px;">';
    html += '<div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">存储模式</div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button id="modeCloud" style="flex:1;padding:10px;border:2px solid ' + (isCloud ? '#4a90d9' : '#e0e0e0') + ';border-radius:8px;background:' + (isCloud ? '#4a90d908' : '#fff') + ';color:' + (isCloud ? '#4a90d9' : '#666') + ';font-size:14px;font-weight:500;-webkit-appearance:none;">☁️ 云端优先</button>';
    html += '<button id="modeLocal" style="flex:1;padding:10px;border:2px solid ' + (!isCloud ? '#4a90d9' : '#e0e0e0') + ';border-radius:8px;background:' + (!isCloud ? '#4a90d908' : '#fff') + ';color:' + (!isCloud ? '#4a90d9' : '#666') + ';font-size:14px;font-weight:500;-webkit-appearance:none;">💾 本地存储</button>';
    html += '</div>';
    html += '<div style="font-size:12px;color:#999;margin-top:8px;">' + (isCloud ? '数据默认同步到云端，多设备可用' : '数据仅保存在本地，不上传云端') + '</div>';
    html += '</div>';
    html += '<div style="background:#f8f8f8;border-radius:12px;padding:16px;margin-bottom:16px;">';
    html += '<div style="font-size:14px;font-weight:600;color:#333;margin-bottom:8px;">存储用量</div>';
    html += '<div style="background:#eee;border-radius:99px;height:6px;overflow:hidden;">';
    html += '<div style="width:' + pct + '%;background:#4a90d9;height:100%;border-radius:99px;transition:width .3s;"></div>';
    html += '</div>';
    html += '<div style="font-size:12px;color:#666;margin-top:6px;display:flex;justify-content:space-between;">';
    html += '<span>' + usedMB + ' MB 已用</span><span>' + (limit > 0 ? limit + ' MB 总量' : '无限') + '</span></div>';
    html += '</div>';
    html += '<div style="font-size:14px;font-weight:600;color:#333;margin-bottom:8px;">数据工具</div>';
    html += '<div class="settings-card">';
    html += '<div class="settings-row clickable" id="storageTrashBtn">';
    html += '<span class="row-icon" data-icon="trash"></span>';
    html += '<span class="row-label"><span class="row-title">回收站</span><span class="row-desc">已删除的对话与数据</span></span>';
    html += '<span class="chev" data-icon="chevronRight"></span>';
    html += '</div>';
    html += '<div class="settings-row clickable" id="storageSyncBtn">';
    html += '<span class="row-icon" data-icon="refreshCw"></span>';
    html += '<span class="row-label"><span class="row-title">云端同步</span><span class="row-desc">手动同步数据到云端</span></span>';
    html += '<span class="chev" data-icon="chevronRight"></span>';
    html += '</div>';
    html += '<div class="settings-row clickable" id="storageClearBtn">';
    html += '<span class="row-icon" data-icon="trash2"></span>';
    html += '<span class="row-label"><span class="row-title">清除本地数据</span><span class="row-desc">仅清除本设备数据（不影响云端）</span></span>';
    html += '<span class="chev" data-icon="chevronRight"></span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    container.innerHTML = html;
    const modeCloud = $('#modeCloud');
    const modeLocal = $('#modeLocal');
    if (modeCloud) modeCloud.onclick = function() { Store.patch({ storageMode: 'cloud' }); renderStorage(); Toast.success('已切换为云端存储'); };
    if (modeLocal) modeLocal.onclick = function() { Store.patch({ storageMode: 'local' }); renderStorage(); Toast.success('已切换为本地存储'); };
    const trashBtn = $('#storageTrashBtn');
    if (trashBtn) trashBtn.onclick = function() { openSub('subTrash'); };
    const syncBtn = $('#storageSyncBtn');
    if (syncBtn) syncBtn.onclick = function() { if (typeof SB !== 'undefined' && SB.Sync) { SB.Sync.push(); Toast.success('同步已触发'); } else { Toast.error('云服务未就绪'); } };
    const clearBtn = $('#storageClearBtn');
    if (clearBtn) clearBtn.onclick = function() { if (!confirm('确定要清除所有本地数据吗？\n此操作不可恢复，云端数据不受影响。')) return; localStorage.removeItem('ai_chat_state_v5'); localStorage.removeItem('ai_users_v5'); Toast.success('本地数据已清除'); location.reload(); };
  }


  function renderBookshelf() {
    const container = document.getElementById('subBookshelfBody');
    if (!container) return;
    const bs = Store.state.bookshelf || { items: [], categories: ['全部','阅读','听书','短剧','漫剧','出版'], activeCategory: '全部' };
    const items = bs.items || [];
    const cats = bs.categories || ['全部','阅读','听书','短剧','漫剧','出版'];
    const active = bs.activeCategory || '全部';
    const filtered = active === '全部' ? items : items.filter(function(i) { return (i.type || '阅读') === active; });

    let html = '<div style="position:sticky;top:0;background:#fff;z-index:10;border-bottom:1px solid #eee;">';
    html += '<div style="display:flex;gap:4px;padding:8px 12px;overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap;">';
    cats.forEach(function(c) {
      const isActive = c === active;
      html += '<button data-cat="' + c + '" style="padding:6px 14px;border-radius:99px;border:none;font-size:13px;' + (isActive ? 'background:#4a90d9;color:#fff;font-weight:500;' : 'background:#f0f0f0;color:#666;') + '-webkit-appearance:none;flex-shrink:0;">' + c + '</button>';
    });
    html += '</div></div>';

    if (filtered.length === 0) {
      html += '<div style="text-align:center;padding:60px 20px;color:#999;">';
      html += '<div style="font-size:48px;margin-bottom:12px;">📚</div>';
      html += '<div style="font-size:15px;margin-bottom:8px;">书架空空如也</div>';
      html += '<div style="font-size:13px;margin-bottom:20px;">导入本地小说开始阅读</div>';
      html += '<button id="bsImport" style="padding:10px 24px;background:#4a90d9;color:#fff;border:none;border-radius:8px;font-size:14px;-webkit-appearance:none;">导入书籍</button>';
      html += '</div>';
    } else {
      html += '<div style="padding:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">';
      filtered.forEach(function(book) {
        const progress = book.progress || 0;
        html += '<div data-book-id="' + (book.id || '') + '" style="cursor:pointer;">';
        html += '<div style="width:100%;aspect-ratio:3/4;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;">📖</div>';
        html += '<div style="margin-top:6px;font-size:13px;font-weight:500;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (book.title || '未命名').replace(/</g,'&lt;') + '</div>';
        html += '<div style="font-size:11px;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (book.author || '未知作者').replace(/</g,'&lt;') + '</div>';
        if (progress > 0) {
          html += '<div style="margin-top:4px;background:#eee;border-radius:99px;height:3px;overflow:hidden;">';
          html += '<div style="width:' + progress + '%;background:#4a90d9;height:100%;"></div></div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    html += '<div style="padding:16px;text-align:center;">';
    html += '<button id="bsImport2" style="padding:10px 24px;background:#f0f0f0;color:#666;border:none;border-radius:8px;font-size:14px;-webkit-appearance:none;">+ 导入书籍</button>';
    html += '</div>';

    container.innerHTML = html;

    // Category click
    container.querySelectorAll('[data-cat]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        Store.patch({ bookshelf: Object.assign({}, Store.state.bookshelf || {}, { activeCategory: btn.dataset.cat }) });
        renderBookshelf();
      });
    });

    // Import buttons
    var importBtn = document.getElementById('bsImport');
    var importBtn2 = document.getElementById('bsImport2');
    if (importBtn) importBtn.addEventListener('click', doImportBook);
    if (importBtn2) importBtn2.addEventListener('click', doImportBook);

    // Book card click - event delegation
    container.addEventListener('click', function(e) {
      var card = e.target.closest('[data-book-id]');
      if (card) {
        var bookId = card.dataset.bookId;
        if (bookId) Toast.info('打开: ' + bookId);
      }
    });
  }

  function doImportBook() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.epub';
    input.multiple = true;
    input.style.display = 'none';
    input.onchange = function(e) {
      var files = e.target.files;
      if (!files || files.length === 0) return;
      var imported = 0;
      Array.from(files).forEach(function(file) {
        var reader = new FileReader();
        reader.onload = function(ev) {
          var bs = Store.state.bookshelf || { items: [] };
          var items = bs.items ? bs.items.slice() : [];
          items.push({
            id: 'book_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            title: file.name.replace(/\.[^/.]+$/, ''),
            author: '本地导入',
            type: '阅读',
            progress: 0,
            lastRead: Date.now(),
            source: 'local'
          });
          Store.patch({ bookshelf: Object.assign({}, bs, { items: items }) });
          imported++;
          if (imported === files.length) {
            Toast.success('导入 ' + imported + ' 本');
            renderBookshelf();
          }
        };
        reader.readAsText(file);
      });
    };
    document.body.appendChild(input);
    input.click();
    setTimeout(function() { input.remove(); }, 2000);
  }

function renderRowDescs() {
    const vs = Store.state.voiceSettings;
    const ttsE = Voice.TTS_ENGINES.find(e => e.id === (vs.ttsEngine || 'browser'));
    const voiceDesc = $('#voiceRowDesc'); if (voiceDesc) voiceDesc.textContent = (ttsE ? (ttsE.provider || '浏览器内置') : '浏览器内置') + ' · ' + (vs.rate || 1) + 'x';
    const asrE = Voice.ASR_ENGINES.find(e => e.id === (vs.asrEngine || 'browser'));
    const asrDesc = $('#asrRowDesc'); if (asrDesc) asrDesc.textContent = asrE ? (asrE.provider || '浏览器内置') : '浏览器内置';
    const themeDesc = $('#themeRowDesc'); if (themeDesc) themeDesc.textContent = I18n.t('theme.' + (Store.state.theme || 'system'));
    const langDesc = $('#langRowDesc'); if (langDesc) langDesc.textContent = I18n.current().name;
    const syncDesc = $('#syncRowDesc');
    if (syncDesc) {
      const cu = Store.state.cloudUser;
      const st = (typeof SB !== 'undefined') ? SB.Sync.status() : null;
      if (!cu) syncDesc.textContent = I18n.t('cld.notCloud');
      else syncDesc.textContent = (cu.isAdmin ? I18n.t('cld.roleAdmin') : I18n.t('cld.roleUser')) + ' · ' +
        (st && st.lastSync ? I18n.t('cld.lastSync') + ' ' + fmtTime(st.lastSync) : I18n.t('cld.never'));
    }
    const proxyDesc = $('#proxyRowDesc');
    if (proxyDesc) {
      const mode = (Store.state && Store.state.proxyMode) || 'local';
      proxyDesc.textContent = mode === 'server' ? '服务器代理' : '本地直连';
    }
    const navDesc = $('#navRowDesc');
    if (navDesc) {
      const ns = Store.state.navSettings || {};
      const d = DeviceInfo.type;
      const mode = ns[d] || (d === 'watch' ? 'float' : 'navbar');
      const labels = { navbar: '导航栏', float: '悬浮按钮', both: '两者', none: '关闭' };
      navDesc.textContent = labels[mode] || '导航栏';
    }
  }

  /* ---- API Key 管理 ---- */
  function renderKeyManagement() {
    const box = $('#keyManagement');
    const cn = [], gl = [];
    Object.keys(PROVIDERS).forEach(p => (PROVIDERS[p].region === 'cn' ? cn : gl).push(p));

    // v5.3: 自动匹配区域
    const autoMatchHtml = '<div class="key-auto-match">' +
      '<div class="key-auto-match-title">' + icon('zap', 16) + ' 自动匹配厂商</div>' +
      '<div class="key-auto-match-desc">粘贴 API Key，系统自动向各厂商发送测试请求识别归属</div>' +
      '<div class="key-auto-match-row">' +
      '<input type="text" class="input" id="autoMatchInput" placeholder="sk-... 或任意格式 API Key" autocomplete="off">' +
      '<button class="btn btn-primary" id="autoMatchBtn">' + icon('search', 14) + ' 自动匹配</button>' +
      '</div>' +
      '<div class="key-auto-match-status" id="autoMatchStatus"></div>' +
      '</div>';

    const blockHtml = p => {
      const cfg = PROVIDERS[p];
      const k = Store.state.apiKeys;
      let rows = '';
      let set = false;
      if (cfg.dualKey) {
        const plan = k.mimoPlan || 'tokenPlan';
        set = plan === 'tokenPlan' ? !!k.mimoTokenPlan : !!k.mimoPayAsYouGo;
        rows =
          '<div class="key-row"><label>计费方式</label><select class="select" data-key="mimoPlan">' +
          '<option value="tokenPlan"' + (plan === 'tokenPlan' ? ' selected' : '') + '>会员计划（Token Plan）</option>' +
          '<option value="payAsYouGo"' + (plan === 'payAsYouGo' ? ' selected' : '') + '>按量付费</option></select></div>' +
          '<div class="key-row"><label>会员计划 Key</label>' + keyInputHtml('mimoTokenPlan', k.mimoTokenPlan) + '</div>' +
          '<div class="key-row"><label>按量付费 Key</label>' + keyInputHtml('mimoPayAsYouGo', k.mimoPayAsYouGo) + '</div>';
      } else {
        set = !!k[cfg.keySlug];
        rows = '<div class="key-row"><label>API Key <span style="color:var(--text-3);font-weight:400">· ' + esc(cfg.keyHint || '') + '</span></label>' + keyInputHtml(cfg.keySlug, k[cfg.keySlug]) + '</div>';
      }
      return '<div class="key-provider-block" data-provider="' + esc(p) + '">' +
        '<button class="key-provider-head">' + providerIconHtml(p, 24) +
        '<span class="kp-name">' + esc(p) + '</span>' +
        '<span class="key-status ' + (set ? 'set' : 'unset') + '">' + (set ? '已配置' : '未配置') + '</span>' +
        icon('chevronDown', 14) + '</button>' +
        '<div class="key-provider-body">' + rows + '</div></div>';
    };

    box.innerHTML = autoMatchHtml +
      '<div class="settings-group-title" style="padding:12px 16px 6px">' + icon('key', 15) + ' 国内厂商</div>' +
      cn.map(blockHtml).join('') +
      '<div class="settings-group-title" style="padding:16px 16px 6px">' + icon('globe', 15) + ' 国外厂商</div>' +
      gl.map(blockHtml).join('');
  }

  function keyInputHtml(slug, val) {
    return '<div class="key-input-wrap"><input type="password" class="input" data-key="' + slug + '" value="' + esc(val || '') + '" placeholder="sk-..." autocomplete="off">' +
      '<button class="key-eye" data-eye tabindex="-1">' + icon('eye', 16) + '</button></div>';
  }

  

  /* v5.3 自动匹配厂商：向各厂商发送测试请求识别 Key 归属 */
  async function autoMatchKey() {
    const input = document.getElementById('autoMatchInput');
    const status = document.getElementById('autoMatchStatus');
    const key = input.value.trim();
    if (!key) return Toast.warning('请先粘贴 API Key');
    if (status) status.innerHTML = '<span class="am-loading">' + icon('loader', 14) + ' 正在匹配…</span>';

    const tests = [];
    Object.entries(PROVIDERS).forEach(([name, cfg]) => {
      if (cfg.dualKey) return; // 跳过双 Key 厂商
      const slug = cfg.keySlug;
      const base = cfg.base();
      const hdr = cfg.headers ? cfg.headers(key) : { 'Authorization': 'Bearer ' + key };
      let url, opts;

      if (cfg.format === 'anthropic') {
        url = base + '/v1/models';
        opts = { method: 'GET', headers: hdr };
      } else if (cfg.format === 'google') {
        url = base + '/v1beta/models?key=' + encodeURIComponent(key);
        opts = { method: 'GET' };
      } else {
        url = base + '/v1/models';
        opts = { method: 'GET', headers: hdr };
      }
      tests.push({ name, slug, url, opts });
    });

    // 并行发送，带 5 秒超时
    const results = await Promise.all(tests.map(async t => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(t.url, { ...t.opts, signal: ctrl.signal });
        clearTimeout(timer);
        if (resp.status === 200) {
          const data = await resp.json().catch(() => null);
          if (data && (data.data || data.models || data.object === 'list')) {
            return { ...t, ok: true };
          }
        }
        return { ...t, ok: false };
      } catch (e) {
        return { ...t, ok: false };
      }
    }));

    const matched = results.filter(r => r.ok);
    if (!matched.length) {
      if (status) status.innerHTML = '<span class="am-fail">未识别到匹配的厂商，请检查 Key 是否有效</span>';
      Toast.error('未匹配到任何厂商');
      return;
    }

    matched.forEach(m => { Store.state.apiKeys[m.slug] = key; });
    Store.save();
    renderKeyManagement();

    const names = matched.map(m => m.name).join('、');
    if (status) status.innerHTML = '<span class="am-success">已匹配并保存：' + esc(names) + '</span>';
    Toast.success('已匹配 ' + matched.length + ' 个厂商：' + names);
  }
function bindKeyEvents() {
    // v5.3: 自动匹配按钮
    const amBtn = document.getElementById('autoMatchBtn');
    const amInput = document.getElementById('autoMatchInput');
    if (amBtn) amBtn.addEventListener('click', autoMatchKey);
    if (amInput) {
      amInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') autoMatchKey();
      });
    }

    $('#keyManagement').addEventListener('click', e => {
      const head = e.target.closest('.key-provider-head');
      if (head) { head.closest('.key-provider-block').classList.toggle('open'); return; }
      const eye = e.target.closest('[data-eye]');
      if (eye) {
        const input = eye.parentElement.querySelector('input');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        eye.innerHTML = icon(show ? 'eyeOff' : 'eye', 16);
      }
    });
    $('#keyManagement').addEventListener('change', e => {
      const el = e.target.closest('[data-key]');
      if (!el) return;
      Store.state.apiKeys[el.dataset.key] = el.value.trim();
      Store.save();
      if (el.tagName === 'SELECT') return;
      renderKeyManagement();
      Toast.success('Key 已保存');
    });

    // 批量导入导出
    $('#exportKeysBtn').addEventListener('click', () => {
      const k = Store.state.apiKeys;
      const lines = Object.keys(k).filter(s => k[s] && s !== 'mimoPlan').map(s => s + '=' + k[s]);
      if (!lines.length) return Toast.warning('暂无已配置的 Key');
      download('api-keys.txt', lines.join('\n'));
      Toast.success('已导出 ' + lines.length + ' 个 Key');
    });
    $('#importKeysBtn').addEventListener('click', () => $('#importKeysFile').click());
    $('#importKeysFile').addEventListener('change', async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await readFileAsText(file);
        let count = 0;
        // 支持 txt（slug=key 每行一条）与 json
        if (file.name.endsWith('.json')) {
          const obj = JSON.parse(text);
          Object.keys(obj).forEach(s => { if (typeof obj[s] === 'string' && obj[s]) { Store.state.apiKeys[s] = obj[s]; count++; } });
        } else {
          text.split(/\r?\n/).forEach(line => {
            const m = line.match(/^\s*([\w-]+)\s*[=:：]\s*(\S+)\s*$/);
            if (m) { Store.state.apiKeys[m[1]] = m[2]; count++; }
          });
        }
        if (!count) throw new Error('empty');
        Store.save();
        renderKeyManagement();
        Toast.success('已导入 ' + count + ' 个 Key');
      } catch (err) { Toast.error('导入失败：格式应为 厂商标识=Key（每行一条）'); }
    });
  }

  /* ---- 主题 ---- */
  function bindThemeEvents() {
    $$('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        Store.state.theme = card.dataset.theme;
        Store.save();
        UI.applyTheme();
        syncThemeCards();
      });
    });
  }
  function syncThemeCards() {
    $$('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === (Store.state.theme || 'system')));
  }

  /* ---- 联网搜索子页 ---- */
  function renderPluginSection() {
    $('#tavilyKeyInput').value = Store.state.webSearch.tavilyKey || '';
    $('#webSearchSwitch').checked = !!Store.state.webSearch.enabled;
  }

  function bindPluginEvents() {
    $('#tavilyKeyInput').addEventListener('change', e => {
      Store.state.webSearch.tavilyKey = e.target.value.trim();
      Store.save();
      Toast.success('搜索 Key 已保存');
      UI.updateWebSearchBtn();
    });
    $('#webSearchSwitch').addEventListener('change', e => {
      if (e.target.checked && !Store.state.webSearch.tavilyKey) {
        e.target.checked = false;
        return Toast.warning('请先填写上方 Tavily API Key（tavily.com 免费获取）');
      }
      Store.state.webSearch.enabled = e.target.checked;
      Store.save();
      UI.updateWebSearchBtn();
      Toast.info(e.target.checked ? '联网搜索已开启' : '联网搜索已关闭');
    });
  }

  /* ==================== 插件库（subPlugins） ==================== */
  let openPluginId = null; // 当前展开的插件卡片（展开态不持久化）

  function pluginBadge(p) {
    if (p.def.backend) return '<span class="plg-badge warn">' + I18n.t('plg.backend') + '</span>';
    if (p.def.info) return '';
    return p.enabled
      ? '<span class="plg-badge on">' + I18n.t('plg.enabled') + '</span>'
      : '<span class="plg-badge">' + I18n.t('plg.disabled') + '</span>';
  }

  function pluginBodyHtml(p) {
    // 开源生态：纯信息卡
    if (p.def.info) {
      return '<div class="plg-body"><div class="plg-eco">' +
        Plugins.ECO_LINKS.map(l =>
          '<div class="plg-eco-item"><b>' + esc(l.name) + '</b><span>' + esc(l.desc) + '</span>' +
          '<a href="https://' + l.url + '" target="_blank" rel="noopener">' + esc(l.url) + '</a></div>').join('') +
        '</div><div class="plg-note">' + icon('info', 14) + ' 后续版本将支持导入开源技能包</div></div>';
    }
    return '<div class="plg-body">' +
      (p.def.note ? '<div class="plg-note">' + icon('info', 14) + ' ' + esc(p.def.note) + '</div>' : '') +
      p.def.fields.map(f =>
        '<div class="plg-field"><label>' + esc(f.label) + (f.hint ? '<span class="plg-field-hint"> · ' + esc(f.hint) + '</span>' : '') + '</label>' +
        (f.secret
          ? '<div class="key-input-wrap"><input type="password" class="input" data-plg-field="' + f.key + '" value="' + esc(p.config[f.key] || '') + '" placeholder="' + esc(f.ph || '') + '" autocomplete="off"><button class="key-eye" data-eye tabindex="-1">' + icon('eye', 16) + '</button></div>'
          : '<input class="input" data-plg-field="' + f.key + '" value="' + esc(p.config[f.key] || '') + '" placeholder="' + esc(f.ph || '') + '" autocomplete="off">') +
        '</div>').join('') +
      '<div class="plg-actions">' +
      '<label class="switch"><input type="checkbox" data-plg-toggle="' + p.def.id + '"' + (p.enabled ? ' checked' : '') + '><span class="track"></span></label>' +
      '<span class="plg-actions-label">' + I18n.t('plg.enable') + '</span>' +
      '<button class="btn btn-primary btn-sm plg-save" data-plg-save="' + p.def.id + '">' + I18n.t('plg.save') + '</button>' +
      '</div></div>';
  }

  function renderPlugins() {
    if (typeof Plugins === 'undefined') return;
    $('#pluginList').innerHTML = Plugins.list().map(p =>
      '<div class="plg-block' + (openPluginId === p.def.id ? ' open' : '') + '" data-plugin="' + p.def.id + '">' +
      '<button class="plg-head-row" type="button">' +
      '<span class="row-icon">' + icon(p.def.icon, 17) + '</span>' +
      '<span class="plg-title"><b>' + esc(p.def.name) + '</b><span>' + esc(p.def.desc) + '</span></span>' +
      pluginBadge(p) + '<span class="plg-caret">' + icon('chevronDown', 14) + '</span></button>' +
      pluginBodyHtml(p) + '</div>').join('');
  }

  /* 收集卡片内表单值并保存（返回配置对象） */
  function collectPluginCfg(block) {
    const cfg = {};
    block.querySelectorAll('[data-plg-field]').forEach(inp => { cfg[inp.dataset.plgField] = inp.value.trim(); });
    return cfg;
  }

  function bindPluginLibEvents() {
    const box = $('#pluginList');
    box.addEventListener('click', e => {
      const head = e.target.closest('.plg-head-row');
      if (head) {
        const id = head.closest('.plg-block').dataset.plugin;
        openPluginId = openPluginId === id ? null : id;
        renderPlugins();
        return;
      }
      const eye = e.target.closest('[data-eye]');
      if (eye) {
        const input = eye.parentElement.querySelector('input');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        eye.innerHTML = icon(show ? 'eyeOff' : 'eye', 16);
        return;
      }
      const save = e.target.closest('[data-plg-save]');
      if (save) {
        const id = save.dataset.plgSave;
        Plugins.setConfig(id, collectPluginCfg(save.closest('.plg-block')));
        Toast.success(I18n.t('plg.saved'));
        renderPlugins();
        if (id === 'tavily-search') UI.updateWebSearchBtn();
      }
    });
    box.addEventListener('change', e => {
      const tg = e.target.closest('[data-plg-toggle]');
      if (!tg) return;
      const id = tg.dataset.plgToggle;
      // 开关时连同已填写的表单一起保存，再校验
      const cfg = collectPluginCfg(tg.closest('.plg-block'));
      cfg.enabled = tg.checked;
      Plugins.setConfig(id, cfg);
      if (id === 'tavily-search' && tg.checked && !Plugins.getConfig(id).tavilyKey) {
        Plugins.toggle(id, false);
        tg.checked = false;
        return Toast.warning('请先填写 Tavily API Key（tavily.com 免费获取）');
      }
      const def = Plugins.get(id).def;
      if (tg.checked && def.backend) Toast.info(def.note);
      Toast.info(tg.checked ? '「' + def.name + '」' + I18n.t('plg.enabled') : '「' + def.name + '」' + I18n.t('plg.disabled'));
      renderPlugins();
      if (id === 'tavily-search') UI.updateWebSearchBtn();
    });
  }

  /* ==================== 技能库（subSkills） ==================== */
  function renderSkills() {
    renderSkillMine();
    renderSkillLib();
  }

  function renderSkillMine() {
    if (typeof Skills === 'undefined') return;
    const list = Skills.listEnabled();
    $('#skillMine').innerHTML =
      '<div class="skl-tip">' + I18n.t('skl.hint') + '</div>' +
      '<div class="settings-card">' + list.map(s =>
        '<div class="settings-row clickable skill-row' + (s.active ? '' : ' tool-off') + '" data-skill="' + s.id + '">' +
        '<span class="row-icon">' + icon(s.icon || 'wand', 17) + '</span>' +
        '<span class="row-label"><span class="row-title">' + esc(s.name) + (s.custom ? ' <em class="p-custom">' + I18n.t('skl.customTag') + '</em>' : '') + '</span>' +
        '<span class="row-desc">' + esc(s.desc) + '</span></span>' +
        (s.custom ? '<button class="skl-del" data-skil-del="' + s.id + '" title="' + I18n.t('skl.del') + '">' + icon('trash', 15) + '</button>' : '') +
        '<label class="switch"><input type="checkbox" data-skil-toggle="' + s.id + '"' + (s.active ? ' checked' : '') + '><span class="track"></span></label>' +
        '</div>').join('') + '</div>';
  }

  function renderSkillLib() {
    if (typeof Skills === 'undefined') return;
    $('#skillLib').innerHTML =
      '<div class="skl-grid">' + Skills.listLibrary().map(s => {
        const added = Skills.isEnabled(s.id);
        return '<div class="skl-card">' +
          '<span class="skl-ic">' + icon(s.icon, 19) + '</span>' +
          '<span class="skl-name">' + esc(s.name) + '</span>' +
          '<span class="skl-desc">' + esc(s.desc) + '</span>' +
          '<button class="btn ' + (added ? 'btn-secondary' : 'btn-primary') + ' btn-sm skl-add" data-skil-add="' + s.id + '"' + (added ? ' disabled' : '') + '>' +
          (added ? I18n.t('skl.added') : I18n.t('skl.add')) + '</button></div>';
      }).join('') + '</div>' +
      '<div class="settings-card skl-form">' +
      '<div class="skl-form-title">' + icon('plus', 15) + ' ' + I18n.t('skl.customTitle') + '</div>' +
      '<div class="field"><label>' + I18n.t('skl.name') + '</label><input class="input" id="skcName" maxlength="20" placeholder="' + I18n.t('skl.namePh') + '"></div>' +
      '<div class="field"><label>' + I18n.t('skl.desc') + '</label><input class="input" id="skcDesc" maxlength="40" placeholder="' + I18n.t('skl.descPh') + '"></div>' +
      '<div class="field"><label>' + I18n.t('skl.prompt') + '</label><textarea class="textarea" id="skcPrompt" rows="5" placeholder="' + I18n.t('skl.promptPh') + '"></textarea></div>' +
      '<button class="btn btn-primary btn-block" id="skcSave">' + I18n.t('skl.save') + '</button>' +
      '</div>';
  }

  function bindSkillEvents() {
    // 页签切换
    $('#skillTabs').addEventListener('click', e => {
      const tab = e.target.closest('[data-sktab]');
      if (!tab) return;
      $$('#skillTabs .seg-tab').forEach(t => t.classList.toggle('active', t === tab));
      $('#skillMine').style.display = tab.dataset.sktab === 'mine' ? '' : 'none';
      $('#skillLib').style.display = tab.dataset.sktab === 'lib' ? '' : 'none';
    });
    // 我的技能：点击试用 / 删除自定义
    $('#skillMine').addEventListener('click', e => {
      const del = e.target.closest('[data-skil-del]');
      if (del) {
        const s = Skills.get(del.dataset.skilDel);
        confirmDialog(I18n.t('skl.del'), I18n.t('skl.delQ') + '「' + (s ? s.name : '') + '」', true).then(ok => {
          if (!ok) return;
          Skills.removeCustom(del.dataset.skilDel);
          renderSkillMine(); renderSkillLib(); renderDiscoverTools();
          Toast.success(I18n.t('skl.deleted'));
        });
        return;
      }
      if (e.target.closest('.switch')) return;
      const row = e.target.closest('[data-skill]');
      if (!row) return;
      const id = row.dataset.skill;
      if (!Skills.isEnabled(id)) return Toast.info('该技能已停用，点击右侧开关重新启用');
      openTool(id);
    });
    $('#skillMine').addEventListener('change', e => {
      const tg = e.target.closest('[data-skil-toggle]');
      if (!tg) return;
      const id = tg.dataset.skilToggle;
      Skills.toggle(id, tg.checked);
      const s = Skills.get(id);
      Toast.info(tg.checked ? '「' + s.name + '」已开启' : '「' + s.name + '」已停用');
      renderSkillMine(); renderSkillLib(); renderDiscoverTools();
    });
    // 发现更多：添加库技能 / 保存自定义技能
    $('#skillLib').addEventListener('click', e => {
      const add = e.target.closest('[data-skil-add]');
      if (add) {
        const s = Skills.addFromLibrary(add.dataset.skilAdd);
        if (s) {
          Toast.success('「' + s.name + '」' + I18n.t('skl.addedToast'));
          renderSkillLib(); renderSkillMine(); renderDiscoverTools();
        }
        return;
      }
      if (e.target.closest('#skcSave')) {
        const name = $('#skcName').value.trim();
        const desc = $('#skcDesc').value.trim();
        const prompt = $('#skcPrompt').value.trim();
        if (!name) return Toast.warning(I18n.t('skl.needName'));
        if (prompt.length < 10) return Toast.warning(I18n.t('skl.needPrompt'));
        const s = Skills.addCustom({ name, desc, promptTemplate: prompt });
        Toast.success('「' + s.name + '」' + I18n.t('skl.createdToast'));
        renderSkillLib(); renderSkillMine(); renderDiscoverTools();
        // 切回「我的技能」页签
        $$('#skillTabs .seg-tab').forEach(t => t.classList.toggle('active', t.dataset.sktab === 'mine'));
        $('#skillMine').style.display = '';
        $('#skillLib').style.display = 'none';
      }
    });
  }

  /* ---- 播报声音子页 ---- */
  function renderVoiceSection() {
    const vs = Store.state.voiceSettings;
    // 引擎下拉
    $('#ttsEngineSelect').innerHTML = Voice.TTS_ENGINES.map(e => {
      const noKey = e.provider && !Voice.engineKey(e.id, Voice.TTS_ENGINES);
      return '<option value="' + e.id + '"' + (vs.ttsEngine === e.id ? ' selected' : '') + '>' +
        esc(e.provider || I18n.t('voice.engineBrowser')) + ' · ' + esc(e.desc) + (noKey ? '（未配置 Key）' : '') + '</option>';
    }).join('');
    renderTtsVoiceOptions();
    $('#voiceRateRange').value = vs.rate || 1;
    $('#voiceRateLabel').textContent = (vs.rate || 1) + 'x';
    renderTtsKeyHint();
  }

  function renderTtsVoiceOptions() {
    const vs = Store.state.voiceSettings;
    const eng = vs.ttsEngine || 'browser';
    let opts;
    if (eng === 'mimo') {
      opts = Voice.MIMO_VOICES.map(v => '<option value="' + esc(v.id) + '"' + (vs.ttsVoice === v.id ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('');
      if (!Voice.MIMO_VOICES.some(v => v.id === vs.ttsVoice)) { vs.ttsVoice = 'mimo_default'; Store.save(); }
    } else if (eng === 'openai') {
      opts = Voice.OPENAI_VOICES.map(v => '<option value="' + v + '"' + (vs.ttsVoice === v ? ' selected' : '') + '>' + v + '</option>').join('');
      if (!Voice.OPENAI_VOICES.includes(vs.ttsVoice)) { vs.ttsVoice = 'alloy'; Store.save(); }
    } else {
      opts = '<option value="">自动选择</option>' + Voice.getVoices().map(v =>
        '<option value="' + esc(v.voiceURI) + '"' + (vs.voiceURI === v.voiceURI ? ' selected' : '') + '>' + esc(v.name) + '</option>').join('');
    }
    $('#voiceSelect').innerHTML = opts;
  }

  function renderTtsKeyHint() {
    const vs = Store.state.voiceSettings;
    const e = Voice.TTS_ENGINES.find(x => x.id === (vs.ttsEngine || 'browser'));
    const hint = $('#ttsKeyHint');
    if (e && e.provider && !Voice.engineKey(e.id, Voice.TTS_ENGINES)) {
      hint.innerHTML = '<span style="color:var(--warning)">' + esc(e.provider) + ' ' + I18n.t('voice.needKey') + '</span>';
    } else hint.textContent = '';
  }

  function bindVoiceEvents() {
    $('#ttsEngineSelect').addEventListener('change', e => {
      Store.state.voiceSettings.ttsEngine = e.target.value;
      Store.save();
      renderTtsVoiceOptions();
      renderTtsKeyHint();
      renderRowDescs();
    });
    $('#voiceSelect').addEventListener('change', e => {
      const vs = Store.state.voiceSettings;
      if ((vs.ttsEngine || 'browser') === 'browser') vs.voiceURI = e.target.value;
      else vs.ttsVoice = e.target.value;
      Store.save();
    });
    $('#voiceRateRange').addEventListener('input', e => {
      Store.state.voiceSettings.rate = +e.target.value;
      $('#voiceRateLabel').textContent = e.target.value + 'x';
      Store.save();
      renderRowDescs();
    });
    $('#voiceTestBtn').addEventListener('click', () => {
      const texts = { 'zh-CN': '你好，我是第三方科技 AI 助手，语音功能已就绪。', 'zh-TW': '你好，我是第三方科技 AI 助手，語音功能已就緒。' };
      Voice.speak(texts[I18n.lang()] || 'Hello! The voice feature is ready.', 'test');
    });
  }

  /* ---- 语音识别子页 ---- */
  function renderAsrSection() {
    const cur = Store.state.voiceSettings.asrEngine || 'browser';
    $('#asrEngineList').innerHTML = Voice.ASR_ENGINES.map(e => {
      const noKey = e.provider && !Voice.engineKey(e.id, Voice.ASR_ENGINES);
      return '<div class="asr-engine-row' + (cur === e.id ? ' active' : '') + (noKey ? ' nokey' : '') + '" data-asr="' + e.id + '">' +
        '<span class="asr-name"><b>' + esc(e.provider || I18n.t('voice.asrBrowser')) + '</b><span>' + esc(e.desc) + (noKey ? ' · 未配置 Key' : '') + '</span></span>' +
        '<span class="asr-check">' + icon('check', 17) + '</span></div>';
    }).join('');
  }

  function bindAsrEvents() {
    $('#asrEngineList').addEventListener('click', e => {
      const row = e.target.closest('[data-asr]');
      if (!row) return;
      const eng = Voice.ASR_ENGINES.find(x => x.id === row.dataset.asr);
      if (eng.provider && !Voice.engineKey(eng.id, Voice.ASR_ENGINES)) {
        Toast.warning(eng.provider + ' ' + I18n.t('voice.needKey'));
        openSub('subKeys');
        return;
      }
      Store.state.voiceSettings.asrEngine = eng.id;
      Store.save();
      renderAsrSection();
      renderRowDescs();
      Toast.success(I18n.t('toast.switched') + (eng.provider || '浏览器内置'));
    });
  }

  /* ---- 语言子页 ---- */
  function renderLangList() {
    const cur = I18n.lang();
    $('#langList').innerHTML = I18n.LANGS.map(l =>
      '<div class="lang-row' + (l.id === cur ? ' active' : '') + '" data-lang="' + l.id + '">' +
      '<span class="lang-name">' + esc(l.name) + '</span><span class="lang-en">' + esc(l.en) + '</span>' +
      '<span class="lang-check">' + icon('check', 17) + '</span></div>').join('');
  }

  function bindLangEvents() {
    $('#langList').addEventListener('click', e => {
      const row = e.target.closest('[data-lang]');
      if (!row) return;
      I18n.setLang(row.dataset.lang);
      renderLangList();
      renderRowDescs();
      Toast.success(I18n.t('toast.switched') + I18n.current().name);
    });
  }

  /* ---- 云端同步（我的 → 用量 分组；SB 不可用时整体降级） ---- */
  /* 动态渲染区域的 [data-icon] 占位填充（静态 DOM 由 index.html 统一注入，动态 HTML 需就地填充） */
  function fillIcons(root) {
    $$('[data-icon]', root).forEach(el => {
      if (!el.innerHTML) el.innerHTML = icon(el.dataset.icon, el.classList.contains('chev') ? 15 : 16);
    });
  }

  function renderSyncSection() {
    const box = $('#syncBody');
    if (!box) return;
    const cu = Store.state.cloudUser;
    const sbReady = typeof SB !== 'undefined' && SB.ready();
    if (!cu) {
      box.innerHTML = '<div class="settings-card"><div class="settings-row">' +
        '<span class="row-icon" data-icon="info"></span>' +
        '<span class="row-label"><span class="row-title">' + esc(I18n.t('cld.notCloud')) + '</span>' +
        '<span class="row-desc" style="display:block">' + esc(I18n.t('cld.notCloudD')) + '</span></span></div></div>';
      fillIcons(box);
      return;
    }
    const st = SB.Sync.status();
    const row = (ic, title, desc) =>
      '<div class="settings-row"><span class="row-icon" data-icon="' + ic + '"></span>' +
      '<span class="row-label"><span class="row-title">' + esc(title) + '</span>' +
      (desc ? '<span class="row-desc" style="display:block">' + esc(desc) + '</span>' : '') + '</span></div>';
    let html = '<div class="settings-card">' +
      row('shield', cu.email, cu.isAdmin ? I18n.t('cld.roleAdmin') : I18n.t('cld.roleUser')) +
      row('history', I18n.t('cld.lastSync'), st.lastSync ? fmtTime(st.lastSync) : I18n.t('cld.never')) +
      (st.keyReady ? '' : row('key', I18n.t('cld.keyPaused'), I18n.t('cld.keyPausedD'))) +
      (cu.isAdmin ? row('database', I18n.t('cld.heavyNote'), I18n.t('cld.heavyNoteD')) : '') +
      (st.lastError ? row('zap', I18n.t('cld.syncFail'), st.lastError) : '') +
      '</div>' +
      '<div class="settings-card">' +
      '<div class="settings-row clickable" id="syncNowBtn">' +
      '<span class="row-icon" data-icon="refresh"></span>' +
      '<span class="row-label"><span class="row-title">' + esc(I18n.t('cld.syncNow')) + '</span>' +
      '<span class="row-desc" style="display:block">' + esc(sbReady ? I18n.t('cld.syncNowD') : I18n.t('cld.cloudOff')) + '</span></span>' +
      '<span class="sync-spin' + (st.syncing ? ' on' : '') + '" id="syncSpin"></span>' +
      '</div>' +
      '<div class="settings-row clickable" id="cloudSignOutBtn">' +
      '<span class="row-icon danger" data-icon="logout"></span>' +
      '<span class="row-label"><span class="row-title" style="color:var(--danger)">' + esc(I18n.t('cld.signOut')) + '</span>' +
      '<span class="row-desc" style="display:block">' + esc(I18n.t('cld.signOutD')) + '</span></span>' +
      '</div></div>';
    box.innerHTML = html;
    fillIcons(box);
  }

  function bindSyncEvents() {
    $('#syncBody').addEventListener('click', async e => {
      if (e.target.closest('#syncNowBtn')) {
        if (typeof SB === 'undefined' || !SB.ready()) return Toast.warning(I18n.t('cld.cloudOff'));
        const spin = $('#syncSpin');
        if (spin) spin.classList.add('on');
        const r = await SB.Sync.syncNow();
        if (r.ok) Toast.success(I18n.t('cld.syncOk'));
        else Toast.error(I18n.t('cld.syncFail') + '：' + (r.error || ''));
        renderSyncSection();
        renderRowDescs();
        return;
      }
      if (e.target.closest('#cloudSignOutBtn')) {
        const ok = await confirmDialog(I18n.t('cld.signOut'), I18n.t('cld.signOutD'));
        if (!ok) return;
        await Auth.cloudSignOut();
        renderProfile();
        renderSyncSection();
        Toast.info(I18n.t('cld.signedOut'));
      }
    });
  }

  /* ---- 数据管理 ---- */
  function renderDataSection() {
    const s = Store.stats();
    $('#dataStats').innerHTML =
      '<div class="data-stat"><b>' + s.chats + '</b><span>对话数</span></div>' +
      '<div class="data-stat"><b>' + s.messages + '</b><span>消息数</span></div>' +
      '<div class="data-stat"><b>' + s.keys + '</b><span>API Key</span></div>' +
      '<div class="data-stat"><b>' + fmtBytes(s.bytes) + '</b><span>存储占用</span></div>';
    renderCloudBackupRows();
  }

  /* 云端备份入口（仅管理员；RLS 限制 cloud_backups 为管理员可写） */
  function renderCloudBackupRows() {
    const box = $('#cloudBackupRows');
    if (!box) return;
    const cu = Store.state.cloudUser;
    if (!cu || !cu.isAdmin) { box.innerHTML = ''; return; }
    box.innerHTML =
      '<div class="settings-row clickable" id="cloudBackupBtn">' +
      '<span class="row-icon" data-icon="upload"></span>' +
      '<span class="row-label"><span class="row-title">' + esc(I18n.t('cld.backupNow')) + '</span>' +
      '<span class="row-desc" style="display:block">' + esc(I18n.t('cld.backupNowD')) + '</span></span>' +
      '<span class="chev" data-icon="chevronRight"></span></div>' +
      '<div class="settings-row clickable" id="cloudRestoreBtn">' +
      '<span class="row-icon" data-icon="download"></span>' +
      '<span class="row-label"><span class="row-title">' + esc(I18n.t('cld.restore')) + '</span>' +
      '<span class="row-desc" style="display:block">' + esc(I18n.t('cld.restoreD')) + '</span></span>' +
      '<span class="chev" data-icon="chevronRight"></span></div>' +
      '<div id="cloudBackupList"></div>';
    fillIcons(box);
  }

  async function loadCloudBackupList() {
    const list = $('#cloudBackupList');
    if (!list) return;
    list.innerHTML = '<div class="cloud-backup-tip">' + esc(I18n.t('cld.loading')) + '</div>';
    const r = await SB.Sync.listBackups();
    if (!r.ok) { list.innerHTML = '<div class="cloud-backup-tip">' + esc(r.error || I18n.t('cld.syncFail')) + '</div>'; return; }
    if (!r.list.length) { list.innerHTML = '<div class="cloud-backup-tip">' + esc(I18n.t('cld.noBackups')) + '</div>'; return; }
    list.innerHTML = r.list.map(b => {
      const d = new Date(b.created_at || '');
      return '<div class="settings-row clickable cloud-backup-item" data-bid="' + esc(b.id) + '">' +
      '<span class="row-icon" data-icon="database"></span>' +
      '<span class="row-label"><span class="row-title">' + esc(b.backup_name || '') + '</span>' +
      '<span class="row-desc" style="display:block">' + esc(fmtBytes(b.size_bytes || 0)) + (isNaN(d) ? '' : ' · ' + esc(d.toLocaleString())) + '</span></span>' +
      '<span class="chev" data-icon="chevronRight"></span></div>';
    }).join('');
    fillIcons(list);
  }

  function bindDataEvents() {
    $('#exportAllBtn').addEventListener('click', () => {
      download('第三方AI-全量备份-' + new Date().toISOString().slice(0, 10) + '.json', Store.exportAll(), 'application/json');
      Toast.success('备份已导出');
    });
    $('#importAllBtn').addEventListener('click', () => $('#importAllFile').click());
    $('#importAllFile').addEventListener('change', async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        Store.importAll(await readFileAsText(file));
        UI.renderSidebar(); UI.renderChat(); renderProfile();
        Toast.success('数据已恢复');
      } catch (err) { Toast.error('恢复失败：' + err.message); }
    });
    $('#clearAllBtn').addEventListener('click', () => {
      confirmDialog('清除所有数据', '将删除全部对话、Key 配置与账号信息并恢复初始状态，确定继续吗？', true).then(ok => {
        if (ok) { Store.reset(); location.reload(); }
      });
    });
    // 云端备份/恢复（行是动态渲染的，用容器委托）
    $('#cloudBackupRows').addEventListener('click', async e => {
      if (typeof SB === 'undefined' || !SB.ready()) return Toast.warning(I18n.t('cld.cloudOff'));
      if (e.target.closest('#cloudBackupBtn')) {
        Toast.info(I18n.t('cld.backing'));
        const r = await SB.Sync.backupNow();
        if (r.ok) { Toast.success(I18n.t('cld.backupOk')); if ($('#cloudBackupList').innerHTML) loadCloudBackupList(); }
        else Toast.error(I18n.t('cld.syncFail') + '：' + (r.error || ''));
        return;
      }
      if (e.target.closest('#cloudRestoreBtn')) { loadCloudBackupList(); return; }
      const item = e.target.closest('.cloud-backup-item');
      if (item) {
        const ok = await confirmDialog(I18n.t('cld.restore'), I18n.t('cld.restoreQ'), true);
        if (!ok) return;
        const r = await SB.Sync.restoreBackup(item.dataset.bid);
        if (!r.ok) return Toast.error(I18n.t('cld.syncFail') + '：' + (r.error || ''));
        try {
          Store.importAll(JSON.stringify(r.data));
          UI.renderSidebar(); UI.renderChat(); renderProfile(); renderDataSection();
          Toast.success(I18n.t('cld.restoreOk'));
        } catch (err) { Toast.error('恢复失败：' + err.message); }
      }
    });
  }

  /* ==================== 回收站 ==================== */
  function renderTrash() {
    const trash = Store.state.trash || { chats: [], apiKeys: [], items: [], clearedAt: 0 };
    const chatsList = $('#trashChatsList');
    if (chatsList) {
      if (trash.chats && trash.chats.length) {
        chatsList.innerHTML = trash.chats.map(c =>
          '<div class="settings-row" style="justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);">' +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%;">' + esc(c.title || '未命名对话') + '<span style="font-size:12px;color:var(--text-3);margin-left:8px;">' + fmtDate(c.deletedAt) + '</span></span>' +
          '<span style="display:flex;gap:8px;flex-shrink:0;">' +
          '<button class="btn btn-sm" data-trash-restore="chat" data-id="' + c.id + '">恢复</button>' +
          '<button class="btn btn-sm btn-danger" data-trash-del="chat" data-id="' + c.id + '">删除</button>' +
          '</span></div>').join('');
      } else {
        chatsList.innerHTML = '<div style="padding:16px;color:var(--text-3);font-size:14px;text-align:center;">暂无已删除的对话</div>';
      }
    }
    const keysList = $('#trashKeysList');
    if (keysList) {
      if (trash.apiKeys && trash.apiKeys.length) {
        keysList.innerHTML = trash.apiKeys.map(k =>
          '<div class="settings-row" style="justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);">' +
          '<span>' + esc(k.provider || '未知厂商') + '<span style="font-size:12px;color:var(--text-3);margin-left:8px;">' + fmtDate(k.deletedAt) + '</span></span>' +
          '<span style="display:flex;gap:8px;flex-shrink:0;">' +
          '<button class="btn btn-sm" data-trash-restore="key" data-id="' + k.id + '">恢复</button>' +
          '<button class="btn btn-sm btn-danger" data-trash-del="key" data-id="' + k.id + '">删除</button>' +
          '</span></div>').join('');
      } else {
        keysList.innerHTML = '<div style="padding:16px;color:var(--text-3);font-size:14px;text-align:center;">暂无已删除的 Key</div>';
      }
    }
    const emptyBtn = $('#trashEmptyBtn');
    if (emptyBtn) {
      const hasAny = (trash.chats && trash.chats.length) || (trash.apiKeys && trash.apiKeys.length);
      emptyBtn.style.display = hasAny ? 'block' : 'none';
    }
  }

  function bindTrashEvents() {
    const trashRow = document.querySelector('[data-sub="subTrash"]');
    if (trashRow) trashRow.addEventListener('click', () => renderTrash());
    const trashBody = $('#subTrashBody');
    if (trashBody) {
      trashBody.addEventListener('click', e => {
        const restoreBtn = e.target.closest('[data-trash-restore]');
        const delBtn = e.target.closest('[data-trash-del]');
        const emptyBtn = e.target.closest('#trashEmptyBtn');
        if (restoreBtn) {
          const type = restoreBtn.dataset.trashRestore;
          const id = restoreBtn.dataset.id;
          const trash = Store.state.trash || { chats: [], apiKeys: [], items: [], clearedAt: 0 };
          if (type === 'chat') {
            const idx = trash.chats.findIndex(c => c.id === id);
            if (idx >= 0) {
              const chat = trash.chats.splice(idx, 1)[0];
              delete chat.deletedAt;
              Store.state.chats.push(chat);
              Store.save();
            }
          } else if (type === 'key') {
            const idx = trash.apiKeys.findIndex(k => k.id === id);
            if (idx >= 0) {
              const key = trash.apiKeys.splice(idx, 1)[0];
              delete key.deletedAt;
              Store.state.apiKeys[key.provider] = key.value;
              Store.save();
            }
          }
          renderTrash();
          Toast.success('已恢复');
          if (type === 'chat') UI.renderSidebar();
          return;
        }
        if (delBtn) {
          const type = delBtn.dataset.trashDel;
          const id = delBtn.dataset.id;
          const trash = Store.state.trash || { chats: [], apiKeys: [], items: [], clearedAt: 0 };
          if (type === 'chat') trash.chats = trash.chats.filter(c => c.id !== id);
          else if (type === 'key') trash.apiKeys = trash.apiKeys.filter(k => k.id !== id);
          Store.save();
          renderTrash();
          Toast.success('已彻底删除');
          return;
        }
        if (emptyBtn) {
          confirmDialog('清空回收站', '确定彻底清空回收站？此操作不可恢复。', true).then(ok => {
            if (!ok) return;
            Store.state.trash = { chats: [], apiKeys: [], items: [], clearedAt: Date.now() };
            Store.save();
            renderTrash();
            Toast.success('回收站已清空');
          });
        }
      });
    }
  }

  /* ---- 关于 ---- */
  function renderAboutSection() {
    $$('#aboutVersion, #aboutVersionSub').forEach(el => { el.textContent = 'v' + APP_VERSION; });
    const latest = CHANGELOG[CHANGELOG.length - 1];
    if (latest) $('#changelogRowDesc').textContent = '最新 v' + latest.version + ' · ' + latest.date + '，共 ' + CHANGELOG.length + ' 个版本';
  }

  /* ---- 帮助中心 ---- */
  const CONSOLE_LINKS = {
    '小米 MiMo': 'https://platform.xiaomimimo.com', 'OpenAI': 'https://platform.openai.com/api-keys',
    'Anthropic': 'https://console.anthropic.com', 'Google': 'https://aistudio.google.com/apikey',
    'DeepSeek': 'https://platform.deepseek.com/api_keys', 'Kimi': 'https://platform.moonshot.cn/console/api-keys',
    '通义千问': 'https://bailian.console.aliyun.com', '智谱AI': 'https://open.bigmodel.cn/usercenter/apikeys',
    '文心一言': 'https://qianfan.cloud.baidu.com', '腾讯混元': 'https://console.cloud.tencent.com/hunyuan/api-keys',
    'MiniMax': 'https://platform.minimaxi.com', '火山引擎': 'https://console.volcengine.com/ark',
    '零一万物': 'https://platform.lingyiwanwu.com/apikeys', '阶跃星辰': 'https://platform.stepfun.com/interface-key',
    '百川智能': 'https://platform.baichuan-ai.com/console/apikey', '讯飞星火': 'https://console.xfyun.cn',
    '昆仑万维': 'https://platform.tiangong.cn', '商汤': 'https://platform.sensenova.cn',
    'Mistral': 'https://console.mistral.ai/api-keys', 'Meta': 'https://llama.developer.meta.com',
    'Cohere': 'https://dashboard.cohere.com/api-keys', 'xAI': 'https://console.x.ai', 'Groq': 'https://console.groq.com/keys'
  };

  function renderHelp() {
    const faqs = [
      { q: '这个平台是什么？', a: '一个纯前端的 AI 对话聚合平台：填入各家厂商的 API Key，就能在一个界面里使用 23 家厂商的 270+ 大模型。支持单模型、多模型对比、辩论、协同四种对话模式，以及语音、绘画、联网搜索等工具。数据只存储在你自己的浏览器里。' },
      { q: '如何开始使用？', a: '<ol><li>进入「我的 → API Key 管理」</li><li>展开任意厂商，粘贴从该厂商控制台申请的 Key（下方有各厂商申请入口）</li><li>回到对话页，顶部选择模型即可开始聊天</li></ol>只需填写 Key 即可，接口地址、请求格式、参数均已按各厂商官方文档内置适配。' },
      { q: '四种对话模式有什么区别？', a: '<ul><li><b>单模型</b>：与任意一个模型对话</li><li><b>多模型</b>：同一个问题同时发给多个模型，并排对比回答</li><li><b>辩论</b>：正方、反方多轮交锋，裁判模型总结点评</li><li><b>协同</b>：多个模型分工协作（提案 → 汇总），完成复杂任务</li></ul>' },
      { q: '语音输入 / 语音朗读怎么用？', a: '<ul><li>点击输入框左侧麦克风开始语音输入，说完再点一次结束</li><li>在「我的 → 语音识别」可切换识别引擎：浏览器内置（免费）、小米 MiMo（支持中文、英语及粤语/吴语/闽南语/四川话等方言）、OpenAI / Groq Whisper</li><li>AI 回复卡片上的喇叭图标可朗读该条回复</li><li>在「我的 → 播报声音」可切换朗读引擎与音色</li></ul>' },
      { q: '语音工坊（合成 / 克隆 / 设计）', a: '「其他 → 语音工坊」使用小米 MiMo 语音模型：<ul><li><b>预置音色</b>：9 种精品音色直接合成</li><li><b>音色设计</b>：用文字描述想要的声音（如“年迈的老先生，北方口音”）现场生成</li><li><b>音色克隆</b>：上传一段 ≤10MB 的音频样本，即可克隆该声音朗读任意文本</li></ul>需先在 API Key 管理中配置小米 MiMo Key。' },
      { q: 'AI 绘画怎么用？', a: '「其他 → AI 绘画」输入画面描述即可生成图片。支持 OpenAI DALL·E、火山引擎 Seedream、通义万相，需配置对应厂商 Key。' },
      { q: '如何安装为 App？', a: '在「我的 → 安装为 App」一键安装（支持浏览器 PWA 安装的设备）；iOS 可在 Safari 菜单选择「添加到主屏幕」。安装后离线也能打开，数据仍在本地。' },
      { q: '模型旁的「新上线 / 已下架」标记？', a: '模型页支持一键「同步模型」，从已配置 Key 的厂商拉取最新模型列表：厂商新发布的模型会标记「新上线」，官方下架的模型标记「已下架」并置灰（仅供展示，不可再选择对话）。' },
      { q: '我的数据安全吗？', a: '全部对话、Key、设置仅存储在你本机浏览器的 localStorage 中，不经过任何第三方服务器（你的提问只会从浏览器直接发往对应 AI 厂商）。清除浏览器数据前，请先在「数据管理」导出备份。' }
    ];
    const cn = [], gl = [];
    Object.keys(PROVIDERS).forEach(p => (PROVIDERS[p].region === 'cn' ? cn : gl).push(p));
    const consoleRows = list => list.map(p =>
      '<div class="console-row">' + providerIconHtml(p, 20) + '<span class="console-name">' + esc(p) + '</span>' +
      '<a href="' + (CONSOLE_LINKS[p] || '#') + '" target="_blank" rel="noopener">' + esc(CONSOLE_LINKS[p] ? CONSOLE_LINKS[p].replace('https://', '') : (PROVIDERS[p].keyHint || '')) + '</a></div>').join('');
    $('#helpBody').innerHTML =
      '<div class="settings-card">' + faqs.map((f, i) =>
        '<div class="faq-item' + (i === 0 ? ' open' : '') + '"><button class="faq-q">' + esc(f.q) + '<span class="faq-arrow">' + icon('chevronRight', 15) + '</span></button>' +
        '<div class="faq-a">' + f.a + '</div></div>').join('') + '</div>' +
      '<div class="help-section-title">各厂商 API Key 申请入口（点击跳转控制台）</div>' +
      '<div class="help-section-title" style="padding-top:4px">国内厂商</div>' +
      '<div class="settings-card">' + consoleRows(cn) + '</div>' +
      '<div class="help-section-title">国外厂商</div>' +
      '<div class="settings-card">' + consoleRows(gl) + '</div>';
  }

  function bindHelpEvents() {
    $('#helpBody').addEventListener('click', e => {
      const q = e.target.closest('.faq-q');
      if (q) q.closest('.faq-item').classList.toggle('open');
    });
  }

  /* ---- 更新日志弹窗（时间线，默认折叠：仅最新版本展开） ---- */
  function renderChangelogModal() {
    const order = window.changelogModalOrder || 'desc';
    const entries = order === 'desc' ? [...CHANGELOG].reverse() : [...CHANGELOG];
    const btnLabel = order === 'desc' ? '↓ 新→旧' : '↑ 旧→新';
    $('#changelogModalBody').innerHTML =
      '<div style="display:flex;justify-content:flex-end;padding:0 0 8px;">' +
      '<button id="changelog-modal-order-btn" style="padding:4px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-soft);font-size:13px;cursor:pointer;color:var(--text);">' + esc(btnLabel) + '</button>' +
      '</div>' +
      '<div class="timeline">' + entries.map((c, idx) =>
        '<div class="tl-item' + (c.major ? ' major' : '') + (idx === 0 ? ' open' : '') + '">' +
        '<div class="tl-dot"></div>' +
        '<div class="tl-card">' +
        '<button class="tl-head tl-toggle" type="button">' +
        '<span class="tl-ver">v' + esc(c.version) + '</span>' +
        (c.major ? '<span class="tl-badge">里程碑</span>' : '') +
        '<span class="tl-summary">' + c.items.length + ' ' + I18n.t('cl.items') + '</span>' +
        '<span class="tl-date">' + esc(c.date) + '</span>' +
        '<span class="tl-caret">' + icon('chevronDown', 14) + '</span></button>' +
        '<ul class="tl-list">' + c.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' +
        '</div></div>').join('') + '</div>';
    const btn = $('#changelog-modal-order-btn');
    if (btn) {
      btn.onclick = () => {
        window.changelogModalOrder = order === 'desc' ? 'asc' : 'desc';
        renderChangelogModal();
      };
    }
  }

  function bindChangelogEvents() {
    $('#changelogRow').addEventListener('click', () => {
      window.changelogModalOrder = 'desc';
      renderChangelogModal();
      $('#changelogModal').classList.add('show');
    });
    $('#changelogClose').addEventListener('click', () => $('#changelogModal').classList.remove('show'));
    $('#changelogModal').addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
    });
    // 点击版本卡片头展开 / 收起（展开态不持久化）
    $('#changelogModalBody').addEventListener('click', e => {
      const head = e.target.closest('.tl-toggle');
      if (head) head.closest('.tl-item').classList.toggle('open');
    });
  }

  /* ==================== 编辑资料（Kimi 式：头像 / 名字 / 简介 + 账号安全） ==================== */
  /* 失焦自动保存；返回时若有改动 Toast 一次 */
  let peDirty = false;

  /* 通用输入弹窗：body 内带 data-field 的输入控件，确认后回传 {field: value}，取消回 null；
     opts.validate(vals) 返回提示文案则 Toast 并保持弹窗打开，返回 null 通过 */
  function inputDialog(opts) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay show';
      overlay.innerHTML =
        '<div class="modal modal-sm" style="animation:popIn .22s var(--ease)">' +
        '<div class="modal-header"><h3>' + icon(opts.icon || 'edit', 19) + esc(opts.title) + '</h3></div>' +
        '<div class="modal-body">' + opts.body + '</div>' +
        '<div class="modal-footer">' +
        '<button class="btn btn-ghost" data-act="no">' + esc(I18n.t('pe.cancel')) + '</button>' +
        '<button class="btn btn-primary" data-act="yes">' + esc(opts.okText || I18n.t('pe.confirm')) + '</button>' +
        '</div></div>';
      document.body.appendChild(overlay);
      const collect = () => {
        const vals = {};
        overlay.querySelectorAll('[data-field]').forEach(el => { vals[el.dataset.field] = el.value; });
        return vals;
      };
      const close = val => { overlay.remove(); resolve(val); };
      const submit = () => {
        const vals = collect();
        if (opts.validate) {
          const msg = opts.validate(vals);
          if (msg) return Toast.warning(msg);   // 校验不过：保持弹窗
        }
        close(vals);
      };
      overlay.addEventListener('click', e => {
        const act = e.target.closest('[data-act]');
        if (act) return act.dataset.act === 'yes' ? submit() : close(null);
        if (e.target === overlay) close(null);
      });
      overlay.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      const first = overlay.querySelector('[data-field]');
      if (first) setTimeout(() => first.focus(), 60);
    });
  }

  /* 本地用户表同步写（userInfo 与 users 表记录是同一账号的两处落地，都要写） */
  function patchLocalUser(fields) {
    const u = Store.state.userInfo || {};
    Object.assign(u, fields);
    Store.state.userInfo = u;
    const account = Store.state.user;
    if (account && account !== 'guest') {
      const users = Store.getUsers();
      if (users[account]) { Object.assign(users[account], fields); Store.saveUsers(users); }
    }
    Store.save();
  }

  /* 资料变更后：刷新资料卡 / 侧栏用户区，并标记「返回时 Toast」 */
  function afterPeChange() {
    peDirty = true;
    renderProfile();
    UI.renderSidebar();
    // 编辑页大头像为字母占位时同步首字（图片头像不动）
    const peAv = $('#peAvatarBtn');
    if (peAv && peAv.firstElementChild && peAv.firstElementChild.tagName === 'SPAN' && !peAv.firstElementChild.classList.contains('pe-avatar-edit')) {
      const cu = Store.state.cloudUser;
      const nm = (cu && cu.name) || (Store.state.userInfo || {}).name || 'U';
      peAv.firstElementChild.textContent = nm.charAt(0).toUpperCase();
    }
  }

  function renderProfileEdit() {
    const box = $('#peBody');
    if (!box) return;
    peDirty = false;
    const cu = Store.state.cloudUser;
    const u = Store.state.userInfo || {};
    const name = (cu && cu.name) || u.name || '';
    const bio = cu ? (cu.bio || '') : (u.bio || '');
    const av = UI.avatarView();
    const avInner = av.img
      ? '<img src="' + av.img + '" alt="">'
      : '<span>' + esc((name || 'U').charAt(0).toUpperCase()) + '</span>';
    const secRow = (id, ic, title, val) =>
      '<div class="settings-row clickable" id="' + id + '">' +
      '<span class="row-icon" data-icon="' + ic + '"></span>' +
      '<span class="row-label"><span class="row-title">' + esc(title) + '</span>' +
      '<span class="row-desc" style="display:block">' + esc(val) + '</span></span>' +
      '<span class="chev" data-icon="chevronRight"></span></div>';

    let html =
      '<div class="settings-group-title">' + icon('user', 15) + ' ' + esc(I18n.t('pe.secA')) + '</div>' +
      '<div class="settings-card pe-card">' +
        '<div class="pe-avatar-wrap">' +
          '<button class="pe-avatar" id="peAvatarBtn" title="' + esc(I18n.t('pe.avatarTip')) + '"' +
            (av.img ? '' : ' style="background:' + av.grad + '"') + '>' + avInner +
            '<span class="pe-avatar-edit">' + icon('edit', 13) + '</span></button>' +
          '<div class="pe-avatar-tip">' + esc(I18n.t('pe.avatarTip')) + '</div>' +
        '</div>' +
        '<div class="pe-field"><label for="peName">' + esc(I18n.t('pe.name')) + '</label>' +
          '<input class="input" id="peName" maxlength="30" value="' + esc(name) + '" placeholder="' + esc(I18n.t('pe.namePh')) + '" autocomplete="off"></div>' +
        '<div class="pe-field"><label for="peBio">' + esc(I18n.t('pe.bio')) + '</label>' +
          '<textarea class="textarea" id="peBio" maxlength="100" rows="3" placeholder="' + esc(I18n.t('pe.bioPh')) + '">' + esc(bio) + '</textarea>' +
          '<div class="pe-count" id="peBioCount">' + bio.length + '/100</div></div>' +
      '</div>';

    html += '<div class="settings-group-title">' + icon('shield', 15) + ' ' + esc(I18n.t('pe.secB')) + '</div>';
    if (cu) {
      html += '<div class="settings-card">' +
        secRow('peEmailRow', 'link', I18n.t('pe.email'), cu.email || '') +
        secRow('pePhoneRow', 'smartphone', I18n.t('pe.phone'), cu.phone || I18n.t('pe.phoneUnset')) +
        secRow('pePassRow', 'key', I18n.t('pe.password'), I18n.t('pe.passwordD')) +
        '</div>' +
        '<div class="subpage-tip">' + esc(I18n.t('pe.phoneNote')) + '</div>';
    } else {
      // 本地账号 / 游客：无云端凭据，隐藏账号安全操作
      html += '<div class="settings-card"><div class="settings-row">' +
        '<span class="row-icon" data-icon="info"></span>' +
        '<span class="row-label"><span class="row-title">' + esc(I18n.t('pe.localOnly')) + '</span>' +
        '<span class="row-desc" style="display:block">' + esc(I18n.t('pe.localOnlyD')) + '</span></span></div></div>';
    }
    box.innerHTML = html;
    fillIcons(box);

    /* ---- A 区：头像 / 名字 / 简介（失焦自动保存） ---- */
    $('#peAvatarBtn').addEventListener('click', () => $('#peAvatarFile').click());
    $('#peName').addEventListener('blur', savePeName);
    $('#peBio').addEventListener('input', e => { $('#peBioCount').textContent = e.target.value.length + '/100'; });
    $('#peBio').addEventListener('blur', savePeBio);

    /* ---- B 区：账号安全（仅云端用户渲染） ---- */
    if (cu) {
      $('#peEmailRow').addEventListener('click', () => changePeEmail(cu));
      $('#pePhoneRow').addEventListener('click', () => changePePhone(cu));
      $('#pePassRow').addEventListener('click', () => changePePassword(cu));
    }
  }

  /* 头像：选图 → 压缩 256px JPEG（≤60KB，超了逐级降质量）→ 云端写 profiles.avatar_url / 本地写 userInfo.avatar */
  async function onPeAvatarFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let dataUrl = await compressImage(await readFileAsDataURL(file), 256, 0.85);
    let q = 0.7;
    while (dataUrl.length > 60 * 1024 && q >= 0.3) {
      dataUrl = await compressImage(dataUrl, 256, q);
      q -= 0.15;
    }
    const cu = Store.state.cloudUser;
    if (cu) {
      const r = await SB.updateProfile({ avatar: dataUrl });
      if (!r.ok) return Toast.error(I18n.t('cld.syncFail') + '：' + (r.error || ''));
    } else {
      patchLocalUser({ avatar: dataUrl });
    }
    afterPeChange();
    renderProfileEdit();
    Toast.success(I18n.t('pe.avatarOk'));
  }

  async function savePeName() {
    const el = $('#peName');
    if (!el) return;
    const name = (el.value || '').trim();
    const cu = Store.state.cloudUser;
    const cur = (cu && cu.name) || (Store.state.userInfo || {}).name || '';
    if (name === cur) return;
    if (!name) { el.value = cur; return Toast.warning(I18n.t('pe.nameEmpty')); }
    peDirty = true;   // 提前标记：云端请求未返回时直接返回也有 Toast
    patchLocalUser({ name });
    if (cu) {
      cu.name = name;
      const r = await SB.updateProfile({ displayName: name });
      if (!r.ok) Toast.error(I18n.t('cld.syncFail') + '：' + (r.error || ''));
    }
    afterPeChange();
  }

  async function savePeBio() {
    const el = $('#peBio');
    if (!el) return;
    const bio = (el.value || '').trim().slice(0, 100);
    const cu = Store.state.cloudUser;
    const cur = cu ? (cu.bio || '') : ((Store.state.userInfo || {}).bio || '');
    if (bio === cur) return;
    peDirty = true;
    if (cu) {
      const r = await SB.updateProfile({ bio });
      if (!r.ok) Toast.error(I18n.t('cld.syncFail') + '：' + (r.error || ''));
    } else {
      patchLocalUser({ bio });
    }
    afterPeChange();
  }

  /* 更改邮箱：updateUser({email}) → 验证邮件发送到新邮箱，确认后生效 */
  async function changePeEmail(cu) {
    const vals = await inputDialog({
      title: I18n.t('pe.emailChange'), icon: 'link',
      body: '<label class="pe-dialog-label">' + esc(I18n.t('pe.emailNew')) + '</label>' +
            '<input class="input" type="email" data-field="email" placeholder="name@example.com" autocomplete="off">',
      okText: I18n.t('pe.confirm'),
      validate: v => (v.email || '').trim().indexOf('@') < 1 ? I18n.t('cld.badEmail') : null
    });
    if (!vals) return;
    const email = (vals.email || '').trim().toLowerCase();
    if (email === (cu.email || '').toLowerCase()) return;
    const r = await SB.Auth.updateUser({ email });
    if (r.error) return Toast.error(SB.errMsg(r.error));
    Toast.success(I18n.t('pe.emailSent'));
  }

  /* 绑定手机号：仅存 profiles.phone（短信验证后续版本开放，目前仅展示） */
  async function changePePhone(cu) {
    const vals = await inputDialog({
      title: I18n.t('pe.phone'), icon: 'smartphone',
      body: '<label class="pe-dialog-label">' + esc(I18n.t('pe.phoneNew')) + '</label>' +
            '<input class="input" type="tel" data-field="phone" value="' + esc(cu.phone || '') + '" placeholder="+86 138 0000 0000" autocomplete="off">',
      okText: I18n.t('pe.confirm'),
      validate: v => {
        const phone = (v.phone || '').trim();
        return (phone && !/^\+?[0-9][0-9 -]{4,18}$/.test(phone)) ? I18n.t('pe.phoneBad') : null;
      }
    });
    if (!vals) return;
    const phone = (vals.phone || '').trim();
    if (phone === (cu.phone || '')) return;
    const r = await SB.updateProfile({ phone });
    if (!r.ok) return Toast.error(I18n.t('cld.syncFail') + '：' + (r.error || ''));
    renderProfileEdit();
    Toast.success(I18n.t('pe.saved'));
  }

  /* 修改密码：旧密码仅本地非空提示；updateUser({password}) 成功后会话内 Key 加密密钥同步换新并重推 */
  async function changePePassword(cu) {
    const vals = await inputDialog({
      title: I18n.t('pe.password'), icon: 'key',
      body: '<label class="pe-dialog-label">' + esc(I18n.t('pe.oldPass')) + '</label>' +
            '<input class="input" type="password" data-field="old" placeholder="' + esc(I18n.t('pe.oldPassPh')) + '" autocomplete="current-password">' +
            '<label class="pe-dialog-label" style="margin-top:12px">' + esc(I18n.t('pe.newPass')) + '</label>' +
            '<input class="input" type="password" data-field="p1" placeholder="' + esc(I18n.t('pe.newPassPh')) + '" autocomplete="new-password">' +
            '<input class="input" type="password" data-field="p2" style="margin-top:8px" placeholder="' + esc(I18n.t('pe.newPass2')) + '" autocomplete="new-password">',
      okText: I18n.t('pe.confirm'),
      validate: v => {
        if (!v.old) return I18n.t('pe.oldPassPh');
        if (!v.p1 || v.p1.length < 6) return I18n.t('cld.pwdShort');
        if (v.p1 !== v.p2) return I18n.t('pe.passMismatch');
        return null;
      }
    });
    if (!vals) return;
    const r = await SB.Auth.updateUser({ password: vals.p1 });
    if (r.error) return Toast.error(SB.errMsg(r.error));
    /* 会话内派生密钥随新密码更新并立即重推（否则旧密文在新密码下无法解开） */
    SB.setPassword(vals.p1);
    SB.Sync.schedulePush(0);
    Toast.success(I18n.t('pe.passOk'));
  }

  /* ---- 编辑资料页事件（一次性绑定；页内元素在 renderProfileEdit 后各自绑定） ---- */
  function bindProfileEditEvents() {
    $('#profileCard').addEventListener('click', () => openSub('subProfileEdit'));
    $('#peAvatarFile').addEventListener('change', onPeAvatarFile);
    // 返回时有未提示的改动 → Toast 一次（subpage-back 的关闭逻辑在 bindSubpageEvents 统一绑定）
    $('#subProfileEdit .subpage-back').addEventListener('click', () => {
      if (peDirty) { peDirty = false; Toast.success(I18n.t('pe.saved')); }
    });
  }

  /* ==================== 语音工坊（小米 MiMo：合成/设计/克隆） ==================== */
  let vsMode = 'preset';

  function openVoiceStudio(mode) {
    vsMode = mode || 'preset';
    const key = getKeyForModel({ provider: '小米 MiMo' });
    $('#vsNoKey').style.display = key ? 'none' : 'block';
    if (!key) $('#vsNoKey').innerHTML = I18n.t('vs.needMimo') +
      '<br><button class="btn btn-secondary btn-sm" id="vsGoKeys" style="margin-top:8px">' + icon('key', 14) + ' 去配置 Key</button>';
    $('#vsBody').style.opacity = key ? '1' : '.45';
    $('#vsBody').style.pointerEvents = key ? 'auto' : 'none';
    // 音色下拉
    $('#vsVoice').innerHTML = Voice.MIMO_VOICES.map(v => '<option value="' + esc(v.id) + '">' + esc(v.name) + '</option>').join('');
    syncVsTabs();
    $('#vsResult').style.display = 'none';
    $('#voiceStudioModal').classList.add('show');
  }

  function syncVsTabs() {
    $$('#voiceStudioModal .vs-tab').forEach(t => t.classList.toggle('active', t.dataset.vsmode === vsMode));
    $('#vsVoiceRow').style.display = vsMode === 'preset' ? 'block' : 'none';
    $('#vsStyleRow').style.display = vsMode === 'preset' ? 'block' : 'none';
    $('#vsDescRow').style.display = vsMode === 'design' ? 'block' : 'none';
    $('#vsSampleRow').style.display = vsMode === 'clone' ? 'block' : 'none';
  }

  function bindVoiceStudioEvents() {
    $('#vsClose').addEventListener('click', () => $('#voiceStudioModal').classList.remove('show'));
    $('#voiceStudioModal').addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
      const go = e.target.closest('#vsGoKeys');
      if (go) { $('#voiceStudioModal').classList.remove('show'); UI.navigate('profile'); setTimeout(() => openSub('subKeys'), 120); }
    });
    $$('#voiceStudioModal .vs-tab').forEach(t => t.addEventListener('click', () => { vsMode = t.dataset.vsmode; syncVsTabs(); }));
    $('#vsGen').addEventListener('click', runVoiceStudio);
  }

  async function runVoiceStudio() {
    const text = $('#vsText').value.trim();
    if (!text) return Toast.warning('请输入要合成的文本');
    const key = getKeyForModel({ provider: '小米 MiMo' });
    if (!key) return Toast.warning('请先配置小米 MiMo Key');
    const btn = $('#vsGen');
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = I18n.t('vs.generating');
    $('#vsResult').style.display = 'none';
    try {
      let body;
      if (vsMode === 'design') {
        const desc = $('#vsDesc').value.trim();
        if (!desc) { Toast.warning('请输入音色描述'); btn.disabled = false; btn.textContent = oldText; return; }
        body = {
          model: 'mimo-v2.5-tts-voicedesign',
          messages: [{ role: 'user', content: desc }, { role: 'assistant', content: text }],
          audio: { format: 'wav', voice: 'mimo_default' }
        };
      } else if (vsMode === 'clone') {
        const file = $('#vsSample').files[0];
        if (!file) { Toast.warning('请上传音频样本'); btn.disabled = false; btn.textContent = oldText; return; }
        if (file.size > 10 * 1024 * 1024) { Toast.warning('音频样本不能超过 10MB'); btn.disabled = false; btn.textContent = oldText; return; }
        const sampleUrl = await readFileAsDataURL(file);
        body = {
          model: 'mimo-v2.5-tts-voiceclone',
          messages: [{ role: 'assistant', content: text }],
          audio: { format: 'wav', voice: sampleUrl }
        };
      } else {
        const style = $('#vsStyle').value.trim();
        const msgs = style ? [{ role: 'user', content: style }, { role: 'assistant', content: text }] : [{ role: 'assistant', content: text }];
        body = {
          model: 'mimo-v2.5-tts',
          messages: msgs,
          audio: { format: 'wav', voice: $('#vsVoice').value || 'mimo_default' }
        };
      }
      const url = await Voice.mimoTtsUrl(text, key, body);
      const audio = $('#vsAudio');
      audio.src = url;
      $('#vsDownload').href = url;
      $('#vsResult').style.display = 'block';
      audio.play().catch(() => {});
      Toast.success('合成完成');
    } catch (e) {
      Toast.error('合成失败：' + e.message);
    }
    btn.disabled = false;
    btn.textContent = oldText;
  }

  /* ---- 安装 App / 退出 ---- */
  function updateInstallRow() {
    const row = $('#installRow');
    if (!row) return;
    row.querySelector('.row-desc').textContent = window.AppInstall && AppInstall.canInstall()
      ? '一键安装到桌面，离线可用'
      : (window.AppInstall && AppInstall.isInstalled() ? '已安装为应用' : '浏览器菜单 → 添加到主屏幕');
  }

  function bindProfileEvents() {
    bindKeyEvents(); bindThemeEvents(); bindPluginEvents(); bindDataEvents(); bindTrashEvents(); bindProfileEditEvents(); bindChangelogEvents();
    bindSubpageEvents(); bindVoiceEvents(); bindAsrEvents(); bindLangEvents(); bindHelpEvents(); bindVoiceStudioEvents();
    $('#installRow').addEventListener('click', () => { if (window.AppInstall) AppInstall.prompt(); });
    $('#logoutBtn').addEventListener('click', () => {
      confirmDialog('退出登录', '确定退出当前账号吗？对话记录将保留在本机。').then(ok => { if (ok) Auth.logout(); });
    });
    syncThemeCards();
  }

  function init() {
    bindModelsEvents();
    bindDiscoverEvents();
    bindPaintEvents();
    bindProfileEvents();
    bindSyncEvents();
    bindToolEvents();
    bindTokenEvents();
    // v5.3: 渲染翻译历史
    renderTrHistory();
    renderTrHistory();
    bindTranslateEvents();
    bindPluginLibEvents();
    bindSkillEvents();
    bindSubpageEvents();
    renderDiscoverTools();
    // 语言切换时重渲染动态内容
    document.addEventListener('langchange', () => {
      renderRowDescs();
      if (Store.state.currentPage === 'models') renderModels();
      renderDiscover();
      if ($('#subTranslate').classList.contains('show')) renderTranslate();
      if ($('#subTokens').classList.contains('show')) renderTokens();
      if ($('#subSync').classList.contains('show')) renderSyncSection();
      if ($('#subProfileEdit').classList.contains('show')) renderProfileEdit();
      if ($('#subPlugins').classList.contains('show')) renderPlugins();
      if ($('#subSkills').classList.contains('show')) renderSkills();
    });
    // 云端同步状态变化：刷新同步子页与「我的」页条目描述
    document.addEventListener('sbsync', () => {
      renderRowDescs();
      if ($('#subSync').classList.contains('show')) renderSyncSection();
    });
  }

  function renderProxySection() {
    const box = document.getElementById('subProxyBody');
    if (!box) { console.warn('[Proxy] subProxyBody element not found'); return; }
    const mode = (Store.state && Store.state.proxyMode) || 'local';
    box.innerHTML = 
      '<div class="settings-group-title">代理模式</div>' +
      '<div class="proxy-option' + (mode === 'local' ? ' active' : '') + '" data-mode="local" style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:12px;cursor:pointer;background:' + (mode === 'local' ? '#f0fdf4' : '#fff') + ';">' +
      '<div style="font-weight:600;font-size:15px;margin-bottom:4px;">📱 本地直连</div>' +
      '<div style="font-size:13px;color:#666;">API Key 保存在本机浏览器中，直接请求厂商服务器。适合个人使用，响应更快。</div>' +
      '</div>' +
      '<div class="proxy-option' + (mode === 'server' ? ' active' : '') + '" data-mode="server" style="padding:16px;border:1px solid #e5e7eb;border-radius:12px;cursor:pointer;background:' + (mode === 'server' ? '#eff6ff' : '#fff') + ';">' +
      '<div style="font-weight:600;font-size:15px;margin-bottom:4px;">☁️ 服务器代理</div>' +
      '<div style="font-size:13px;color:#666;">API Key 保存在云端 Worker，通过服务器转发请求。适合多设备同步，Key 不暴露前端。</div>' +
      '</div>' +
      '<div style="padding:12px 16px;font-size:12px;color:#999;margin-top:8px;">切换后下次对话生效</div>';

    box.querySelectorAll('.proxy-option').forEach(el => {
      el.addEventListener('click', () => {
        const newMode = el.dataset.mode;
        Store.patch({proxyMode: newMode});
        renderProxySection();
        renderRowDescs();
        if (typeof showToast === 'function') showToast(newMode === 'server' ? '已切换至服务器代理' : '已切换至本地直连');
      });
    });
  }

  function renderNavSettings() {
    const devices = [
      { key: 'desktop', label: '桌面端', icon: 'monitor' },
      { key: 'mobile', label: '移动端', icon: 'smartphone' },
      { key: 'watch', label: '手表端', icon: 'watch' }
    ];
    const modes = [
      { key: 'navbar', label: '导航栏' },
      { key: 'float', label: '悬浮按钮' },
      { key: 'both', label: '两者' },
      { key: 'none', label: '关闭' }
    ];

    devices.forEach(dev => {
      const container = $('#nav' + dev.key.charAt(0).toUpperCase() + dev.key.slice(1) + 'Opts');
      if (!container) return;
      const current = (Store.state.navSettings || {})[dev.key] || (dev.key === 'watch' ? 'float' : 'navbar');
      container.innerHTML = modes.map(m => {
        const active = m.key === current;
        return '<div class="settings-row clickable nav-opt-row" data-device="' + dev.key + '" data-mode="' + m.key + '" style="' + (active ? 'background:var(--accent-10);color:var(--accent);font-weight:500' : '') + '">' +
          '<span class="row-label"><span class="row-title">' + m.label + '</span></span>' +
          (active ? '<span data-icon="check" style="color:var(--accent)"></span>' : '') +
          '</div>';
      }).join('');
    });

    // 事件委托：在容器上绑定一次，避免重复渲染导致内存泄漏
    devices.forEach(dev => {
      const container = $('#nav' + dev.key.charAt(0).toUpperCase() + dev.key.slice(1) + 'Opts');
      if (!container || container.dataset.navBound) return;
      container.dataset.navBound = '1';
      container.addEventListener('click', e => {
        const row = e.target.closest('.nav-opt-row');
        if (!row) return;
        const device = row.dataset.device;
        const mode = row.dataset.mode;
        const ns = Object.assign({}, Store.state.navSettings || {});
        ns[device] = mode;
        Store.patch({ navSettings: ns });
        renderNavSettings();
        renderRowDescs();
        window.dispatchEvent(new CustomEvent('pagechange', { detail: { page: Store.state.currentPage } }));
      });
    });
  }

  

  
  /* ==================== 小说阅读器 ==================== */
  function renderNovel() {
    Novel.renderShelf();
    Novel.renderSourceList();
  }
  function bindNovelEvents() {
    // 标签切换
    const tabs = $$('#subNovel .novel-tab');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $$('#subNovel .novel-panel').forEach(p => p.classList.add('hidden'));
      const panel = $('#novelPanel' + (t.dataset.tab[0].toUpperCase() + t.dataset.tab.slice(1)));
      if (panel) { panel.classList.remove('hidden'); }
      if (t.dataset.tab === 'shelf') Novel.renderShelf();
      if (t.dataset.tab === 'source') Novel.renderSourceList();
    }));
    // 搜索
    const searchBtn = $('#novelSearchBtn');
    const searchInput = $('#novelSearchInput');
    if (searchBtn) {
      searchBtn.addEventListener('click', async () => {
        const kw = searchInput.value.trim();
        if (!kw) return Toast.warning('请输入搜索关键词');
        searchBtn.textContent = '搜索中…';
        const res = await Novel.searchBooks(kw);
        searchBtn.textContent = '搜索';
        if (!res.ok) return Toast.warning(res.err);
        Novel.renderSearchResults(res.list);
      });
    }
    // 导入书源（支持 URL 自动下载）
    const importBtn = $('#novelSourceImport');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        const text = $('#novelSourceInput').value.trim();
        if (!text) return Toast.warning('请粘贴书源内容或链接');
        importBtn.textContent = '导入中…';
        importBtn.disabled = true;
        const res = await Novel.importSources(text);
        importBtn.textContent = '导入书源';
        importBtn.disabled = false;
        if (res.ok) { Toast.success('成功导入 ' + res.n + ' 个书源（识别到 ' + res.total + ' 个）'); $('#novelSourceInput').value = ''; Novel.renderSourceList(); }
        else { Toast.warning(res.err); }
      });
    }
    // 验证书源
    const verifyBtn = $('#novelSourceVerify');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', async () => {
        verifyBtn.textContent = '验证中…';
        verifyBtn.disabled = true;
        const results = await Novel.verifyAllSources();
        verifyBtn.textContent = '验证书源';
        verifyBtn.disabled = false;
        let ok = 0, fail = 0;
        results.forEach(r => { if (r.ok) ok++; else fail++; });
        Toast.success('验证完成：' + ok + ' 个可用，' + fail + ' 个不可用');
        Novel.renderSourceList();
      });
    }
    // 书源列表事件委托（删除）
    const sourceList = $('#novelSourceList');
    if (sourceList) {
      sourceList.addEventListener('click', e => {
        const btn = e.target.closest('.novel-src-del');
        if (btn) { Novel.delSource(btn.dataset.name); Novel.renderSourceList(); }
      });
    }
    // 书架点击（打开章节列表）
    const shelf = $('#novelShelf');
    if (shelf) {
      shelf.addEventListener('click', async e => {
        const card = e.target.closest('.novel-book-card');
        if (!card) return;
        const url = card.dataset.url;
        const sourceName = card.dataset.source;
        const src = Novel.getSources().find(s => s.name === sourceName);
        if (!src) return Toast.warning('书源已删除');
        const chapters = await Novel.fetchChapters(url, src);
        if (!chapters.length) return Toast.warning('获取章节失败');
        window.__novelChapters = chapters;
        window.__novelCurrentBook = { url, sourceName, name: card.querySelector('.novel-title').textContent };
        Novel.renderChapterList(chapters, 0);
        $('#novelChapterBookName').textContent = window.__novelCurrentBook.name;
        $$('#subNovel .novel-panel').forEach(p => p.classList.add('hidden'));
        $('#novelPanelChapters').classList.remove('hidden');
      });
    }
    // 章节列表点击（打开阅读器）
    const chapterList = $('#novelChapterList');
    if (chapterList) {
      chapterList.addEventListener('click', async e => {
        const row = e.target.closest('.novel-chapter-row');
        if (!row) return;
        const idx = parseInt(row.dataset.idx);
        const chapters = window.__novelChapters;
        const book = window.__novelCurrentBook;
        const src = Novel.getSources().find(s => s.name === book.sourceName);
        if (!src || !chapters[idx]) return;
        const content = await Novel.fetchContent(chapters[idx].url, src);
        Novel.renderReader(content, chapters[idx].name);
        window.__novelCurrentChapter = idx;
        Novel.updateShelf(book.url, { lastRead: Date.now(), chapterIdx: idx, chapterName: chapters[idx].name });
        $$('#subNovel .novel-panel').forEach(p => p.classList.add('hidden'));
        $('#novelPanelReader').classList.remove('hidden');
      });
    }
    // 返回按钮
    const backCh = $('#subNovel button[data-back-chapters]');
    if (backCh) backCh.addEventListener('click', () => { $('#novelPanelChapters').classList.add('hidden'); $('#novelPanelShelf').classList.remove('hidden'); $$('#subNovel .novel-tab')[0].classList.add('active'); });
    const backRd = $('#subNovel button[data-back-reader]');
    if (backRd) backRd.addEventListener('click', () => { $('#novelPanelReader').classList.add('hidden'); $('#novelPanelChapters').classList.remove('hidden'); });
    // 搜索结果加入书架
    const results = $('#novelSearchResults');
    if (results) {
      results.addEventListener('click', e => {
        const btn = e.target.closest('.novel-add-shelf-btn');
        if (btn) {
          const row = btn.closest('.novel-result-row');
          if (row) {
            Novel.addShelf({ name: row.dataset.name, author: row.dataset.author, url: row.dataset.url, sourceName: row.dataset.source });
            btn.textContent = '已在书架';
            Toast.success('已加入书架');
          }
        }
      });
    }
  }

  /* ==================== 漫画阅读器 ==================== */
  function renderComic() {
    Comic.renderShelf();
    Comic.renderSourceList();
  }
  function bindComicEvents() {
    const tabs = $$('#subComic .novel-tab');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $$('#subComic .novel-panel').forEach(p => p.classList.add('hidden'));
      const panel = $('#comicPanel' + (t.dataset.tab[0].toUpperCase() + t.dataset.tab.slice(1)));
      if (panel) { panel.classList.remove('hidden'); }
      if (t.dataset.tab === 'shelf') Comic.renderShelf();
      if (t.dataset.tab === 'source') Comic.renderSourceList();
    }));
    const searchBtn = $('#comicSearchBtn');
    const searchInput = $('#comicSearchInput');
    if (searchBtn) {
      searchBtn.addEventListener('click', async () => {
        const kw = searchInput.value.trim();
        if (!kw) return Toast.warning('请输入搜索关键词');
        searchBtn.textContent = '搜索中…';
        const res = await Comic.searchBooks(kw);
        searchBtn.textContent = '搜索';
        if (!res.ok) return Toast.warning(res.err);
        Comic.renderSearchResults(res.list);
      });
        const importBtn = $('#comicSourceImport');
    if (importBtn) {
      importBtn.addEventListener('click', async () => {
        const text = $('#comicSourceInput').value.trim();
        if (!text) return Toast.warning('请粘贴图源内容或链接');
        importBtn.textContent = '导入中…';
        importBtn.disabled = true;
        const res = await Comic.importSources(text);
        importBtn.textContent = '导入图源';
        importBtn.disabled = false;
        if (res.ok) { Toast.success('成功导入 ' + res.n + ' 个图源（识别到 ' + res.total + ' 个）'); $('#comicSourceInput').value = ''; Comic.renderSourceList(); }
        else { Toast.warning(res.err); }
      });
    }
    // 验证图源
    const verifyBtn = $('#comicSourceVerify');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', async () => {
        verifyBtn.textContent = '验证中…';
        verifyBtn.disabled = true;
        const results = await Comic.verifyAllSources();
        verifyBtn.textContent = '验证图源';
        verifyBtn.disabled = false;
        let ok = 0, fail = 0;
        results.forEach(r => { if (r.ok) ok++; else fail++; });
        Toast.success('验证完成：' + ok + ' 个可用，' + fail + ' 个不可用');
        Comic.renderSourceList();
      });
    }}
    const sourceList = $('#comicSourceList');
    if (sourceList) {
      sourceList.addEventListener('click', e => {
        const btn = e.target.closest('.novel-src-del');
        if (btn) { Comic.delSource(btn.dataset.name); Comic.renderSourceList(); }
      });
    }
    const shelf = $('#comicShelf');
    if (shelf) {
      shelf.addEventListener('click', async e => {
        const card = e.target.closest('.comic-book-card');
        if (!card) return;
        const url = card.dataset.url;
        const sourceName = card.dataset.source;
        const src = Comic.getSources().find(s => s.name === sourceName);
        if (!src) return Toast.warning('图源已删除');
        const chapters = await Comic.fetchChapters(url, src);
        if (!chapters.length) return Toast.warning('获取章节失败');
        window.__comicChapters = chapters;
        window.__comicCurrentBook = { url, sourceName, name: card.querySelector('.comic-title').textContent };
        Comic.renderChapterList(chapters, 0);
        $('#comicChapterBookName').textContent = window.__comicCurrentBook.name;
        $$('#subComic .novel-panel').forEach(p => p.classList.add('hidden'));
        $('#comicPanelChapters').classList.remove('hidden');
      });
    }
    const chapterList = $('#comicChapterList');
    if (chapterList) {
      chapterList.addEventListener('click', async e => {
        const row = e.target.closest('.novel-chapter-row');
        if (!row) return;
        const idx = parseInt(row.dataset.idx);
        const chapters = window.__comicChapters;
        const book = window.__comicCurrentBook;
        const src = Comic.getSources().find(s => s.name === book.sourceName);
        if (!src || !chapters[idx]) return;
        const images = await Comic.fetchImages(chapters[idx].url, src);
        Comic.renderReader(images, chapters[idx].name);
        window.__comicCurrentChapter = idx;
        Comic.updateShelf(book.url, { lastRead: Date.now(), chapterIdx: idx, chapterName: chapters[idx].name });
        $$('#subComic .novel-panel').forEach(p => p.classList.add('hidden'));
        $('#comicPanelReader').classList.remove('hidden');
      });
    }
    const backCh = $('#subComic button[data-back-chapters]');
    if (backCh) backCh.addEventListener('click', () => { $('#comicPanelChapters').classList.add('hidden'); $('#comicPanelShelf').classList.remove('hidden'); $$('#subComic .novel-tab')[0].classList.add('active'); });
    const backRd = $('#subComic button[data-back-reader]');
    if (backRd) backRd.addEventListener('click', () => { $('#comicPanelReader').classList.add('hidden'); $('#comicPanelChapters').classList.remove('hidden'); });
    const results = $('#comicSearchResults');
    if (results) {
      results.addEventListener('click', e => {
        const btn = e.target.closest('.novel-add-shelf-btn');
        if (btn) {
          const row = btn.closest('.comic-result-row');
          if (row) {
            Comic.addShelf({ name: row.dataset.name, author: row.dataset.author, url: row.dataset.url, sourceName: row.dataset.source, cover: row.dataset.cover });
            btn.textContent = '已在书架';
            Toast.success('已加入书架');
          }
        }
      });
    }
  }

return { init, renderModels, renderDiscover, renderProfile, syncThemeCards, openSub, closeSubs, openVoiceStudio, openModelInfo, renderProxySection, renderNavSettings };
})();
