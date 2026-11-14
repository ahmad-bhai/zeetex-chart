import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';
import { TFMS, priceAt, defCtl, getSegs, makePrice, buildCandles, settleTrade } from '../../lib/engine.js';
const read = async k => (await db.ref(k).once('value')).val() || {};
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-employee');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;
  let step = 'start';
  try {
    if (req.method === 'POST') {
      const { id, active, addBalance } = req.body || {};
      if (!id) return res.status(400).json({ status: false, message: 'id required' });
      if (typeof active === 'boolean') await db.ref(`users/${id}/active`).set(active);
      if (addBalance) await db.ref(`users/${id}/balance`).transaction(b => (Number(b) || 0) + Number(addBalance));
      await db.ref(`logs/${Date.now()}_user`).set({ ts: Date.now(), type: 'user_update', id: String(id), active: typeof active === 'boolean' ? active : null, addBalance: addBalance ? Number(addBalance) : null });
      return res.status(200).json({ status: true });
    }
    step = 'settle-expired';          // admin panel open => every expired trade gets its result
    const T = await read('trades'), now = Date.now(), jobs = [];
    for (const uid in T) for (const id in (T[uid] || {})) { const x = T[uid][id]; if (x.status === 'open' && x.expiryTime < now - 1500) jobs.push(settleTrade({ ...x, userId: x.userId || uid, id: x.id || id }).then(n => { if (n) T[uid][id] = n; }).catch(e => console.error('settle', e.message))); }
    await Promise.all(jobs);
    step = 'read';
    const [U, C, P] = await Promise.all(['users', 'control', 'pairs'].map(read));
    const users = {}, open = [], closed = [];
    for (const id in U) { const { password, ...r } = U[id] || {}; users[id] = { ...r, balance: Number(r.balance) || 0, open: 0, openAmt: 0 }; }
    for (const uid in T) for (const id in (T[uid] || {})) {
      const x = { ...T[uid][id], name: U[uid] && U[uid].name };
      if (x.status === 'open' || x.status === 'settling') { open.push(x); if (users[uid]) { users[uid].open++; users[uid].openAmt += Number(x.amount) || 0; } } else closed.push(x);
    }
    step = 'pairs';
    const pairs = {};
    for (const k in P) { const c = C[k] ? { ...C[k], vol: Number(P[k].volatility) || 0.1 } : defCtl(P[k]); pairs[k] = { ...P[k], price: priceAt(c, now), control: c, up: 0, down: 0, upN: 0, downN: 0 }; }
    open.forEach(x => { const r = pairs[x.pair]; if (!r) return; const s = x.direction === 'buy' ? 'up' : 'down'; r[s] += Number(x.amount) || 0; r[s + 'N']++; });
    closed.sort((a, b) => (b.entryTime || 0) - (a.entryTime || 0));
    step = 'candles';
    const { pair, tf = '1m' } = req.query;
    let candles;
    if (pair && P[pair] && TFMS[tf]) candles = buildCandles(makePrice(pair, P[pair], await getSegs(pair, P[pair])), tf, 200, now);
    res.status(200).json({ status: true, serverTime: now, users: Object.values(users), pairs, open, closed: closed.slice(0, 60), candles });
  } catch (e) { console.error('[OVERVIEW]', step, e); res.status(500).json({ status: false, code: 'SERVER_ERROR', step, message: e.message, stack: String(e.stack).split('\n').slice(0, 3) }); }
}
