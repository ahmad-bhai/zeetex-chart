import { db } from '../../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: false });
  const { userId, password } = req.body;

  const snap = await db.ref(`users/${userId}`).get();
  const user = snap.val();

  if (!user || user.password !== password) {
    return res.status(401).json({ status: false, message: 'Invalid credentials' });
  }
  res.status(200).json({ status: true, user: { id: user.id, name: user.name } });
}
