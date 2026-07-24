import { json } from '../router';
import type { Env } from '../index';

// POST /api/v1/chats/save
// 保存单条聊天记录到 Supabase
export async function saveChatRoute(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const { chatId, title, model, mode, messages, userToken } = body;

  if (!userToken) {
    return json({ error: 'Unauthorized: missing userToken' }, 401);
  }

  if (!chatId) {
    return json({ error: 'Missing chatId' }, 400);
  }

  try {
    // 保存/更新对话基本信息
    const chatRes = await fetch(`${env.SUPABASE_URL}/rest/v1/chats?id=eq.${chatId}`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: chatId,
        title: title || '新对话',
        model_id: model || '',
        mode: mode || 'single',
        updated_at: new Date().toISOString(),
      }),
    });

    // 保存消息（如果有）
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const msgRes = await fetch(`${env.SUPABASE_URL}/rest/v1/messages`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join(''),
          chat_id: chatId,
          role: lastMsg.role || 'user',
          content: lastMsg.content || '',
          model_id: lastMsg.model || model || '',
          created_at: new Date().toISOString(),
        }),
      });
    }

    return json({ success: true, chatId });
  } catch (e: any) {
    return json({ error: 'Failed to save chat', detail: e.message }, 500);
  }
}

// GET /api/v1/chats
// 获取用户所有聊天记录
export async function getChatsRoute(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.slice(7);

  try {
    // 获取对话列表
    const chatsRes = await fetch(`${env.SUPABASE_URL}/rest/v1/chats?select=*&order=updated_at.desc`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });

    const chats = await chatsRes.json();

    // 获取最近的消息（每个对话最后一条）
    const messagesRes = await fetch(`${env.SUPABASE_URL}/rest/v1/messages?select=*&order=created_at.desc&limit=100`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    });

    const messages = await messagesRes.json();

    return json({ chats: chats || [], messages: messages || [] });
  } catch (e: any) {
    return json({ error: 'Failed to fetch chats', detail: e.message }, 500);
  }
}

// POST /api/v1/chats/delete
// 删除对话
export async function deleteChatRoute(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const { chatId, userToken } = body;

  if (!userToken) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!chatId) {
    return json({ error: 'Missing chatId' }, 400);
  }

  try {
    // 删除消息
    await fetch(`${env.SUPABASE_URL}/rest/v1/messages?chat_id=eq.${chatId}`, {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${userToken}`,
      },
    });

    // 删除对话
    await fetch(`${env.SUPABASE_URL}/rest/v1/chats?id=eq.${chatId}`, {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${userToken}`,
      },
    });

    return json({ success: true, chatId });
  } catch (e: any) {
    return json({ error: 'Failed to delete chat', detail: e.message }, 500);
  }
}
