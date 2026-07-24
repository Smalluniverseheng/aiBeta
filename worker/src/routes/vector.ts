import { json } from '../router';
import type { Env } from '../index';

export async function vectorRoute(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const { query, documentIds, topK = 5 } = body;

  if (!query) return json({ error: 'Missing query' }, 400);

  // 1. 获取 embedding (使用 OpenAI)
  const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: query }),
  });
  const embedData = await embedRes.json();
  const embedding = embedData.data?.[0]?.embedding;
  if (!embedding) return json({ error: 'Failed to generate embedding' }, 500);

  // 2. 查询 Supabase pgvector
  const rpcBody = {
    query_embedding: embedding,
    match_count: topK,
    ...(documentIds?.length ? { filter_document_ids: documentIds } : {}),
  };

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/match_document_chunks`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rpcBody),
  });

  const chunks = await res.json();
  return json({
    chunks: (chunks || []).map((c: any) => ({
      content: c.content,
      similarity: c.similarity,
      documentId: c.document_id,
      documentTitle: c.document_title,
    })),
  });
}
