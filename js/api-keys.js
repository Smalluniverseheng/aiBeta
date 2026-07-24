/**
 * api-keys.js — API Key 管理
 * 支持：本地存储（localStorage）或 上传云端（Supabase）
 */

const API_KEYS_STORAGE_KEY = 'ai_api_keys';
const API_KEYS_CLOUD_KEY = 'ai_api_keys_cloud_enabled';

const apiKeys = {
  // 获取所有已保存的 Key
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(API_KEYS_STORAGE_KEY) || '{}');
    } catch { return {}; }
  },

  // 获取单个 Key
  get(provider) {
    return this.getAll()[provider] || '';
  },

  // 保存 Key
  async save(provider, key, syncToCloud = false) {
    const all = this.getAll();
    if (key) {
      all[provider] = key;
    } else {
      delete all[provider];
    }
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(all));

    // 标记是否启用云端同步
    localStorage.setItem(API_KEYS_CLOUD_KEY, JSON.stringify(syncToCloud));

    if (syncToCloud && typeof auth !== 'undefined' && auth.client) {
      try {
        const { data: { session } } = await auth.client.auth.getSession();
        if (session) {
          await fetch('https://ai-gateway.smalluniverseheng.workers.dev/api/v1/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider,
              key,
              syncToCloud: true,
              userToken: session.access_token,
            }),
          });
        }
      } catch (e) {
        console.error('Cloud sync failed:', e);
      }
    }

    return true;
  },

  // 删除 Key
  remove(provider) {
    return this.save(provider, '', false);
  },

  // 是否启用云端同步
  isCloudSyncEnabled() {
    try {
      return JSON.parse(localStorage.getItem(API_KEYS_CLOUD_KEY) || 'false');
    } catch { return false; }
  },

  // 渲染设置面板
  renderSettingsPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const providers = [
      { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
      { id: 'anthropic', name: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
      { id: 'deepseek', name: 'DeepSeek', placeholder: 'sk-...' },
      { id: 'moonshot', name: 'Moonshot (Kimi)', placeholder: 'sk-...' },
      { id: 'google', name: 'Google (Gemini)', placeholder: 'AIza...' },
      { id: 'alibaba', name: '阿里云 (Qwen)', placeholder: 'sk-...' },
    ];

    const saved = this.getAll();
    const cloudEnabled = this.isCloudSyncEnabled();

    let html = `
      <div class="api-keys-panel" style="padding:16px;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:600;">API Key 管理</h3>
        <p style="margin:0 0 16px;font-size:13px;color:#888;">
          输入你自己的 API Key，可选择保存在本地或同步到云端。
          不上传云端则仅保存在本设备浏览器中。
        </p>

        <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer;font-size:13px;">
          <input type="checkbox" id="api-key-cloud-sync" ${cloudEnabled ? 'checked' : ''} 
            onchange="apiKeys.onCloudToggle(this.checked)">
          <span>上传云端（登录后同步到所有设备）</span>
        </label>

        <div style="display:flex;flex-direction:column;gap:12px;">
    `;

    for (const p of providers) {
      const val = saved[p.id] || '';
      const masked = val ? val.slice(0, 8) + '...' + val.slice(-4) : '';
      html += `
        <div class="api-key-row" style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:13px;font-weight:500;">${p.name}</label>
          <div style="display:flex;gap:8px;">
            <input type="password" 
              id="api-key-${p.id}" 
              value="${val}" 
              placeholder="${p.placeholder}" 
              style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;"
              onfocus="this.type='text'" 
              onblur="this.type='password'">
            <button onclick="apiKeys.save('${p.id}', document.getElementById('api-key-${p.id}').value, apiKeys.isCloudSyncEnabled())" 
              style="padding:8px 16px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">保存</button>
            ${val ? `<button onclick="apiKeys.remove('${p.id}');document.getElementById('api-key-${p.id}').value=''" 
              style="padding:8px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:13px;cursor:pointer;">删除</button>` : ''}
          </div>
          ${masked ? `<span style="font-size:11px;color:#666;">已保存: ${masked}</span>` : ''}
        </div>
      `;
    }

    html += `</div></div>`;
    container.innerHTML = html;
  },

  onCloudToggle(checked) {
    localStorage.setItem(API_KEYS_CLOUD_KEY, JSON.stringify(checked));
    if (checked) {
      // 如果启用云端，把本地所有 key 同步上去
      const all = this.getAll();
      for (const [provider, key] of Object.entries(all)) {
        if (key) this.save(provider, key, true);
      }
    }
  },
};

window.apiKeys = apiKeys;
