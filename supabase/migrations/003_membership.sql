-- ==========================================
-- Supabase 迁移 003: 会员体系 + 卡密 + 设备 + 家庭共享
-- ==========================================

-- 1. 会员计划配置表（管理员维护）
CREATE TABLE IF NOT EXISTS public.membership_plans (
  tier TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  storage_quota BIGINT DEFAULT 0,        -- 存储配额（字节）
  device_limit INT DEFAULT 1,            -- 设备上限
  model_access JSONB DEFAULT '[]',       -- 可访问模型列表
  features JSONB DEFAULT '{}',           -- 功能开关
  monthly_price INT DEFAULT 0,           -- 月费（分）
  yearly_price INT DEFAULT 0,            -- 年费（分）
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认会员计划
INSERT INTO public.membership_plans (tier, name, description, storage_quota, device_limit, model_access, features, monthly_price, yearly_price) VALUES
  ('guest', '游客', '基础体验', 10485760, 1, '["deepseek-chat","moonshot-v1-8k"]', '{"webSearch":false,"voice":false,"sync":false,"proxy":false,"export":false}', 0, 0),
  ('satellite', '卫星会员', '入门体验', 104857600, 2, '["deepseek-chat","moonshot-v1-8k","gpt-4o-mini"]', '{"webSearch":true,"voice":true,"sync":true,"proxy":false,"export":true}', 1500, 15000),
  ('planet', '行星会员', '进阶体验', 536870912, 3, '["deepseek-chat","moonshot-v1-8k","gpt-4o-mini","claude-3-haiku"]', '{"webSearch":true,"voice":true,"sync":true,"proxy":true,"export":true}', 3000, 30000),
  ('star', '恒星会员', '高级体验', 1073741824, 5, '["deepseek-chat","moonshot-v1-8k","gpt-4o","claude-3-sonnet"]', '{"webSearch":true,"voice":true,"sync":true,"proxy":true,"export":true,"family":true}', 6000, 60000),
  ('galaxy', '星系会员', '专业体验', 5368709120, 8, '["deepseek-chat","moonshot-v1-8k","gpt-4o","claude-3-sonnet","gemini-pro"]', '{"webSearch":true,"voice":true,"sync":true,"proxy":true,"export":true,"family":true}', 12000, 120000),
  ('universe', '宇宙会员', '终极体验', 10737418240, 999, '["*"]', '{"webSearch":true,"voice":true,"sync":true,"proxy":true,"export":true,"family":true}', 30000, 300000)
ON CONFLICT (tier) DO NOTHING;

-- 2. 卡密表
CREATE TABLE IF NOT EXISTS public.card_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,             -- 50位卡密
  type TEXT NOT NULL CHECK (type IN ('plan','upgrade','extension')), -- plan:新购 upgrade:升级 extension:续费
  tier TEXT NOT NULL REFERENCES public.membership_plans(tier),
  duration_months INT NOT NULL DEFAULT 1, -- 有效月数
  is_used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES auth.users ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_keys_code ON public.card_keys(code);
CREATE INDEX IF NOT EXISTS idx_card_keys_used ON public.card_keys(is_used);

-- 3. 用户会员表
CREATE TABLE IF NOT EXISTS public.user_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  tier TEXT NOT NULL REFERENCES public.membership_plans(tier) DEFAULT 'guest',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                -- NULL 表示永久
  storage_used BIGINT DEFAULT 0,         -- 已用存储（字节）
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_memberships_user_id ON public.user_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_expires ON public.user_memberships(expires_at);

-- 4. 设备表
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  device_id TEXT NOT NULL,               -- 设备唯一标识
  device_name TEXT,                      -- 设备名称
  device_type TEXT DEFAULT 'unknown',    -- mobile/desktop/tablet
  is_trusted BOOLEAN DEFAULT FALSE,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON public.user_devices(device_id);

-- 5. 家庭共享表
CREATE TABLE IF NOT EXISTS public.family_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT DEFAULT '我的家庭',
  storage_shared BIGINT DEFAULT 0,       -- 共享存储额度（字节）
  member_limit INT DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 家庭成员表
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES public.family_groups ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner','member')),
  storage_allocated BIGINT DEFAULT 0,    -- 分配给该成员的存储
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members(user_id);

-- 7. RLS 策略
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- 会员计划公开可读
CREATE POLICY "Membership plans public read" ON public.membership_plans FOR SELECT USING (TRUE);

-- 卡密只有管理员可操作，用户只能验证（通过 RPC/函数）
CREATE POLICY "Card keys admin only" ON public.card_keys FOR ALL USING (is_admin(auth.uid()));

-- 用户只能看自己的会员信息
CREATE POLICY "Users own membership" ON public.user_memberships FOR ALL USING (auth.uid() = user_id);

-- 用户只能管理自己的设备
CREATE POLICY "Users own devices" ON public.user_devices FOR ALL USING (auth.uid() = user_id);

-- 家庭组成员可见
CREATE POLICY "Family members visible" ON public.family_groups FOR SELECT USING (
  owner_id = auth.uid() OR id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
);
CREATE POLICY "Family owner manage" ON public.family_groups FOR ALL USING (owner_id = auth.uid());

-- 家庭成员可见
CREATE POLICY "Family members visible" ON public.family_members FOR SELECT USING (
  user_id = auth.uid() OR family_id IN (SELECT id FROM public.family_groups WHERE owner_id = auth.uid())
);
CREATE POLICY "Family owner manage members" ON public.family_members FOR ALL USING (
  family_id IN (SELECT id FROM public.family_groups WHERE owner_id = auth.uid())
);

-- 8. 触发器：更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_memberships_updated_at ON public.user_memberships;
CREATE TRIGGER update_user_memberships_updated_at
  BEFORE UPDATE ON public.user_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_family_groups_updated_at ON public.family_groups;
CREATE TRIGGER update_family_groups_updated_at
  BEFORE UPDATE ON public.family_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
