const nz = s => { 
  const x = Math.sin(s * 12.9898) * 43758.5453; 
  return x - Math.floor(x); 
};

export const priceAt = (c, t = Date.now()) => {
  if (!c) return 100;
  if (c.dir === 'flat') return Number(c.price || 100);
  const s = Math.max(0, (t - (c.since || t)) / 1000);
  const d = c.dir === 'up' ? 1 : -1;
  const speed = Number(c.speed || 1);
  const vol = Number(c.vol || 0.1);
  const base = Number(c.price || 100);
  return base + d * speed * vol * s * 0.05 + (nz(Math.floor(t / 500) + (c.since || 0) % 97) - 0.5) * vol * 0.2 * speed * Math.min(1, s / 2);
};

export const ctl = (name, cfg, c) => ({
  pair: name,
  dir: c && c.dir ? c.dir : 'flat',
  speed: c && c.speed !== undefined ? Number(c.speed) : 1,
  price: c && c.price !== undefined ? Number(c.price) : Number(cfg.basePrice || 100),
  since: c && c.since ? c.since : Date.now(),
  vol: Number(cfg.volatility || 0.1)
});
