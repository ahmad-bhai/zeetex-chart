import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET') {
      const snap = await db.ref('pairs').get();
      return res.status(200).json({ status: true, pairs: snap.val() || {} });
    }

    if (req.method === 'POST') {
      const { pair, basePrice, volatility, payout, active = true } = req.body || {};
      if (!pair) return res.status(400).json({ status: false, message: 'pair name required' });
      const data = {
        basePrice: Number(basePrice) || 100,
        volatility: Number(volatility) || 0.1,
        payout: Number(payout) || 85,
        active: !!active,
        updatedAt: Date.now(),
      };
      await db.ref(`pairs/${pair}`).set(data);
      await db.ref(`logs/${Date.now()}_pair`).set({ ts: Date.now(), type: 'pair_upsert', pair, data });
      return res.status(200).json({ status: true, pair, data });
    }

    if (req.method === 'DELETE') {
      const { pair } = req.query;
      if (!pair) return res.status(400).json({ status: false, message: 'pair required' });
      await db.ref(`pairs/${pair}`).remove();
      await db.ref(`logs/${Date.now()}_pair`).set({ ts: Date.now(), type: 'pair_remove', pair });
      return res.status(200).json({ status: true, removed: pair });
    }

    return res.status(405).json({ status: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('[PAIRS_ADMIN]', err);
    return res.status(500).json({ status: false, message: err.message });
  }
}
