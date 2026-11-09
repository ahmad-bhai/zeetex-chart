import { db } from '../lib/firebase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: false, message: 'POST only' });

  try {
    const { userId, pair, direction, amount, duration = 60 } = req.body || {};
    if (!userId || !pair || !direction || !amount) {
      return res.status(400).json({ status: false, code: 'MISSING_FIELDS', message: 'userId, pair, direction, amount required' });
    }
    if (!['buy', 'sell'].includes(direction)) {
      return res.status(400).json({ status: false, code: 'BAD_DIRECTION', message: 'direction must be buy|sell' });
    }

    const userSnap = await db.ref(`users/${userId}`).get();
    const user = userSnap.val();
    if (!user) return res.status(404).json({ status: false, code: 'USER_NOT_FOUND', message: 'User not found' });

    const pairSnap = await db.ref(`pairs/${pair}`).get();
    const pairConfig = pairSnap.val();
    if (!pairConfig) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND', message: 'NOT FOUND BRO' });

    const balance = Number(user.balance || 0);
    const amt = Number(amount);
    if (amt <= 0 || amt > balance) {
      return res.status(400).json({ status: false, code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance', balance });
    }

    const tradeId = db.ref('trades').push().key;
    const now = Date.now();
    const trade = {
      id: tradeId,
      userId, pair, direction,
      amount: amt,
      payout: pairConfig.payout ?? 85,
      duration,
      status: 'open',
      entryTime: now,
      expiryTime: now + duration * 1000,
      entryPrice: pairConfig.basePrice,
      result: null,
    };

    await db.ref(`trades/${userId}/${tradeId}`).set(trade);
    await db.ref(`users/${userId}/balance`).set(balance - amt);
    await db.ref(`logs/${now}_${tradeId}`).set({ ts: now, type: 'trade_open', userId, pair, direction, amount: amt, tradeId });

    return res.status(200).json({ status: true, code: 'OK', trade, newBalance: balance - amt });
  } catch (err) {
    console.error('[TRADE_ERROR]', err);
    return res.status(500).json({ status: false, code: 'SERVER_ERROR', message: err.message });
  }
}
