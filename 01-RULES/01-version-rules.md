# 版本号规则（强制）

> 每次发版必须同时更新以下 4 处，缺一不可。

---

## 更新清单

| # | 文件 | 字段/位置 | 示例 |
|---|------|----------|------|
| 1 | `js/providers.js` | `const APP_VERSION = 'X.Y.Z';` | `3.6.0` → `3.7.0` |
| 2 | `sw.js` | `const VERSION = 'vX.Y.Z';` | `v3.6.0` → `v3.7.0` |
| 3 | `js/changelog.js` | 数组最顶部追加新对象 | `{version: '3.7', ...}` |
| 4 | `index.html` | 所有 `?v=X.Y.Z` 查询串 | 全局替换 `?v=3.6.0` → `?v=3.7.0` |

---

## 规则

1. **逐一加 0.1**：`3.6` → `3.7` → `3.8`，**不要**用 `3.6.1`
2. **changelog 数组顶部追加**：最新的在最前面
3. **index.html 全量替换**：所有 `?v=` 都要换，用于缓存穿透
4. **4 处必须同时更新**：漏一处会导致缓存不一致

---

## 错误示例

```javascript
// ❌ 错误：用小版本号
const APP_VERSION = '3.5.1';

// ❌ 错误：只更新一处
// providers.js 更新了，但 index.html 还是旧版本

// ❌ 错误：changelog 追加到数组末尾
// 应该追加到数组最顶部
```

## 正确示例

```javascript
// js/providers.js
const APP_VERSION = '3.7.0';

// sw.js
const VERSION = 'v3.7.0';

// js/changelog.js（数组最顶部）
const CHANGELOG = [
  {
    version: '3.7', date: '2026-07-24', major: false, items: [
      'xxx 功能',
      'yyy 修复'
    ]
  },
  // ... 旧记录在下面
];

// index.html（所有 ?v= 都要换）
<script src="js/app.js?v=3.7.0"></script>
<link rel="stylesheet" href="css/base.css?v=3.7.0">
```

---

*违反此规则会导致线上缓存不一致，用户看到旧界面。*
