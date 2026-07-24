/**
 * lazy-load.js — 图片懒加载 + 虚拟列表辅助
 * v6.1 新增
 */

(function() {
  'use strict';

  // ===== 图片懒加载 =====
  if ('IntersectionObserver' in window) {
    const imgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
          }
          imgObserver.unobserve(img);
        }
      });
    }, { rootMargin: '200px 0px' });

    // 自动观察所有带 data-src 的图片
    function observeLazyImages() {
      document.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));
    }

    // MutationObserver 监听新添加的图片
    const mo = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.matches && node.matches('img[data-src]')) imgObserver.observe(node);
            if (node.querySelectorAll) node.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));
          }
        });
      });
    });
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });

    // 初始观察
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeLazyImages);
    } else {
      observeLazyImages();
    }
  }

  // ===== 消息虚拟列表（超过 50 条时启用） =====
  window.VirtualList = {
    enabled: false,
    container: null,
    items: [],
    itemHeight: 80,
    buffer: 5,

    init(containerSelector) {
      this.container = document.querySelector(containerSelector);
      if (!this.container) return;

      const count = this.container.children.length;
      if (count < 50) return; // 不足50条不启用

      this.enabled = true;
      this.items = Array.from(this.container.children);
      this.setupVirtualScroll();
    },

    setupVirtualScroll() {
      const container = this.container;
      container.style.position = 'relative';

      // 创建占位撑开滚动区域
      const spacer = document.createElement('div');
      spacer.className = 'virtual-spacer';
      spacer.style.height = (this.items.length * this.itemHeight) + 'px';
      container.appendChild(spacer);

      // 可见区域渲染
      const renderVisible = () => {
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const startIdx = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
        const endIdx = Math.min(this.items.length, Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.buffer);

        // 只保留可见范围内的元素
        this.items.forEach((item, i) => {
          if (i >= startIdx && i < endIdx) {
            item.style.position = 'absolute';
            item.style.top = (i * this.itemHeight) + 'px';
            item.style.display = '';
          } else {
            item.style.display = 'none';
          }
        });
      };

      container.addEventListener('scroll', renderVisible, { passive: true });
      renderVisible();
    }
  };
})();
