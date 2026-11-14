import { db } from '../../lib/firebase.js';
import { requireAdmin } from '../../lib/auth.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-employee');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') {
      const u = (await db.ref('users').once('value')).val() || {};
      for (const k in u) delete u[k].password;          // never send passwords
      return res.status(200).json({ status: true, users: u });
    }
    if (req.method === 'POST') {
      const { id, name, balance, pairs, active, password } = req.body || {};
      if (!id) return res.status(400).json({ status: false, message: 'id required' });
      const ref = db.ref(`users/${id}`), ex = (await ref.once('value')).val() || {};
      const data = { ...ex, id: String(id), traderId: String(id), name: name ?? ex.name ?? 'Trader', balance: balance !== undefined ? Number(balance) || 0 : Number(ex.balance ?? 500), pairs: Array.isArray(pairs) ? pairs : (ex.pairs || []), active: active !== undefined ? !!active : ex.active !== false, updatedAt: Date.now() };
      if (password) data.password = String(password);
      await ref.set(data);
      await db.ref(`logs/${Date.now()}_user`).set({ ts: Date.now(), type: 'user_upsert', id: String(id) });
      const { password: _p, ...safe } = data;
      return res.status(200).json({ status: true, user: safe });
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ status: false, message: 'id required' });
      await Promise.all([db.ref(`users/${id}`).remove(), db.ref(`trades/${id}`).remove()]);
      return res.status(200).json({ status: true, removed: id });
    }
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  } catch (e) { console.error('[USERS]', e); res.status(500).json({ status: false, message: e.message }); }
}
