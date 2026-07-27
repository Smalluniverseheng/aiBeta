# AI 开发指南 — 第三方科技 · AI 智能聚合平台

> **当前版本**: v5.2 | **仓库**: `Smalluniverseheng/aiBeta` (测试服) / `Smalluniverseheng/AI` (生产服)
> **技术栈**: 纯前端 HTML + CSS + Vanilla JS (ES6+)，无构建步骤，PWA
> **部署**: GitHub Pages

---

## 一、项目概览

这是一个第三方 AI 聚合对话平台，支持多厂商模型切换、语音输入/输出、文件上传、联网搜索、绘画等功能。

### 核心架构

```
index.html          # 单页应用入口，包含所有页面 DOM 结构
├── css/
│   ├── layout.css  # 布局、侧边栏、导航栏、响应式
│   ├── chat.css    # 对话气泡、输入框、悬浮按钮、模型卡片
│   ├── discover.css# 发现页、排行榜、工具卡片
│   └── profile.css # 个人中心、设置页、子页面
├── js/
│   ├── app.js      # 应用初始化、Service Worker、悬浮按钮、全局事件
│   ├── ui.js       # 页面路由(navigate)、侧边栏手势、键盘快捷键
│   ├── pages.js    # 所有页面渲染函数（IIFE 封装，通过 return 导出）
│   ├── chat.js     # 对话逻辑、消息发送/接收、附件处理、Markdown 渲染
│   ├── store.js    # 本地状态管理(localStorage)、数据持久化
│   ├── providers.js# 模型厂商配置、模型列表、API 路由
│   ├── supabase.js # Supabase 后端同步（消息/用量/配置）
│   ├── util.js     # 工具函数（$、$$、debounce、copy 等）
│   ├── device.js   # 设备检测（desktop/mobile/watch）
│   ├── theme.js    # 主题切换（light/dark/auto）
│   ├── changelog.js# 更新日志数组
│   └── ...         # 其他功能模块
└── sw.js           # Service Worker（缓存策略）
```

### 脚本加载顺序（严格！）

```html
<script src="js/util.js"></script>
<script src="js/device.js"></script>
<script src="js/theme.js"></script>
<script src="js/store.js"></script>
<script src="js/providers.js"></script>
<script src="js/supabase.js"></script>
<script src="js/chat.js"></script>
<script src="js/ui.js"></script>
<script src="js/pages.js"></script>
<script src="js/app.js"></script>
```

**关键依赖链**: `store.js` → `ui.js` → `pages.js` → `app.js`

---

## 二、页面结构与交互逻辑

### 2.1 四大主页面

| 页面 | ID | 路由 | 说明 |
|------|-----|------|------|
| 对话页 | `pageChat` | `chat` | 核心功能，左侧历史侧边栏 + 右侧对话区 |
| 模型页 | `pageModels` | `models` | 模型选择、分类浏览 |
| 发现页 | `pageDiscover` | `discover` | 排行榜、工具、翻译、Token 统计 |
| 我的页 | `pageProfile` | `profile` | 个人中心、设置、子页面入口 |

**路由函数**: `UI.navigate(page)` 在 `js/ui.js` 中定义。
- 切换页面时自动隐藏/显示侧边栏（对话页显示，其他页隐藏）
- 触发 `pagechange` 自定义事件
- 更新 `Store.state.currentPage`

### 2.2 子页面系统

所有子页面通过 `Pages.openSub(id)` 打开，`Pages.closeSubs()` 关闭。

**16 个子页面**:

| 子页面 ID | 渲染函数 | 入口位置 | 说明 |
|-----------|----------|----------|------|
| `subPlugins` | `renderPlugins()` | 发现页 | 插件库 |
| `subSkills` | `renderSkills()` | 发现页 | 技能库 |
| `subPlugin` | `renderPluginSection()` | 发现页 | 单个插件详情 |
| `subData` | `renderDataSection()` | 我的 → 数据管理 | 数据导出/导入/清理 |
| `subVoice` | `renderVoiceSection()` | 我的 → 语音设置 | TTS/ASR 配置 |
| `subAsr` | `renderAsrSection()` | 语音设置内 | ASR 语言选择 |
| `subLang` | `renderLangList()` | 语音设置内 | 翻译语言列表 |
| `subHelp` | `renderHelp()` | 我的 → 帮助中心 | 帮助文档 |
| `subTheme` | `syncThemeCards()` | 我的 → 主题 | 主题切换 |
| `subTokens` | `renderTokens()` | 发现页 | Token 用量统计 |
| `subSync` | `renderSyncSection()` | 我的 → 云同步 | Supabase 同步配置 |
| `subProfileEdit` | `renderProfileEdit()` | 我的 → 编辑资料 | 修改昵称/头像 |
| `subTranslate` | `renderTranslate()` | 发现页 | 翻译工具 |
| `subProxy` | `renderProxySection()` | 我的 → 代理模式 | API 代理设置 |
| `subNavSettings` | `renderNavSettings()` | 我的 → 通用 → 导航方式 | 三端导航设置 |
| `subTrash` | `renderTrash()` | 我的 → 回收站 | 已删除对话恢复 |

