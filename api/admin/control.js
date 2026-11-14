import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';
import { TFMS, DURS, ck, setControl, getMode } from '../../lib/engine.js';
// One function for: manual candle control AND auto/manual mode (keeps the project under Vercel's 12-function limit)
//  POST { pair, tf, dur, dir, speed }      -> move that chart (only when pair is in MANUAL mode)
//  POST { mode:'auto'|'manual' }           -> global switch (clears per-pair overrides)
//  POST { pair, mode:'auto'|'manual' }     -> one pair only
//  GET                                     -> { control, mode:{global,pairs} }
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-employee');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') {
      const [c, g, m] = await Promise.all([db.ref('control').once('value'), db.ref('config/mode').once('value'), db.ref('modes').once('value')]);
      return res.json({ status: true, control: c.val() || {}, mode: { global: g.val() || 'manual', pairs: m.val() || {} } });
    }
    const body = req.body || {}, by = req.headers['x-employee'] || 'admin';
    if (body.mode !== undefined) {
      const { pair, mode } = body;
      if (!['auto', 'manual'].includes(mode)) return res.status(400).json({ status: false, message: 'mode must be auto|manual' });
      if (pair) await db.ref(`modes/${pair}`).set(mode); else { await db.ref('config/mode').set(mode); await db.ref('modes').remove(); }
      await db.ref(`logs/${Date.now()}_mode`).set({ ts: Date.now(), type: 'mode', pair: pair || 'ALL', mode, by });
      return res.json({ status: true, pair: pair || 'ALL', mode });
    }
    const { pair, tf = '1m', dur = 60, dir, speed } = body;
    if (!TFMS[tf] || !DURS.includes(Number(dur))) return res.status(400).json({ status: false, code: 'BAD_PARAMS' });
    const cfg = (await db.ref(`pairs/${pair}`).once('value')).val();
    if (!cfg) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND' });
    if ((await getMode(pair)) === 'auto') return res.status(409).json({ status: false, code: 'AUTO_MODE', message: 'AUTO mode is ON for this pair. Switch to MANUAL in admin panel first.' });
    const c = await setControl(ck(pair, tf, Number(dur)), cfg, dir, speed, by);
    res.json({ status: true, control: c, serverTime: Date.now() });
  } catch (e) { res.status(500).json({ status: false, message: e.message }); }
}
