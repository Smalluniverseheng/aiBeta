# 【终极执行指令】第三方科技 AI 聚合平台 — Supabase 后端全量接入

> 接收方 AI 必须按此指令逐条执行，不可跳过任何步骤。执行完成后输出一份完整的交付报告。
> 本指令包含：后台配置、数据库 Schema、前端改造、安全策略、付费提醒、测试验证。

---

## 零、项目基本信息（执行前确认）

| 项 | 值 | 备注 |
|---|---|---|
| 前端地址 | `https://smalluniverseheng.github.io/AI/` | GitHub Pages 纯静态托管 |
| Supabase 项目 URL | `https://mxvvxlgjzeboktufumxbp.supabase.co` | 已创建 |
| Publishable Key | `sb_publishable_WzUzAQK5cOEsn7QwFB2cAw_ubIkG7RJ` | 前端用，可公开 |
| Secret Key | **请用户提供 `kimi_ai` 对应的完整 Key** | 后端管理用，严禁写入前端代码 |
| 区域 | ap-south-1 (Mumbai) | 国内延迟 150-300ms |
| 套餐 | **Free Tier** | 见下方付费提醒 |

---

## 一、付费与额度提醒清单（执行前必须告知用户）

⚠️ **以下项目涉及费用或额度限制，执行前必须确认用户知情：**

| 项目 | 免费额度 | 超限后果 | 建议 |
|------|---------|---------|------|
| **Supabase 数据库** | 500MB | 写入失败 | 定期清理旧备份，消息内容长期保留但附件走 Storage |
| **Supabase Storage** | 1GB | 上传失败 | 图片上传前压缩到 1MB 以内，AI 绘画图片存 URL 不存原图 |
| **Supabase 并发连接** | 60 个 | 新连接被拒绝 | 前端连接池管理，页面关闭时释放连接 |
| **Supabase API 请求** | 无限（有速率限制） | 429 Too Many Requests | 防抖写入，批量操作，本地缓存 5 分钟 |
| **Supabase 邮件发送** | 免费套餐有限额 | 验证邮件/重置邮件发不出去 | 已建议关闭邮箱验证，如需开启需配置 SMTP |
| **23 家厂商 API Key** | 用户自备 | 按各厂商定价计费 | 调用逻辑不变，仅增加用量记录到 Supabase |
| **未来升级** | 当前 Free | 数据量大了需 $25/月 Pro | 代码已预留自托管迁移路径，未来可迁到黑鲨4 Pro |

**用户确认：我已知晓以上额度限制，同意按 Free Tier 方案执行。**

---

## 二、后台自动配置（使用 Secret Key）

通过 Supabase Management API 或 SQL Editor 完成以下配置。如使用 Management API，Header 需携带：`Authorization: Bearer <Secret Key>`

### 2.1 关闭邮箱验证（简化注册流程）
```bash
# 通过 Management API PATCH 项目配置
PATCH https://api.supabase.com/v1/projects/mxvvxlgjzeboktufumxbp/config/auth
Headers: Authorization: Bearer <Secret Key>
Body:
{
  "mailer_autoconfirm": true,
  "security_manual_linking_enabled": false
}
```
或手动路径：Authentication → Providers → Email → **Disable email confirmations** → Save

### 2.2 创建 Storage Bucket
```bash
POST https://mxvvxlgjzeboktufumxbp.supabase.co/storage/v1/bucket
Headers: Authorization: Bearer <Secret Key>
Body:
{
  "id": "user-files",
  "name": "user-files",
  "public": false,
  "file_size_limit": 52428800,
  "allowed_mime_types": ["image/*", "application/pdf", "text/*"]
}
```
或手动路径：Storage → New bucket → Name: `user-files` → Public: off → File size limit: 50MB

### 2.3 启用数据库扩展
在 SQL Editor 执行：
```sql
-- 确认已启用
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS pg_graphql;
```

### 2.4 确认 Realtime 白名单
在 SQL Editor 执行：
```sql
-- 确认 messages 表在 realtime 发布中
SELECT * FROM pg_publication_tables WHERE publication_name = 'supabase_realtime';
-- 如缺少，执行：
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
```

