import { db } from '../lib/firebase.js';
import { priceAt, ctl } from '../lib/priceEngine.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { userId, tradeId } = req.body || {};
    const ref = db.ref(`trades/${userId}/${tradeId}`), bal = db.ref(`users/${userId}/balance`);
    const t = (await ref.get()).val();
    if (!t) return res.status(404).json({ status: false, code: 'TRADE_NOT_FOUND' });
    if (t.status !== 'open') return res.json({ status: true, trade: t, newBalance: (await bal.get()).val() });
    if (Date.now() < t.expiryTime - 300) return res.status(400).json({ status: false, code: 'TOO_EARLY' });
    const lock = await ref.child('status').transaction(s => (s === 'open' ? 'settling' : undefined));
    if (!lock.committed) return res.json({ status: true, trade: (await ref.get()).val(), newBalance: (await bal.get()).val() });
    const cfg = (await db.ref(`pairs/${t.pair}`).get()).val() || { basePrice: t.entryPrice };
    const close = priceAt(ctl(t.pair, cfg, (await db.ref(`control/${t.pair}`).get()).val()));
    const tie = Math.abs(close - t.entryPrice) < 1e-9;
    const win = t.direction === 'buy' ? close > t.entryPrice : close < t.entryPrice;
    const pnl = tie ? 0 : win ? +(t.amount * t.payout / 100).toFixed(2) : -t.amount;
    await ref.update({ status: 'closed', closePrice: close, result: tie ? 'tie' : win ? 'win' : 'loss', pnl, closedAt: Date.now() });
    const credit = tie ? t.amount : win ? t.amount + pnl : 0;
    if (credit) await bal.transaction(b => (Number(b) || 0) + credit);
    await db.ref(`logs/${Date.now()}_${tradeId}`).set({ ts: Date.now(), type: 'trade_close', userId, tradeId, pair: t.pair, pnl });
    res.json({ status: true, trade: (await ref.get()).val(), newBalance: (await bal.get()).val() });
  } catch (e) { res.status(500).json({ status: false, code: 'SERVER_ERROR', message: e.message }); }
}
