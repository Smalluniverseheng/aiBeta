import { json, stream } from '../router';
import type { Env } from '../index';

export async function multiRoute(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const { models, messages, temperature = 0.7 } = body;

  if (!models || !Array.isArray(models) || models.length === 0) {
    return json({ error: 'Missing models array' }, 400);
  }

  // 转发到 chat 路由处理每个模型
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for (const m of models) {
        controller.enqueue(encoder.encode(`data: {"model":"${m.model}","status":"start"}\n\n`));

        // 这里简化处理，实际应并发请求
        try {
          const res = await fetch(request.url.replace('/multi', ''), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: m.provider, model: m.model, messages, temperature }),
          });

          if (res.body) {
            const reader = res.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          }
        } catch (e: any) {
          controller.enqueue(encoder.encode(`data: {"model":"${m.model}","error":"${e.message}"}\n\n`));
        }

        controller.enqueue(encoder.encode(`data: {"model":"${m.model}","status":"done"}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}
