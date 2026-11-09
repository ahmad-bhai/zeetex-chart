// Own candle engine (canvas, no library) + same price function as the server
(function () {
  const nz = s => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
  window.priceAt = (c, t = Date.now()) => {
    if (!c) return null; if (c.dir === 'flat') return c.price;
    const s = (t - c.since) / 1000, d = c.dir === 'up' ? 1 : -1;
    return c.price + d * c.speed * c.vol * s * 0.05 + (nz(Math.floor(t / 500) + c.since % 97) - 0.5) * c.vol * 0.6 * c.speed * Math.min(1, s / 2);
  };
  window.decOf = p => p >= 500 ? 2 : p >= 50 ? 3 : p >= 5 ? 4 : 5;
  window.CandleChart = class {
    constructor(cv) {
      this.cv = cv; this.g = cv.getContext('2d'); this.C = []; this.tf = 60; this.dec = 4; this.cw = 10; this.off = 0;
      this.marks = []; this.price = 0; this.disp = 0; this.lo = 0; this.hi = 1; this.skew = 0; this.W = 0; this.H = 0;
      let d = null, pd = 0;
      cv.addEventListener('pointerdown', e => { d = { x: e.clientX, o: this.off }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', e => { if (d) this.off = Math.max(0, Math.min(this.C.length - 10, d.o + (e.clientX - d.x) / this.cw)); });
      cv.addEventListener('pointerup', () => d = null);
      cv.addEventListener('wheel', e => { e.preventDefault(); this.cw = Math.max(4, Math.min(36, this.cw * (e.deltaY > 0 ? .92 : 1.08))); }, { passive: false });
      cv.addEventListener('touchmove', e => { if (e.touches.length === 2) { const a = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pd) this.cw = Math.max(4, Math.min(36, this.cw * a / pd)); pd = a; } }, { passive: true });
      cv.addEventListener('touchend', () => pd = 0);
      new ResizeObserver(() => this.size()).observe(cv.parentElement); this.size(); this.draw();
    }
    size() { const r = this.cv.getBoundingClientRect(), p = devicePixelRatio || 1; this.W = r.width; this.H = r.height; this.cv.width = r.width * p; this.cv.height = r.height * p; this.g.setTransform(p, 0, 0, p, 0, 0); }
    // candles: [{time,open,high,low,close}] ; shifted so the last close equals the live price
    setData(c, price, tf, dec) {
      const sh = price - c[c.length - 1].close;
      this.C = c.map(k => ({ t: k.time, o: k.open + sh, h: k.high + sh, l: k.low + sh, c: k.close + sh }));
      this.tf = tf; this.dec = dec; this.price = this.disp = price; this.off = 0; this.lo = price * .999; this.hi = price * 1.001;
    }
    tick(price, now) {
      if (!this.C.length) return; this.price = price; const t = Math.floor(now / 1000 / this.tf) * this.tf, l = this.C[this.C.length - 1];
      if (t > l.t) { this.C.push({ t, o: l.c, h: Math.max(l.c, price), l: Math.min(l.c, price), c: price }); if (this.C.length > 1500) this.C.shift(); }
      else { l.c = price; l.h = Math.max(l.h, price); l.l = Math.min(l.l, price); }
    }
    draw() {
      requestAnimationFrame(() => this.draw());
      const { g, W, H, C } = this; g.clearRect(0, 0, W, H); if (!W || !C.length) return;
      const now = Date.now() + this.skew, AX = 66, pw = W - AX, R = pw * .86, cw = this.cw, fo = Math.floor(this.off), last = C.length - 1 - fo, first = Math.max(0, last - Math.ceil(R / cw) - 2);
      this.disp += (this.price - this.disp) * .2;
      const K = i => { const k = C[i]; return i === C.length - 1 ? { t: k.t, o: k.o, h: Math.max(k.h, this.disp), l: Math.min(k.l, this.disp), c: this.disp } : k; };
      let mn = 1e18, mx = -1e18; for (let i = first; i <= last; i++) { const k = K(i); mn = Math.min(mn, k.l); mx = Math.max(mx, k.h); }
      const span = Math.max(mx - mn, this.price * .0008), mid = (mx + mn) / 2, pad = span * .25;
      this.lo += (mid - span / 2 - pad - this.lo) * .15; this.hi += (mid + span / 2 + pad - this.hi) * .15;
      const Y = v => 14 + (this.hi - v) / (this.hi - this.lo) * (H - 44), X = i => R - (last - i + .5) * cw - (this.off % 1) * cw, f = v => v.toFixed(this.dec);
      g.font = '11px system-ui,sans-serif'; g.textBaseline = 'middle'; g.lineWidth = 1;
      for (let i = 0; i <= 7; i++) { const v = this.lo + (this.hi - this.lo) * i / 7, y = Math.round(Y(v)) + .5; g.strokeStyle = '#262a3c'; g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); g.fillStyle = '#8f95ad'; g.textAlign = 'left'; g.fillText(f(v), pw + 8, y); }
      const step = Math.max(1, Math.ceil(100 / cw)); g.textAlign = 'center';
      for (let i = first; i <= last; i++) if (Math.round(C[i].t / this.tf) % step === 0) { const x = Math.round(X(i)) + .5; g.strokeStyle = '#262a3c'; g.beginPath(); g.moveTo(x, 14); g.lineTo(x, H - 30); g.stroke(); g.fillStyle = '#8f95ad'; g.fillText(new Date(C[i].t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), x, H - 14); }
      const bw = Math.max(2, cw * .72);
      for (let i = first; i <= last; i++) {
        const k = K(i), x = X(i), col = k.c >= k.o ? '#0faf59' : '#ef5d4e'; g.fillStyle = g.strokeStyle = col;
        g.beginPath(); g.moveTo(Math.round(x) + .5, Y(k.h)); g.lineTo(Math.round(x) + .5, Y(k.l)); g.stroke();
        const y1 = Y(Math.max(k.o, k.c)), h = Math.max(1.5, Math.abs(Y(k.o) - Y(k.c))), r = Math.min(2, bw / 3);
        g.beginPath(); g.roundRect ? g.roundRect(x - bw / 2, y1, bw, h, r) : g.rect(x - bw / 2, y1, bw, h); g.fill();
      }
      for (const m of this.marks) { const y = Y(m.price), c = m.dir === 'buy' ? '#0faf59' : '#ef5d4e'; g.setLineDash([5, 4]); g.strokeStyle = c; g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); g.setLineDash([]); g.fillStyle = c; g.fillRect(8, y - 10, 96, 20); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText((m.dir === 'buy' ? '▲ ' : '▼ ') + '$' + m.amt + '  ' + Math.max(0, Math.ceil((m.exp - now) / 1000)) + 's', 13, y); }
      const py = Y(this.disp), left = Math.max(0, this.tf - (now / 1000) % this.tf), tm = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(Math.floor(left % 60)).padStart(2, '0');
      g.setLineDash([6, 5]); g.strokeStyle = '#e8ebf4'; g.beginPath(); g.moveTo(0, py); g.lineTo(pw, py); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#2b3047'; g.fillRect(pw * .45, py - 10, 52, 20); g.fillStyle = '#e8ebf4'; g.textAlign = 'center'; g.fillText(tm, pw * .45 + 26, py);
      g.fillStyle = '#2b99ff'; g.beginPath(); g.roundRect ? g.roundRect(pw + 2, py - 11, AX - 4, 22, 11) : g.rect(pw + 2, py - 11, AX - 4, 22); g.fill(); g.fillStyle = '#fff'; g.fillText(f(this.disp), pw + AX / 2, py);
    }
  };
})();
