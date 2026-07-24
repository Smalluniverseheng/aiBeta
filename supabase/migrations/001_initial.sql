-- ==========================================
-- Supabase 初始化迁移 (001_initial.sql)
-- ==========================================

-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 用户扩展表（Supabase Auth 管理用户）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 对话表
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT '新对话',
  model_id TEXT NOT NULL,
  mode TEXT DEFAULT 'single', -- single/multi/debate/collab
  system_prompt TEXT,
  preset_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 消息表
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  thinking TEXT,
  model_id TEXT,
  batch_id TEXT,
  collab_role TEXT,
  stage TEXT,
  tool_calls JSONB,
  error TEXT,
  attachments JSONB,
  parent_id UUID REFERENCES public.messages(id),
  branch_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 知识库文档表
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  file_path TEXT,
  file_type TEXT,
  chunk_count INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 文档分块表（RAG 用）
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  chunk_index INT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  theme TEXT DEFAULT 'system',
  language TEXT DEFAULT 'zh-CN',
  voice_engine TEXT DEFAULT 'browser',
  voice_speed FLOAT DEFAULT 1.0,
  web_search_enabled BOOLEAN DEFAULT FALSE,
  thinking_enabled BOOLEAN DEFAULT FALSE,
  tools_enabled JSONB DEFAULT '["polish","summary","codeExplain"]',
  api_keys JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 向量索引
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON public.document_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);

-- RLS 策略
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "Users own chats" ON public.chats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own messages" ON public.messages FOR ALL USING (chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid()));
CREATE POLICY "Users own documents" ON public.documents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own chunks" ON public.document_chunks FOR ALL USING (document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid()));
CREATE POLICY "Users own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own profiles" ON public.profiles FOR ALL USING (auth.uid() = id);

-- 向量搜索 RPC 函数
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  filter_document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  document_title TEXT,
  content TEXT,
  chunk_index INT,
  similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id,
    dc.document_id,
    d.title AS document_title,
    dc.content,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE (filter_document_ids IS NULL OR dc.document_id = ANY(filter_document_ids))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
