import { json } from '../router';

// 获取设备列表
export async function getDevicesRoute(request: Request, env: any): Promise<Response> {
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

    const { data, error } = await env.supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .order('last_active', { ascending: false });

    if (error) {
      return json({ error: '查询失败: ' + error.message }, 500);
    }

    return json({ devices: data || [] });
  } catch (e: any) {
    return json({ error: e.message || '查询失败' }, 500);
  }
}

// 添加/更新设备
export async function addDeviceRoute(request: Request, env: any): Promise<Response> {
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

    const { device_id, device_name, device_type } = await request.json();
    if (!device_id) {
      return json({ error: '设备ID不能为空' }, 400);
    }

    // 检查设备数量限制
    const { data: membership } = await env.supabase
      .from('user_memberships')
      .select('tier, plan:membership_plans(device_limit)')
      .eq('user_id', userId)
      .single();

    const { count } = await env.supabase
      .from('user_devices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const limit = membership?.plan?.device_limit || 1;
    if ((count || 0) >= limit) {
      return json({ error: '设备数量已达上限' }, 403);
    }

    const { data, error } = await env.supabase
      .from('user_devices')
      .upsert({
        user_id: userId,
        device_id,
        device_name: device_name || '未知设备',
        device_type: device_type || 'unknown',
        last_active: new Date().toISOString(),
      }, { onConflict: 'user_id,device_id' })
      .select()
      .single();

    if (error) {
      return json({ error: '添加失败: ' + error.message }, 500);
    }

    return json({ success: true, device: data });
  } catch (e: any) {
    return json({ error: e.message || '添加失败' }, 500);
  }
}

// 删除设备
export async function deleteDeviceRoute(request: Request, env: any, ctx: any, params: Record<string, string>): Promise<Response> {
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

    const url = new URL(request.url);
    const deviceId = url.searchParams.get('id');
    if (!deviceId) {
      return json({ error: '设备ID不能为空' }, 400);
    }

    const { error } = await env.supabase
      .from('user_devices')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    if (error) {
      return json({ error: '删除失败: ' + error.message }, 500);
    }

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || '删除失败' }, 500);
  }
}
