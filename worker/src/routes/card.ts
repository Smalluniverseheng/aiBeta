import { json } from '../router';

// 卡密验证（预检查，不消耗）
export async function verifyCardRoute(request: Request, env: any): Promise<Response> {
  try {
    const { code } = await request.json();
    if (!code || typeof code !== 'string') {
      return json({ error: '卡密不能为空' }, 400);
    }

    const { data, error } = await env.supabase
      .from('card_keys')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      return json({ valid: false, error: '卡密不存在' });
    }

    if (data.is_used) {
      return json({ valid: false, error: '卡密已被使用' });
    }

    return json({
      valid: true,
      type: data.type,
      tier: data.tier,
      duration_months: data.duration_months,
    });
  } catch (e: any) {
    return json({ error: e.message || '验证失败' }, 500);
  }
}

// 卡密激活（消耗卡密，升级/续费会员）
export async function redeemCardRoute(request: Request, env: any): Promise<Response> {
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

    const { code } = await request.json();
    if (!code || typeof code !== 'string') {
      return json({ error: '卡密不能为空' }, 400);
    }

    // 查询卡密
    const { data: card, error: cardError } = await env.supabase
      .from('card_keys')
      .select('*')
      .eq('code', code)
      .single();

    if (cardError || !card) {
      return json({ error: '卡密不存在' }, 404);
    }
    if (card.is_used) {
      return json({ error: '卡密已被使用' }, 400);
    }

    // 查询当前会员
    const { data: currentMembership } = await env.supabase
      .from('user_memberships')
      .select('*')
      .eq('user_id', userId)
      .single();

    const now = new Date();
    let newTier = card.tier;
    let newExpiresAt: Date;

    // 计算新的过期时间
    const durationMs = card.duration_months * 30 * 24 * 60 * 60 * 1000;

    if (card.type === 'extension' && currentMembership) {
      // 续费：在当前过期时间上累加
      const baseDate = currentMembership.expires_at ? new Date(currentMembership.expires_at) : now;
      newExpiresAt = new Date(baseDate.getTime() + durationMs);
    } else {
      // 新购/升级：从当前时间开始
      newExpiresAt = new Date(now.getTime() + durationMs);
    }

    // 更新会员
    const { error: upsertError } = await env.supabase
      .from('user_memberships')
      .upsert({
        user_id: userId,
        tier: newTier,
        started_at: now.toISOString(),
        expires_at: newExpiresAt.toISOString(),
        is_active: true,
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      return json({ error: '会员更新失败: ' + upsertError.message }, 500);
    }

    // 标记卡密为已使用
    await env.supabase
      .from('card_keys')
      .update({ is_used: true, used_by: userId, used_at: now.toISOString() })
      .eq('id', card.id);

    return json({
      success: true,
      tier: newTier,
      expires_at: newExpiresAt.toISOString(),
      message: '激活成功',
    });
  } catch (e: any) {
    return json({ error: e.message || '激活失败' }, 500);
  }
}
