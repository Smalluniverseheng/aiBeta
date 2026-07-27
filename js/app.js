/* ==================== APP · 应用入口 ==================== */
(function () {
  // 加载状态
  Store.load();
  SB.init();   // 云 SDK 懒初始化；加载失败时 Toast 一次并整体降级为纯本地
  UI.applyTheme();

  /* ---------- PWA 安装 ---------- */
  window.AppInstall = (() => {
    let deferredPrompt = null;
    let installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      if (Store.state.loggedIn) Pages.renderProfile && Pages.renderProfile();
    });
    window.addEventListener('appinstalled', () => {
      installed = true;
      deferredPrompt = null;
      Toast.success('已安装到桌面 🎉');
    });

    return {
      canInstall: () => !!deferredPrompt,
      isInstalled: () => installed,
      prompt: () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(choice => {
            if (choice.outcome !== 'accepted') Toast.info('已取消安装');
            deferredPrompt = null;
          });
        } else if (installed) {
          Toast.info('应用已安装');
        } else {
          Toast.info('请使用浏览器菜单「添加到主屏幕」安装（iOS：分享 → 添加到主屏幕）');
        }
      }
    };
  })();

  /* ---------- 可拖动悬浮返回按钮 ---------- */
  function initFloatBackBtn() {
    const btn = $('#floatBackBtn');
    if (!btn) return;

    let dragging = false, moved = false;
    let startX, startY, startLeft, startTop;
    let currentDevice = DeviceInfo.type;

    function updateVisibility() {
      const page = Store.state.currentPage || 'chat';
      const settings = Store.state.navSettings || {};
      const mode = settings[currentDevice] || (currentDevice === 'watch' ? 'float' : 'navbar');
      const isChat = page === 'chat';

      // 悬浮按钮
      if (isChat) {
        btn.style.display = 'none';
        document.documentElement.dataset.floatVisible = 'false';
      } else {
        const showFloat = mode === 'float' || mode === 'both';
        btn.style.display = showFloat ? 'flex' : 'none';
        document.documentElement.dataset.floatVisible = showFloat ? 'true' : 'false';
      }

      // 导航栏控制
      const bottomNav = $('#bottomNav');
      if (bottomNav) {
        const showNav = mode === 'navbar' || mode === 'both';
        bottomNav.style.display = showNav ? '' : 'none';
      }
    }

    // 点击返回对话（关闭子页面 + 切换页面）
    btn.addEventListener('click', (e) => {
      if (moved) return;
      // 关闭所有子页面
      $$('.subpage').forEach(s => s.classList.remove('show'));
      UI.navigate('chat');
    });

    // 触摸拖动
    btn.addEventListener('touchstart', (e) => {
      dragging = true; moved = false;
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
      const rect = btn.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      btn.classList.add('dragging');
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
      let nx = startLeft + dx, ny = startTop + dy;
      const ww = window.innerWidth, wh = window.innerHeight;
      nx = Math.max(0, Math.min(ww - 48, nx));
      ny = Math.max(0, Math.min(wh - 48, ny));
      btn.style.left = nx + 'px'; btn.style.right = 'auto';
      btn.style.top = ny + 'px'; btn.style.bottom = 'auto';
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      btn.classList.remove('dragging');
      // 吸附到左右边缘
      const rect = btn.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (cx < vw / 2) { btn.style.left = '12px'; btn.style.right = 'auto'; }
      else { btn.style.left = 'auto'; btn.style.right = '12px'; }
      if (cy < 60) { btn.style.top = '60px'; btn.style.bottom = 'auto'; }
      else if (cy > vh - 60) { btn.style.top = 'auto'; btn.style.bottom = '12px'; }
    });

    // 鼠标拖动（桌面端）
    btn.addEventListener('mousedown', (e) => {
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      const rect = btn.getBoundingClientRect();
      startLeft = rect.left; startTop = rect.top;
      btn.classList.add('dragging');
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
      let nx = startLeft + dx, ny = startTop + dy;
      const ww = window.innerWidth, wh = window.innerHeight;
      nx = Math.max(0, Math.min(ww - 48, nx));
      ny = Math.max(0, Math.min(wh - 48, ny));
      btn.style.left = nx + 'px'; btn.style.right = 'auto';
      btn.style.top = ny + 'px'; btn.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      btn.classList.remove('dragging');
      const rect = btn.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (cx < vw / 2) { btn.style.left = '12px'; btn.style.right = 'auto'; }
      else { btn.style.left = 'auto'; btn.style.right = '12px'; }
      if (cy < 60) { btn.style.top = '60px'; btn.style.bottom = 'auto'; }
      else if (cy > vh - 60) { btn.style.top = 'auto'; btn.style.bottom = '12px'; }
    });

    window.addEventListener('pagechange', updateVisibility);
    window.addEventListener('resize', () => {
      const newDevice = DeviceInfo.type;
      if (newDevice !== currentDevice) {
        currentDevice = newDevice;
        updateVisibility();
      }
    });

    updateVisibility();
  }

  /* ---------- Service Worker 注册 ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    // file:// 协议下跳过
    if (location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js?v=5.0').then(reg => {
      // 有更新时提示刷新
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            Toast.info('新版本已就绪，自动刷新中...'); setTimeout(() => location.reload(), 1500);
          }
        });
      });
    }).catch(() => {});
  }

  /* ---------- 开屏页（splash：品牌展示 ≥1.6s 后淡出，每会话一次，手表跳过） ---------- */
  function initSplash() {
    const sp = $('#splash');
    if (!sp) return;
    // logo 加载失败时优雅降级（露出渐变底）
    const img = sp.querySelector('.splash-logo img');
    if (img) img.addEventListener('error', () => { img.style.display = 'none'; });
    let shown = false;
    try {
      shown = !!sessionStorage.getItem('splashShown');
      sessionStorage.setItem('splashShown', '1');
    } catch (e) {}
    // 手表模式 / 本会话已播过：直接移除
    if ((window.DeviceInfo && DeviceInfo.isWatch()) || shown) { sp.remove(); return; }
    // 到时淡出（CSS 另有兜底动画，JS 失效时也会自动隐藏，不阻塞应用）
    setTimeout(() => {
      sp.classList.add('out');
      setTimeout(() => sp.remove(), 650);
    }, 1600);
  }

  /* ---------- 登录/注册（三条路径：管理员别名 / 邮箱注册登录 / 游客本地） ---------- */
  function bindAuthEvents() {
    const switchTab = tab => {
      $$('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      $('#loginFormSection').style.display = tab === 'login' ? 'block' : 'none';
      $('#registerFormSection').style.display = tab === 'register' ? 'block' : 'none';
      hideError();
    };
    $$('.login-tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    // 游客登录：本地浏览使用，无需账号（不关联云端）
    $('#guestBtn').addEventListener('click', () => {
      Auth.guest();
      UI.showApp();
      Toast.success('已进入游客模式，数据仅保存在本机浏览器');
    });

    const showError = msg => {
      const box = $('#loginError');
      box.innerHTML = icon('zap', 15) + '<span>' + esc(msg) + '</span>';
      box.classList.add('show');
    };
    const hideError = () => $('#loginError').classList.remove('show');

    const doLogin = async () => {
      const account = $('#loginUser').value.trim();
      const password = $('#loginPass').value;
      if (!account || !password) return showError('请输入账号和密码');
      const btn = $('#loginBtn');
      btn.disabled = true;
      btn.textContent = '登录中…';
      // 账号框兼容：管理员别名（1234/admin）与邮箱 → 云端；其余 → 老本地账号
      const email = SB.mapAccount(account);
      const result = email ? await Auth.cloudLogin(email, password) : await Auth.login(account, password);
      btn.disabled = false;
      btn.textContent = '登 录';
      if (result.ok) {
        UI.showApp();
        const name = (Store.state.userInfo || {}).name || account;
        Toast.success('欢迎回来，' + name + (email ? (result.isAdmin ? '（管理员 · 云端同步已开启）' : '（云端同步已开启）') : ''));
      } else showError(result.error);
    };

    const doRegister = async () => {
      const info = {
        name: $('#regName').value.trim(),
        account: $('#regAccount').value.trim(),
        password: $('#regPass').value,
        password2: $('#regPass2').value
      };
      const btn = $('#registerBtn');
      btn.disabled = true;
      btn.textContent = '注册中…';
      const result = await Auth.cloudRegister(info);
      btn.disabled = false;
      btn.textContent = '注 册';
      if (result.ok) {
        // 邮箱验证开启：不自动登录，引导用户去邮箱点链接
        Toast.success('验证邮件已发送，请到邮箱点击链接后登录');
        switchTab('login');
        $('#loginUser').value = info.account;
        $('#loginPass').value = '';
        [$('#regName'), $('#regAccount'), $('#regPass'), $('#regPass2')].forEach(el => { el.value = ''; });
      } else showError(result.error);
    };

    // 忘记密码：向账号框中的邮箱发送重置邮件
    $('#forgotPassLink').addEventListener('click', async () => {
      const account = $('#loginUser').value.trim();
      const email = SB.mapAccount(account);
      if (!email) return showError('请先在账号框输入邮箱');
      if (!SB.ready()) return showError('云服务不可用，请检查网络');
      const r = await SB.Auth.resetPassword(email);
      if (r.error) showError(SB.errMsg(r.error));
      else Toast.success('重置密码邮件已发送，请查收');
    });

    $('#loginBtn').addEventListener('click', doLogin);
    $('#registerBtn').addEventListener('click', doRegister);
    [$('#loginUser'), $('#loginPass')].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));
    [$('#regName'), $('#regAccount'), $('#regPass'), $('#regPass2')].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); }));
  }

  /* ---------- 云会话恢复：Supabase session 持久化，启动时后台恢复 + 增量同步 ---------- */
  async function restoreCloud() {
    if (!Store.state.cloudUser) return;
    if (!SB.ready()) return;   // SDK 未加载：保持本地会话，云功能静默降级
    const u = await SB.Auth.getUser();
    if (!u) {
      // 云会话已失效：在线时清掉 cloudUser（离线时保留，等 online 后再验）
      if (navigator.onLine !== false) Store.patch({ cloudUser: null });
      return;
    }
    // 刷新 profile（角色可能变化），随后后台增量同步（拉取合并 + 幂等推送）
    const prof = await SB.profile();
    const cu = Store.state.cloudUser;
    if (prof) {
      cu.isAdmin = !!prof.isAdmin;
      if (prof.displayName) cu.name = prof.displayName;
    }
    SB.Sync.syncNow();
  }

  /* ---------- 启动 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initSplash();
    UI.init();
    Pages.init();
    bindAuthEvents();
    registerSW();
    I18n.apply();

    // 语言切换：重渲染 UI 动态部分
    document.addEventListener('langchange', () => {
      UI.updateModeSel();
      UI.updateModelSel();
      UI.renderSidebar();
      UI.renderChat();
      if (Store.state.loggedIn) Pages.renderProfile();
    });

    // 恢复侧边栏折叠状态
    if (Store.state.sidebarCollapsed) {
      $('#sidebar').classList.add('collapsed');
      $('#sidebarToggle').classList.add('collapsed');
    }

    if (Auth.checkSession()) { UI.showApp(); restoreCloud(); }
    else UI.showLogin();

    initFloatBackBtn();

    // 断网恢复：补一次同步（SB 内部自行判断登录态/离线，静默跳过）
    window.addEventListener('online', () => { if (Store.state.cloudUser) SB.Sync.schedulePush(0); });
  });
})();
