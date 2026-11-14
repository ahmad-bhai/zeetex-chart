import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';
import { priceAt, getSegs, lastCtl } from '../../lib/engine.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-employee');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') return res.json({ status: true, control: (await db.ref('control').once('value')).val() || {} });
    const { pair, dir, speed } = req.body || {};
    const cfg = (await db.ref(`pairs/${pair}`).once('value')).val();
    if (!cfg) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND' });
    const old = lastCtl(await getSegs(pair, cfg), cfg), now = Date.now();
    const n = { pair, dir: ['up', 'down', 'flat'].includes(dir) ? dir : 'flat', speed: Math.max(0.2, Math.min(5, Number(speed) || 1)), price: priceAt(old, now), since: now, by: req.headers['x-employee'] || 'admin' };
    await Promise.all([db.ref(`control/${pair}`).set(n), db.ref(`ctlLog/${pair}/${now}`).set(n), db.ref(`logs/${now}_ctl`).set({ ts: now, type: 'control', ...n })]);
    res.json({ status: true, control: { ...n, vol: Number(cfg.volatility) || 0.1 }, serverTime: now });
  } catch (e) { res.status(500).json({ status: false, message: e.message }); }
}
