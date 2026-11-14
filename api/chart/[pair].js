import { db } from '../../lib/firebase.js';
import { TFMS, DURS, ck, getSegs, lastCtl, makePrice, buildCandles, getMode } from '../../lib/engine.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ status: false, message: 'GET only' });

  try {
    const { pair, id: userId, tf = '1m', dur = '60', limit = '300' } = req.query, d = Number(dur);
    if (!pair) return res.status(400).json({ status: false, code: 'PAIR_REQUIRED', message: 'pair required' });
    if (!userId) return res.status(400).json({ status: false, code: 'USER_ID_REQUIRED', message: 'id (userid) required' });
    if (!TFMS[tf]) return res.status(400).json({ status: false, code: 'BAD_TF', message: 'bad candle time' });
    if (!DURS.includes(d)) return res.status(400).json({ status: false, code: 'BAD_DURATION', message: 'bad trade time' });

    // Backend se user data fetch karein (Local storage ki bajaye Firebase se)
    const userSnap = await db.ref(`users/${userId}`).once('value');
    const user = userSnap.val();
    if (!user) return res.status(404).json({ status: false, code: 'USER_NOT_FOUND', message: 'User not found', userId });
    if (user.active === false) return res.status(403).json({ status: false, code: 'USER_BLOCKED', message: 'User blocked', userId });

    const cfg = (await db.ref(`pairs/${pair}`).once('value')).val();
    if (!cfg) return res.status(404).json({ status: false, code: 'PAIR_NOT_FOUND', message: 'NOT FOUND BRO', pair });
    if (cfg.active === false) return res.status(403).json({ status: false, code: 'PAIR_DISABLED', message: 'Pair disabled', pair });

    const key = ck(pair, tf, d);
    const segs = await getSegs(key, cfg);
    const now = Date.now();
    
    // Purani candles aur real-time movement maintain rahegi
    const candles = buildCandles(makePrice(key, cfg, segs), tf, Math.min(parseInt(limit, 10) || 300, 600), now);
    
    // Backend se trades fetch karein taake refresh par bhi trades zinda rahein
    const allTradesSnap = await db.ref(`trades/${userId}`).limitToLast(100).once('value');
    const tradesObj = allTradesSnap.val() || {};
    const trades = Object.values(tradesObj).sort((a, b) => b.entryTime - a.entryTime);
    const wins = trades.filter(t => t.result === 'win').length;

    res.status(200).json({
      status: true,
      code: 'OK',
      pair,
      user: { id: userId, name: user.name, traderId: user.traderId || userId, balance: Number(user.balance ?? 0) },
      timeframe: tf,
      duration: d,
      payout: cfg.payout ?? 85,
      mode: await getMode(pair),
      control: lastCtl(segs, cfg),
      stats: {
        balance: Number(user.balance ?? 0),
        openTrades: trades.filter(t => t.status === 'open').length,
        totalTrades: trades.length,
        winRate: trades.length ? +(wins / trades.length * 100).toFixed(1) : 0
      },
      trades,
      count: candles.length,
      candle: candles,
      serverTime: now,
    });
  } catch (e) {
    console.error('[CHART_API]', e);
    res.status(500).json({ status: false, code: 'SERVER_ERROR', message: e.message });
  }
}