**子页面打开流程**:
1. 用户点击 `[data-sub="xxx"]` 元素
2. `bindSubpageEvents()` 捕获点击 → 调用 `Pages.openSub(id)`
3. `openSub(id)` 显示对应 `.subpage` 容器，调用 `renderSubContent(id)`
4. `renderSubContent(id)` 根据 ID 分发到对应的 `renderXxx()` 函数

**⚠️ 关键坑点**: `bindSubpageEvents()` 必须在 `Pages.init()` 中被调用！v5.2 之前遗漏导致子页面打不开。

### 2.3 历史侧边栏

- **对话页**: 固定显示（桌面端）或可滑动展开/收起（移动端）
- **非对话页**: 完全隐藏（通过 `page-hidden` CSS 类）
- **展开手势**: 对话页从左边缘（<24px）向右滑动 >60px 展开
- **收起手势**: 对话页从右向左滑动 >60px 收起，或点击遮罩层
- **桌面端**: 侧边栏始终显示，非对话页时折叠到左侧

### 2.4 悬浮返回按钮（v5.1+）

- **显示条件**: 非对话页且当前设备导航设置包含 `float` 模式
- **位置**: 右下角固定定位
- **拖动**: 支持触摸/鼠标拖动，阈值 8px，松手吸附左右边缘
- **点击**: 关闭所有子页面，返回对话页
- **视觉反馈**: 拖动时添加 `dragging` 类（放大+透明度变化）

### 2.5 导航设置（v5.1+）

三端独立设置：桌面端、移动端、手表端。
每端可选：
- `navbar` — 仅导航栏
- `float` — 仅悬浮按钮
- `both` — 两者都显示
- `off` — 关闭（仅手表端）

存储在 `Store.state.navSettings` 中，持久化到 localStorage。

---

## 三、对话系统交互逻辑

### 3.1 消息发送流程

1. 用户在输入框输入内容（支持 Shift+Enter 换行）
2. 点击发送按钮或按 Enter
3. `Chat.send()` 创建用户消息对象，添加到当前对话
4. 显示"思考中"状态（旋转动画）
5. 通过 SSE 流式接收 AI 回复
6. 每收到一个 chunk，更新消息内容并渲染 Markdown
7. 接收完成后，保存到 Store，触发 Supabase 同步

### 3.2 附件处理

- **图片**: 点击 + 按钮选择图片，预览后发送，支持多图
- **文件**: 支持 txt、pdf、doc 等，自动提取文本内容
- **语音**: 长按麦克风按钮录音，松手发送语音消息

### 3.3 消息操作

- **复制**: 点击消息右上角复制按钮
- **重新生成**: 点击重新生成按钮，重新发送最后一条用户消息
- **删除**: 长按消息或点击删除按钮
- **编辑用户消息**: 点击编辑按钮，修改后重新发送

### 3.4 模型切换

- 点击顶部模型选择栏，弹出模型列表
- 支持搜索、分类筛选（文本/多模态/编程/推理）
- 切换后立即生效，下一条消息使用新模型

---

## 四、数据结构与状态管理

### 4.1 Store.state 结构

```javascript
{
  currentPage: 'chat',           // 当前页面
  currentChatId: null,           // 当前对话 ID
  currentModel: 'default-model', // 当前模型 key
  chats: [                       // 对话列表
    {
      id: 'uuid',
      title: '对话标题',
      messages: [
        {
          id: 'uuid',
          role: 'user' | 'assistant',
          content: '消息内容',
          model: '模型key',
          timestamp: 1234567890,
          attachments: [],      // 附件列表
          tokens: 0,            // Token 用量
        }
      ],
      createdAt: 1234567890,
      updatedAt: 1234567890,
    }
  ],
  navSettings: {                 // 导航设置 (v5.1+)
    desktop: 'navbar',
    mobile: 'navbar',
    watch: 'float'
  },
  theme: 'auto',                 // 主题
  sidebarCollapsed: false,       // 侧边栏折叠状态
  voiceSettings: { ... },        // 语音设置
  syncSettings: { ... },         // 同步设置
  // ... 其他状态
}
```

### 4.2 持久化规则

- `Store.save()` 将 `state` 序列化为 JSON 存入 localStorage
- 自动保存触发点：对话切换、消息发送/接收、设置变更
- **不要**在模块加载时执行清理操作（会清空用户数据）