---

## 三、完整数据库 Schema（一次性执行）

在 SQL Editor 新建 Query，复制以下全部 SQL，一次性执行：

```sql
-- ============================================================
-- 第三方科技 AI 聚合平台 — 完整数据库 Schema
-- 包含：基础表、扩展表、索引、RLS、初始数据
-- ============================================================

-- -----------------------------------------------------------
-- 1. 基础表（已存在则跳过）
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title       text DEFAULT '新对话',
  model_leader text DEFAULT 'kimi',
  created_at  timestamptz DEFAULT timezone('utc'::text, now()),
  updated_at  timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.messages (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id  uuid REFERENCES public.conversations ON DELETE CASCADE NOT NULL,
  role             text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          text NOT NULL,
  model            text,
  provider         text,
  tokens_used      integer DEFAULT 0,
  latency_ms       integer,
  is_error         boolean DEFAULT false,
  attachments      jsonb,
  created_at       timestamptz DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------
-- 2. 扩展表（新增）
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  theme      text DEFAULT 'dark',
  language   text DEFAULT 'zh-CN',
  tts_engine text DEFAULT 'default',
  tts_voice  text,
  tts_speed  numeric DEFAULT 1.0,
  stt_engine text DEFAULT 'default',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.token_usage (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  provider    text NOT NULL,
  model       text NOT NULL,
  prompt_tokens     integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens      integer DEFAULT 0,
  cost_usd          numeric DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custom_roles (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  description text,
  system_prompt text NOT NULL,
  icon        text,
  is_builtin  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cloud_backups (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  backup_name text DEFAULT '自动备份',
  backup_data jsonb NOT NULL,
  size_bytes  integer,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.encrypted_api_keys (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  provider    text NOT NULL,
  encrypted_key text NOT NULL,
  iv          text NOT NULL,
  salt        text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- -----------------------------------------------------------
-- 3. RLS 安全策略（全部启用）
-- -----------------------------------------------------------
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_api_keys ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（避免重复报错）
DROP POLICY IF EXISTS "Users own their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users own their messages" ON public.messages;
DROP POLICY IF EXISTS "Users own their settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users own their usage" ON public.token_usage;
DROP POLICY IF EXISTS "Users own their roles" ON public.custom_roles;
DROP POLICY IF EXISTS "Users own their backups" ON public.cloud_backups;
DROP POLICY IF EXISTS "Users own their encrypted keys" ON public.encrypted_api_keys;

CREATE POLICY "Users own their conversations"
  ON public.conversations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their messages"
  ON public.messages FOR ALL USING (conversation_id IN (
    SELECT id FROM public.conversations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users own their settings"
  ON public.user_settings FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their usage"
  ON public.token_usage FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their roles"
  ON public.custom_roles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their backups"
  ON public.cloud_backups FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their encrypted keys"
  ON public.encrypted_api_keys FOR ALL USING (auth.uid() = user_id);

-- -----------------------------------------------------------
-- 4. 索引优化（性能关键）
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messages_conv_created 
  ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_user_created 
  ON public.token_usage(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_backups_user_created 
  ON public.cloud_backups(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_roles_user 
  ON public.custom_roles(user_id);

-- -----------------------------------------------------------
-- 5. 初始数据（可选）
-- -----------------------------------------------------------
INSERT INTO public.custom_roles (name, system_prompt, icon, is_builtin, user_id)
SELECT '通用助手', '你是一个 helpful 的 AI 助手。', '🤖', true, '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM public.custom_roles WHERE is_builtin = true);
```

---

## 四、前端改造完整代码

### 4.1 新增文件：`supabase-client.js`（所有 Supabase 调用封装）

