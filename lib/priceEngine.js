// ONE engine for everything: chart candles, live price, trade entry, trade settle, admin view.
import { db } from './firebase.js';
const nz = s => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
export const TFMS = { '5s': 5e3, '10s': 1e4, '15s': 15e3, '30s': 3e4, '1m': 6e4, '2m': 12e4, '3m': 18e4, '5m': 3e5, '10m': 6e5, '15m': 9e5, '30m': 18e5, '1h': 36e5, '4h': 144e5, '1d': 864e5 };
export const DURS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400];
export const r6 = v => +Number(v).toFixed(6);

// price inside ONE admin control segment (browser chart.js uses the exact same formula)
export function priceAt(c, t = Date.now()) {
  if (!c) return 100;
  if (c.dir === 'flat') return Number(c.price);
  const s = Math.max(0, (t - c.since) / 1000), d = c.dir === 'up' ? 1 : -1, sp = Number(c.speed) || 1, v = Number(c.vol) || 0.1;
  return Number(c.price) + d * sp * v * s * 0.05 + (nz(Math.floor(t / 500) + c.since % 97) - 0.5) * v * 0.2 * sp * Math.min(1, s / 2);
}
export const defCtl = cfg => ({ dir: 'flat', speed: 1, price: Number(cfg.basePrice) || 100, since: 0, vol: Number(cfg.volatility) || 0.1 });

// every admin action is a segment; history of segments = history of the chart
export async function getSegs(pair, cfg) {
  const [l, c] = await Promise.all([db.ref(`ctlLog/${pair}`).orderByKey().limitToLast(300).once('value'), db.ref(`control/${pair}`).once('value')]);
  const m = {}, vol = Number(cfg.volatility) || 0.1;
  Object.values(l.val() || {}).forEach(s => { if (s && s.since) m[s.since] = s; });
  if (c.val() && c.val().since) m[c.val().since] = c.val();
  return Object.values(m).map(s => ({ ...s, vol })).sort((a, b) => a.since - b.since);
}
export const lastCtl = (segs, cfg) => segs.length ? segs[segs.length - 1] : defCtl(cfg);

// full price(t): synthetic look-alike history before anchor A, then ONLY admin segments (no admin action => flat)
export function makePrice(pair, cfg, segs) {
  const base = Number(cfg.basePrice) || 100, vol = Number(cfg.volatility) || 0.1, P = [...pair].reduce((a, c) => a + c.charCodeAt(0), 0);
  const seg = t => { for (let i = segs.length - 1; i >= 0; i--) if (segs[i].since <= t) return priceAt(segs[i], t); return base; };
  const syn = t => vol * (6 * Math.sin(t / 2.3e6 + P) + 4 * Math.sin(t / 5.1e5 + P * 2) + 2.5 * Math.sin(t / 1.3e5 + P * 3) + 1.2 * Math.sin(t / 2.7e4 + P)) + (nz(Math.floor(t / 1000) + P) - 0.5) * vol * 0.35;
  const A = Math.min(Number(cfg.updatedAt) || Date.now(), segs.length ? segs[0].since : Infinity), pA = seg(A);
  return t => t >= A ? seg(t) : pA + syn(t) - syn(A);
}
export function buildCandles(price, tf, count, now) {
  const ms = TFMS[tf] || 6e4, last = Math.floor(now / ms) * ms, N = Math.min(24, Math.max(2, Math.floor(ms / 1000))), out = [];
  for (let i = count; i >= 0; i--) {
    const b = last - i * ms, end = i === 0 ? now : b + ms, o = price(b); let h = o, l = o, c = o;
    for (let k = 1; k <= N; k++) { const p = price(b + (end - b) * k / N); h = Math.max(h, p); l = Math.min(l, p); c = p; }
    out.push({ time: Math.floor(b / 1000), open: r6(o), high: r6(h), low: r6(l), close: r6(c), volume: 0 });
  }
  return out;
}
// settle one expired trade (safe against double-settle). Price at expiry comes from the same series as the chart.
export async function settleTrade(t) {
  const ref = db.ref(`trades/${t.userId}/${t.id}`);
  const lock = await ref.child('status').transaction(s => s === null ? s : s === 'open' ? 'settling' : undefined); // null-safe
  if (!lock.committed || lock.snapshot.val() !== 'settling') return null;
  const cfg = (await db.ref(`pairs/${t.pair}`).once('value')).val() || { basePrice: t.entryPrice };
  const price = makePrice(t.pair, cfg, await getSegs(t.pair, cfg));
  const close = r6(price(t.expiryTime)), entry = Number(t.entryPrice);
  const tie = Math.abs(close - entry) < 5e-7, win = t.direction === 'buy' ? close > entry : close < entry;
  const rate = Number(t.payout ?? cfg.payout ?? 85), pnl = tie ? 0 : win ? +(t.amount * rate / 100).toFixed(2) : -t.amount;
  const result = tie ? 'tie' : win ? 'win' : 'loss';
  await ref.update({ status: 'closed', closePrice: close, result, pnl, closedAt: Date.now() });
  const credit = tie ? t.amount : win ? t.amount + pnl : 0;
  if (credit) await db.ref(`users/${t.userId}/balance`).transaction(b => (Number(b) || 0) + credit);
  await db.ref(`logs/${Date.now()}_${t.id}`).set({ ts: Date.now(), type: 'trade_close', userId: t.userId, tradeId: t.id, pair: t.pair, result, pnl });
  return (await ref.once('value')).val();
}
