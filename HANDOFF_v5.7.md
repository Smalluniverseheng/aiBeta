# 🚨 AI 接手交接文档 — v5.7 会员体系开发

> 创建时间: 2026-07-29 13:12
> 当前状态: 开发中，白屏问题待修复
> 上一个AI: Kimi (当前会话)

---

## 一、项目概述

**第三方科技 AI** 是一个纯前端 PWA 应用（零构建、零框架），部署在 GitHub Pages，后端使用 Cloudflare Worker + Supabase。

当前正在开发 **v5.7 会员体系**，包含：
- 6级会员（游客→卫星→行星→恒星→星系→宇宙）
- 老虎机抽奖系统
- 数据导出功能
- 设备管理
- 存储管理
- 家庭共享
- 卡密系统

---

## 二、已完成的工作

### 2.1 前端（aiBeta / main 分支）

| 文件 | 操作 | 说明 |
|------|------|------|
| `js/providers.js` | 修改 | APP_VERSION = '5.7' |
| `sw.js` | 修改 | VERSION = 'v5.7' |
| `js/changelog.js` | 修改 | 追加 v5.7 更新日志 |
| `index.html` | 修改 | 版本号 + 新 subpage DOM + 菜单入口 + diag.js 引用 |
| `js/store.js` | 修改 | 添加 membership/devices/storage/lottery/family 默认值 |
| `js/ui.js` | 修改 | 侧边栏用户名称右侧添加等级标签 (getTierBadge) |
| `js/pages.js` | 修改 | 添加会员/存储/设备/抽奖/导出/家庭渲染函数 |
| `js/auth.js` | 修改 | 登录时延迟记录设备信息 (setTimeout) |
| `js/app.js` | 修改 | 添加会员初始化 + 存储警告 |
| `css/pages.css` | 修改 | 全套会员样式 |
| `js/membership.js` | **新建** | 会员核心逻辑 |
| `js/lottery.js` | **新建** | 老虎机抽奖 |
| `js/export-data.js` | **新建** | 数据导出 |
| `js/diag.js` | **新建** | 白屏诊断工具（测试服专用） |

### 2.2 管理后台（AI-admin / main 分支）

| 文件 | 操作 | 说明 |
|------|------|------|
| `index.html` | 修改 | 卡密管理导航 + 页面 DOM |
| `js/admin.js` | 修改 | 卡密生成/复制/导出/列表逻辑 |
| `css/admin.css` | 修改 | 卡密管理样式 |
| `database/schema.sql` | 修改 | 7 张新表 + RLS 策略 |
| `database/schema-cloud.sql` | 修改 | 云端精简版表 |
| `worker/index.ts` | 修改 | 5 个新 API 接口 |
| `worker/wrangler.toml` | 修改 | 修正 main 入口路径 |

### 2.3 Worker 后端

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/v1/card/redeem` | POST | 卡密激活 | ✅ 已部署 |
| `/api/v1/card/verify` | POST | 卡密预验证 | ✅ 已部署 |
| `/api/v1/membership` | GET | 查询会员信息 | ✅ 已部署 |
| `/api/v1/membership` | POST | 更新会员（管理员） | ✅ 已部署 |
| `/api/v1/proxy` | GET | 书源/图源代理 | ✅ 已部署 |

**Worker 地址**: `https://ai-gateway.1829487897.workers.dev`

---

## 三、当前遇到的问题（白屏）

### 3.1 问题描述

测试端 (`https://smalluniverseheng.github.io/aiBeta/`) 出现**白屏**，页面只显示简单的 HTML 结构，没有 CSS 样式和 JS 交互。

### 3.2 诊断结果

通过 `js/diag.js` 诊断工具捕获到：

```
Store: ❌
Store.state: ❌
SB: ✅
UI: ✅
Toast: ✅
Membership: ✅
Lottery: ✅
ExportData: ✅
renderMembership: ❌
renderStorage: ❌
renderDevices: ❌
renderLottery: ❌
renderExport: ❌
renderFamily: ❌
app: ❌
chatPage: ❌
modelPage: ❌
discoverPage: ❌
profilePage: ❌
```

**Script 加载**: store.js ✅, pages.js ✅, membership.js ✅, lottery.js ✅, export-data.js ✅, ui.js ✅, app.js ✅, auth.js ✅

### 3.3 已修复但可能未生效的问题

1. **store.js DEFAULTS 对象语法错误**
   - `comicHistory: []` 后面缺少逗号
   - 新添加的字段缩进只有2个空格（应为4个空格）
   - **已推送修复**，但可能被 Service Worker 缓存

2. **pages.js 重复函数定义**
   - `renderMembership`、`renderStorage`、`renderDevices` 被定义了两次
   - **已推送修复**（删除第二次定义）

3. **auth.js Membership 引用时机**
   - auth.js 在 membership.js 之前加载，直接调用 `Membership.addDevice()` 报错
   - **已推送修复**（改为 `setTimeout` 延迟 + `typeof` 检查）

4. **index.html app div 缺失**
   - 诊断报告显示 `app: ❌`
   - 需要检查 index.html 中 `<div id="app">` 是否存在

