import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';
import { TFMS, DURS, ck, setControl, getMode } from '../../lib/engine.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-employee');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') return res.json({ status: true, control: (await db.ref('control').once('value')).val() || {} });
    const { pair, tf = '1m', dur = 60, dir, speed } = req.body || {};
    if (!TFMS[tf] || !DURS.includes(Number(dur))) return res.status(400).json({ status: false, code: 'BAD_PARAMS' });
    const cfg = (await db.ref(`pairs/${pair}`).once('value')).val();
    if (!cfg) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND' });
    if ((await getMode(pair)) === 'auto') return res.status(409).json({ status: false, code: 'AUTO_MODE', message: 'AUTO mode is ON for this pair. Switch to MANUAL in admin panel first.' });
    const c = await setControl(ck(pair, tf, Number(dur)), cfg, dir, speed, req.headers['x-employee'] || 'admin');
    res.json({ status: true, control: c, serverTime: Date.now() });
  } catch (e) { res.status(500).json({ status: false, message: e.message }); }
}
