import { json } from '../router';
import type { Env } from '../index';

export async function imageRoute(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const { provider, prompt, size = '1024x1024', n = 1 } = body;

  if (!prompt) return json({ error: 'Missing prompt' }, 400);

  const apiKey = env.OPENAI_API_KEY; // 默认用 OpenAI DALL-E
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, size, n, response_format: 'url' }),
  });

  const data = await res.json();
  return json({ urls: data.data?.map((d: any) => d.url) || [] });
}