---

## 五、版本号规则（绝对禁止违反）

```
① 只用 x.y 格式（如 4.3、5.2），禁止 x.y.z（如 4.3.1）
② 发版必须同步改 4 处：
   - js/providers.js: APP_VERSION
   - sw.js: VERSION
   - index.html: 所有 ?v=X.Y
   - js/changelog.js: 数组末尾追加新版本条目
③ Git 提交信息、文档、changelog 条目也禁止出现 x.y.z
```

---

## 六、分支规则

| 分支 | 用途 | 部署 |
|------|------|------|
| `main` | v5.0 稳定版备份 | 不部署 |
| `5.0` | v5.0 开发历史 | 不部署 |
| `5.1` | v5.1 开发历史 | 不部署 |
| `5.2` | **当前开发分支** | aiBeta 测试服 |
| `ai-context` | AI 文档、规则、上下文 | 不部署 |
| `archive` | 全量历史追加式备份 | 不部署 |
| `production` (AI仓库) | 生产端稳定版 | AI 生产服 |

**版本号规则**: `x.y` 格式，每次发版同步改 4 处。

---

## 七、后端 API 与配置

### 7.1 Supabase 配置

```javascript
// js/supabase.js
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'
```

**同步数据**:
- 消息记录 (`messages` 表)
- Token 用量 (`usage` 表)
- 用户配置 (`configs` 表)

**关键约束**: `messages` 表的 `id` 列非空。推送前必须为无 `id` 的消息生成 UUID。

### 7.2 模型 API 路由

所有模型请求通过 `js/providers.js` 中配置的 `baseURL` 路由。
支持厂商：OpenAI、Anthropic、Google、阿里云、腾讯云、硅基流动等。

### 7.3 Service Worker 缓存

```javascript
// sw.js
const VERSION = 'v5.2'
const CACHE_NAME = `ai-cache-${VERSION}`
```

缓存策略：Cache First，网络失败时回退缓存。

---

## 八、开发约束与注意事项

### 8.1 CSS 约束

- 使用 CSS 变量（`--sidebar-w`、`--primary` 等）
- 移动端优先，桌面端用 `@media (min-width: 769px)`
- 手表端特殊样式用 `.watch` 类或 `DeviceInfo.isWatch()` 判断

### 8.2 JS 约束

- 所有 `renderXxx` 函数必须在 `Pages` IIFE 内部定义
- 通过 `return { ... }` 导出，放在外部会导致 `ReferenceError`
- 事件委托优于直接绑定（避免内存泄漏）
- 不要用 `setTimeout` 重置标志位（时序问题）

### 8.3 常见坑点

1. **Pages IIFE 作用域**: `renderXxx` 必须在 IIFE 内
2. **GitHub Pages 缓存**: 修改后 1-2 分钟生效，测试时加 `?nocache=1`
3. **脚本加载顺序**: `store.js` → `ui.js` → `pages.js` → `app.js`
4. **事件委托**: 反复渲染的元素用 `container.onclick` 而非 `forEach`
5. **changelog.js 语法**: 数组条目间必须有逗号

---

## 九、版本规划

### 已完成

- **v5.0** — 基础稳定版
- **v5.1** — 悬浮按钮、三端导航设置、侧边栏页面控制、子页面修复、同步修复
- **v5.2** — 修复悬浮按钮返回后导航栏消失、帮助中心/回收站打不开、对话页滑动手势

### 待开发（v5.3+）

| 版本 | 功能 | 优先级 |
|------|------|--------|
| **v5.3** | 基础对话优化（思考面板、流式渲染优化） | P0 |
| **v5.4** | 模型目录扩展至 230+、排行榜、模型详情页 | P1 |
| **v5.5** | 目录 272、tool_calls 工具卡片、思考面板升级 | P1 |
| **v5.6** | Token 统计、翻译独立空间、SSE 30s 熔断、Esc 停止 | P1 |
| **v5.7** | 回到底部按钮、开屏页、插件库、技能库、粘贴长文本转附件、消息重编辑 | P1 |
| **v5.8** | Supabase 后端接入、邮箱验证注册、游客纯本地、管理员数据上云 | P0 |
| **v5.9** | 编辑资料页、自动同步加固、顶栏播报按钮与模式胶囊分离 | P1 |
| **v6.0** | AI 集群协作模式（Swarm / 多 Agent 调度） | P2 |
| **v6.1** | 插件市场完整版（10个前端工具插件） | P2 |
| **v6.2** | 会员中心（前端 Mock） | P3 |
| **v6.3** | Mermaid 渲染、Artifacts 代码预览 | P3 |
| **v6.4** | RAG 知识库 UI | P4 |

---

## 十、给下一个 AI 的留言

### 经验总结

