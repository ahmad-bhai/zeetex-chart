import { db } from '../lib/firebase.js';
import { settleTrade } from '../lib/engine.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { userId, tradeId } = req.body || {};
    if (!userId || !tradeId) return res.status(400).json({ status: false, code: 'MISSING_PARAMS' });
    const bal = async () => (await db.ref(`users/${userId}/balance`).once('value')).val();
    let t = (await db.ref(`trades/${userId}/${tradeId}`).once('value')).val();
    if (!t) return res.status(404).json({ status: false, code: 'TRADE_NOT_FOUND' });
    if (t.status === 'open') {
      if (Date.now() < t.expiryTime - 200) return res.status(400).json({ status: false, code: 'TOO_EARLY' });
      t = (await settleTrade(t)) || (await db.ref(`trades/${userId}/${tradeId}`).once('value')).val();
    }
    res.status(200).json({ status: true, trade: t, newBalance: await bal() });
  } catch (e) { console.error('[SETTLE]', e); res.status(500).json({ status: false, code: 'SERVER_ERROR', message: e.message, stack: String(e.stack).split('\n').slice(0, 3) }); }
}