```javascript
// supabase-client.js — 所有数据库操作封装，未来迁移自托管时只改此文件
const SUPABASE_URL = 'https://mxvvxlgjzeboktufumxbp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WzUzAQK5cOEsn7QwFB2cAw_ubIkG7RJ';

const supabase = supabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== 认证 ==========
const Auth = {
  async getUser() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ?? null;
  },
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { user: data?.user, error };
  },
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { user: data?.user, error };
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null);
    });
  }
};

// ========== 对话 ==========
const Conversations = {
  async create(title = '新对话') {
    const user = await Auth.getUser();
    if (!user) return { error: '未登录' };
    const { data, error } = await supabase.from('conversations')
      .insert({ user_id: user.id, title }).select().single();
    return { data, error };
  },
  async list() {
    const user = await Auth.getUser();
    if (!user) return { data: [] };
    const { data, error } = await supabase.from('conversations')
      .select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    return { data: data || [], error };
  },
  async delete(id) {
    return supabase.from('conversations').delete().eq('id', id);
  }
};

// ========== 消息（分页加载）==========
const Messages = {
  async send(conversationId, content, role = 'user', meta = {}) {
    const { data, error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role,
      content,
      model: meta.model,
      provider: meta.provider,
      tokens_used: meta.tokens,
      latency_ms: meta.latency
    }).select().single();
    return { data, error };
  },
  async load(conversationId, page = 0, pageSize = 50) {
    const { data, error } = await supabase.from('messages')
      .select('*').eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    return { data: data?.reverse() || [], hasMore: data?.length === pageSize, error };
  },
  subscribe(conversationId, onInsert) {
    return supabase.channel('msg-' + conversationId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'conversation_id=eq.' + conversationId
      }, (payload) => onInsert(payload.new))
      .subscribe();
  }
};

// ========== 设置 ==========
const Settings = {
  async get() {
    const user = await Auth.getUser();
    if (!user) return { data: null };
    const { data, error } = await supabase.from('user_settings')
      .select('*').eq('user_id', user.id).single();
    return { data, error };
  },
  async update(partial) {
    const user = await Auth.getUser();
    if (!user) return { error: '未登录' };
    const { data, error } = await supabase.from('user_settings')
      .upsert({ user_id: user.id, ...partial, updated_at: new Date().toISOString() });
    return { data, error };
  }
};

// ========== Token 用量 ==========
const Usage = {
  async record(provider, model, prompt, completion, cost) {
    const user = await Auth.getUser();
    if (!user) return;
    await supabase.from('token_usage').insert({
      user_id: user.id, provider, model,
      prompt_tokens: prompt, completion_tokens: completion,
      total_tokens: prompt + completion, cost_usd: cost
    });
  },
  async stats() {
    const user = await Auth.getUser();
    if (!user) return { data: [] };
    const { data } = await supabase.from('token_usage')
      .select('provider, model, total_tokens, cost_usd, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000);
    return { data: data || [] };
  }
};

// ========== 云端备份 ==========
const Backups = {
  async save(name, jsonData) {
    const user = await Auth.getUser();
    if (!user) return { error: '未登录' };
    // 清理旧备份（只保留最近 20 份）
    await supabase.from('cloud_backups').delete()
      .eq('user_id', user.id)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    const { data, error } = await supabase.from('cloud_backups').insert({
      user_id: user.id, backup_name: name,
      backup_data: jsonData, size_bytes: JSON.stringify(jsonData).length
    }).select().single();
    return { data, error };
  },
  async list() {
    const user = await Auth.getUser();
    if (!user) return { data: [] };
    const { data } = await supabase.from('cloud_backups')
      .select('id, backup_name, size_bytes, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false });
    return { data: data || [] };
  },
  async restore(id) {
    const { data, error } = await supabase.from('cloud_backups')
      .select('backup_data').eq('id', id).single();
    return { data: data?.backup_data, error };
  }
};

// ========== 加密 API Key（可选）==========
const CryptoUtils = {
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const mat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      mat, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  },
  async encrypt(plain, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(ct))),
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt))
    };
  },
  async decrypt(encObj, password) {
    const { encrypted, iv, salt } = encObj;
    const key = await this.deriveKey(password, Uint8Array.from(atob(salt), c => c.charCodeAt(0)));
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Uint8Array.from(atob(iv), c => c.charCodeAt(0)) },
      key, Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
    );
    return new TextDecoder().decode(pt);
  }
};

const EncryptedKeys = {
  async upload(provider, plainKey, password) {
    const user = await Auth.getUser();
    if (!user) return { error: '未登录' };
    const enc = await CryptoUtils.encrypt(plainKey, password);
    const { error } = await supabase.from('encrypted_api_keys').upsert({
      user_id: user.id, provider,
      encrypted_key: enc.encrypted, iv: enc.iv, salt: enc.salt,
      updated_at: new Date().toISOString()
    });
    return { error };
  },
  async download(provider, password) {
    const user = await Auth.getUser();
    if (!user) return { data: null, error: '未登录' };
    const { data, error } = await supabase.from('encrypted_api_keys')
      .select('*').eq('user_id', user.id).eq('provider', provider).single();
    if (error || !data) return { data: null, error };
    try {
      const plain = await CryptoUtils.decrypt({
        encrypted: data.encrypted_key, iv: data.iv, salt: data.salt
      }, password);
      return { data: plain, error: null };
    } catch { return { data: null, error: '解密失败，密码错误' }; }
  }
};

// ========== 离线队列 ==========
const OfflineQueue = {
  queue: JSON.parse(localStorage.getItem('sb_offline_queue') || '[]'),
  push(op) {
    this.queue.push({ ...op, timestamp: Date.now() });
    localStorage.setItem('sb_offline_queue', JSON.stringify(this.queue));
  },
  async flush() {
    if (!navigator.onLine || this.queue.length === 0) return;
    const copy = [...this.queue];
    this.queue = [];
    localStorage.setItem('sb_offline_queue', '[]');
    for (const op of copy) {
      try { await supabase.from(op.table)[op.action](op.data); }
      catch { this.queue.push(op); } // 失败的重回队列
    }
  }
};
window.addEventListener('online', () => OfflineQueue.flush());

// 导出
window.SB = { supabase, Auth, Conversations, Messages, Settings, Usage, Backups, EncryptedKeys, OfflineQueue, CryptoUtils };
```

