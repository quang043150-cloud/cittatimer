/* Solvo Timer — animated background library (Canvas 2D). Each scene gets a
   palette {shadow, mid, high} and draws frame(t) where t is scene time in seconds. */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
  function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  function rand(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  // 3D value noise
  const PERM = new Uint8Array(512); (function () { const r = rand(1337); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; })();
  const fade = t => t * t * (3 - 2 * t);
  function h3(x, y, z) { return PERM[(PERM[(PERM[x & 255] + y) & 255] + z) & 255] / 255; }
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
      l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v), w);
  }
  function fbm(x, y, z) { return noise3(x, y, z) * 0.6 + noise3(x * 2.1, y * 2.1, z * 1.3) * 0.28 + noise3(x * 4.3, y * 4.3, z * 1.7) * 0.12; }

  function baseFill(ctx, w, h, P, k) {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, mix(P.shadow, P.mid, k || 0.22)); g.addColorStop(1, P.shadow);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }

  const scenes = [];
  const def = (id, name, make) => scenes.push({ id, name, make });

  // 1. Bubbles — bokeh discs with ring bubbles
  def('bubbles', 'Violet Bubbles', (ctx) => {
    let w, h, items = [];
    return {
      resize(W, H) { w = W; h = H; const r = rand(7); items = []; const n = Math.round(w * h / 9000) + 30; for (let i = 0; i < n; i++) items.push({ x: r() * w, y: r() * h, r: 3 + Math.pow(r(), 3) * 60, vy: 4 + r() * 14, ph: r() * TAU, ring: r() < 0.35, a: 0.25 + r() * 0.6, hue: r() }); },
      frame(t, P) {
        baseFill(ctx, w, h, P, 0.3);
        for (const b of items) {
          const y = ((b.y - t * b.vy) % (h + 140) + h + 140) % (h + 140) - 70;
          const x = b.x + Math.sin(t * 0.4 + b.ph) * 18;
          const col = b.hue < 0.55 ? P.mid : P.high;
          if (b.ring) { ctx.strokeStyle = rgba(P.high, b.a * 0.5); ctx.lineWidth = Math.max(1, b.r * 0.12); ctx.beginPath(); ctx.arc(x, y, b.r * 0.6, 0, TAU); ctx.stroke(); ctx.fillStyle = rgba(P.high, b.a * 0.5); ctx.beginPath(); ctx.arc(x - b.r * 0.2, y - b.r * 0.2, b.r * 0.12, 0, TAU); ctx.fill(); }
          else { const g = ctx.createRadialGradient(x - b.r * 0.3, y - b.r * 0.3, 0, x, y, b.r); g.addColorStop(0, rgba(mix(col, '#ffffff', 0.35), b.a)); g.addColorStop(0.7, rgba(col, b.a * 0.7)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill(); }
        }
      }
    };
  });

  // 2. Topo Glow — animated contour lines (marching squares over fbm)
  def('topo', 'Topo Glow', (ctx) => {
    let w, h; const cell = 14;
    return {
      resize(W, H) { w = W; h = H; },
      frame(t, P) {
        const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, mix(P.shadow, P.mid, 0.55)); g.addColorStop(0.5, mix(P.shadow, P.mid, 0.25)); g.addColorStop(1, P.shadow);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        const cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1, f = new Float32Array(cols * rows), s = 0.0032, z = t * 0.05;
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) f[j * cols + i] = fbm(i * cell * s, j * cell * s, z);
        const levels = 11;
        for (let L = 1; L < levels; L++) {
          const iso = 0.2 + L * 0.055;
          ctx.strokeStyle = rgba(mix(P.mid, P.high, L / levels), 0.25 + 0.5 * (L / levels)); ctx.lineWidth = L % 3 === 0 ? 1.8 : 1;
          ctx.beginPath();
          for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
            const a = f[j * cols + i], b = f[j * cols + i + 1], c = f[(j + 1) * cols + i + 1], d = f[(j + 1) * cols + i];
            const idx = (a > iso) | (b > iso) << 1 | (c > iso) << 2 | (d > iso) << 3; if (idx === 0 || idx === 15) continue;
            const x = i * cell, y = j * cell, lp = (p, q) => (iso - p) / (q - p);
            const T = [x + cell * lp(a, b), y], R = [x + cell, y + cell * lp(b, c)], B = [x + cell * lp(d, c), y + cell], Lf = [x, y + cell * lp(a, d)];
            const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
            switch (idx) { case 1: case 14: seg(Lf, T); break; case 2: case 13: seg(T, R); break; case 3: case 12: seg(Lf, R); break; case 4: case 11: seg(R, B); break; case 5: seg(Lf, T); seg(R, B); break; case 6: case 9: seg(T, B); break; case 7: case 8: seg(Lf, B); break; case 10: seg(T, R); seg(Lf, B); break; }
          }
          ctx.stroke();
        }
      }
    };
  });

  // 3. Liquid Silk — warped flowing strands
  def('silk', 'Liquid Silk', (ctx) => {
    let w, h;
    return {
      resize(W, H) { w = W; h = H; },
      frame(t, P) {
        baseFill(ctx, w, h, P, 0.25);
        ctx.lineWidth = 1.2;
        for (let k = 0; k < 46; k++) {
          ctx.strokeStyle = rgba(k % 5 === 0 ? P.high : P.mid, 0.1 + (k % 7) * 0.035);
          ctx.beginPath();
          for (let x = -20; x <= w + 20; x += 16) {
            const y = h * 0.5 + (k - 23) * h * 0.02 + Math.sin(x * 0.004 + t * 0.35 + k * 0.12) * h * 0.18 + (noise3(x * 0.003, k * 0.08, t * 0.12) - 0.5) * h * 0.35;
            x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    };
  });

  // 4. Sakura Night — branches, moon, falling petals
  def('sakura', 'Sakura Night', (ctx) => {
    let w, h, petals = [], branches = null;
    function drawBranch(c, x, y, ang, len, wid, depth, r, blossoms) {
      if (depth === 0 || len < 6) return;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      c.strokeStyle = '#1a0f1c'; c.lineWidth = wid; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * len * 0.3, (y + y2) / 2 + (r() - 0.5) * len * 0.3, x2, y2); c.stroke();
      if (depth < 4) for (let i = 0; i < 5; i++) blossoms.push([x2 + (r() - 0.5) * 30, y2 + (r() - 0.5) * 30, 3 + r() * 6, r()]);
      const n = 2 + (r() < 0.3);
      for (let i = 0; i < n; i++) drawBranch(c, x2, y2, ang + (r() - 0.5) * 1.1, len * (0.62 + r() * 0.2), wid * 0.62, depth - 1, r, blossoms);
    }
    return {
      resize(W, H) {
        w = W; h = H; const r = rand(11); petals = []; for (let i = 0; i < 70; i++) petals.push({ x: r() * w, y: r() * h, s: 3 + r() * 5, sp: 18 + r() * 30, ph: r() * TAU, rot: r() * TAU });
        branches = document.createElement('canvas'); branches.width = w; branches.height = h; const c = branches.getContext('2d'); const bl = [];
        drawBranch(c, -20, h * 0.15, 0.25, Math.min(w, h) * 0.28, 16, 7, r, bl);
        drawBranch(c, w + 20, h * 0.95, Math.PI + 0.55, Math.min(w, h) * 0.3, 18, 7, r, bl);
        this.bl = bl;
      },
      frame(t, P) {
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, mix(P.shadow, P.mid, 0.35)); g.addColorStop(1, P.shadow); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        const mx = w * 0.82, my = h * 0.42, mr = Math.min(w, h) * 0.2; const mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 2.2); mg.addColorStop(0, rgba('#fbe7f0', 0.55)); mg.addColorStop(0.45, rgba(P.high, 0.12)); mg.addColorStop(1, rgba(P.high, 0)); ctx.fillStyle = mg; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = rgba('#f6dde9', 0.65); ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
        ctx.drawImage(branches, 0, 0);
        for (const b of this.bl) { ctx.fillStyle = rgba(b[3] < 0.5 ? '#f9a8c9' : '#fcd3e1', 0.85); ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, TAU); ctx.fill(); }
        for (const p of petals) {
          const y = (p.y + t * p.sp) % (h + 20) - 10, x = (p.x + Math.sin(t * 0.8 + p.ph) * 40 + t * 12) % (w + 20) - 10;
          ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot + t); ctx.fillStyle = rgba('#fbcfe0', 0.8); ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
        }
      }
    };
  });

  // 5. Hyperspace — star streaks from centre
  def('hyper', 'Hyperspace', (ctx) => {
    let w, h, stars = [];
    return {
      resize(W, H) { w = W; h = H; const r = rand(5); stars = []; for (let i = 0; i < 420; i++) stars.push({ a: r() * TAU, d: r(), s: 0.2 + r() * 0.8 }); },
      frame(t, P) {
        ctx.fillStyle = P.shadow; ctx.fillRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2, R = Math.hypot(w, h) / 2;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5); g.addColorStop(0, rgba(P.mid, 0.35)); g.addColorStop(1, rgba(P.mid, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.lineCap = 'round';
        for (const s of stars) {
          const d = ((s.d + t * 0.12 * s.s) % 1); const d0 = Math.pow(d, 2.2), d1 = Math.pow(Math.min(1, d + 0.04 * s.s), 2.2);
          ctx.strokeStyle = rgba(s.s > 0.7 ? P.high : mix(P.mid, '#ffffff', 0.4), Math.min(1, d * 1.6)); ctx.lineWidth = 0.5 + d * 2.2;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(s.a) * d0 * R, cy + Math.sin(s.a) * d0 * R); ctx.lineTo(cx + Math.cos(s.a) * d1 * R, cy + Math.sin(s.a) * d1 * R); ctx.stroke();
        }
      }
    };
  });

  // 6. Aurora Veil
  def('aurora', 'Aurora Veil', (ctx) => {
    let w, h;
    return {
      resize(W, H) { w = W; h = H; },
      frame(t, P) {
        ctx.fillStyle = P.shadow; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 4; k++) {
          const col = [P.mid, P.high, mix(P.mid, P.high, 0.5), P.mid][k];
          for (let x = 0; x < w; x += 6) {
            const base = h * (0.3 + k * 0.1) + (noise3(x * 0.002, k, t * 0.08) - 0.5) * h * 0.5;
            const len = h * (0.15 + noise3(x * 0.004, k + 9, t * 0.1) * 0.35);
            const g = ctx.createLinearGradient(0, base - len, 0, base); g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.8, rgba(col, 0.07)); g.addColorStop(1, rgba(col, 0));
            ctx.fillStyle = g; ctx.fillRect(x, base - len, 6, len);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    };
  });

  // 7. Hex Pulse
  def('hex', 'Hex Pulse', (ctx) => {
    let w, h;
    return {
      resize(W, H) { w = W; h = H; },
      frame(t, P) {
        ctx.fillStyle = P.shadow; ctx.fillRect(0, 0, w, h);
        const R = 26, dx = R * Math.sqrt(3), dy = R * 1.5;
        for (let row = -1; row * dy < h + R; row++) for (let col = -1; col * dx < w + R; col++) {
          const x = col * dx + (row % 2 ? dx / 2 : 0), y = row * dy;
          const d = Math.hypot(x - w / 2, y - h / 2); const wave = Math.max(0, Math.sin(d * 0.012 - t * 1.6)); const n = noise3(x * 0.01, y * 0.01, t * 0.2);
          const a = 0.06 + Math.pow(wave, 6) * 0.55 + n * 0.08;
          ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = Math.PI / 6 + i * Math.PI / 3; const px = x + Math.cos(an) * (R - 2), py = y + Math.sin(an) * (R - 2); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath();
          ctx.fillStyle = rgba(P.mid, a * 0.6); ctx.fill(); ctx.strokeStyle = rgba(P.high, a); ctx.lineWidth = 1; ctx.stroke();
        }
      }
    };
  });

  // 8. Glass Rain
  def('rain', 'Glass Rain', (ctx) => {
    let w, h, drops = [], streaks = [];
    return {
      resize(W, H) { w = W; h = H; const r = rand(3); drops = []; for (let i = 0; i < w * h / 2500; i++) drops.push({ x: r() * w, y: r() * h, r: 1 + Math.pow(r(), 2) * 6 }); streaks = []; for (let i = 0; i < 26; i++) streaks.push({ x: r() * w, sp: 40 + r() * 120, ph: r() * 10, r: 2 + r() * 4 }); },
      frame(t, P) {
        const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, mix(P.shadow, P.mid, 0.45)); g.addColorStop(1, mix(P.shadow, P.high, 0.12)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 5; i++) { const x = (noise3(i, 0, t * 0.03)) * w, y = noise3(0, i, t * 0.03) * h; const bg = ctx.createRadialGradient(x, y, 0, x, y, 220); bg.addColorStop(0, rgba(P.high, 0.16)); bg.addColorStop(1, rgba(P.high, 0)); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
        for (const d of drops) { ctx.fillStyle = rgba('#ffffff', 0.08); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill(); ctx.fillStyle = rgba('#ffffff', 0.35); ctx.beginPath(); ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.25, 0, TAU); ctx.fill(); }
        for (const s of streaks) { const y = ((t + s.ph) * s.sp) % (h + 200) - 100; const gg = ctx.createLinearGradient(0, y - 90, 0, y); gg.addColorStop(0, rgba('#ffffff', 0)); gg.addColorStop(1, rgba('#ffffff', 0.25)); ctx.fillStyle = gg; ctx.fillRect(s.x - 1, y - 90, 2, 90); ctx.fillStyle = rgba('#ffffff', 0.4); ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, TAU); ctx.fill(); }
      }
    };
  });

  // 9. Nebula Core — low-res fbm clouds scaled up
  def('nebula', 'Nebula Core', (ctx) => {
    let w, h, off, oc, stars = [];
    const S = 4;
    return {
      resize(W, H) { w = W; h = H; off = document.createElement('canvas'); off.width = Math.ceil(w / (S * 4)); off.height = Math.ceil(h / (S * 4)); oc = off.getContext('2d'); const r = rand(9); stars = []; for (let i = 0; i < 160; i++) stars.push([r() * w, r() * h, r() * 1.4 + 0.2, r()]); },
      frame(t, P) {
        const iw = off.width, ih = off.height, img = oc.createImageData(iw, ih), A = hexRgb(P.shadow), B = hexRgb(P.mid), C = hexRgb(P.high);
        for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
          const v = fbm(x * 0.06, y * 0.06, t * 0.04), u = Math.max(0, Math.min(1, (v - 0.3) * 2));
          const k = (y * iw + x) * 4; const m = u < 0.6 ? u / 0.6 : 1, m2 = u < 0.6 ? 0 : (u - 0.6) / 0.4;
          for (let c = 0; c < 3; c++) img.data[k + c] = A[c] + (B[c] - A[c]) * m + (C[c] - B[c]) * m2;
          img.data[k + 3] = 255;
        }
        oc.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, w, h);
        for (const s of stars) { ctx.fillStyle = rgba('#ffffff', 0.3 + 0.5 * Math.abs(Math.sin(t * 0.7 + s[3] * 9))); ctx.fillRect(s[0], s[1], s[2], s[2]); }
      }
    };
  });

  // 10. Plasma Storm — low-res plasma + lightning
  def('plasma', 'Plasma Storm', (ctx) => {
    let w, h, off, oc;
    return {
      resize(W, H) { w = W; h = H; off = document.createElement('canvas'); off.width = Math.ceil(w / 14); off.height = Math.ceil(h / 14); oc = off.getContext('2d'); },
      frame(t, P) {
        const iw = off.width, ih = off.height, img = oc.createImageData(iw, ih), A = hexRgb(P.shadow), B = hexRgb(P.mid), C = hexRgb(P.high);
        for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
          const v = (Math.sin(x * 0.12 + t * 0.7) + Math.sin(y * 0.15 - t * 0.5) + Math.sin((x + y) * 0.08 + t * 0.3) + Math.sin(Math.hypot(x - iw / 2, y - ih / 2) * 0.18 - t)) / 4;
          const u = Math.pow((v + 1) / 2, 1.6), k = (y * iw + x) * 4;
          for (let c = 0; c < 3; c++) img.data[k + c] = u < 0.5 ? A[c] + (B[c] - A[c]) * u * 2 : B[c] + (C[c] - B[c]) * (u - 0.5) * 2;
          img.data[k + 3] = 255;
        }
        oc.putImageData(img, 0, 0); ctx.drawImage(off, 0, 0, w, h);
        const flash = Math.sin(t * 0.9) > 0.985 || Math.sin(t * 1.37 + 2) > 0.99;
        if (flash) { const r = rand(Math.floor(t * 10)); ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); let x = r() * w, y = 0; ctx.moveTo(x, y); while (y < h) { x += (r() - 0.5) * 60; y += 20 + r() * 30; ctx.lineTo(x, y); } ctx.stroke(); }
      }
    };
  });

  // 11. Neon Ribbons
  def('ribbons', 'Neon Ribbons', (ctx) => {
    let w, h;
    return {
      resize(W, H) { w = W; h = H; },
      frame(t, P) {
        baseFill(ctx, w, h, P, 0.12);
        ctx.globalCompositeOperation = 'lighter';
        for (let r = 0; r < 3; r++) {
          for (let k = 0; k < 26; k++) {
            ctx.strokeStyle = rgba(r === 1 ? P.high : P.mid, 0.06 + (k / 26) * 0.06); ctx.lineWidth = 1.5; ctx.beginPath();
            for (let x = -20; x <= w + 20; x += 14) {
              const y = h * (0.3 + r * 0.22) + Math.sin(x * 0.006 + t * (0.5 + r * 0.15) + k * 0.06) * h * 0.12 * Math.sin(t * 0.2 + r + k * 0.03) + k * 3;
              x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    };
  });

  // 12. Event Horizon — black hole with accretion particles
  def('horizon', 'Event Horizon', (ctx) => {
    let w, h, ps = [];
    return {
      resize(W, H) { w = W; h = H; const r = rand(21); ps = []; for (let i = 0; i < 900; i++) ps.push({ a: r() * TAU, rr: 1.15 + Math.pow(r(), 2) * 1.8, s: r() }); },
      frame(t, P) {
        ctx.fillStyle = P.shadow; ctx.fillRect(0, 0, w, h);
        const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.13;
        const glow = ctx.createRadialGradient(cx, cy, R, cx, cy, R * 4); glow.addColorStop(0, rgba(P.high, 0.45)); glow.addColorStop(0.3, rgba(P.mid, 0.2)); glow.addColorStop(1, rgba(P.mid, 0)); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
        for (const p of ps) {
          const a = p.a + t * 0.6 / (p.rr * p.rr); const x = cx + Math.cos(a) * R * p.rr * 1.6, y = cy + Math.sin(a) * R * p.rr * 0.38;
          const front = Math.sin(a) > 0; ctx.fillStyle = rgba(p.s > 0.5 ? P.high : mix(P.mid, '#ffffff', 0.3), front ? 0.9 : 0.4); ctx.fillRect(x, y, 1.6, 1.6);
        }
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(P.high, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R * 1.02, 0, TAU); ctx.stroke();
      }
    };
  });

  // 13. Scramble Rain — falling move notation (cubing-themed)
  def('scramblerain', 'Scramble Rain', (ctx) => {
    let w, h, cols = [];
    const MOVES = ["R", "U", "F", "L", "D", "B", "R'", "U'", "F2", "R2", "M", "x", "y'", "Rw"];
    return {
      resize(W, H) { w = W; h = H; const r = rand(4); cols = []; for (let x = 0; x < w; x += 34) cols.push({ x, sp: 30 + r() * 70, off: r() * h, seed: Math.floor(r() * 1000) }); },
      frame(t, P) {
        ctx.fillStyle = P.shadow; ctx.fillRect(0, 0, w, h);
        ctx.font = '600 15px "Geist Mono", ui-monospace, monospace'; ctx.textAlign = 'center';
        for (const c of cols) {
          const head = (c.off + t * c.sp) % (h + 400);
          for (let i = 0; i < 16; i++) {
            const y = head - i * 22; if (y < -20 || y > h + 20) continue;
            const m = MOVES[(c.seed + i * 7 + Math.floor((t * c.sp) / 22)) % MOVES.length];
            ctx.fillStyle = rgba(i === 0 ? '#ffffff' : (i < 4 ? P.high : P.mid), (1 - i / 16) * 0.75); ctx.fillText(m, c.x + 17, y);
          }
        }
      }
    };
  });

  // 14. Studio — calm gradient (lightest on GPU)
  def('studio', 'Studio Calm', (ctx) => {
    let w, h;
    return {
      resize(W, H) { w = W; h = H; },
      frame(t, P) {
        const x = w * (0.5 + Math.sin(t * 0.05) * 0.2), y = h * (0.4 + Math.cos(t * 0.04) * 0.15);
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h)); g.addColorStop(0, mix(P.shadow, P.mid, 0.45)); g.addColorStop(0.6, P.shadow); g.addColorStop(1, mix(P.shadow, '#000000', 0.4));
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
    };
  });

  const PALETTES = [
    { name: 'Amethyst', shadow: '#120c22', mid: '#6d3fd6', high: '#c4b5fd' },
    { name: 'Rose Topo', shadow: '#1b0b19', mid: '#a3245e', high: '#f9a8d4' },
    { name: 'Lagoon', shadow: '#061417', mid: '#0f766e', high: '#5eead4' },
    { name: 'Ember', shadow: '#180a06', mid: '#c2410c', high: '#fdba74' },
    { name: 'Glacier', shadow: '#07111f', mid: '#2563eb', high: '#bae6fd' },
    { name: 'Moss', shadow: '#0b130a', mid: '#4d7c0f', high: '#d9f99d' },
    { name: 'Mono', shadow: '#0c0c0f', mid: '#52525b', high: '#e4e4e7' },
    { name: 'Sakura', shadow: '#1d1024', mid: '#7e3a7a', high: '#f9a8c9' },
    { name: 'Gold Leaf', shadow: '#14100a', mid: '#a16207', high: '#fde68a' },
    { name: 'Cyber', shadow: '#0a0614', mid: '#db2777', high: '#22d3ee' },
  ];

  // GPU scenes (shaders.js) come first. Each names a 2D look-alike for browsers without WebGL.
  const GLS = window.SolvoShaders;
  const FB = { 'gl-nebula': 'nebula', 'gl-aurora': 'aurora', 'gl-chrome': 'silk', 'gl-warp': 'hyper', 'gl-synth': 'ribbons', 'gl-rubik': 'scramblerain', 'gl-voronoi': 'hex', 'gl-galaxy': 'horizon', 'gl-storm': 'plasma', 'gl-ink': 'silk' };
  if (GLS) GLS.scenes.slice().reverse().forEach(s => { s.fb = FB[s.id] || 'nebula'; scenes.unshift(s); });
  const find = id => scenes.find(x => x.id === id) || scenes[0];
  const fxState = () => (window.SolvoFX && window.SolvoFX.state) || null;

  // one shared offscreen WebGL context for thumbnails and share cards
  let offGL = null;
  function offscreen() { if (offGL === null) { try { offGL = GLS ? new GLS.GL(document.createElement('canvas')) : false; } catch (e) { offGL = false; } if (offGL && !offGL.ok()) offGL = false; } return offGL; }
  function paint(ctx, id, P, w, h, t) {
    let s = find(id);
    if (s.gl) {
      const g = offscreen();
      if (g) { g.c.width = w; g.c.height = h; if (g.render(s, w, h, t, P, null)) { ctx.drawImage(g.c, 0, 0, w, h); return; } }
      s = find(s.fb);
    }
    const sc = s.make(ctx); sc.resize(w, h); try { sc.frame(t, P); } catch (e) { }
  }
  function thumb(id, P, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), id, P, w, h, 6); return c; }
  const glAvailable = () => !!offscreen();

  // Engine: one live scene. 2D scenes draw on `canvas`, GPU scenes on `glCanvas`.
  class Engine {
    constructor(canvas, glCanvas) {
      this.c = canvas; this.ctx = canvas.getContext('2d'); this.gc = glCanvas || null; this.glr = null;
      this.t = 0; this.speed = 1; this.frozen = false; this.last = 0; this.P = PALETTES[0];
      this.dyn = 1; this.maxDyn = 1; this.ft = []; this.warm = 0; this.isGL = false;
      this.reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._loop = this._loop.bind(this); this.resize = this.resize.bind(this);
      window.addEventListener('resize', this.resize);
    }
    gl() { if (!this.glr && this.gc && GLS) { try { this.glr = new GLS.GL(this.gc); } catch (e) { this.glr = null; } } return this.glr && this.glr.gl ? this.glr : null; }
    set(id) {
      this.id = id; let s = find(id);
      if (s.gl) { const g = this.gl(); if (!g || !g.prog(s)) { if (g && g.errors[s.id]) console.warn('Solvo shader ' + s.id + ':', g.errors[s.id]); s = find(s.fb); } }
      this.use(s);
    }
    use(s) {
      this.sc = s; this.isGL = !!s.gl; this.scene = s.gl ? null : s.make(this.ctx);
      this.c.style.display = this.isGL ? 'none' : ''; if (this.gc) this.gc.style.display = this.isGL ? '' : 'none';
      this.dyn = 1; this.maxDyn = 1; this.ft = []; this.warm = 50;
      this.resize();
    }
    resize() {
      const W = window.innerWidth, H = window.innerHeight, q = this.quality || 1, d = Math.min(window.devicePixelRatio || 1, 1.5);
      if (this.isGL) { const k = d * q * (this.sc.scale || 0.66) * this.dyn; this.gc.width = Math.max(2, Math.round(W * k)); this.gc.height = Math.max(2, Math.round(H * k)); }
      else { const dpr = d * q; this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.scene && this.scene.resize(W, H); }
      this.draw();
    }
    draw() {
      if (this.isGL) {
        if (this.glr.lost) return;
        if (!this.glr.render(this.sc, this.gc.width, this.gc.height, this.t, this.P, fxState())) this.use(find(this.sc.fb));
        return;
      }
      try { this.scene && this.scene.frame(this.t, this.P); } catch (e) { console.error(e); }
    }
    start() { if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this._loop); } }
    _loop(now) {
      if (!this.running) return;
      const iv = now - this.last, cap = this.isGL ? 1000 / 61 : 1000 / 40; // GPU 60fps, 2D ~40fps
      if (iv >= cap - 1) {
        this.last = now; const dt = Math.min(0.1, iv / 1000), f = fxState(), e = f ? f.energy : 0;
        if (!this.frozen && !this.reduced && !document.hidden) {
          this.t += dt * this.speed * (1 + e * 1.4); this.draw();
          if (this.isGL) this.adapt(iv);
        }
      }
      requestAnimationFrame(this._loop);
    }
    // keep the frame rate up: render the GPU scene at a lower resolution on slow devices
    adapt(iv) {
      if (this.warm > 0) { this.warm--; return; }
      this.ft.push(Math.min(iv, 100)); if (this.ft.length < 40) return;
      const avg = this.ft.reduce((a, b) => a + b, 0) / this.ft.length; this.ft = [];
      if (avg > 25 && this.dyn > 0.35) { this.maxDyn = Math.max(0.35, this.dyn * 0.95); this.dyn = Math.max(0.35, this.dyn * 0.78); this.resize(); }
      else if (avg < 18 && this.dyn < this.maxDyn) { this.dyn = Math.min(this.maxDyn, this.dyn * 1.1); this.resize(); }
    }
  }

  window.SolvoBG = { scenes, PALETTES, Engine, thumb, paint, glAvailable, mix, rgba };
})();
