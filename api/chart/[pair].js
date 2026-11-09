import { getUser, getPair } from '../../../lib/store.js';
import { generateCandles } from '../../../lib/candleGenerator.js';

export default function handler(req, res) {
  // CORS — dashboard kisi bhi origin se call kar sake
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ status: false, message: 'Method not allowed' });
  }

  const { pair } = req.query;
  const { id: userId, tf = '1m', limit = '200' } = req.query;

  // Log entry
  const logEntry = {
    ts: new Date().toISOString(),
    pair,
    userId,
    tf,
    ip: req.headers['x-forwarded-for'] || 'unknown',
  };
  console.log('[CHART_API]', JSON.stringify(logEntry));

  // Validate user
  if (!userId) {
    return res.status(400).json({
      status: false,
      code: 'USER_ID_REQUIRED',
      message: 'id (userid) query param required hai bhai',
    });
  }

  const user = getUser(userId);
  if (!user) {
    return res.status(404).json({
      status: false,
      code: 'USER_NOT_FOUND',
      message: 'User not found — admin panel se user create karo',
      userId,
    });
  }

  if (user.active === false) {
    return res.status(403).json({
      status: false,
      code: 'USER_BLOCKED',
      message: 'Ye user blocked hai',
      userId,
    });
  }

  // Validate pair
  const pairConfig = getPair(pair);
  if (!pairConfig) {
    return res.status(404).json({
      status: false,
      code: 'PAIR_NOT_FOUND',
      message: 'NOT FOUND BRO',
      pair,
    });
  }

  // Check kya user ko ye pair access hai
  if (Array.isArray(user.pairs) && !user.pairs.includes(pair)) {
    return res.status(403).json({
      status: false,
      code: 'PAIR_NOT_ALLOWED',
      message: 'Ye pair aapke account pe allowed nahi hai',
      pair,
      allowedPairs: user.pairs,
    });
  }

  const candleCount = Math.min(parseInt(limit, 10) || 200, 1000);

  const candles = generateCandles({
    pairName: pair,
    pairConfig,
    userId,
    timeframe: tf,
    count: candleCount,
  });

  // Trade stats (placeholder — baad me trade log se aayega)
  const tradeStats = {
    balance: user.balance ?? 0,
    openTrades: 0,
    totalTrades: 0,
    winRate: 0,
  };

  return res.status(200).json({
    status: true,
    code: 'OK',
    pair,
    user: {
      id: user.id,
      name: user.name,
      traderId: user.id,
    },
    timeframe: tf,
    payout: pairConfig.payout ?? 0,
    stats: tradeStats,
    count: candles.length,
    candle: candles,     // sara data
    serverTime: Date.now(),
    nextCandleAt: candles[candles.length - 1].time * 1000 + (tf === '1m' ? 60_000 : tf === '5m' ? 300_000 : 900_000),
  });
}
