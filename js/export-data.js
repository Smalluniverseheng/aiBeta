/* export-data.js - 数据导出功能 v5.7 */
(function() {
  'use strict';

  const EXPORT_TYPES = [
    { key: 'conversations', label: '历史对话', icon: '💬', sizeEstimate: 'variable' },
    { key: 'novelSources',  label: '书源列表', icon: '📚', sizeEstimate: 'small' },
    { key: 'comicSources',  label: '漫画图源', icon: '🎨', sizeEstimate: 'small' },
    { key: 'novelShelf',    label: '小说书架', icon: '📖', sizeEstimate: 'small' },
    { key: 'comicShelf',    label: '漫画书架', icon: '🖼️', sizeEstimate: 'small' },
    { key: 'customRoles',   label: '自定义角色', icon: '🎭', sizeEstimate: 'small' },
    { key: 'settings',      label: '设置偏好', icon: '⚙️', sizeEstimate: 'tiny' }
  ];

  const EXPORT_FORMATS = ['json', 'markdown', 'txt', 'html', 'zip'];

  // ========== 计算各类型大小 ==========
  function estimateSize(typeKey) {
    const settings = Store.get('settings') || {};
    let bytes = 0;
    switch (typeKey) {
      case 'conversations':
        bytes = JSON.stringify(Store.get('conversations') || []).length * 2;
        break;
      case 'novelSources':
        bytes = JSON.stringify(settings.novelSources || []).length * 2;
        break;
      case 'comicSources':
        bytes = JSON.stringify(settings.comicSources || []).length * 2;
        break;
      case 'novelShelf':
        bytes = JSON.stringify(settings.novelShelf || []).length * 2;
        break;
      case 'comicShelf':
        bytes = JSON.stringify(settings.comicShelf || []).length * 2;
        break;
      case 'customRoles':
        bytes = JSON.stringify(settings.customRoles || []).length * 2;
        break;
      case 'settings':
        bytes = JSON.stringify(settings).length * 2;
        break;
    }
    return formatBytes(bytes);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/(1024*1024)).toFixed(1) + ' MB';
  }

  // ========== 执行导出 ==========
  async function doExport(selectedTypes, format, deleteAfter = false) {
    const exportObj = {};
    const settings = Store.get('settings') || {};

    selectedTypes.forEach(type => {
      switch (type) {
        case 'conversations':
          exportObj.conversations = Store.get('conversations') || [];
          break;
        case 'novelSources':
          exportObj.novelSources = settings.novelSources || [];
          break;
        case 'comicSources':
          exportObj.comicSources = settings.comicSources || [];
          break;
        case 'novelShelf':
          exportObj.novelShelf = settings.novelShelf || [];
          break;
        case 'comicShelf':
          exportObj.comicShelf = settings.comicShelf || [];
          break;
        case 'customRoles':
          exportObj.customRoles = settings.customRoles || [];
          break;
        case 'settings':
          exportObj.settings = settings;
          break;
      }
    });

    let blob, filename, mimeType;
    const dateStr = new Date().toISOString().slice(0,10);

    if (format === 'json') {
      blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      filename = 'thirdparty_ai_backup_' + dateStr + '.json';
    } else if (format === 'markdown') {
      let md = '# 第三方科技 AI 数据备份\n\n> 导出时间: ' + new Date().toLocaleString('zh-CN') + '\n\n';
      if (exportObj.conversations) {
        md += '## 历史对话\n\n';
        exportObj.conversations.forEach((c, i) => {
          md += '### 对话 ' + (i+1) + ': ' + (c.title || '未命名') + '\n\n';
          (c.messages || []).forEach(m => {
            md += '**' + (m.role === 'user' ? '用户' : 'AI') + '**: ' + (m.content || '') + '\n\n';
          });
        });
      }
      blob = new Blob([md], { type: 'text/markdown' });
      filename = 'backup_' + dateStr + '.md';
    } else if (format === 'txt') {
      let txt = '第三方科技 AI 数据备份\n导出时间: ' + new Date().toLocaleString('zh-CN') + '\n' + '='.repeat(40) + '\n\n';
      if (exportObj.conversations) {
        txt += '【历史对话】\n';
        exportObj.conversations.forEach((c, i) => {
          txt += '\n对话 ' + (i+1) + ': ' + (c.title || '未命名') + '\n';
          (c.messages || []).forEach(m => {
            txt += (m.role === 'user' ? '[用户]' : '[AI]') + ' ' + (m.content || '') + '\n';
          });
        });
      }
      blob = new Blob([txt], { type: 'text/plain' });
      filename = 'backup_' + dateStr + '.txt';
    } else if (format === 'html') {
      let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>数据备份</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:20px}</style></head><body>';
      html += '<h1>第三方科技 AI 数据备份</h1><p>导出时间: ' + new Date().toLocaleString('zh-CN') + '</p><hr>';
      if (exportObj.conversations) {
        html += '<h2>历史对话</h2>';
        exportObj.conversations.forEach((c, i) => {
          html += '<h3>对话 ' + (i+1) + ': ' + (c.title || '未命名') + '</h3>';
          (c.messages || []).forEach(m => {
            html += '<p><b>' + (m.role === 'user' ? '用户' : 'AI') + '</b>: ' + (m.content || '').replace(/</g, '&lt;') + '</p>';
          });
        });
      }
      html += '</body></html>';
      blob = new Blob([html], { type: 'text/html' });
      filename = 'backup_' + dateStr + '.html';
    } else {
      // zip fallback -> json
      blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      filename = 'backup_' + dateStr + '.json';
    }

    // 下载
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // 删除数据
    if (deleteAfter) {
      const s = Store.get('settings') || {};
      selectedTypes.forEach(type => {
        switch (type) {
          case 'conversations': Store.set('conversations', []); break;
          case 'novelSources': s.novelSources = []; break;
          case 'comicSources': s.comicSources = []; break;
          case 'novelShelf': s.novelShelf = []; break;
          case 'comicShelf': s.comicShelf = []; break;
          case 'customRoles': s.customRoles = []; break;
          case 'settings':
            // 不删除全部设置，只重置部分
            break;
        }
      });
      Store.set('settings', s);
    }

    return { ok: true, size: blob.size, filename };
  }

  // ========== 公开 API ==========
  window.ExportData = {
    EXPORT_TYPES,
    EXPORT_FORMATS,
    estimateSize,
    formatBytes,
    doExport
  };
})();
