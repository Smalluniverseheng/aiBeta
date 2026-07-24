import { json } from '../router';

export async function healthRoute(): Promise<Response> {
  return json({ status: 'ok', version: 'v2.0.0', timestamp: Date.now() });
}
