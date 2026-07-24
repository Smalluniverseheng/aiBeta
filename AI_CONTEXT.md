# 当前上下文快照

> 供 AI 快速了解项目当前状态，每次重大修改后更新。

---

## 基本信息

| 项目 | 值 |
|------|-----|
| 当前版本 | **v3.6** |
| 前端版本 | `APP_VERSION = '3.6.0'` |
| SW 版本 | `VERSION = 'v3.6.0'` |
| 缓存穿透 | `?v=3.6.0` |
| 部署地址 | `https://smalluniverseheng.github.io/AI/` |
| 仓库 | `https://github.com/Smalluniverseheng/AI` |

---

## 分支状态

| 分支 | 最新提交 | 用途 |
|------|----------|------|
| `preview` | v3.6 | 线上部署（GitHub Pages） |
| `production` | v3.6 | 开发主干（默认分支） |
| `backup` | v3.6 | 备份回滚 |
| `ai-context` | v3.6 | AI 规则/上下文 |
| `v2` | - | Next.js 重构实验 |

---

## 已知问题

1. **Service Worker 缓存**：手表端测试时需清除缓存或换端口
2. **空白对话残留**：v3.6 已修复（初始化清理 + 创建时自动删除）
3. **侧滑手势冲突**：v3.5 已修复（复用现有 `bindSwipeGesture()`）

---

## 待办事项

| 优先级 | 事项 | 状态 |
|--------|------|------|
| P0 | 手表端空白对话清理验证 | 待测试 |
| P1 | 垃圾回收站 30 天自动清理定时器 | 待实现 |
| P1 | 扫一扫功能实现 | 预留 |
| P2 | 会员中心（纯前端 Mock） | 未开始 |
| P2 | AI 集群协作模式（Swarm） | 未开始 |
| P2 | 完整插件市场（10 个纯前端工具） | 部分完成 |

---

## 关键文件位置

| 功能 | 文件 |
|------|------|
| 手表端检测 | `js/device.js` |
| 手表端样式 | `css/watch.css` |
| 侧滑手势 | `js/ui.js` ~第 1328 行 `bindSwipeGesture()` |
| 对话核心 | `js/chat.js` |
| 状态管理 | `js/store.js` |
| 页面路由 | `js/pages.js` |
| 厂商配置 | `js/providers.js` |
| 模型数据 | `js/models.js` |
| 多语言 | `js/i18n.js` |

---

## 凭证位置

凭证存储在 `.ai-handoff/handoff-v2.md` 中（base64 编码块），**不要直接写入本文件**。

**注意**：Secret Key 只存 Worker 环境变量，绝不暴露前端。

---

*最后更新：2026-07-23 | 版本：v3.6*
