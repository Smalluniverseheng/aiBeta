# 版本号规则

> 绝对禁止违反！

---

## 规则

### 1. 格式

只用 `x.y` 格式（如 `4.3`、`5.2`）。

**禁止** `x.y.z`（如 `4.3.1`）。

### 2. 发版同步

每次发版必须同时修改 **4 处**：

1. `js/providers.js`: `const APP_VERSION = 'x.y';`
2. `sw.js`: `const VERSION = 'vx.y';`
3. `index.html`: 所有 `?v=x.y`（缓存版本标记）
4. `js/changelog.js`: 数组末尾追加新版本条目

### 3. 提交信息

Git 提交信息、文档、changelog 条目也禁止出现 `x.y.z`。

### 4. 示例

```javascript
// js/providers.js
const APP_VERSION = '5.2';

// sw.js
const VERSION = 'v5.2';

// index.html
<script src="js/app.js?v=5.2"></script>

// js/changelog.js
  {
    version: '5.2', date: '2026-07-27', major: false, items: [
      '修复悬浮按钮返回后导航栏消失',
      '修复帮助中心/回收站打不开',
      '新增对话页滑动手势'
    ]
  }
```

---

## 历史版本

- v5.2 — 悬浮按钮修复、滑动手势、子页面修复
- v5.1 — 悬浮按钮、导航设置、侧边栏控制
- v5.0 — 基础稳定版
