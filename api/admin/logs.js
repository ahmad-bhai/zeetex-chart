import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  try {
    const snap = await db.ref('logs').limitToLast(200).get();
    const logsObj = snap.val() || {};
    const logs = Object.values(logsObj).sort((a, b) => b.ts - a.ts);
    return res.status(200).json({ status: true, logs });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
}
