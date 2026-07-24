import { json } from '../router';
import type { Env } from '../index';

export async function searchRoute(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const { query, maxResults = 5 } = body;

  if (!query) return json({ error: 'Missing query' }, 400);
  if (!env.TAVILY_API_KEY) return json({ error: 'Tavily API key not configured' }, 500);

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: maxResults,
      include_answer: true,
    }),
  });

  const data = await res.json();
  return json({
    answer: data.answer || '',
    results: (data.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    })),
  });
}
