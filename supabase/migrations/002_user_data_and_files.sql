-- ==========================================
-- Supabase 迁移 002: 用户数据扩展 + 文件存储 + 分级管理
-- ==========================================

-- 1. 扩展 profiles 表（用户头像、介绍、分级）
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS bio TEXT,                    -- 个人介绍
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'      -- 角色: admin/user/guest
    CHECK (role IN ('admin', 'user', 'guest'));

-- 2. 扩展 user_settings 表（更多设置项）
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS font_size TEXT DEFAULT 'medium',     -- 字号: small/medium/large
  ADD COLUMN IF NOT EXISTS message_density TEXT DEFAULT 'normal', -- 密度: compact/normal/comfortable
  ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT TRUE,        -- 自动同步开关
  ADD COLUMN IF NOT EXISTS sync_interval INT DEFAULT 30,          -- 自动同步间隔(秒)
  ADD COLUMN IF NOT EXISTS default_model TEXT,                    -- 默认模型
  ADD COLUMN IF NOT EXISTS default_mode TEXT DEFAULT 'single',    -- 默认模式
  ADD COLUMN IF NOT EXISTS shortcuts JSONB DEFAULT '{}',          -- 快捷键配置
  ADD COLUMN IF NOT EXISTS custom_themes JSONB DEFAULT '[]',     -- 自定义主题
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;             -- 最后同步时间

-- 3. 创建文件存储表（记录文件元数据，实际文件存 R2/Storage）
CREATE TABLE IF NOT EXISTS public.files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  chat_id UUID REFERENCES public.chats ON DELETE SET NULL,       -- 关联对话（可选）
  message_id UUID REFERENCES public.messages ON DELETE SET NULL, -- 关联消息（可选）
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,        -- image/pdf/audio/video/txt/markdown
  file_size INT NOT NULL,         -- 字节
  mime_type TEXT,
  storage_provider TEXT DEFAULT 'r2' CHECK (storage_provider IN ('r2', 'supabase')), -- 存储位置
  storage_path TEXT NOT NULL,     -- 存储路径（R2 bucket 路径或 Storage 路径）
  public_url TEXT,                -- 公开访问 URL
  thumbnail_url TEXT,             -- 缩略图 URL（图片用）
  width INT,                      -- 图片宽度
  height INT,                     -- 图片高度
  duration INT,                   -- 音频/视频时长（秒）
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_chat_id ON public.files(chat_id);
CREATE INDEX IF NOT EXISTS idx_files_message_id ON public.files(message_id);

-- 4. 创建系统配置表（管理员用）
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 创建操作日志表（审计用）
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  action TEXT NOT NULL,           -- login/logout/create_chat/delete_chat/upload_file/sync/settings_change
  target_type TEXT,               -- chat/message/file/user/settings
  target_id TEXT,                 -- 目标ID
  details JSONB,                  -- 详细数据
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- 6. RLS 策略
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的文件
CREATE POLICY "Users own files" ON public.files FOR ALL USING (auth.uid() = user_id);

-- 用户只能查看自己的操作日志（管理员可看全部）
CREATE POLICY "Users view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);

-- 7. 管理员权限函数
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = user_uuid;
  RETURN user_role = 'admin';
END;
$$;

-- 8. 管理员可查看所有数据的策略
CREATE POLICY "Admin view all chats" ON public.chats FOR SELECT USING (is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Admin view all messages" ON public.messages FOR SELECT USING (is_admin(auth.uid()) OR chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid()));
CREATE POLICY "Admin view all files" ON public.files FOR SELECT USING (is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Admin view all audit logs" ON public.audit_logs FOR SELECT USING (is_admin(auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Admin view all profiles" ON public.profiles FOR SELECT USING (is_admin(auth.uid()) OR id = auth.uid());

-- 9. 插入默认系统配置
INSERT INTO public.system_config (key, value, description) VALUES
  ('max_file_size', '{"value": 20971520}', '最大上传文件大小（20MB）'),
  ('allowed_file_types', '{"value": ["image/jpeg","image/png","image/webp","image/gif","application/pdf","text/plain","text/markdown","audio/mpeg","audio/wav","video/mp4"]}', '允许上传的文件类型'),
  ('default_models', '{"value": {"single": "deepseek-chat", "multi": ["deepseek-chat", "moonshot-v1-8k"], "debate": "deepseek-chat", "collab": "deepseek-chat"}}', '各模式默认模型'),
  ('rate_limits', '{"value": {"guest": 10, "user": 100, "admin": 9999}}', '每分钟请求限制'),
  ('storage_quota', '{"value": {"guest": 0, "user": 1073741824, "admin": 10737418240}}', '存储配额（字节）')
ON CONFLICT (key) DO NOTHING;
