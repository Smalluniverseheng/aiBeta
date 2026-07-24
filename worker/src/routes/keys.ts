import { json } from '../router';
import type { Env } from '../index';

export async function keysRoute(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    // 获取用户保存的 API Keys（通过 Supabase）
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const token = authHeader.slice(7);

    // 验证 JWT 并获取用户设置
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/user_settings?select=api_keys`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await res.json();
    return json({ keys: data?.[0]?.api_keys || {} });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { provider, key, syncToCloud, userToken } = body;

    if (!provider || !key) {
      return json({ error: 'Missing provider or key' }, 400);
    }

    if (syncToCloud && userToken) {
      // 存入 Supabase
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/user_settings`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          user_id: 'me', // Supabase 会根据 JWT 自动解析
          api_keys: { [provider]: key },
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return json({ error: 'Failed to save to cloud', detail: err }, 500);
      }
    }

    return json({ success: true, provider, syncToCloud });
  }

  return json({ error: 'Method not allowed' }, 405);
}
