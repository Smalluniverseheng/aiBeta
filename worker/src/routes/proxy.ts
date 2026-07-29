import { json } from '../router';

// 书源/图源代理（绕过 CORS）
export async function proxyRoute(request: Request, env: any): Promise<Response> {
  try {
    const { url, method = 'GET', headers: customHeaders, body } = await request.json();

    if (!url || typeof url !== 'string') {
      return json({ error: 'URL 不能为空' }, 400);
    }

    // 安全校验：只允许 http/https
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return json({ error: '不支持的协议' }, 400);
    }

    // 构建请求
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...customHeaders,
      },
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    // 读取响应内容
    const contentType = response.headers.get('content-type') || '';
    let responseBody: any;

    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    return json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      data: responseBody,
    });
  } catch (e: any) {
    return json({ error: e.message || '代理请求失败' }, 500);
  }
}

// 批量代理（用于书源/图源导入时批量验证）
export async function proxyBatchRoute(request: Request, env: any): Promise<Response> {
  try {
    const { urls } = await request.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return json({ error: 'URL 列表不能为空' }, 400);
    }

    // 限制批量数量
    if (urls.length > 20) {
      return json({ error: '单次最多 20 个 URL' }, 400);
    }

    const results = await Promise.all(
      urls.map(async (url: string) => {
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          const text = await res.text();
          return {
            url,
            success: res.ok,
            status: res.status,
            size: text.length,
            preview: text.slice(0, 200),
          };
        } catch (e: any) {
          return { url, success: false, error: e.message };
        }
      })
    );

    return json({ results });
  } catch (e: any) {
    return json({ error: e.message || '批量代理失败' }, 500);
  }
}