### 4.2 改造：在现有 HTML 中引入

在 `<head>` 中，**在所有其他 JS 之前**加入：
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="supabase-client.js"></script>
```

### 4.3 改造：登录弹窗 UI（新增，不破坏现有布局）

在现有页面中添加一个隐藏的登录弹窗，样式与现有暗色主题一致：
- 背景：`#0d0d0d`
- 主按钮：`#3ecf8e`
- 输入框：`#1a1a1a` + 边框 `#333`
- 触发位置：右上角用户区域，或设置页底部

```html
<!-- 登录弹窗 -->
<div id="login-modal" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:999;display:flex;align-items:center;justify-content:center;">
  <div style="background:#0d0d0d;border:1px solid #333;border-radius:16px;padding:24px;width:90%;max-width:360px;">
    <h3 style="margin:0 0 16px;color:#fff;">登录 / 注册</h3>
    <input id="login-email" type="email" placeholder="邮箱" style="width:100%;padding:12px;margin:6px 0;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#fff;box-sizing:border-box;">
    <input id="login-password" type="password" placeholder="密码" style="width:100%;padding:12px;margin:6px 0;background:#1a1a1a;border:1px solid #333;border-radius:8px;color:#fff;box-sizing:border-box;">
    <button onclick="handleLogin()" style="width:100%;padding:12px;margin:8px 0;background:#3ecf8e;border:none;border-radius:8px;color:#000;font-weight:bold;cursor:pointer;">登录</button>
    <button onclick="handleRegister()" style="width:100%;padding:12px;margin:4px 0;background:#333;border:none;border-radius:8px;color:#fff;cursor:pointer;">注册</button>
    <p id="login-msg" style="color:#ff6b6b;font-size:13px;margin:8px 0 0;"></p>
    <button onclick="closeLogin()" style="position:absolute;top:12px;right:12px;background:none;border:none;color:#888;font-size:20px;cursor:pointer;">×</button>
  </div>
</div>

<script>
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const { user, error } = await SB.Auth.signIn(email, password);
  if (error) { document.getElementById('login-msg').textContent = error.message; return; }
  closeLogin(); initUserUI(user);
}
async function handleRegister() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const { error } = await SB.Auth.signUp(email, password);
  document.getElemen