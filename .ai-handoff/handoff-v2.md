# 开发交接文档 v2

> 项目: 第三方科技 · AI 智能聚合平台
> 当前版本: v5.2
> 最后更新: 2026-07-27

---

## 一、仓库结构

```
aiBeta/               # 测试服仓库
├── main              # v5.0 稳定版备份
├── 5.0               # v5.0 开发历史
├── 5.1               # v5.1 开发历史
├── 5.2               # 当前开发分支（部署中）
├── ai-context        # AI 文档/规则/上下文
├── archive           # 全量历史追加式备份
└── production        # (AI仓库) 生产端稳定版

AI/                   # 生产服仓库
└── production        # 生产端部署分支
```

---

## 二、开发流程

1. 在 `aiBeta/5.x` 分支开发新功能
2. 每完成一个功能就测试验证
3. 全部完成后合并到 `aiBeta/main`
4. 确认测试服稳定后，同步到 `AI/production`

---

## 三、关键经验（血泪教训）

### 3.1 Pages IIFE 作用域

**所有 `renderXxx` 函数必须在 `Pages` IIFE 内部定义！**

```javascript
const Pages = (() => {
  function renderSomething() { ... }  // ✅ 正确
  return { renderSomething };
})();

function renderSomething() { ... }  // ❌ 错误！会导致 ReferenceError
```

**v5.1 之前的问题**: `renderProxySection` 和 `renderNavSettings` 被放在 IIFE 外部，导致子页面打不开。

### 3.2 bindSubpageEvents 必须调用

`bindSubpageEvents()` 负责监听 `[data-sub]` 点击事件。**必须在 `Pages.init()` 中调用！**

v5.2 之前遗漏，导致帮助中心、回收站等子页面点击无反应。

### 3.3 版本号规则（绝对禁止违反）

```
① 只用 x.y 格式（如 4.3、5.2），禁止 x.y.z（如 4.3.1）
② 发版必须同步改 4 处：
   - js/providers.js: APP_VERSION
   - sw.js: VERSION
   - index.html: 所有 ?v=X.Y
   - js/changelog.js: 数组末尾追加新版本条目
③ Git 提交信息、文档、changelog 条目也禁止出现 x.y.z
```

### 3.4 事件委托优于直接绑定

反复渲染的元素（如导航设置选项）必须使用事件委托：

```javascript
// ✅ 正确：事件委托
container.addEventListener('click', e => {
  const row = e.target.closest('.nav-opt-row');
  if (!row) return;
  // 处理点击
});

// ❌ 错误：直接绑定（每次渲染重复添加监听器）
$$('.nav-opt-row').forEach(row => {
  row.addEventListener('click', () => { ... });
});
```

### 3.5 moved 标志时序

悬浮按钮拖动时，`moved` 标志的时序非常关键：

```javascript
// ✅ 正确：只在 drag start 重置
btn.addEventListener('touchstart', () => {
  moved = false;
  dragging = true;
});

// touchend 中不重置 moved！
document.addEventListener('touchend', () => {
  dragging = false;
  // 不要在这里 reset moved！
});

// click 中检查 moved
btn.addEventListener('click', () => {
  if (moved) return;  // 拖动后不触发点击
  // 处理点击
});
```

### 3.6 不要在模块加载时清理数据

```javascript
// ❌ 错误：模块加载时清理会清空所有历史
(function cleanupEmptyChats() {
  Store.state.chats = Store.state.chats.filter(...);
})();

// ✅ 正确：只在 create() 时清理
function create() {
  // 清理空白会话（保留当前查看的）
  const currentId = Store.state.currentChatId;
  Store.state.chats = Store.state.chats.filter(
    c => c.id === currentId || (c.messages && c.messages.length > 0)
  );
}
```

### 3.7 GitHub Pages 缓存

修改后需要 1-2 分钟才能生效，测试时加 `?nocache=1` 或强制刷新。

---

## 四、已知问题与解决方案

| 问题 | 版本 | 解决方案 |
|------|------|----------|
| 子页面打不开 | v5.0 | 将 renderXxx 移入 IIFE 内部 |
| 子页面点击无反应 | v5.1 | 在 Pages.init() 中调用 bindSubpageEvents() |
| 悬浮按钮拖动后误触发点击 | v5.1 | moved 标志只在 drag start 重置 |
| 返回对话页后导航栏消失 | v5.2 | updateVisibility 不再控制 topbar |
| 侧边栏在非对话页仍显示 | v5.1 | 添加 page-hidden CSS 类 |
| 后端同步 id 报错 | v5.1 | pushMessages 前为无 id 消息生成 UUID |

---

## 五、测试验证清单

每次发版前必须验证：

- [ ] 悬浮按钮在非对话页显示，对话页隐藏
- [ ] 悬浮按钮可拖动，松手吸附边缘
- [ ] 点击悬浮按钮返回对话页
- [ ] 导航设置页面可打开，选项可点击
- [ ] 帮助中心、回收站、代理模式、导航设置都能打开
- [ ] 历史侧边栏只在对话页显示
- [ ] 从对话页切换出去，侧边栏自动收起
- [ ] 更新日志正常显示，无 CHANGELOG 报错
- [ ] 后端同步无 "null value in column id" 报错
- [ ] 版本号一致（4处）

---

## 六、联系方式

- 测试服: `https://smalluniverseheng.github.io/aiBeta/`
- 生产服: `https://smalluniverseheng.github.io/AI/`
- 测试服仓库: `https://github.com/Smalluniverseheng/aiBeta`
- 生产服仓库: `https://github.com/Smalluniverseheng/AI`
