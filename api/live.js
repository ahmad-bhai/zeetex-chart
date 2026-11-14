import { db } from '../lib/firebase.js';
import { priceAt, ctl } from '../lib/priceEngine.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  let step = 'start';
  try {
    const { pair } = req.query;
    step = 'read';
    if (!pair) {
      const [p, c] = await Promise.all([db.ref('pairs').once('value'), db.ref('control').once('value')]);
      const P = p.val() || {}, C = c.val() || {};
      const list = Object.keys(P).filter(k => P[k] && P[k].active !== false).map(k => ({ name: k, payout: P[k].payout ?? 85, price: priceAt(ctl(k, P[k], C[k])) }));
      return res.status(200).json({ status: true, serverTime: Date.now(), pairs: list });
    }
    const [p, c] = await Promise.all([db.ref(`pairs/${pair}`).once('value'), db.ref(`control/${pair}`).once('value')]);
    const cfg = p.val();
    if (!cfg || cfg.active === false) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND', pair });
    const controlObj = ctl(pair, cfg, c.val());
    res.status(200).json({ status: true, pair, payout: cfg.payout ?? 85, control: controlObj, price: priceAt(controlObj), serverTime: Date.now() });
  } catch (e) {
    console.error('[LIVE]', step, e);
    res.status(500).json({ status: false, code: 'SERVER_ERROR', step, message: e.message, stack: String(e.stack).split('\n').slice(0, 3) });
  }
}
