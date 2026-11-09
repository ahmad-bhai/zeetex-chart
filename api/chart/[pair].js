import { db } from '../../lib/firebase.js';
import { generateCandles } from '../../lib/candleGenerator.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ status: false, message: 'GET only' });

  try {
    const { pair } = req.query;
    const { id: userId, tf = '1m', limit = '200' } = req.query;

    console.log('[CHART_API]', JSON.stringify({
      ts: new Date().toISOString(), pair, userId, tf,
      ip: req.headers['x-forwarded-for'] || 'unknown',
    }));

    if (!pair) return res.status(400).json({ status: false, code: 'PAIR_REQUIRED', message: 'pair required' });
    if (!userId) return res.status(400).json({ status: false, code: 'USER_ID_REQUIRED', message: 'id (userid) required bhai' });

    // User check
    const userSnap = await db.ref(`users/${userId}`).get();
    const user = userSnap.val();
    if (!user) return res.status(404).json({ status: false, code: 'USER_NOT_FOUND', message: 'User not found', userId });
    if (user.active === false) return res.status(403).json({ status: false, code: 'USER_BLOCKED', message: 'User blocked', userId });

    // Pair check
    const pairSnap = await db.ref(`pairs/${pair}`).get();
    const pairConfig = pairSnap.val();
    if (!pairConfig) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND', message: 'NOT FOUND BRO', pair });
    if (pairConfig.active === false) return res.status(403).json({ status: false, code: 'PAIR_DISABLED', message: 'Pair disabled', pair });

    // Pair allowed for user?
    if (Array.isArray(user.pairs) && user.pairs.length > 0 && !user.pairs.includes(pair)) {
      return res.status(403).json({ status: false, code: 'PAIR_NOT_ALLOWED', message: 'Pair not allowed for this user', pair, allowedPairs: user.pairs });
    }

    // Global settings (admin se candle upar/neeche)
    const settingsSnap = await db.ref('settings').get();
    const settings = settingsSnap.val() || {};

    const count = Math.min(parseInt(limit, 10) || 200, 1000);
    const candles = generateCandles({ pairName: pair, pairConfig, userId, timeframe: tf, count, settings });

    // Trade stats
    const tradesSnap = await db.ref(`trades/${userId}`).limitToLast(200).get();
    const tradesObj = tradesSnap.val() || {};
    const trades = Object.values(tradesObj);
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.result === 'win').length;
    const winRate = totalTrades ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;
    const openTrades = trades.filter(t => t.status === 'open').length;

    return res.status(200).json({
      status: true,
      code: 'OK',
      pair,
      user: { id: userId, name: user.name, traderId: user.traderId || userId },
      timeframe: tf,
      payout: pairConfig.payout ?? 85,
      stats: { balance: Number(user.balance ?? 0), openTrades, totalTrades, winRate },
      count: candles.length,
      candle: candles,
      serverTime: Date.now(),
      nextCandleAt: candles[candles.length - 1].time * 1000 + ({ '1m': 60_000, '5m': 300_000, '15m': 900_000 }[tf] || 60_000),
    });
  } catch (err) {
    console.error('[CHART_API_ERROR]', err);
    return res.status(500).json({ status: false, code: 'SERVER_ERROR', message: err.message });
  }
}
