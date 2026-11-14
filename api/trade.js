import { db } from '../lib/firebase.js';
import { TFMS, DURS, ck, getSegs, makePrice, r6, autoStep } from '../lib/engine.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: false, message: 'POST only' });
  try {
    const { userId, pair, direction, amount, duration = 60, tf = '1m' } = req.body || {};
    if (!userId || !pair || !direction || !amount) return res.status(400).json({ status: false, code: 'MISSING_FIELDS', message: 'userId, pair, direction, amount required' });
    if (!['buy', 'sell'].includes(direction)) return res.status(400).json({ status: false, code: 'BAD_DIRECTION', message: 'direction must be buy|sell' });
    const dur = Number(duration);
    if (!DURS.includes(dur) || !TFMS[tf]) return res.status(400).json({ status: false, code: 'BAD_DURATION', message: 'invalid trade/candle time' });
    const user = (await db.ref(`users/${userId}`).once('value')).val();
    if (!user) return res.status(404).json({ status: false, code: 'USER_NOT_FOUND', message: 'User not found' });
    if (user.active === false) return res.status(403).json({ status: false, code: 'USER_BLOCKED', message: 'User blocked' });
    const cfg = (await db.ref(`pairs/${pair}`).once('value')).val();
    if (!cfg || cfg.active === false) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND', message: 'NOT FOUND BRO' });
    const amt = Number(amount), now = Date.now();
    if (!(amt >= 1)) return res.status(400).json({ status: false, code: 'BAD_AMOUNT', message: 'Minimum amount is 1' });
    if (Number(user.balance || 0) < amt) return res.status(400).json({ status: false, code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance' });
    const tx = await db.ref(`users/${userId}/balance`).transaction(b => b === null ? b : (Number(b) >= amt ? Number(b) - amt : undefined));
    if (!tx.committed) return res.status(400).json({ status: false, code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance' });
    const key = ck(pair, tf, dur), entry = r6(makePrice(key, cfg, await getSegs(key, cfg))(now));
    const id = db.ref('trades').push().key;
    const trade = { id, userId: String(userId), pair, tf, direction, amount: amt, payout: cfg.payout ?? 85, duration: dur, status: 'open', entryTime: now, expiryTime: now + dur * 1000, entryPrice: entry, result: null };
    await db.ref(`trades/${userId}/${id}`).set(trade);
    await db.ref(`openIdx/${key}/${id}`).set({ dir: direction, amt, exp: trade.expiryTime });
    await db.ref(`logs/${now}_${id}`).set({ ts: now, type: 'trade_open', userId, pair, tf, direction, amount: amt, tradeId: id });
    await autoStep(pair, tf, dur, cfg).catch(() => {});      // AUTO mode reacts instantly to the new money
    res.status(200).json({ status: true, code: 'OK', trade, newBalance: tx.snapshot.val() });
  } catch (e) { console.error('[TRADE]', e); res.status(500).json({ status: false, code: 'SERVER_ERROR', message: e.message }); }
}
