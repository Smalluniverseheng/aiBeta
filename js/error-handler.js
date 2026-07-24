/**
 * error-handler.js — 全局错误边界 + 离线检测
 * v6.1 新增
 */

(function() {
  'use strict';

  // ===== 全局错误捕获 =====
  window.addEventListener('error', function(e) {
    console.error('[Global Error]', e.message, e.filename, e.lineno);
    showErrorToast('脚本错误: ' + e.message.slice(0, 60));
  });

  window.addEventListener('unhandledrejection', function(e) {
    console.error('[Unhandled Promise]', e.reason);
    showErrorToast('异步错误: ' + String(e.reason).slice(0, 60));
  });

  // ===== 离线/在线检测 =====
  function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    if (document.body) document.body.classList.toggle('is-offline', !isOnline);

    if (!isOnline) {
      showErrorToast('⚠️ 网络已断开，已切换至离线模式', 5000);
    } else {
      showErrorToast('✅ 网络已恢复', 2000);
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // ===== 错误提示 Toast =====
  function showErrorToast(msg, duration = 4000) {
    let toast = document.getElementById('global-error-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-error-toast';
      toast.style.cssText = `
        position:fixed; top:12px; left:50%; transform:translateX(-50%) translateY(-100px);
        z-index:99999; padding:10px 18px; border-radius:10px; font-size:13px;
        background:rgba(220,38,38,.92); color:#fff; backdrop-filter:blur(8px);
        box-shadow:0 4px 20px rgba(0,0,0,.3); transition:transform .3s ease;
        max-width:90vw; word-break:break-word; pointer-events:none;
      `;
      if (document.body) document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(-100px)';
    }, duration);
  }

  // ===== 性能监控（可选） =====
  if ('PerformanceObserver' in window) {
    try {
      const perfObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            console.log('[Perf] LCP:', Math.round(entry.startTime), 'ms');
          }
          if (entry.entryType === 'first-input') {
            console.log('[Perf] FID:', Math.round(entry.processingStart - entry.startTime), 'ms');
          }
        }
      });
      perfObs.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] });
    } catch(e) {}
  }

  // ===== 长任务监控 =====
  if ('PerformanceObserver' in window) {
    try {
      const longTaskObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.warn('[Perf] Long task:', Math.round(entry.duration), 'ms');
        }
      });
      longTaskObs.observe({ entryTypes: ['longtask'] });
    } catch(e) {}
  }

  window.showErrorToast = showErrorToast;
})();
