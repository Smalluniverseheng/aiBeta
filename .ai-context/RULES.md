# AI 开发规则（必读）

> 本文件供 AI 编程助手读取，每次对话开始时必须先读取本分支所有文件恢复上下文。
> 分支：`ai-context` | 仓库：`Smalluniverseheng/AI`

---

## 一、版本号规则（强制）

每次发版必须同时更新以下 4 处，缺一不可：

| 文件 | 字段 | 规则 |
|------|------|------|
| `js/providers.js` | `APP_VERSION` | 逐一加 0.1，如 `3.6` → `3.7` |
| `sw.js` | `VERSION` | 带 v 前缀，如 `v3.7` |
| `js/changelog.js` | 数组末尾追加 | 版本号、日期、更新项（数组按时间升序，render 时 reverse） |
| `index.html` | 所有 `?v=X.Y` | 缓存穿透，全量替换 |

**错误示例**：`3.5.1`、`3.6.0`（不要用小版本号，统一 x.y 格式）  
**正确示例**：`3.6` → `3.7` → `3.8`

---

## 二、分支规范（强制）

| 分支 | 用途 | 说明 |
|------|------|------|
| `preview` | **线上部署** | GitHub Pages 实际部署分支，**必须同步到这里才能线上生效** |
| `production` | **开发主干** | 默认分支，日常开发推这里 |
| `v3.7` | **备份回滚** | 保存稳定版本快照，方便回滚 |
| `ai-context` | **AI 上下文** | 存规则和历史，供 AI 读取恢复上下文 |
| `后端` | **后端服务** | Cloudflare Worker + Supabase 后端代码，已删除所有前端文件 |

### ⚠️ 关键提醒
**GitHub Pages 的部署源分支是 `preview`，不是 `production`。**
如果修改推到了 `production` 但线上没变化，一定是没同步到 `preview`。

### 推送规则
1. 日常开发 → `production`（GitHub Pages 从此分支自动构建部署）
2. **备份 → `v3.7`（上个版本备份，覆盖式）**
   - 用途：保存**上一个稳定版本**的快照，方便快速回滚
   - 触发：用户测试完、确认新版稳定后，说"备份"才执行
   - 方式：覆盖式（force push 允许），v3.7 永远只存一个版本（上个稳定版）
   - 示例：production 是 v3.8 时，backup 存 v3.7；发 v3.9 后，backup 更新为 v3.8
3. **存档 → `archive`（全量历史存档，追加式）**
   - 用途：保存**所有历史版本**的完整 commit 历史，不可删除
   - 触发：用户说"存档"才执行
   - 方式：追加式（merge 或 fast-forward），**严禁 force push**
   - 与 backup 的区别：backup 只存上个版本（快速回滚），archive 存全部（完整历史追溯）
4. 修改规则/历史 → `ai-context`
5. 后端代码 → `后端`（与前端物理隔离）

### 废弃版本
| 分支 | 版本 | 废弃原因 |
|------|------|----------|
| `v4.3-废弃` | v4.3 | 报错中心功能导致白屏，多次修复未解决，暂时废弃 |

> 废弃版本保留代码历史，供后续参考，不再合并到 production。

### 网络受限推送（中国大陆）
```bash
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" production
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" preview
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" backup
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" ai-context
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" 后端
```

---

## 三、开发约束（强制）

1. **只做增量添加，禁止改动现有逻辑**（聊天管线、模型库结构、主题 CSS 变量、API 层）
2. **不引入构建工具/框架/国外平台依赖**；纯原生 JS + CDN
3. **移动端优先**（用户开发机是黑鲨4 Pro + Termux）
4. 数据全部 localStorage，预留后端切换能力
5. 手表端检测在 `js/device.js`，CSS 用 `html[data-device="watch"]` 隔离
6. 侧滑手势已有 `bindSwipeGesture()`（`ui.js` 第 1328 行），**不要重复添加**

---

## 四、手表端开发规范

- 屏幕极小（~340px），按钮最小 36×36px，字号最小 12px
- sidebar 占 80%，右侧露出 1/5 对话内容
- 点击历史对话 → 加载并关闭抽屉
- 长按历史对话（500ms）→ 弹出菜单（重命名/置顶/多选/删除）
- 历史记录项隐藏 `meta`（时间）节省空间

---

## 五、垃圾回收站规则

- 删除的对话进入 `Store.state.trash`（30 天后自动清理）
- 恢复：`restoreFromTrash(id)`
- 清理：`emptyTrash()`（删除超过 30 天的）
- UI 在「我的」页面 → 垃圾回收站入口

---

## 六、空对话处理

- 创建新对话时，自动删除上一个**没有任何消息**的空白对话
- 初始化时（`app.js` `Store.load()` 后）清理历史空白对话
- 新对话防抖：300ms 内重复点击忽略
- 保留标准：只要有 1 条消息（哪怕一个符号）就保留

---

*最后更新：2026-07-24 | 版本：v3.7*