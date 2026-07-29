/* lottery.js - 邀请有奖老虎机 v5.7 */
(function() {
  'use strict';

  // ========== 奖品池（概率递减，尽量抽到最低）==========
  const PRIZES = [
    { tier: 0,  name: '谢谢参与',        type: 'none',      detail: null,                     prob: 35.00 },
    { tier: 10, name: '100MB / 3天',     type: 'storage',   detail: { size: 100*1024*1024, days: 3 },  prob: 28.00 },
    { tier: 9,  name: '200MB / 7天',     type: 'storage',   detail: { size: 200*1024*1024, days: 7 },  prob: 18.00 },
    { tier: 8,  name: '500MB / 7天',     type: 'storage',   detail: { size: 500*1024*1024, days: 7 },  prob: 10.00 },
    { tier: 7,  name: '1GB / 30天',      type: 'storage',   detail: { size: 1024*1024*1024, days: 30 }, prob: 5.00 },
    { tier: 6,  name: '2GB / 30天',      type: 'storage',   detail: { size: 2*1024*1024*1024, days: 30 }, prob: 2.50 },
    { tier: 5,  name: '5GB / 30天',      type: 'storage',   detail: { size: 5*1024*1024*1024, days: 30 }, prob: 1.00 },
    { tier: 4,  name: '行星会员 1个月',   type: 'membership',detail: { plan: 'planet', days: 30 },    prob: 0.30 },
    { tier: 3,  name: '恒星会员 1个月',   type: 'membership',detail: { plan: 'star', days: 30 },      prob: 0.15 },
    { tier: 2,  name: '星系会员 1个月',   type: 'membership',detail: { plan: 'galaxy', days: 30 },    prob: 0.04 },
    { tier: 1,  name: '宇宙会员 1个月',   type: 'membership',detail: { plan: 'universe', days: 30 },  prob: 0.009 },
    { tier: 0,  name: '宇宙会员 1年',     type: 'membership',detail: { plan: 'universe', days: 365 }, prob: 0.001 }
  ];

  // 校验总概率
  const totalProb = PRIZES.reduce((s, p) => s + p.prob, 0);
  console.log('[Lottery] 总概率:', totalProb.toFixed(3) + '%');

  // ========== 抽奖核心 ==========
  function draw() {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const prize of PRIZES) {
      cumulative += prize.prob;
      if (rand <= cumulative) {
        return prize;
      }
    }
    return PRIZES[0]; // fallback
  }

  // ========== 记录抽奖 ==========
  function recordLottery(prize) {
    const records = Store.state.lotteryRecords || [];
    records.unshift({
      prizeName: prize.name,
      prizeType: prize.type,
      prizeDetail: prize.detail,
      tier: prize.tier,
      time: new Date().toISOString()
    });
    // 只保留最近 50 条
    if (records.length > 50) records.pop();
    Store.set('lotteryRecords', records);

    // 如果是存储包，添加到 bonusStorage
    if (prize.type === 'storage' && prize.detail) {
      const bonus = Store.state.bonusStorage || [];
      const now = new Date();
      bonus.push({
        size: prize.detail.size,
        startedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + prize.detail.days * 86400000).toISOString(),
        source: 'lottery'
      });
      Store.set('bonusStorage', bonus);
    }

    // 如果是会员，更新 membership
    if (prize.type === 'membership' && prize.detail) {
      const m = Store.state.membership || {};
      const now = new Date();
      const expires = new Date(now.getTime() + prize.detail.days * 86400000);
      Store.set('membership', {
        tier: prize.detail.plan,
        expiresAt: expires.toISOString(),
        startedAt: now.toISOString(),
        source: 'lottery'
      });
    }

    return records;
  }

  // ========== 获取剩余抽奖次数 ==========
  function getLotteryCount() {
    return Store.state.lotteryCount || 0;
  }

  function addLotteryCount(n) {
    const c = getLotteryCount() + n;
    Store.set('lotteryCount', c);
    return c;
  }

  function consumeLotteryCount() {
    const c = getLotteryCount();
    if (c <= 0) return false;
    Store.set('lotteryCount', c - 1);
    return true;
  }

  // ========== 老虎机动画 ==========
  function runSlotMachine(onComplete) {
    const reels = document.querySelectorAll('.lottery-reel');
    if (!reels.length) return;

    const prize = draw();
    const symbols = PRIZES.map(p => p.name);
    const targetIdx = PRIZES.indexOf(prize);

    // 每个 reel 的滚动
    reels.forEach((reel, idx) => {
      let pos = 0;
      const speed = 50 + idx * 20; // 越后面的 reel 越慢
      const duration = 1500 + idx * 800; // 越后面的 reel 转越久
      const interval = setInterval(() => {
        pos = (pos + 1) % symbols.length;
        reel.textContent = symbols[pos];
        reel.style.transform = `translateY(${(Math.random() - 0.5) * 4}px)`;
      }, speed);

      setTimeout(() => {
        clearInterval(interval);
        // 最终停止在目标奖品附近（略有随机偏移）
        const finalPos = (targetIdx + idx * 3) % symbols.length;
        reel.textContent = symbols[finalPos];
        reel.style.transform = 'translateY(0)';
        reel.classList.add('lottery-reel-stop');

        if (idx === reels.length - 1) {
          setTimeout(() => {
            recordLottery(prize);
            if (onComplete) onComplete(prize);
          }, 300);
        }
      }, duration);
    });

    return prize;
  }

  // ========== 公开 API ==========
  window.Lottery = {
    PRIZES,
    draw,
    recordLottery,
    getLotteryCount,
    addLotteryCount,
    consumeLotteryCount,
    runSlotMachine
  };
})();
