// 後台資料 API：需帶 Authorization: Bearer <ADMIN_PASSWORD>
const crypto = require('crypto');
const store = require('./_store');

const TZ = 'Asia/Taipei';
const dayKey = ts => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));

function authorized(req) {
  const pw = process.env.ADMIN_PASSWORD || '';
  if (!pw) return false;
  const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got), b = Buffer.from(pw);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: '尚未設定 ADMIN_PASSWORD 環境變數' });
  if (!authorized(req)) { await new Promise(r => setTimeout(r, 600)); return res.status(401).json({ error: '密碼錯誤' }); }
  if (!store.enabled()) return res.status(503).json({ error: '尚未連接資料庫（Upstash Redis）', pricing: store.PRICE });

  let calls;
  try { calls = await store.readCalls(5000); } catch (e) { return res.status(502).json({ error: '讀取資料庫失敗：' + e.message }); }

  // 依議事編號合併成場次
  const map = new Map();
  for (const c of calls) {
    let s = map.get(c.sid);
    if (!s) { s = { sid: c.sid, ts: c.ts, q: c.q, ctx: c.ctx || '', ip: c.ip, masters: new Set(), verdict: '', recommendation: '', stances: [], calls: 0, errors: [], cost: 0, usage: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 } }; map.set(c.sid, s); }
    s.ts = Math.min(s.ts, c.ts); s.calls++;
    (c.ids || []).forEach(id => s.masters.add(id));
    if (c.verdict) { s.verdict = c.verdict; s.recommendation = c.recommendation || ''; }
    if (c.stances) s.stances.push(...c.stances);
    if (c.error) s.errors.push(c.error);
    s.cost += c.cost || 0;
    for (const k in s.usage) s.usage[k] += (c.usage && c.usage[k]) || 0;
  }
  const sessions = [...map.values()].map(s => {
    const totalIn = s.usage.input + s.usage.cacheWrite + s.usage.cacheRead;
    return { ...s, masters: s.masters.size, cost: +s.cost.toFixed(6), cacheHit: totalIn ? +(s.usage.cacheRead / totalIn).toFixed(3) : 0, complete: !!s.verdict };
  }).sort((a, b) => b.ts - a.ts);

  // 匯總
  const now = Date.now(), today = dayKey(now);
  const sum = (arr) => ({ sessions: arr.length, cost: +arr.reduce((t, s) => t + s.cost, 0).toFixed(4) });
  const within = days => sessions.filter(s => now - s.ts < days * 864e5);
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const k = dayKey(now - i * 864e5);
    const arr = sessions.filter(s => dayKey(s.ts) === k);
    daily.push({ date: k, ...sum(arr) });
  }
  res.status(200).json({
    generatedAt: now,
    pricing: store.PRICE,
    usdTwd: Number(process.env.USD_TWD || 32),
    totals: { today: sum(sessions.filter(s => dayKey(s.ts) === today)), d7: sum(within(7)), d30: sum(within(30)), all: sum(sessions) },
    uniqueVisitors30: new Set(within(30).map(s => s.ip)).size,
    daily,
    sessions: sessions.slice(0, 1000).map(({ ip, ...s }) => s)
  });
};
