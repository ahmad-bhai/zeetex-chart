import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';
import { generateCandles } from '../../lib/candleGenerator.js';

// Self-contained price engine (no import of lib/priceEngine.js)
const nz = s => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
const priceAt = (c, t = Date.now()) => {
  if (c.dir === 'flat') return c.price;
  const s = (t - c.since) / 1000, d = c.dir === 'up' ? 1 : -1;
  return c.price + d * c.speed * c.vol * s * 0.05 + (nz(Math.floor(t / 500) + c.since % 97) - 0.5) * c.vol * 0.6 * c.speed * Math.min(1, s / 2);
};
const ctl = (name, cfg, c) => ({ pair: name, dir: 'flat', speed: 1, price: Number(cfg.basePrice) || 100, since: Date.now(), ...(c || {}), vol: Number(cfg.volatility) || 0.1 });
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
    step = 'read';
    const [U, T, C, P, S] = await Promise.all(['users', 'trades', 'control', 'pairs', 'settings'].map(read));
    step = 'users/trades';
    const users = {}, open = [], closed = [];
    for (const id in U) { const { password, ...r } = U[id] || {}; users[id] = { ...r, balance: Number(r.balance) || 0, open: 0, openAmt: 0 }; }
    for (const uid in T) for (const id in (T[uid] || {})) {
      const x = { ...T[uid][id], name: U[uid] && U[uid].name };
      if (x.status === 'open' || x.status === 'settling') { open.push(x); if (users[uid]) { users[uid].open++; users[uid].openAmt += Number(x.amount) || 0; } } else closed.push(x);
    }
    step = 'pairs';
    const pairs = {};
    for (const k in P) { const c = ctl(k, P[k], C[k]); pairs[k] = { ...P[k], price: priceAt(c), control: c, up: 0, down: 0, upN: 0, downN: 0 }; }
    open.forEach(x => { const r = pairs[x.pair]; if (!r) return; const s = x.direction === 'buy' ? 'up' : 'down'; r[s] += Number(x.amount) || 0; r[s + 'N']++; });
    closed.sort((a, b) => (b.entryTime || 0) - (a.entryTime || 0));
    step = 'candles';
    const { pair, tf = '1m' } = req.query;
    const candles = pair && P[pair] ? generateCandles({ pairName: pair, pairConfig: P[pair], userId: 'x', timeframe: tf, count: 150, settings: S }) : undefined;
    res.status(200).json({ status: true, serverTime: Date.now(), users: Object.values(users), pairs, open, closed: closed.slice(0, 60), candles });
  } catch (e) {
    console.error('[OVERVIEW]', step, e);
    res.status(500).json({ status: false, code: 'SERVER_ERROR', step, message: e.message, stack: String(e.stack).split('\n').slice(0, 3) });
  }
}
