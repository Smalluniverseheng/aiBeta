import { json } from '../router';

// 获取家庭信息
export async function getFamilyRoute(request: Request, env: any): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: '未登录' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await env.supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: '登录已过期' }, 401);
    }
    const userId = userData.user.id;

    // 查询用户所在的家庭
    const { data: memberData, error: memberError } = await env.supabase
      .from('family_members')
      .select('*, family:family_groups(*)')
      .eq('user_id', userId)
      .single();

    if (memberError && memberError.code !== 'PGRST116') {
      return json({ error: '查询失败: ' + memberError.message }, 500);
    }

    if (!memberData) {
      return json({ family: null });
    }

    // 查询家庭成员
    const { data: members, error: membersError } = await env.supabase
      .from('family_members')
      .select('*, user:profiles(id, display_name, avatar_url)')
      .eq('family_id', memberData.family_id);

    if (membersError) {
      return json({ error: '查询成员失败: ' + membersError.message }, 500);
    }

    return json({
      family: memberData.family,
      members: members || [],
      myRole: memberData.role,
    });
  } catch (e: any) {
    return json({ error: e.message || '查询失败' }, 500);
  }
}

// 创建家庭
export async function createFamilyRoute(request: Request, env: any): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: '未登录' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await env.supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: '登录已过期' }, 401);
    }
    const userId = userData.user.id;

    // 检查会员等级（恒星及以上）
    const { data: membership } = await env.supabase
      .from('user_memberships')
      .select('tier')
      .eq('user_id', userId)
      .single();

    const allowedTiers = ['star', 'galaxy', 'universe'];
    if (!membership || !allowedTiers.includes(membership.tier)) {
      return json({ error: '恒星及以上会员才能创建家庭' }, 403);
    }

    // 检查是否已在家庭中
    const { data: existing } = await env.supabase
      .from('family_members')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return json({ error: '您已在家庭中' }, 400);
    }

    const { name } = await request.json();

    // 创建家庭
    const { data: family, error: familyError } = await env.supabase
      .from('family_groups')
      .insert({ owner_id: userId, name: name || '我的家庭' })
      .select()
      .single();

    if (familyError) {
      return json({ error: '创建失败: ' + familyError.message }, 500);
    }

    // 添加自己为成员
    await env.supabase
      .from('family_members')
      .insert({ family_id: family.id, user_id: userId, role: 'owner' });

    return json({ success: true, family });
  } catch (e: any) {
    return json({ error: e.message || '创建失败' }, 500);
  }
}

// 添加家庭成员
export async function addFamilyMemberRoute(request: Request, env: any): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: '未登录' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await env.supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: '登录已过期' }, 401);
    }
    const userId = userData.user.id;

    const { family_id, user_id, storage_allocated } = await request.json();

    // 检查是否是家庭所有者
    const { data: family } = await env.supabase
      .from('family_groups')
      .select('*')
      .eq('id', family_id)
      .eq('owner_id', userId)
      .single();

    if (!family) {
      return json({ error: '无权限' }, 403);
    }

    // 检查成员数量
    const { count } = await env.supabase
      .from('family_members')
      .select('*', { count: 'exact', head: true })
      .eq('family_id', family_id);

    if ((count || 0) >= (family.member_limit || 4)) {
      return json({ error: '家庭人数已达上限' }, 403);
    }

    const { data, error } = await env.supabase
      .from('family_members')
      .insert({
        family_id,
        user_id,
        storage_allocated: storage_allocated || 0,
      })
      .select()
      .single();

    if (error) {
      return json({ error: '添加失败: ' + error.message }, 500);
    }

    return json({ success: true, member: data });
  } catch (e: any) {
    return json({ error: e.message || '添加失败' }, 500);
  }
}

// 移除家庭成员
export async function removeFamilyMemberRoute(request: Request, env: any): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: '未登录' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await env.supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: '登录已过期' }, 401);
    }
    const userId = userData.user.id;

    const { family_id, member_user_id } = await request.json();

    // 检查权限
    const { data: family } = await env.supabase
      .from('family_groups')
      .select('*')
      .eq('id', family_id)
      .eq('owner_id', userId)
      .single();

    if (!family) {
      return json({ error: '无权限' }, 403);
    }

    const { error } = await env.supabase
      .from('family_members')
      .delete()
      .eq('family_id', family_id)
      .eq('user_id', member_user_id);

    if (error) {
      return json({ error: '移除失败: ' + error.message }, 500);
    }

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || '移除失败' }, 500);
  }
}
