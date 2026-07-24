import { Router } from './router';
import { chatRoute } from './routes/chat';
import { multiRoute } from './routes/multi';
import { searchRoute } from './routes/search';
import { imageRoute } from './routes/image';
import { vectorRoute } from './routes/vector';
import { storageRoute } from './routes/storage';
import { healthRoute } from './routes/health';
import { keysRoute } from './routes/keys';
import { saveChatRoute, getChatsRoute, deleteChatRoute } from './routes/chats';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GOOGLE_API_KEY: string;
  DEEPSEEK_API_KEY: string;
  MOONSHOT_API_KEY: string;
  ALIBABA_API_KEY: string;
  BAICHUAN_API_KEY: string;
  ZHIPU_API_KEY: string;
  MINIMAX_API_KEY: string;
  SPARK_API_KEY: string;
  ERNIE_API_KEY: string;
  HUNYUAN_API_KEY: string;
  DOUBAO_API_KEY: string;
  QWEN_API_KEY: string;
  COZE_API_KEY: string;
  GROQ_API_KEY: string;
  COHERE_API_KEY: string;
  MISTRAL_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  TOGETHER_API_KEY: string;
  FIREWORKS_API_KEY: string;
  NOVITA_API_KEY: string;
  SILICONFLOW_API_KEY: string;
  R2_BUCKET?: R2Bucket;
  R2_PUBLIC_URL?: string;
  TAVILY_API_KEY: string;
}

const router = new Router();
router.post('/api/v1/chat', chatRoute);
router.post('/api/v1/chat/multi', multiRoute);
router.post('/api/v1/search', searchRoute);
router.post('/api/v1/image', imageRoute);
router.post('/api/v1/vector/search', vectorRoute);
router.post('/api/v1/storage/upload', storageRoute);
router.get('/api/v1/health', healthRoute);
router.post('/api/v1/keys', keysRoute);
router.get('/api/v1/keys', keysRoute);
router.post('/api/v1/chats/save', saveChatRoute);
router.get('/api/v1/chats', getChatsRoute);
router.post('/api/v1/chats/delete', deleteChatRoute);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info',
      'Access-Control-Max-Age': '86400',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    const response = await router.handle(request, env, ctx);
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  },
};

// 触发重新部署: 1784823702

// 触发重新部署: fix messages id null 1784824168
