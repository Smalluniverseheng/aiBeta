import { json } from '../router';

// 查询会员信息
export async function getMembershipRoute(request: Request, env: any): Promise<Response> {
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

    // 查询会员信息
    const { data: membership, error: memError } = await env.supabase
      .from('user_memberships')
      .select('*, plan:membership_plans(*)')
      .eq('user_id', userId)
      .single();

    if (memError && memError.code !== 'PGRST116') {
      return json({ error: '查询失败: ' + memError.message }, 500);
    }

    // 如果没有会员记录，创建默认游客会员
    if (!membership) {
      const { data: newMem, error: createError } = await env.supabase
        .from('user_memberships')
        .insert({ user_id: userId, tier: 'guest' })
        .select('*, plan:membership_plans(*)')
        .single();

      if (createError) {
        return json({ error: '创建会员记录失败: ' + createError.message }, 500);
      }
      return json({ membership: newMem });
    }

    // 检查是否过期
    if (membership.expires_at && new Date(membership.expires_at) < new Date()) {
      // 过期降级为游客
      await env.supabase
        .from('user_memberships')
        .update({ tier: 'guest', is_active: false })
        .eq('user_id', userId);
      membership.tier = 'guest';
      membership.is_active = false;
    }

    return json({ membership });
  } catch (e: any) {
    return json({ error: e.message || '查询失败' }, 500);
  }
}

// 更新会员信息（手动调整，通常由卡密激活触发）
export async function updateMembershipRoute(request: Request, env: any): Promise<Response> {
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

    const { tier, storage_used } = await request.json();

    const updates: any = { updated_at: new Date().toISOString() };
    if (tier) updates.tier = tier;
    if (typeof storage_used === 'number') updates.storage_used = storage_used;

    const { data, error } = await env.supabase
      .from('user_memberships')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return json({ error: '更新失败: ' + error.message }, 500);
    }

    return json({ success: true, membership: data });
  } catch (e: any) {
    return json({ error: e.message || '更新失败' }, 500);
  }
}
