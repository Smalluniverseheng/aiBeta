# 开发约束（强制）

> 违反任何一条都可能导致项目崩溃或用户数据丢失。

---

## 核心约束

### 1. 只做增量添加，禁止改动现有逻辑

**禁止改动的模块**：
- 聊天管线（`js/chat.js` 的核心流程）
- 模型库结构（`js/models.js`、`js/providers.js`）
- 主题 CSS 变量（`css/base.css` 中的 `:root` 变量）
- API 层（`js/api.js` 的请求封装）

**允许的操作**：
- 新增函数/组件
- 新增 CSS 类（用 `html[data-device="watch"]` 隔离）
- 新增页面/路由
- 在现有函数末尾追加逻辑（如 `create` 函数加防抖）

### 2. 不引入构建工具/框架/国外平台依赖

**禁止**：
- npm / yarn / pnpm
- webpack / vite / rollup
- React / Vue / Angular
- TypeScript（项目是纯 JS）
- 国外 CDN（可能被墙）

**允许**：
- 纯原生 JS（ES6+）
- 国内 CDN（如 jsDelivr 国内节点、BootCDN）
- 直接复制到 `js/` 目录的第三方库

### 3. 移动端优先

- 用户开发机是 **黑鲨4 Pro + Termux**
- 所有新功能必须先在移动端测试
- 触摸事件优先于鼠标事件
- 按钮最小 44×44px（移动端可点击区域）

### 4. 数据全部 localStorage

- 当前所有数据存在 `localStorage`（key: `ai_chat_state_v5`）
- 预留后端切换能力（`Store` 模块已抽象）
- 不要直接操作 `localStorage`，用 `Store.save()` / `Store.load()`

### 5. 手表端隔离

- 手表端检测在 `js/device.js`
- 检测后会在 `<html>` 上设置 `data-device="watch"`
- 所有手表端样式必须用 `html[data-device="watch"]` 前缀
- 手表端功能限制：强制单模型、简化动画、语音优先

### 6. 侧滑手势不要重复添加

- `ui.js` 中已有 `bindSwipeGesture()`（约第 1328 行）
- 手表端侧滑需修改 `mobile()` 判断让其包含手表端
- **不要**再添加 `initSwipe()` 或类似函数

---

## 代码风格

### 文件头格式
```javascript
==== 模块名 · 职责 ====
```

### 全局单例模块
```javascript
const ModuleName = (() => {
  // 私有变量
  // 公共 API
  return { ... };
})();
```

### 工具函数
```javascript
const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
const esc = s => (s || '').replace(/</g, '&lt;');
```

---

## 性能约束

- 消息超过 50 条启用虚拟滚动
- 图片用 Intersection Observer 懒加载
- 代码按路由懒加载（辩论/协同/知识库单独 chunk）
- Worker 缓存厂商模型列表 1 小时

---

## 安全约束

- Secret Key 只存 Cloudflare Worker 环境变量
- 前端用 Publishable Key
- 厂商 API Key 只在 Worker 环境变量
- CORS 只允许特定域名
