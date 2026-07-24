import { json } from '../router';
import type { Env } from '../index';

// GET /api/v1/admin/users
// 管理员查看所有用户（仅 admin 可访问）
export async function adminListUsersRoute(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  // 检查是否为管理员
  const isAdmin = await checkAdmin(token, env);
  if (!isAdmin) {
    return json({ error: 'Forbidden: admin only' }, 403);
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // 获取用户列表（profiles + auth.users）
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=*,auth_users:auth.users(email)&order=created_at.desc&limit=${limit}&offset=${offset}`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });

    const users = await res.json();
    return json({ users: users || [], total: users?.length || 0 });
  } catch (e: any) {
    return json({ error: 'Failed to list users', detail: e.message }, 500);
  }
}

// GET /api/v1/admin/stats
// 管理员查看系统统计
export async function adminStatsRoute(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  const isAdmin = await checkAdmin(token, env);
  if (!isAdmin) {
    return json({ error: 'Forbidden: admin only' }, 403);
  }

  try {
    // 获取各项统计
    const [chatsRes, messagesRes, filesRes, usersRes] = await Promise.all([
      fetch(`${env.SUPABASE_URL}/rest/v1/chats?select=count`, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` } }),
      fetch(`${env.SUPABASE_URL}/rest/v1/messages?select=count`, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` } }),
      fetch(`${env.SUPABASE_URL}/rest/v1/files?select=count`, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` } }),
      fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=count`, { headers: { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${token}` } }),
    ]);

    const [chats, messages, files, users] = await Promise.all([
      chatsRes.json(), messagesRes.json(), filesRes.json(), usersRes.json(),
    ]);

    return json({
      stats: {
        total_chats: chats?.[0]?.count || 0,
        total_messages: messages?.[0]?.count || 0,
        total_files: files?.[0]?.count || 0,
        total_users: users?.[0]?.count || 0,
      },
    });
  } catch (e: any) {
    return json({ error: 'Failed to get stats', detail: e.message }, 500);
  }
}

// PUT /api/v1/admin/users/:id/role
// 管理员修改用户角色
export async function adminUpdateRoleRoute(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  const isAdmin = await checkAdmin(token, env);
  if (!isAdmin) {
    return json({ error: 'Forbidden: admin only' }, 403);
  }

  const url = new URL(request.url);
  const userId = url.pathname.split('/').slice(-2)[0];
  const body = await request.json().catch(() => ({}));
  const { role } = body;

  if (!role || !['admin', 'user', 'guest'].includes(role)) {
    return json({ error: 'Invalid role' }, 400);
  }

  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role }),
    });

    return json({ success: res.ok });
  } catch (e: any) {
    return json({ error: 'Failed to update role', detail: e.message }, 500);
  }
}

// 辅助：检查当前用户是否为管理员
async function checkAdmin(token: string, env: Env): Promise<boolean> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=role`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await res.json();
    return data?.[0]?.role === 'admin';
  } catch {
    return false;
  }
}
