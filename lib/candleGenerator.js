function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function round(v, vol) {
  const decimals = vol < 0.001 ? 5 : vol < 1 ? 4 : 2;
  return Number(v.toFixed(decimals));
}

const tfMsMap = {
  '5s': 5_000,
  '10s': 10_000,
  '15s': 15_000,
  '30s': 30_000,
  '1m': 60_000,
  '2m': 120_000,
  '3m': 180_000,
  '5m': 300_000,
  '10m': 600_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

export function generateCandles({ pairName, pairConfig, userId, timeframe = '1m', count = 200, settings = {} }) {
  const tfMs = tfMsMap[timeframe] || 60_000;
  const now = Date.now();
  const lastBucket = Math.floor(now / tfMs) * tfMs;

  const bias = Number(settings.candleBias ?? 0);
  const volMult = Number(settings.volatilityMult ?? 1);
  const basePrice = Number(pairConfig.basePrice ?? 100);
  const vol = Number(pairConfig.volatility ?? 0.1) * volMult;

  const candles = [];
  let price = basePrice;

  for (let i = count; i >= 0; i--) {
    const bucket = lastBucket - i * tfMs;
    const seed = hashString(`${pairName}:${bucket}:${userId}:${bias}`);
    const rand = mulberry32(seed);

    const open = price;
    const m1 = (rand() - 0.5) * 2 * vol;
    const m2 = (rand() - 0.5) * 2 * vol;
    const m3 = (rand() - 0.5) * 2 * vol;
    const biasShift = bias * vol * 0.8;
    const close = open + m1 + m2 * 0.5 + m3 * 0.3 + biasShift;
    const high = Math.max(open, close) + Math.abs(m1) * 0.6 + rand() * vol * 0.4;
    const low  = Math.min(open, close) - Math.abs(m2) * 0.6 - rand() * vol * 0.4;

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