### 3.4 可能的根因

| 可能性 | 说明 |
|--------|------|
| **Service Worker 缓存** | `?nocache=1` 不影响 SW 缓存，浏览器仍加载旧版 store.js |
| **index.html 结构损坏** | 多次修改可能导致 DOM 结构不完整 |
| **CSS 未加载** | 诊断报告显示"复古的简单 UI"，可能是 CSS 未加载 |

### 3.5 建议排查步骤

1. **清除 Service Worker 缓存**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister())).then(()=>caches.keys().then(keys=>keys.forEach(k=>caches.delete(k)))).then(()=>location.reload(true))
   ```

2. **检查 index.html 中 app div**
   - 搜索 `<div id="app">` 是否存在
   - 如果不存在，需要恢复

3. **检查 CSS 文件是否加载**
   - 查看 Network 面板中 CSS 请求是否 200

4. **检查 store.js 实际加载内容**
   - 在 Console 中查看 `typeof Store`
   - 如果 undefined，说明 store.js 仍有语法错误

---

## 四、待完成的工作

### 4.1 高优先级（阻塞发布）

- [ ] **修复白屏问题** — 确保 Store 正常初始化
- [ ] **验证所有页面正常渲染** — 会员计划、存储管理、设备管理、抽奖、导出
- [ ] **验证侧边栏等级标签显示**
- [ ] **验证卡密激活流程** — 输入卡密 → Worker API → 更新会员状态
- [ ] **验证数据导出功能** — 多格式导出 + 导出后删除

### 4.2 中优先级

- [ ] **在 Supabase 创建数据库表** — 执行 `AI-admin/database/schema.sql`
- [ ] **验证 Worker API 正常工作** — 卡密验证、会员查询、代理
- [ ] **验证设备管理** — 设备列表、信任设备、踢出设备
- [ ] **验证存储管理** — 已用/总量显示、分类详情、清理
- [ ] **验证老虎机抽奖** — 动画、奖品记录、独立存储包

### 4.3 低优先级

- [ ] **家庭共享功能** — 主账号分配额度、子账号管理
- [ ] **邀请有奖** — 邀请链接生成、抽奖次数累积
- [ ] **AI-admin 卡密管理** — 生成、导出、列表筛选
- [ ] **支付渠道预留** — 微信支付/支付宝/Stripe 接口位置

---

## 五、API 密钥位置

所有密钥存储在 `ai-context` 分支的 `SECRETS.md` 文件中。

**访问方式**:
```bash
# 通过 GitHub API 读取
GET https://api.github.com/repos/Smalluniverseheng/aiBeta/contents/SECRETS.md?ref=ai-context
# Base64 解码 content 字段
```

**密钥清单**:
- Supabase Anon Key
- Supabase Service Role Key
- Cloudflare Account ID
- Cloudflare API Token
- GitHub Token（用户保管，不在 SECRETS.md 中）

---

## 六、关键文件位置

### 6.1 会员体系相关

| 功能 | 前端文件 | 后端接口 |
|------|----------|----------|
| 会员计划页面 | `js/pages.js` → `renderMembership()` | Worker `/api/v1/membership` |
| 存储管理 | `js/pages.js` → `renderStorage()` | 本地计算 + Supabase |
| 设备管理 | `js/pages.js` → `renderDevices()` | Supabase `user_devices` 表 |
| 老虎机抽奖 | `js/pages.js` → `renderLottery()` | 本地概率计算 |
| 数据导出 | `js/pages.js` → `renderExport()` | 本地生成文件 |
| 家庭共享 | `js/pages.js` → `renderFamily()` | Supabase `family_groups` 表 |
| 卡密激活 | `js/membership.js` → `redeemCardKey()` | Worker `/api/v1/card/redeem` |

### 6.2 数据库表（待创建）

```sql
-- 在 Supabase SQL 编辑器执行 AI-admin/database/schema.sql
-- 核心表：
-- card_keys, card_key_logs, user_bonus_storage, 
-- user_invites, lottery_records, user_devices, 
-- family_groups, family_members
```

---

## 七、版本号规则（绝对禁止违反）

1. **只用 x.y 格式**（如 5.7），禁止 x.y.z（如 5.7.1）
2. **每次发版必须同时修改 4 处**:
   - `js/providers.js` → `APP_VERSION`
   - `sw.js` → `VERSION`
   - `index.html` → 所有 `?v=x.y`
   - `js/changelog.js` → 数组末尾追加

---

## 八、测试地址

```
测试服: https://smalluniverseheng.github.io/aiBeta/?nocache=1
正式服: https://smalluniverseheng.github.io/AI/
管理后台: https://smalluniverseheng.github.io/AI-admin/
Worker: https://ai-gateway.1829487897.workers.dev
```

---

## 九、联系方式

- **仓库**: https://github.com/Smalluniverseheng/aiBeta
- **用户**: 18岁高二学生，使用黑鲨4 Pro + Termux
- **部署方式**: 纯手机操作，GitHub API 推送代码

---

*本文档由 AI 维护，每次交接后更新。*
*最后更新: 2026-07-29 13:12*
