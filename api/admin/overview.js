import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';
import { priceAt, ctl } from '../../lib/priceEngine.js';
import { generateCandles } from '../../lib/candleGenerator.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-employee');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'POST') { // { id, active?, addBalance? } - never overwrites password
      const { id, active, addBalance } = req.body || {};
      if (!id) return res.status(400).json({ status: false, message: 'id required' });
      if (typeof active === 'boolean') await db.ref(`users/${id}/active`).set(active);
      if (addBalance) await db.ref(`users/${id}/balance`).transaction(b => (Number(b) || 0) + Number(addBalance));
      await db.ref(`logs/${Date.now()}_user`).set({ ts: Date.now(), type: 'user_update', id, active: active ?? null, addBalance: addBalance ?? null });
      return res.json({ status: true });
    }
    const [U, T, C, P, S] = await Promise.all(['users', 'trades', 'control', 'pairs', 'settings'].map(k => db.ref(k).get().then(s => s.val() || {})));
    const users = {}, open = [], closed = [];
    for (const id in U) { const { password, ...r } = U[id]; users[id] = { ...r, open: 0, openAmt: 0 }; }
    for (const uid in T) for (const id in T[uid]) {
      const x = { ...T[uid][id], name: U[uid]?.name };
      if (x.status === 'open' || x.status === 'settling') { open.push(x); if (users[uid]) { users[uid].open++; users[uid].openAmt += x.amount; } } else closed.push(x);
    }
    const pairs = {};
    for (const k in P) { const c = ctl(k, P[k], C[k]); pairs[k] = { ...P[k], price: priceAt(c), control: c, up: 0, down: 0, upN: 0, downN: 0 }; }
    open.forEach(x => { const r = pairs[x.pair]; if (!r) return; const s = x.direction === 'buy' ? 'up' : 'down'; r[s] += x.amount; r[s + 'N']++; });
    closed.sort((a, b) => b.entryTime - a.entryTime);
    const { pair, tf = '1m' } = req.query;
    const candles = pair && P[pair] ? generateCandles({ pairName: pair, pairConfig: P[pair], userId: 'x', timeframe: tf, count: 150, settings: S }) : undefined;
    res.json({ status: true, serverTime: Date.now(), users: Object.values(users), pairs, open, closed: closed.slice(0, 60), candles });
  } catch (e) { res.status(500).json({ status: false, message: e.message }); }
}
