import { db } from '../lib/firebase.js';
import { priceAt, defCtl, getSegs, lastCtl } from '../lib/engine.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { pair } = req.query, now = Date.now();
    if (!pair) {
      const [p, c] = await Promise.all([db.ref('pairs').once('value'), db.ref('control').once('value')]);
      const P = p.val() || {}, C = c.val() || {};
      return res.status(200).json({ status: true, serverTime: now, pairs: Object.keys(P).filter(k => P[k] && P[k].active !== false).map(k => ({ name: k, payout: P[k].payout ?? 85, price: priceAt(C[k] ? { ...C[k], vol: Number(P[k].volatility) || 0.1 } : defCtl(P[k]), now) })) });
    }
    const cfg = (await db.ref(`pairs/${pair}`).once('value')).val();
    if (!cfg || cfg.active === false) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND', pair });
    const k = lastCtl(await getSegs(pair, cfg), cfg);
    res.status(200).json({ status: true, pair, payout: cfg.payout ?? 85, control: k, price: priceAt(k, now), serverTime: now });
  } catch (e) { res.status(500).json({ status: false, code: 'SERVER_ERROR', message: e.message, stack: String(e.stack).split('\n').slice(0, 3) }); }
}
