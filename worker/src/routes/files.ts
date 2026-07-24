import { json } from '../router';
import type { Env } from '../index';

// POST /api/v1/files/upload
// 上传文件到 R2，记录元数据到 Supabase
export async function uploadFileRoute(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const chatId = formData.get('chatId') as string || null;
    const messageId = formData.get('messageId') as string || null;

    if (!file) {
      return json({ error: 'No file provided' }, 400);
    }

    // 检查文件大小（20MB 限制）
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return json({ error: 'File too large, max 20MB' }, 413);
    }

    // 生成存储路径
    const userId = await getUserIdFromToken(token, env);
    if (!userId) {
      return json({ error: 'Invalid token' }, 401);
    }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop() || '';
    const storagePath = `users/${userId}/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // 上传到 R2
    const r2Key = env.R2_ACCESS_KEY_ID;
    const r2Secret = env.R2_SECRET_ACCESS_KEY;
    const r2Endpoint = env.R2_ENDPOINT || `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const bucket = env.R2_BUCKET_NAME || 'ai-files';

    // 使用 S3 兼容 API 上传
    const uploadUrl = `${r2Endpoint}/${bucket}/${storagePath}`;
    const r2Res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Length': String(file.size),
        'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
      },
      body: file,
    });

    if (!r2Res.ok) {
      return json({ error: 'R2 upload failed', detail: await r2Res.text() }, 500);
    }

    // 生成公开 URL
    const publicUrl = `${env.R2_PUBLIC_URL || r2Endpoint}/${bucket}/${storagePath}`;

    // 记录到 Supabase
    const dbRes = await fetch(`${env.SUPABASE_URL}/rest/v1/files`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        chat_id: chatId,
        message_id: messageId,
        file_name: file.name,
        file_type: getFileType(file.type, ext),
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
        storage_provider: 'r2',
        storage_path: storagePath,
        public_url: publicUrl,
      }),
    });

    const dbData = await dbRes.json();

    return json({
      success: true,
      file: {
        id: dbData?.[0]?.id || null,
        name: file.name,
        url: publicUrl,
        size: file.size,
        type: getFileType(file.type, ext),
      },
    });
  } catch (e: any) {
    return json({ error: 'Upload failed', detail: e.message }, 500);
  }
}

// GET /api/v1/files
// 获取用户文件列表
export async function listFilesRoute(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  try {
    const url = new URL(request.url);
    const chatId = url.searchParams.get('chatId');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let query = `${env.SUPABASE_URL}/rest/v1/files?select=*&order=created_at.desc&limit=${limit}`;
    if (chatId) {
      query += `&chat_id=eq.${chatId}`;
    }

    const res = await fetch(query, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });

    const files = await res.json();
    return json({ files: files || [] });
  } catch (e: any) {
    return json({ error: 'Failed to list files', detail: e.message }, 500);
  }
}

// DELETE /api/v1/files/:id
// 删除文件
export async function deleteFileRoute(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  try {
    const url = new URL(request.url);
    const fileId = url.pathname.split('/').pop();

    if (!fileId) {
      return json({ error: 'Missing file ID' }, 400);
    }

    // 获取文件信息
    const fileRes = await fetch(`${env.SUPABASE_URL}/rest/v1/files?id=eq.${fileId}&select=storage_path`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });
    const fileData = await fileRes.json();
    const storagePath = fileData?.[0]?.storage_path;

    // 从 R2 删除
    if (storagePath) {
      const r2Endpoint = env.R2_ENDPOINT || `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      const bucket = env.R2_BUCKET_NAME || 'ai-files';
      await fetch(`${r2Endpoint}/${bucket}/${storagePath}`, {
        method: 'DELETE',
      });
    }

    // 从数据库删除
    await fetch(`${env.SUPABASE_URL}/rest/v1/files?id=eq.${fileId}`, {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });

    return json({ success: true });
  } catch (e: any) {
    return json({ error: 'Failed to delete file', detail: e.message }, 500);
  }
}

// 辅助函数
function getFileType(mimeType: string, ext: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'text/plain' || ext === 'txt') return 'txt';
  if (mimeType === 'text/markdown' || ext === 'md') return 'markdown';
  return 'other';
}

async function getUserIdFromToken(token: string, env: Env): Promise<string | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });
    const data = await res.json();
    return data.id || null;
  } catch {
    return null;
  }
}
