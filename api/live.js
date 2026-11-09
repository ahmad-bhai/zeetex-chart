import { db } from '../lib/firebase.js';

// Self-contained: does NOT import lib/priceEngine.js, so a missing file can't cause a 500.
const nz = s => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
const priceAt = (c, t = Date.now()) => {
  if (c.dir === 'flat') return c.price;
  const s = (t - c.since) / 1000, d = c.dir === 'up' ? 1 : -1;
  return c.price + d * c.speed * c.vol * s * 0.05 + (nz(Math.floor(t / 500) + c.since % 97) - 0.5) * c.vol * 0.6 * c.speed * Math.min(1, s / 2);
};
const ctl = (name, cfg, c) => ({ pair: name, dir: 'flat', speed: 1, price: Number(cfg.basePrice) || 100, since: Date.now(), ...(c || {}), vol: Number(cfg.volatility) || 0.1 });

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
    const k = ctl(pair, cfg, c.val());
    res.status(200).json({ status: true, pair, payout: cfg.payout ?? 85, control: k, price: priceAt(k), serverTime: Date.now() });
  } catch (e) {
    console.error('[LIVE]', step, e);
    res.status(500).json({ status: false, code: 'SERVER_ERROR', step, message: e.message, stack: String(e.stack).split('\n').slice(0, 3) });
  }
}
