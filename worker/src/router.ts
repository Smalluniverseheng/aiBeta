export type Handler = (request: Request, env: any, ctx: ExecutionContext, params?: Record<string, string>) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  get(path: string, handler: Handler) { this.add('GET', path, handler); }
  post(path: string, handler: Handler) { this.add('POST', path, handler); }
  put(path: string, handler: Handler) { this.add('PUT', path, handler); }
  delete(path: string, handler: Handler) { this.add('DELETE', path, handler); }

  private add(method: string, path: string, handler: Handler) {
    const pattern = new RegExp('^' + path.replace(/:([^/]+)/g, '([^/]+)') + '$');
    this.routes.push({ method, pattern, handler });
  }

  async handle(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = url.pathname.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        const keys = route.pattern.toString().match(/\(.*?\)/g) || [];
        keys.forEach((_, i) => {
          params[`param${i}`] = match[i + 1];
        });
        try {
          return await route.handler(request, env, ctx, params);
        } catch (e: any) {
          return json({ error: e.message || 'Internal Error' }, 500);
        }
      }
    }
    return json({ error: 'Not Found' }, 404);
  }
}

export function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function stream(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
