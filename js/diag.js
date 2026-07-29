/* diag.js - 白屏/报错诊断工具 (测试服专用)
 * 正式服部署前：删除 index.html 中 <script src="js/diag.js?v=5.7"></script> 这一行
 */
(function() {
  'use strict';

  var errors = [];
  var diagShown = false;

  // ========== 错误捕获 ==========
  var origOnError = window.onerror;
  window.onerror = function(msg, url, line, col, err) {
    errors.push({
      type: 'JS Error',
      msg: String(msg),
      url: url || '',
      line: line || 0,
      col: col || 0,
      stack: err && err.stack ? err.stack.split('\n').slice(0,3).join('\n') : '',
      time: new Date().toLocaleTimeString('zh-CN')
    });
    if (!diagShown) tryShowDiag();
    if (origOnError) return origOnError.apply(this, arguments);
    return false;
  };

  window.addEventListener('error', function(e) {
    errors.push({
      type: 'Resource Error',
      msg: 'Failed to load: ' + (e.target.src || e.target.href || 'unknown'),
      url: e.filename || '',
      line: e.lineno || 0,
      col: e.colno || 0,
      stack: '',
      time: new Date().toLocaleTimeString('zh-CN')
    });
    if (!diagShown) tryShowDiag();
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    errors.push({
      type: 'Promise Error',
      msg: String(e.reason),
      url: '',
      line: 0,
      col: 0,
      stack: e.reason && e.reason.stack ? e.reason.stack.split('\n').slice(0,3).join('\n') : '',
      time: new Date().toLocaleTimeString('zh-CN')
    });
    if (!diagShown) tryShowDiag();
  });

  // ========== 关键变量检查 ==========
  function checkVars() {
    var checks = [
      {name: 'Store',      check: function(){ return typeof Store !== 'undefined'; }},
      {name: 'Store.state',check: function(){ return typeof Store !== 'undefined' && !!Store.state; }},
      {name: 'SB',         check: function(){ return typeof SB !== 'undefined'; }},
      {name: 'UI',         check: function(){ return typeof UI !== 'undefined'; }},
      {name: 'Toast',      check: function(){ return typeof Toast !== 'undefined'; }},
      {name: 'Membership', check: function(){ return typeof Membership !== 'undefined'; }},
      {name: 'Lottery',    check: function(){ return typeof Lottery !== 'undefined'; }},
      {name: 'ExportData', check: function(){ return typeof ExportData !== 'undefined'; }},
      {name: 'renderMembership', check: function(){ return typeof renderMembership !== 'undefined'; }},
      {name: 'renderStorage',    check: function(){ return typeof renderStorage !== 'undefined'; }},
      {name: 'renderDevices',    check: function(){ return typeof renderDevices !== 'undefined'; }},
      {name: 'renderLottery',    check: function(){ return typeof renderLottery !== 'undefined'; }},
      {name: 'renderExport',     check: function(){ return typeof renderExport !== 'undefined'; }},
      {name: 'renderFamily',     check: function(){ return typeof renderFamily !== 'undefined'; }},
    ];
    var results = [];
    checks.forEach(function(c){
      try {
        results.push(c.name + ': ' + (c.check() ? '✅' : '❌'));
      } catch(e) {
        results.push(c.name + ': ❌ (' + e.message + ')');
      }
    });
    return results;
  }

  // ========== DOM 检查 ==========
  function checkDOM() {
    var ids = ['app','sidebar','chatPage','modelPage','discoverPage','profilePage',
               'subMembership','subStorage','subDevices','subLottery','subExport','subFamily',
               'membershipPlans','storagePanel','devicesPanel','lotteryPanel','exportPanel','familyPanel'];
    var results = [];
    ids.forEach(function(id){
      var el = document.getElementById(id);
      results.push(id + ': ' + (el ? '✅' : '❌'));
    });
    return results;
  }

  // ========== Script 加载检查 ==========
  function checkScripts() {
    var scripts = document.querySelectorAll('script[src]');
    var needed = ['store.js','pages.js','membership.js','lottery.js','export-data.js','ui.js','app.js','auth.js'];
    var results = [];
    needed.forEach(function(name){
      var found = false;
      scripts.forEach(function(s){
        if (s.src.indexOf(name) >= 0) found = true;
      });
      results.push(name + ': ' + (found ? '✅' : '❌'));
    });
    return results;
  }

  // ========== 生成诊断报告 ==========
  function generateReport() {
    var lines = [];
    lines.push('========== 第三方科技 AI 诊断报告 ==========');
    lines.push('URL: ' + location.href);
    lines.push('UA: ' + navigator.userAgent.substring(0,100));
    lines.push('Time: ' + new Date().toISOString());
    lines.push('');

    lines.push('---------- 错误列表 (' + errors.length + ') ----------');
    if (errors.length === 0) {
      lines.push('暂无捕获到的错误');
    } else {
      errors.forEach(function(e, i){
        lines.push('[' + (i+1) + '] ' + e.type + ' @ ' + e.time);
        lines.push('    Msg: ' + e.msg);
        if (e.url) lines.push('    File: ' + e.url.split('/').pop() + ':' + e.line + ':' + e.col);
        if (e.stack) lines.push('    Stack: ' + e.stack);
        lines.push('');
      });
    }
    lines.push('');

    lines.push('---------- 关键变量 ----------');
    checkVars().forEach(function(r){ lines.push(r); });
    lines.push('');

    lines.push('---------- DOM 检查 ----------');
    checkDOM().forEach(function(r){ lines.push(r); });
    lines.push('');

    lines.push('---------- Script 加载 ----------');
    checkScripts().forEach(function(r){ lines.push(r); });
    lines.push('');

    lines.push('---------- 存储空间 ----------');
    try {
      var used = 0;
      for (var key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage.getItem(key).length * 2;
        }
      }
      lines.push('localStorage: ' + (used/1024).toFixed(1) + ' KB');
    } catch(e) {
      lines.push('localStorage: 无法读取');
    }
    lines.push('');

    lines.push('========================================');
    return lines.join('\n');
  }

  // ========== 显示诊断面板 ==========
  function showDiag() {
    if (diagShown) return;
    diagShown = true;

    var report = generateReport();

    var style = document.createElement('style');
    style.textContent = `
      #__diag-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
      #__diag-box{background:#1a1a2e;color:#e0e0e0;border-radius:12px;max-width:500px;width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid #333}
      #__diag-header{padding:16px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center}
      #__diag-header h2{margin:0;font-size:18px;color:#ef4444}
      #__diag-close{background:none;border:none;color:#888;font-size:20px;cursor:pointer;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center}
      #__diag-body{padding:16px;overflow-y:auto;flex:1;font-size:13px;line-height:1.6}
      #__diag-body pre{margin:0;white-space:pre-wrap;word-break:break-all;background:#0f0f1a;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;max-height:300px;overflow-y:auto}
      #__diag-footer{padding:16px;border-top:1px solid #333;display:flex;gap:8px}
      #__diag-copy,#__diag-refresh{flex:1;padding:12px;border-radius:8px;border:none;font-size:14px;cursor:pointer;font-weight:500}
      #__diag-copy{background:#6366f1;color:#fff}
      #__diag-copy.copied{background:#22c55e}
      #__diag-refresh{background:#333;color:#e0e0e0}
      .__diag-error{color:#f87171;padding:4px 0;border-bottom:1px solid #333}
      .__diag-section{color:#4ade80;font-weight:600;margin-top:12px;margin-bottom:4px}
    `;
    document.head.appendChild(style);

    var box = document.createElement('div');
    box.id = '__diag-overlay';
    box.innerHTML = `
      <div id="__diag-box">
        <div id="__diag-header">
          <h2>⚠️ 诊断报告</h2>
          <button id="__diag-close">&times;</button>
        </div>
        <div id="__diag-body">
          <div class="__diag-section">错误列表</div>
          <div id="__diag-errors">` + (errors.length === 0 ? '<div style="color:#888">暂无错误</div>' : errors.map(function(e,i){
            return '<div class="__diag-error"><b>[' + (i+1) + '] ' + e.type + '</b><br>' + e.msg + '<br><span style="color:#888;font-size:11px">' + (e.url ? e.url.split('/').pop() + ':' + e.line : '') + '</span></div>';
          }).join('')) + `</div>
          <div class="__diag-section">完整报告</div>
          <pre id="__diag-report">` + report.replace(/</g, '&lt;').replace(/>/g, '&gt;') + `</pre>
        </div>
        <div id="__diag-footer">
          <button id="__diag-copy">📋 一键复制报告</button>
          <button id="__diag-refresh">🔄 刷新页面</button>
        </div>
      </div>
    `;
    document.body.appendChild(box);

    document.getElementById('__diag-close').addEventListener('click', function(){
      box.style.display = 'none';
      diagShown = false;
    });

    document.getElementById('__diag-copy').addEventListener('click', function(){
      var btn = document.getElementById('__diag-copy');
      navigator.clipboard.writeText(report).then(function(){
        btn.textContent = '✅ 已复制';
        btn.classList.add('copied');
        setTimeout(function(){
          btn.textContent = '📋 一键复制报告';
          btn.classList.remove('copied');
        }, 2000);
      }).catch(function(){
        // fallback
        var ta = document.createElement('textarea');
        ta.value = report;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = '✅ 已复制';
        setTimeout(function(){ btn.textContent = '📋 一键复制报告'; }, 2000);
      });
    });

    document.getElementById('__diag-refresh').addEventListener('click', function(){
      location.reload(true);
    });
  }

  function tryShowDiag() {
    if (document.body) {
      showDiag();
    } else {
      setTimeout(tryShowDiag, 100);
    }
  }

  // ========== 白屏检测 ==========
  setTimeout(function(){
    var bodyEmpty = !document.body || document.body.children.length === 0 || document.body.innerText.trim().length < 20;
    var appMissing = !document.getElementById('app');
    if (bodyEmpty || appMissing) {
      errors.push({
        type: 'White Screen',
        msg: bodyEmpty ? 'Body is empty' : 'App element missing',
        url: '', line: 0, col: 0, stack: '', time: new Date().toLocaleTimeString('zh-CN')
      });
      tryShowDiag();
    }
  }, 3000);

  // ========== 手动触发诊断（双击页面空白处） ==========
  document.addEventListener('dblclick', function(e){
    if (e.target === document.body || e.target.id === '__diag-overlay') {
      diagShown = false;
      tryShowDiag();
    }
  });

})();
