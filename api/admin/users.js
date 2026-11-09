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
      const snap = await db.ref('users').get();
      return res.status(200).json({ status: true, users: snap.val() || {} });
    }

    if (req.method === 'POST') {
      const { id, name, balance = 10000, pairs = [], active = true } = req.body || {};
      if (!id) return res.status(400).json({ status: false, message: 'id required' });
      const data = {
        id: String(id), name: name || 'Trader',
        balance: Number(balance) || 0,
        pairs: Array.isArray(pairs) ? pairs : [],
        active: !!active,
        traderId: String(id),
        updatedAt: Date.now(),
      };
      await db.ref(`users/${id}`).set(data);
      await db.ref(`logs/${Date.now()}_user`).set({ ts: Date.now(), type: 'user_upsert', id, data });
      return res.status(200).json({ status: true, user: data });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ status: false, message: 'id required' });
      await db.ref(`users/${id}`).remove();
      return res.status(200).json({ status: true, removed: id });
    }

    return res.status(405).json({ status: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('[USERS_ADMIN]', err);
    return res.status(500).json({ status: false, message: err.message });
  }
}
