import { Hono } from 'hono'
import { cors } from 'hono/cors'

const proxy = new Hono()

// Enable CORS for all proxy routes
proxy.use('*', cors({
  origin: '*',
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

// Single URL proxy
proxy.post('/', async (c) => {
  try {
    const { url, headers: customHeaders = {}, method = 'GET', body, timeout = 30000 } = await c.req.json()

    if (!url) {
      return c.json({ success: false, error: 'Missing url parameter' }, 400)
    }

    // Validate URL
    let targetUrl: URL
    try {
      targetUrl = new URL(url)
    } catch {
      return c.json({ success: false, error: 'Invalid URL' }, 400)
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.0.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      ...customHeaders,
    }

    // Remove forbidden headers
    delete headers['host']
    delete headers['connection']
    delete headers['content-length']

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const startTime = Date.now()

    const response = await fetch(targetUrl.toString(), {
      method: method.toUpperCase(),
      headers,
      body: body || undefined,
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    const responseTime = Date.now() - startTime
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    // Handle different content types
    const contentType = response.headers.get('content-type') || ''
    let data: string

    if (contentType.includes('application/json')) {
      data = await response.text()
    } else if (contentType.includes('text/') || contentType.includes('application/xml') || contentType.includes('application/xhtml')) {
      data = await response.text()
    } else {
      // For binary data, encode as base64
      const arrayBuffer = await response.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      data = btoa(binary)
    }

    return c.json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      responseTime,
      contentType,
    })

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return c.json({ success: false, error: 'Request timeout', status: 408 }, 408)
    }
    return c.json({ success: false, error: error.message, status: 500 }, 500)
  }
})

// Batch proxy
proxy.post('/batch', async (c) => {
  try {
    const { urls, timeout = 30000 } = await c.req.json()

    if (!Array.isArray(urls) || urls.length === 0) {
      return c.json({ success: false, error: 'urls must be a non-empty array' }, 400)
    }

    if (urls.length > 20) {
      return c.json({ success: false, error: 'Maximum 20 URLs allowed per batch' }, 400)
    }

    const results = await Promise.all(
      urls.map(async ({ url, headers: customHeaders = {}, method = 'GET' }) => {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeout)

          const response = await fetch(url, {
            method: method.toUpperCase(),
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/json,*/*',
              ...customHeaders,
            },
            signal: controller.signal,
          })

          clearTimeout(timeoutId)
          const data = await response.text()

          return {
            url,
            success: true,
            status: response.status,
            data,
            responseTime: 0,
          }
        } catch (error: any) {
          return {
            url,
            success: false,
            error: error.message,
            status: 0,
          }
        }
      })
    )

    return c.json({ success: true, results })

  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// Health check
proxy.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

export default proxy