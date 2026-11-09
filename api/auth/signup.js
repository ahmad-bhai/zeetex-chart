import { db } from '../../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: false });
  const { id, name, password } = req.body;

  const snap = await db.ref(`users/${id}`).get();
  if (snap.exists()) return res.status(400).json({ status: false, message: 'User ID already exists' });

  await db.ref(`users/${id}`).set({
    id, name, password, // Note: Real app mein password hash karna chahiye
    balance: 10000, active: true, pairs: []
  });
  res.status(200).json({ status: true, message: 'User created' });
}
