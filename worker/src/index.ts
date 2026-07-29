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
import { verifyCardRoute, redeemCardRoute } from './routes/card';
import { getMembershipRoute, updateMembershipRoute } from './routes/membership';
import { getDevicesRoute, addDeviceRoute, deleteDeviceRoute } from './routes/device';
import { getFamilyRoute, createFamilyRoute, addFamilyMemberRoute, removeFamilyMemberRoute } from './routes/family';
import { proxyRoute, proxyBatchRoute } from './routes/proxy';

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

// 原有路由
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

// 会员体系路由 (v5.7)
router.post('/api/v1/card/verify', verifyCardRoute);
router.post('/api/v1/card/redeem', redeemCardRoute);
router.get('/api/v1/membership', getMembershipRoute);
router.post('/api/v1/membership', updateMembershipRoute);
router.get('/api/v1/devices', getDevicesRoute);
router.post('/api/v1/devices', addDeviceRoute);
router.delete('/api/v1/devices', deleteDeviceRoute);
router.get('/api/v1/family', getFamilyRoute);
router.post('/api/v1/family', createFamilyRoute);
router.post('/api/v1/family/members', addFamilyMemberRoute);
router.delete('/api/v1/family/members', removeFamilyMemberRoute);
router.post('/api/v1/proxy', proxyRoute);
router.post('/api/v1/proxy/batch', proxyBatchRoute);

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

// 触发重新部署: v5.7-membership
