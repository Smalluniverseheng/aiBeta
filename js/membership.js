/* membership.js - 会员体系核心逻辑 v5.7 */
(function() {
  'use strict';

  // ========== 会员等级配置 ==========
  const TIERS = {
    guest:    { key: 'guest',    name: '游客',    icon: '',      color: '#888',  price: 0,    storage: 0,       devices: 1,  sync: false, proxy: false, family: false },
    satellite:{ key: 'satellite',name: '卫星',    icon: '🛰️',   color: '#9e9e9e',price: 0,    storage: 10*1024*1024, devices: 1,  sync: false, proxy: false, family: false },
    planet:   { key: 'planet',   name: '行星',    icon: '🪐',   color: '#4caf50',price: 9.9,  storage: 1024*1024*1024, devices: 10, sync: true,  proxy: true,  family: false },
    star:     { key: 'star',     name: '恒星',    icon: '☀️',   color: '#2196f3',price: 29.9, storage: 10*1024*1024*1024, devices: 20, sync: true,  proxy: true,  family: true },
    galaxy:   { key: 'galaxy',   name: '星系',    icon: '🌌',   color: '#9c27b0',price: 59.9, storage: 50*1024*1024*1024, devices: 40, sync: true,  proxy: true,  family: true },
    universe: { key: 'universe', name: '宇宙',    icon: '🌠',   color: '#ffc107',price: 99,   storage: 100*1024*1024*1024, devices: Infinity, sync: true, proxy: true, family: true }
  };

  const TIER_ORDER = ['guest','satellite','planet','star','galaxy','universe'];

  // ========== 卡密激活 ==========
  async function redeemCardKey(key) {
    key = key.trim().toUpperCase();
    if (!/^TP-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}-[A-Z0-9]{8}$/.test(key)) {
      return { ok: false, msg: '卡密格式错误，应为 TP-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX' };
    }
    const user = Store.state.user;
    if (!user || !user.id) {
      return { ok: false, msg: '请先登录' };
    }
    try {
      // 调用 Supabase Edge Function 验证卡密
      const resp = await fetch('https://ai-gateway.1829487897.workers.dev/api/v1/card/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, userId: user.id })
      });
      const data = await resp.json();
      if (!resp.ok) return { ok: false, msg: data.error || '卡密验证失败' };
      // 更新本地状态
      const now = new Date();
      const expires = new Date(now.getTime() + data.durationDays * 86400000);
      Store.set('membership', {
        tier: data.planType,
        expiresAt: expires.toISOString(),
        startedAt: now.toISOString(),
        source: 'cardkey'
      });
      return { ok: true, msg: `激活成功！您已成为【${TIERS[data.planType].name}】会员，有效期至 ${expires.toLocaleDateString('zh-CN')}` };
    } catch (e) {
      return { ok: false, msg: '网络错误，请重试' };
    }
  }

  // ========== 获取当前等级信息 ==========
  function getCurrentTier() {
    const m = Store.state.membership;
    if (!m || !m.tier) return TIERS.guest;
    // 检查是否过期
    if (m.expiresAt && new Date(m.expiresAt) < new Date()) {
      return TIERS.satellite; // 过期后降级为卫星（免费登录版）
    }
    return TIERS[m.tier] || TIERS.guest;
  }

  // ========== 存储计算 ==========
  function getStorageUsed() {
    // 从 Store 中计算各类数据大小
    let used = 0;
    const settings = Store.state || {};
    // 历史对话估算
    const conversations = Store.state.chats || [];
    conversations.forEach(c => {
      used += JSON.stringify(c).length * 2; // UTF-16 估算
    });
    // 书源
    const novelSources = settings.novelSources || [];
    const comicSources = settings.comicSources || [];
    used += JSON.stringify(novelSources).length * 2;
    used += JSON.stringify(comicSources).length * 2;
    // 书架
    const novelShelf = settings.novelShelf || [];
    const comicShelf = settings.comicShelf || [];
    used += JSON.stringify(novelShelf).length * 2;
    used += JSON.stringify(comicShelf).length * 2;
    // 自定义角色
    const customRoles = settings.customRoles || [];
    used += JSON.stringify(customRoles).length * 2;
    // 设置
    used += JSON.stringify(settings).length * 2;
    return used;
  }

  function getStorageLimit() {
    const tier = getCurrentTier();
    // 加上抽奖获得的临时存储
    const bonus = Store.state.bonusStorage || [];
    let bonusTotal = 0;
    const now = new Date();
    bonus.forEach(b => {
      if (b.expiresAt && new Date(b.expiresAt) > now) {
        bonusTotal += b.size;
      }
    });
    return tier.storage + bonusTotal;
  }

  function getStoragePercent() {
    const used = getStorageUsed();
    const limit = getStorageLimit();
    if (limit === 0) return 0;
    return Math.min(100, Math.round(used / limit * 100));
  }

  // ========== 设备管理 ==========
  function getDevices() {
    return Store.state.devices || [];
  }

  function addDevice(deviceInfo) {
    const devices = getDevices();
    const now = new Date().toISOString();
    const existing = devices.find(d => d.deviceId === deviceInfo.deviceId);
    if (existing) {
      existing.lastActive = now;
      existing.isCurrent = true;
    } else {
      devices.forEach(d => d.isCurrent = false);
      devices.push({
        deviceId: deviceInfo.deviceId || generateDeviceId(),
        name: deviceInfo.name || '未知设备',
        type: deviceInfo.type || 'unknown',
        os: deviceInfo.os || '',
        browser: deviceInfo.browser || '',
        lastActive: now,
        isTrusted: false,
        isCurrent: true
      });
    }
    Store.set('devices', devices);
    return devices;
  }

  function generateDeviceId() {
    return 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  function removeDevice(deviceId) {
    let devices = getDevices();
    devices = devices.filter(d => d.deviceId !== deviceId);
    Store.set('devices', devices);
    return devices;
  }

  function setDeviceTrusted(deviceId, trusted) {
    const devices = getDevices();
    const d = devices.find(x => x.deviceId === deviceId);
    if (d) d.isTrusted = trusted;
    Store.set('devices', devices);
    return devices;
  }

  // ========== 导出数据 ==========
  async function exportData(options) {
    const { types, format } = options;
    const exportObj = {};
    const settings = Store.state || {};

    if (types.includes('conversations')) {
      exportObj.conversations = Store.state.chats || [];
    }
    if (types.includes('novelSources')) {
      exportObj.novelSources = settings.novelSources || [];
    }
    if (types.includes('comicSources')) {
      exportObj.comicSources = settings.comicSources || [];
    }
    if (types.includes('novelShelf')) {
      exportObj.novelShelf = settings.novelShelf || [];
    }
    if (types.includes('comicShelf')) {
      exportObj.comicShelf = settings.comicShelf || [];
    }
    if (types.includes('customRoles')) {
      exportObj.customRoles = settings.customRoles || [];
    }
    if (types.includes('settings')) {
      exportObj.settings = settings;
    }

    let blob, filename;
    if (format === 'json') {
      blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      filename = 'thirdparty_ai_backup_' + new Date().toISOString().slice(0,10) + '.json';
    } else if (format === 'csv') {
      // 简单 CSV 转换
      blob = new Blob([JSON.stringify(exportObj)], { type: 'text/csv' });
      filename = 'backup.csv';
    } else if (format === 'zip') {
      // ZIP 需要 JSZip，这里先返回 JSON
      blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      filename = 'backup.json';
    } else {
      blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      filename = 'backup.json';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    return { ok: true, size: blob.size };
  }

  // ========== 公开 API ==========
  window.Membership = {
    TIERS,
    TIER_ORDER,
    redeemCardKey,
    getCurrentTier,
    getStorageUsed,
    getStorageLimit,
    getStoragePercent,
    getDevices,
    addDevice,
    removeDevice,
    setDeviceTrusted,
    generateDeviceId,
    exportData
  };
})();
