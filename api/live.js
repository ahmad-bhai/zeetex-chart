import { db } from '../lib/firebase.js';
import { priceAt, ctl } from '../lib/priceEngine.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { pair } = req.query;
    if (!pair) {
      const [p, c] = await Promise.all([db.ref('pairs').get(), db.ref('control').get()]);
      const P = p.val() || {}, C = c.val() || {};
      return res.json({ status: true, serverTime: Date.now(), pairs: Object.keys(P).filter(k => P[k].active !== false).map(k => ({ name: k, payout: P[k].payout ?? 85, price: priceAt(ctl(k, P[k], C[k])) })) });
    }
    const [p, c] = await Promise.all([db.ref(`pairs/${pair}`).get(), db.ref(`control/${pair}`).get()]);
    const cfg = p.val();
    if (!cfg || cfg.active === false) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND', pair });
    const k = ctl(pair, cfg, c.val());
    res.json({ status: true, pair, payout: cfg.payout ?? 85, control: k, price: priceAt(k), serverTime: Date.now() });
  } catch (e) { res.status(500).json({ status: false, message: e.message }); }
}
