# v5.7 后端完成记录

> 记录时间: 2026-07-29
> 对应前端版本: v5.7

---

## 一、Worker 部署状态

- **Worker 名称**: ai-gateway
- **部署地址**: https://ai-gateway.1829487897.workers.dev
- **部署状态**: ✅ 已部署（2026-07-29 01:03）
- **部署方式**: Cloudflare API 直接推送 JS

---

## 二、新增 API 接口

### 2.1 卡密系统

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/v1/card/redeem` | POST | 卡密激活（验证→更新会员→标记已用） | ✅ |
| `/api/v1/card/verify` | POST | 卡密预验证（只查不激活） | ✅ |

**请求格式**:
```json
// /api/v1/card/redeem
{
  "key": "TP-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX",
  "userId": "uuid"
}

// /api/v1/card/verify
{
  "key": "TP-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
}
```

**响应格式**:
```json
{
  "ok": true,
  "planType": "planet|star|galaxy|universe",
  "durationDays": 30|365,
  "expiresAt": "2026-08-28T...",
  "isUpgrade": false,
  "message": "激活成功！..."
}
```

### 2.2 会员管理

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/v1/membership` | GET | 查询用户会员信息 | ✅ |
| `/api/v1/membership` | POST | 更新用户会员（管理员用） | ✅ |

**GET 请求参数**: `?user_id=uuid`

**响应格式**:
```json
{
  "plan": "planet",
  "expiresAt": "2026-08-28T...",
  "storageUsed": 10485760,
  "storageQuota": 1073741824,
  "bonusStorage": [],
  "devices": []
}
```

### 2.3 书源/图源代理

| 接口 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/v1/proxy` | GET | 代理请求书源链接，绕过 CORS | ✅ |

**请求参数**: `?url=https://example.com/source.json`

---

## 三、数据库表

### 3.1 已创建表（schema.sql 中定义）

| 表名 | 用途 | 状态 |
|------|------|------|
| `card_keys` | 卡密主表 | ⏳ 待执行 SQL |
| `card_key_logs` | 卡密使用记录 | ⏳ 待执行 SQL |
| `user_bonus_storage` | 用户临时存储额度（抽奖获得） | ⏳ 待执行 SQL |
| `user_invites` | 邀请记录 | ⏳ 待执行 SQL |
| `lottery_records` | 抽奖记录 | ⏳ 待执行 SQL |
| `user_devices` | 设备管理 | ⏳ 待执行 SQL |
| `family_groups` | 家庭组 | ⏳ 待执行 SQL |
| `family_members` | 家庭成员 | ⏳ 待执行 SQL |

> ⚠️ **重要**: 以上表需要在 Supabase SQL 编辑器手动执行 schema.sql 创建

### 3.2 profiles 表扩展字段

```sql
-- 需要添加到 profiles 表
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan text DEFAULT 'satellite';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storage_used bigint DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS storage_quota_mb bigint DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS device_management boolean DEFAULT false;
```

---

## 四、前端调用方式

### 4.1 卡密激活（membership.js）

```javascript
// 调用 Worker API
const resp = await fetch('https://ai-gateway.1829487897.workers.dev/api/v1/card/redeem', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'TP-...', userId: user.id })
});
const result = await resp.json();
```

### 4.2 代理请求书源

```javascript
// 通过 Worker 代理获取书源
const resp = await fetch(
  'https://ai-gateway.1829487897.workers.dev/api/v1/proxy?url=' + 
  encodeURIComponent(sourceUrl)
);
const data = await resp.json();
```

---

## 五、已知问题

1. **数据库表未创建** — 需要手动在 Supabase SQL 编辑器执行 schema.sql
2. **profiles 表缺少扩展字段** — 需要执行 ALTER TABLE 添加 plan/plan_expires_at 等字段
3. **Worker 部署方式** — 当前通过 Cloudflare API 直接部署 JS，建议后续改用 wrangler deploy 部署 TS

---

## 六、密钥清单

| 密钥 | 用途 | 存储位置 |
|------|------|----------|
| GitHub Token | 仓库操作 | 用户本地保管 |
| Supabase Anon Key | 前端数据库访问 | ai-context/SECRETS.md |
| Supabase Service Role Key | 后端管理数据库 | ai-context/SECRETS.md |
| Cloudflare Account ID | Worker 部署 | ai-context/SECRETS.md |
| Cloudflare API Token | Worker 管理 | ai-context/SECRETS.md |

---

*本文档由 AI 维护，每次后端变更后更新。*
