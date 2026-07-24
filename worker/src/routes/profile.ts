import { json } from '../router';
import type { Env } from '../index';

// GET /api/v1/profile
// 获取当前用户资料
export async function getProfileRoute(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  try {
    // 获取用户资料
    const profileRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?select=*`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });
    const profile = await profileRes.json();

    // 获取用户设置
    const settingsRes = await fetch(`${env.SUPABASE_URL}/rest/v1/user_settings?select=*`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });
    const settings = await settingsRes.json();

    return json({
      profile: profile?.[0] || null,
      settings: settings?.[0] || null,
    });
  } catch (e: any) {
    return json({ error: 'Failed to fetch profile', detail: e.message }, 500);
  }
}

// PUT /api/v1/profile
// 更新用户资料
export async function updateProfileRoute(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  const body = await request.json().catch(() => ({}));
  const { display_name, bio, avatar_url } = body;

  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        display_name,
        bio,
        avatar_url,
        updated_at: new Date().toISOString(),
      }),
    });

    return json({ success: res.ok });
  } catch (e: any) {
    return json({ error: 'Failed to update profile', detail: e.message }, 500);
  }
}

// PUT /api/v1/settings
// 更新用户设置
export async function updateSettingsRoute(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  const body = await request.json().catch(() => ({}));

  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/user_settings`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        ...body,
        updated_at: new Date().toISOString(),
      }),
    });

    return json({ success: res.ok });
  } catch (e: any) {
    return json({ error: 'Failed to update settings', detail: e.message }, 500);
  }
}
