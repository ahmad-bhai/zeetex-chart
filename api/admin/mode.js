import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';
// POST { mode:'auto'|'manual' }            -> global switch (clears per-pair overrides)
// POST { pair:'USDPKR-OTC', mode:'auto' }  -> one pair only
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-employee');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') { const [g, m] = await Promise.all([db.ref('config/mode').once('value'), db.ref('modes').once('value')]); return res.json({ status: true, global: g.val() || 'manual', pairs: m.val() || {} }); }
    const { pair, mode } = req.body || {};
    if (!['auto', 'manual'].includes(mode)) return res.status(400).json({ status: false, message: 'mode must be auto|manual' });
    if (pair) await db.ref(`modes/${pair}`).set(mode); else { await db.ref('config/mode').set(mode); await db.ref('modes').remove(); }
    await db.ref(`logs/${Date.now()}_mode`).set({ ts: Date.now(), type: 'mode', pair: pair || 'ALL', mode, by: req.headers['x-employee'] || 'admin' });
    res.json({ status: true, pair: pair || 'ALL', mode });
  } catch (e) { res.status(500).json({ status: false, message: e.message }); }
}