1. **先读文档再动手**: 本项目有完整的 ai-context 分支文档，修改前先读 `00-START-HERE.md`
2. **Pages IIFE 是最大坑**: 所有 `renderXxx` 必须在 IIFE 内部，放在外部会导致子页面打不开
3. **版本号严格 x.y**: 绝对禁止 x.y.z，发版改 4 处
4. **测试服先行**: 所有修改先在 `aiBeta` 测试，稳定后再同步到 `AI` 生产服
5. **GitHub Pages 缓存**: 修改后等 1-2 分钟，或加 `?nocache=1`
6. **事件委托**: 子页面选项用事件委托，避免重复绑定导致内存泄漏
7. **Store 持久化**: 不要在模块加载时执行清理操作
8. **脚本顺序**: 新增模块时注意加载顺序，依赖关系不能乱

### 联系方式

- 测试服: `https://smalluniverseheng.github.io/aiBeta/`
- 生产服: `https://smalluniverseheng.github.io/AI/`
- 测试服仓库: `https://github.com/Smalluniverseheng/aiBeta`
- 生产服仓库: `https://github.com/Smalluniverseheng/AI`

### 最后更新时间

2026-07-27 — v5.2 发布


---

## 十一、管理后台（AI-admin）

### 11.1 架构

独立仓库 `Smalluniverseheng/AI-admin`，与 AI 平台共用 Supabase 数据库。

```
AI 平台 (aiBeta/5.2)          AI 管理后台 (AI-admin)
     │                                │
     └────────→ Supabase ←───────────┘
                ├── profiles
                ├── orders
                ├── agent_commissions
                └── configs
```

### 11.2 访问地址

```
https://smalluniverseheng.github.io/AI-admin/
```

### 11.3 功能模块

| 模块 | 功能 |
|------|------|
| 仪表盘 | 总用户数、代理数、今日订单、今日收入 |
| 用户管理 | 查看列表、调整角色、修改配额 |
| 代理管理 | 审核代理、查看下级、分润统计 |
| 订单管理 | 充值记录、套餐购买、订单状态 |
| 系统设置 | 会员配额、代理分润比例 |

### 11.4 账号等级体系

| 等级 | 标识 | 月配额 | 日配额 | 月费 | 功能 |
|------|------|--------|--------|------|------|
| 游客 | guest | 50,000 | 2,000 | 免费 | 基础对话，10条历史，无云同步 |
| 普通 | user | 200,000 | 10,000 | 免费 | 完整功能，50条历史 |
| 进阶 | advanced | 1,000,000 | 50,000 | ¥29 | 优先响应，200条历史 |
| VIP | vip | 5,000,000 | 200,000 | ¥99 | 专属客服，无限历史 |
| 代理 | agent | 1,000,000 | 50,000 | 免费 | 代理面板，享受分润 |
| 管理员 | admin | 无限 | 无限 | 免费 | 全部权限，管理后台 |

---

## 十二、数据库设计

### 12.1 表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `membership_levels` | 会员等级配置 | level_key, token_quota, price_month, features |
| `profiles` | 用户资料（扩展 auth.users） | role, token_quota, token_used, balance, agent_code, parent_agent_id |
| `token_usage` | Token 用量记录（按天） | user_id, date, input_tokens, output_tokens, by_model |
| `orders` | 订单（充值/升级/套餐） | order_no, type, amount, status, agent_id, commission |
| `agent_commissions` | 代理分润记录 | agent_id, order_id, rate, amount, level, status |
| `agent_relations` | 代理关系树 | ancestor_id, descendant_id, depth |
| `invite_codes` | 邀请码 | code, created_by, max_uses, reward_type, reward_value |
| `configs` | 系统配置 | key, value(JSONB) |
| `audit_logs` | 操作日志 | user_id, action, target_type, old_value, new_value |

### 12.2 自动触发器

| 触发器 | 触发条件 | 动作 |
|--------|----------|------|
| `trg_token_usage` | INSERT token_usage | 更新 profiles 累计用量 |
| `trg_process_order` | UPDATE orders status→paid | 增加余额 + 升级等级 + 计算分润 |
| `reset_daily_quota()` | 每日定时 | 重置所有用户 daily_used |
| `check_user_quota()` | 函数调用 | 检查用户是否有足够配额 |

### 12.3 代理分润流程

```
用户充值/购买 → 订单状态变为 paid
    ↓
查找用户的 parent_agent_id
    ↓
一级分润：金额 × level1%（默认 20%）
    ↓
查找代理的 parent_agent_id
    ↓
二级分润：金额 × level2%（默认 5%）
    ↓
三级分润：金额 × level3%（默认 2%）
```

### 12.4 SQL 文件位置

`AI-admin/database/schema.sql`
