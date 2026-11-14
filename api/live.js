import { db } from '../lib/firebase.js';
import { TFMS, DURS, ck, priceAt, defCtl, getSegs, lastCtl, autoStep } from '../lib/engine.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { pair, tf = '1m', dur = '60' } = req.query, now = Date.now(), d = Number(dur);
    if (!pair) {
      const P = (await db.ref('pairs').once('value')).val() || {};
      return res.status(200).json({ status: true, serverTime: now, pairs: Object.keys(P).filter(k => P[k] && P[k].active !== false).map(k => ({ name: k, payout: P[k].payout ?? 85, price: priceAt(defCtl(P[k]), now) })) });
    }
    if (!TFMS[tf] || !DURS.includes(d)) return res.status(400).json({ status: false, code: 'BAD_PARAMS' });
    const cfg = (await db.ref(`pairs/${pair}`).once('value')).val();
    if (!cfg || cfg.active === false) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND', pair });
    await autoStep(pair, tf, d, cfg).catch(() => {});   // users polling keeps AUTO mode alive
    const k = lastCtl(await getSegs(ck(pair, tf, d), cfg), cfg);
    res.status(200).json({ status: true, pair, payout: cfg.payout ?? 85, control: k, price: priceAt(k, now), serverTime: now });
  } catch (e) { res.status(500).json({ status: false, code: 'SERVER_ERROR', message: e.message, stack: String(e.stack).split('\n').slice(0, 3) }); }
}
