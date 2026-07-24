/* ==================== DEVICE · 设备分级（手表 / 手机 / 电脑） ====================
 * 在 <head> 中最先执行，给 <html> 打上 data-device 标记，CSS 据此切换界面：
 *   watch   - 智能手表（1:1 / 4:3 小屏，≤340px 或 UA 含手表特征）
 *   mobile  - 手机 / 小平板（≤860px）
 *   desktop - 电脑（横屏宽界面）
 * 标记在页面绘制前完成，避免界面闪烁。
 */
(function () {
  function detect() {
    const ua = navigator.userAgent || '';
    const w = window.innerWidth, h = window.innerHeight;
    const minSide = Math.min(w, h);

    // 手表特征 UA：Apple Watch / Wear OS / Tizen(三星) / 小米 / 华为手表
    const watchUA = /Watch\s*OS|Watch[0-9,]|Wear\s*OS|Tizen|SM-R9|SM-R8|GT\d|Mi\s*Watch|OPPO\s*Watch|Amazfit/i.test(ua);
    // 视口兜底：任意一边 ≤ 340px 视为手表级小屏（Apple Watch 默认视口 320×357）
    let device;
    if (watchUA || minSide <= 340) device = 'watch';
    else if (minSide <= 860 || /Mobi|Android|iPhone|iPad/i.test(ua)) device = 'mobile';
    else device = 'desktop';

    const root = document.documentElement;
    root.dataset.device = device;
    // 圆形屏幕（Wear OS 等）标记：UA 命中手表且近似正方形时按圆屏留出安全边距
    if (device === 'watch' && watchUA && w / h > 0.8 && w / h < 1.25) root.dataset.round = 'true';
    else delete root.dataset.round;
    return device;
  }

  const device = detect();
  window.DeviceInfo = {
    get type() { return document.documentElement.dataset.device; },
    isWatch: () => document.documentElement.dataset.device === 'watch',
    isMobile: () => document.documentElement.dataset.device === 'mobile',
    isDesktop: () => document.documentElement.dataset.device === 'desktop',
    isRound: () => document.documentElement.dataset.round === 'true',
    refresh: detect
  };

  // 视口变化（旋转 / 分屏 / 窗口缩放）时重新分级
  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const before = document.documentElement.dataset.device;
      const after = detect();
      if (before !== after && typeof UI !== "undefined" && Store.state.loggedIn) UI.showApp();
    }, 200);
  });
})();
