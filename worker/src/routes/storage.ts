import { json } from '../router';
import type { Env } from '../index';

export async function storageRoute(request: Request, env: Env): Promise<Response> {
  if (!env.R2_BUCKET) return json({ error: 'R2 not configured' }, 500);

  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) return json({ error: 'No file' }, 400);

  const key = `uploads/${Date.now()}-${file.name}`;
  await env.R2_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const url = env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : `https://r2.example.com/${key}`;
  return json({ url, path: key });
}
