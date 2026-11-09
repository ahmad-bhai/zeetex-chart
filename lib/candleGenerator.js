// Deterministic candle generator — same minute pe same candles aate hain
// Isse chart stable rahega har refresh pe.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pair + timestamp + user ke basis pe deterministic candles banata hai.
 * Live feel ke liye current minute ka candle "last" candle hoga jo tick karta rahega.
 */
export function generateCandles({ pairName, pairConfig, userId, timeframe = '1m', count = 200 }) {
  const tfMs = { '1m': 60_000, '5m': 300_000, '15m': 900_000 }[timeframe] || 60_000;
  const now = Date.now();
  const lastBucket = Math.floor(now / tfMs) * tfMs;

  const candles = [];
  let price = pairConfig.basePrice;
  const vol = pairConfig.volatility;

  for (let i = count; i >= 0; i--) {
    const bucket = lastBucket - i * tfMs;
    const seed = hashString(`${pairName}:${bucket}:${userId}`);
    const rand = mulberry32(seed);

    const open = price;
    const move1 = (rand() - 0.5) * 2 * vol;
    const move2 = (rand() - 0.5) * 2 * vol;
    const move3 = (rand() - 0.5) * 2 * vol;

    const close = open + move1 + move2 * 0.5 + move3 * 0.3;
    const high = Math.max(open, close) + Math.abs(move1) * 0.6 + rand() * vol * 0.4;
    const low = Math.min(open, close) - Math.abs(move2) * 0.6 - rand() * vol * 0.4;

    candles.push({
      time: Math.floor(bucket / 1000),
      open: round(open, vol),
      high: round(high, vol),
      low: round(low, vol),
      close: round(close, vol),
      volume: Math.floor(rand() * 900 + 100),
    });

    price = close;
  }

  return candles;
}

function round(v, vol) {
  const decimals = vol < 0.001 ? 5 : vol < 1 ? 4 : vol < 100 ? 2 : 2;
  return Number(v.toFixed(decimals));
}
