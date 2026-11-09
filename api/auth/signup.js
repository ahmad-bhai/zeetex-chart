import { db } from '../../lib/firebase.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: false });
  const { id, name, password } = req.body || {};
  if (!/^\d{4,12}$/.test(String(id)) || !name || String(password || '').length < 6) return res.status(400).json({ status: false, message: 'ID 4-12 digits, name and password (min 6) required' });
  if ((await db.ref(`users/${id}`).get()).exists()) return res.status(400).json({ status: false, message: 'User ID already exists' });
  await db.ref(`users/${id}`).set({ id: String(id), name, password, balance: 500, active: true, pairs: [], traderId: String(id) });
  res.json({ status: true, message: 'User created' });
}
