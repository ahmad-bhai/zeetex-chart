import { db } from '../../lib/firebase.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: false });
  const { userId, password } = req.body || {};
  const user = userId ? (await db.ref(`users/${userId}`).get()).val() : null;
  if (!user || user.password !== password) return res.status(401).json({ status: false, message: 'Invalid credentials' });
  if (user.active === false) return res.status(403).json({ status: false, message: 'Account blocked' });
  res.json({ status: true, user: { id: user.id, name: user.name } });
}
