import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET') {
      const snap = await db.ref('settings').get();
      return res.status(200).json({ status: true, settings: snap.val() || { candleBias: 0, volatilityMult: 1 } });
    }
    if (req.method === 'POST') {
      const { candleBias = 0, volatilityMult = 1 } = req.body || {};
      const data = {
        candleBias: Math.max(-1, Math.min(1, Number(candleBias))),
        volatilityMult: Math.max(0.1, Math.min(5, Number(volatilityMult))),
        updatedAt: Date.now(),
      };
      await db.ref('settings').set(data);
      return res.status(200).json({ status: true, settings: data });
    }
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
}
