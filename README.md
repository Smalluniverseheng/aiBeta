# 🔧 后端服务分支

> **这是 AI 聚合平台的「后端服务」专用分支。**
> 前端代码在 `production` 分支维护，本分支只存放后端基础设施。

---

## 分支职责

| 分支 | 用途 |
|------|------|
| `production` | 前端代码（HTML/CSS/JS），GitHub Pages 部署 |
| `preview` | 线上预览，同步 production |
| `后端` | **本分支**，Cloudflare Worker + Supabase 后端服务 |

---

## 后端架构

```
用户浏览器 ──→ Cloudflare Worker ──→ 厂商 API (OpenAI/Claude/DeepSeek/...)
                    │
                    ├──→ Supabase (Auth + PostgreSQL + pgvector)
                    │
                    └──→ Cloudflare R2 (文件存储)
```

---

## 目录结构

```
后端/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions 自动部署 Worker
├── worker/                      # Cloudflare Worker 代码
│   ├── src/
│   │   ├── index.ts            # Worker 入口
│   │   ├── router.ts           # 路由分发
│   │   └── routes/             # 各功能路由
│   │       ├── chat.ts         # AI 对话代理
│   │       ├── multi.ts        # 多模型并行
│   │       ├── search.ts       # 联网搜索
│   │       ├── image.ts        # AI 绘画
│   │       ├── vector.ts       # 向量检索 (RAG)
│   │       ├── storage.ts      # 文件上传
│   │       ├── keys.ts         # API Key 管理
│   │       └── health.ts       # 健康检查
│   ├── wrangler.toml           # Worker 配置
│   └── package.json
├── supabase/
│   └── migrations/
│       └── 001_initial.sql     # 数据库初始化 (6表 + RLS + pgvector)
├── js/                          # 前端对接参考代码
│   ├── api-v2.js               # 前端调用 Worker 的 API 客户端
│   └── api-keys.js             # API Key 管理前端逻辑
└── .ai-handoff/                 # 项目交接文档
```

---

## 部署

### 手动部署

```bash
cd worker
npm install -g wrangler@3.65.0
wrangler deploy
```

### 自动部署

推送到本分支 → GitHub Actions 自动部署到 Cloudflare。

---

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/chat` | POST | 单模型对话 (SSE) |
| `/api/v1/chat/multi` | POST | 多模型并行 (SSE) |
| `/api/v1/search` | POST | 联网搜索 (Tavily) |
| `/api/v1/image` | POST | AI 绘画 |
| `/api/v1/vector/search` | POST | 向量检索 (RAG) |
| `/api/v1/storage/upload` | POST | 文件上传 |
| `/api/v1/keys` | GET/POST | API Key 管理 |
| `/api/v1/health` | GET | 健康检查 |

---

## 环境变量

在 Cloudflare Worker 设置以下 Secrets：

```
SUPABASE_URL
SUPABASE_SERVICE_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
GOOGLE_API_KEY
DEEPSEEK_API_KEY
MOONSHOT_API_KEY
ALIBABA_API_KEY
BAICHUAN_API_KEY
ZHIPU_API_KEY
MINIMAX_API_KEY
SPARK_API_KEY
ERNIE_API_KEY
HUNYUAN_API_KEY
DOUBAO_API_KEY
QWEN_API_KEY
COZE_API_KEY
GROQ_API_KEY
COHERE_API_KEY
MISTRAL_API_KEY
PERPLEXITY_API_KEY
TOGETHER_API_KEY
FIREWORKS_API_KEY
NOVITA_API_KEY
SILICONFLOW_API_KEY
TAVILY_API_KEY
```

---

*本分支由 AI 维护，人类请勿直接修改前端相关文件。*
