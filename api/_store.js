// 後台紀錄用的儲存層：Upstash Redis（REST API，不需額外套件）
// Vercel 的 Upstash 整合會自動設定 KV_REST_API_URL / KV_REST_API_TOKEN
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const KEY = 'mtt:calls';
const MAX = 20000;

// 官方牌價（美元／百萬 token），可用環境變數覆寫
const PRICE = {
  input: Number(process.env.PRICE_INPUT || 2),
  output: Number(process.env.PRICE_OUTPUT || 10),
  cacheWrite: Number(process.env.PRICE_CACHE_WRITE || 2.5),
  cacheRead: Number(process.env.PRICE_CACHE_READ || 0.1)
};
const cost = u => ((u.input || 0) * PRICE.input + (u.output || 0) * PRICE.output + (u.cacheWrite || 0) * PRICE.cacheWrite + (u.cacheRead || 0) * PRICE.cacheRead) / 1e6;

const enabled = () => !!(URL_ && TOKEN);

async function pipeline(cmds, timeoutMs = 2500) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
      method: 'POST', signal: ac.signal,
      headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify(cmds)
    });
    if (!r.ok) throw new Error('store ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function logCall(rec) {
  if (!enabled()) return false;
  try {
    await pipeline([['LPUSH', KEY, JSON.stringify(rec)], ['LTRIM', KEY, '0', String(MAX - 1)]]);
    return true;
  } catch (e) { return false; }
}

async function readCalls(limit = 5000) {
  const res = await pipeline([['LRANGE', KEY, '0', String(Math.min(limit, MAX) - 1)]], 8000);
  const arr = (res && res[0] && res[0].result) || [];
  return arr.map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
}

module.exports = { enabled, logCall, readCalls, cost, PRICE };
