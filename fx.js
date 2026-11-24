/* Solvo Timer — reactive effects. Feeds the GPU background (solve energy, hold, ready, late
   inspection, PB glow, shockwave pulse, pointer) and draws two overlays:
   #fxc behind the cards (shockwaves, warp streaks, colour tints for 2D scenes) and
   #fxt above everything (fireworks, cursor trail, tap sparks). */
(function () {
  'use strict';
  const A = window.SolvoApp, C = window.SolvoCube;
  const $ = s => document.querySelector(s);
  const st = { energy: 0, hold: 0, ready: 0, warn: 0, pb: 0, pulse: [0.5, 0.5, 9, 0], mouse: [0.5, 0.5] };
  const set = () => A.set();
  const on = k => set()[k] !== false;
  const K = () => Math.max(0.3, Math.min(1.5, +set().fxIntensity || 1));
  const reduced = () => C.reducedMotion();
  const rgb = h => { h = String(h || '#ffffff').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`; };
  const accent = () => set().accent || '#a78bfa';
  const high = () => (A.palette() || {}).high || '#ffffff';

  let back, bctx, top, tctx, W = 1, H = 1, last = performance.now(), dirtyB = false, dirtyT = false, now = 0;
  const rings = [], streaks = [], parts = [], trail = [], mouse = [0.5, 0.5];

  function canvas(id, z) {
    let c = document.getElementById(id);
    if (!c) { c = document.createElement('canvas'); c.id = id; c.setAttribute('aria-hidden', 'true'); document.body.appendChild(c); }
    c.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z}`;
    return c;
  }
  function size() {
    const d = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    for (const [c, x] of [[back, bctx], [top, tctx]]) { c.width = Math.round(W * d); c.height = Math.round(H * d); x.setTransform(d, 0, 0, d, 0, 0); }
    dirtyB = dirtyT = true;
  }

  // centre of the active timer's digits, or the middle of the screen
  function origin() {
    const T = A.Timer; let el = null; try { el = T.ctx && T.ctx.el && T.ctx.el(); } catch (e) { }
    if (el && el.offsetParent) { const r = el.getBoundingClientRect(); if (r.width) return [r.left + r.width / 2, r.top + r.height / 2]; }
    return [W / 2, H / 2];
  }
  function pulse(x, y, k) { st.pulse = [x / W, 1 - y / H, 0, k]; }
  function shock(x, y, o) {
    o = o || {};
    rings.push({ x, y, t: 0, life: o.life || 1.1, r0: o.r0 || 24, r1: o.r1 || Math.hypot(W, H) * 0.62, w: o.w || 3, col: o.col || accent() });
    if (o.gl !== false) pulse(x, y, (o.k || 1) * K());
    dirtyB = true;
  }
  function warp(x, y) {
    const n = Math.round(80 * K()), a1 = accent(), a2 = high();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      streaks.push({ x, y, a, d: 40 + Math.random() * 90, v: 700 + Math.random() * 1500, len: 50 + Math.random() * 180, t: 0, life: 0.5 + Math.random() * 0.45, w: 0.8 + Math.random() * 1.8, col: Math.random() < 0.55 ? a1 : a2 });
    }
    dirtyB = true;
  }
  function burst(x, y, n, o) {
    o = o || {}; const cols = o.cols || [accent(), high(), '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (o.v || 380) * (0.3 + Math.random() * 0.8);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + (o.up || 0), t: 0, life: (o.life || 1.4) * (0.6 + Math.random() * 0.6), s: o.s || (1.3 + Math.random() * 2), col: cols[i % cols.length], g: o.g != null ? o.g : 240, drag: o.drag || 1.5, tw: Math.random() < 0.35 });
    }
    dirtyT = true;
  }
  // PB / badge celebration; returns false when disabled so the caller can fall back to confetti
  function fireworks() {
    if (!on('fxFireworks') || reduced()) return false;
    const gold = ['#fde68a', '#fbbf24', '#ffffff', '#fff7d6'], mine = [accent(), high(), '#ffffff'], cube = C.COLORS;
    const n = Math.max(3, Math.round(6 * K()));
    for (let i = 0; i < n; i++) setTimeout(() => {
      const x = W * (0.16 + Math.random() * 0.68), y = H * (0.14 + Math.random() * 0.36);
      burst(x, y, Math.round(80 * K()), { cols: i % 3 === 0 ? gold : i % 3 === 1 ? mine : cube, v: 430, life: 1.7, g: 150, drag: 1.3 });
      burst(x, y, 12, { cols: ['#ffffff'], v: 110, life: 0.45, g: 0, s: 3.2, drag: 3 });
    }, i * 230);
    return true;
  }

  // ------------------------------------------------------------------ frame loop
  function tick(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t; now = t / 1000;
    const T = A.Timer, s = T.state, react = on('fxReactive') && !reduced();
    let tE = s === 'running' ? 1 : 0, tH = s === 'hold' || s === 'inspHold' ? 1 : 0, tR = s === 'ready' || s === 'inspReady' ? 1 : 0, tW = 0;
    if (T.i0 && /^insp/.test(s)) { const e = (performance.now() - T.i0) / 1000; tW = e >= 12 ? 1 : e >= 8 ? 0.45 : 0; }
    if (!react) tE = tH = tR = tW = 0;
    const ease = (v, to, up, down) => v + (to - v) * (1 - Math.exp(-dt * (to > v ? up : down)));
    st.energy = ease(st.energy, tE * K(), 3.2, 1.3); st.hold = ease(st.hold, tH, 6, 9); st.ready = ease(st.ready, tR, 12, 5); st.warn = ease(st.warn, tW, 4, 4);
    st.pb = Math.max(0, st.pb - dt * 0.42);
    st.pulse[2] += dt; if (st.pulse[2] > 3) st.pulse[3] = 0;
    const m = 1 - Math.exp(-dt * 2.5); st.mouse[0] += (mouse[0] - st.mouse[0]) * m; st.mouse[1] += (mouse[1] - st.mouse[1]) * m;
    for (let i = trail.length - 1; i >= 0; i--) { trail[i].t += dt; if (trail[i].t > 0.32) trail.splice(i, 1); }
    pointerFrame(); drawBack(dt); drawTop(dt);
    requestAnimationFrame(tick);
  }
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  function vignette(ctx, col, a) {
    if (a < 0.01) return;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, a)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function drawBack(dt) {
    const eng = A.engine && A.engine(), gl = !!(eng && eng.isGL);
    const tint = !gl && (st.hold > 0.01 || st.ready > 0.01 || st.warn > 0.01 || st.pb > 0.01);
    if (!rings.length && !streaks.length && !tint) { if (dirtyB) { bctx.clearRect(0, 0, W, H); dirtyB = false; } return; }
    bctx.clearRect(0, 0, W, H); dirtyB = true;
    if (tint) { vignette(bctx, '#ef4444', st.hold * 0.32); vignette(bctx, '#22c55e', st.ready * 0.28); vignette(bctx, '#ef4444', st.warn * (0.32 + 0.22 * Math.sin(now * 9))); vignette(bctx, '#fde68a', st.pb * 0.3); }
    bctx.globalCompositeOperation = 'lighter';
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt; const p = r.t / r.life; if (p >= 1) { rings.splice(i, 1); continue; }
      const rad = r.r0 + (r.r1 - r.r0) * easeOut(p), a = Math.pow(1 - p, 1.6);
      bctx.lineWidth = r.w * (1 + p * 2.5); bctx.strokeStyle = rgba(r.col, a * 0.9); bctx.beginPath(); bctx.arc(r.x, r.y, rad, 0, Math.PI * 2); bctx.stroke();
      bctx.lineWidth = r.w * 7 * (1 + p); bctx.strokeStyle = rgba(r.col, a * 0.12); bctx.beginPath(); bctx.arc(r.x, r.y, rad * 0.97, 0, Math.PI * 2); bctx.stroke();
    }
    bctx.lineCap = 'round';
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i]; s.t += dt; const p = s.t / s.life; if (p >= 1) { streaks.splice(i, 1); continue; }
      const head = s.d + s.v * s.t * (0.6 + p), tail = Math.max(s.d * 0.6, head - s.len * (0.5 + p)), c = Math.cos(s.a), sn = Math.sin(s.a);
      const x1 = s.x + c * tail, y1 = s.y + sn * tail, x2 = s.x + c * head, y2 = s.y + sn * head;
      const g = bctx.createLinearGradient(x1, y1, x2, y2); g.addColorStop(0, rgba(s.col, 0)); g.addColorStop(1, rgba(s.col, (1 - p) * 0.85));
      bctx.strokeStyle = g; bctx.lineWidth = s.w; bctx.beginPath(); bctx.moveTo(x1, y1); bctx.lineTo(x2, y2); bctx.stroke();
    }
    bctx.globalCompositeOperation = 'source-over';
  }
  function drawTop(dt) {
    if (!parts.length && !trail.length) { if (dirtyT) { tctx.clearRect(0, 0, W, H); dirtyT = false; } return; }
    tctx.clearRect(0, 0, W, H); dirtyT = true;
    tctx.globalCompositeOperation = 'lighter'; tctx.lineCap = 'round';
    if (trail.length > 1) {
      const col = accent();
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i], k = 1 - b.t / 0.32;
        tctx.strokeStyle = rgba(col, k * 0.55); tctx.lineWidth = 1 + k * 5; tctx.beginPath(); tctx.moveTo(a.x, a.y); tctx.lineTo(b.x, b.y); tctx.stroke();
      }
      const h = trail[trail.length - 1], g = tctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 16); g.addColorStop(0, rgba(col, 0.35)); g.addColorStop(1, rgba(col, 0));
      tctx.fillStyle = g; tctx.fillRect(h.x - 16, h.y - 16, 32, 32);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt; if (p.t >= p.life) { parts.splice(i, 1); continue; }
      const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy = p.vy * dr + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      let a = 1 - p.t / p.life; if (p.tw) a *= 0.55 + 0.45 * Math.sin(p.t * 38);
      tctx.strokeStyle = rgba(p.col, a * 0.6); tctx.lineWidth = p.s; tctx.beginPath(); tctx.moveTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); tctx.lineTo(p.x, p.y); tctx.stroke();
      tctx.fillStyle = rgba(p.col, a); tctx.beginPath(); tctx.arc(p.x, p.y, p.s * 0.75, 0, Math.PI * 2); tctx.fill();
    }
    tctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ timer moments
  function hookTimer() {
    A.on('start', () => {
      if (!on('fxReactive') || reduced()) return;
      const [x, y] = origin(); if (on('fxShock')) shock(x, y, { life: 0.95, w: 2.4, k: 1 }); warp(x, y);
    });
    A.on('stop', (t, pen, name) => {
      if (reduced()) return;
      const [x, y] = origin(), dnf = pen === -1;
      if (on('fxShock')) shock(x, y, { life: 1.3, w: 3.6, r1: Math.hypot(W, H) * 0.8, col: dnf ? '#f87171' : accent(), k: 0.9 });
      if (on('fxReactive')) burst(x, y, Math.round(26 * K()), { v: 320, life: 0.75, g: 0, drag: 3.6, s: 1.5, cols: dnf ? ['#f87171', '#fecaca'] : undefined });
      if (dnf) glitch();
      // virtual or smart cube solved: spin the cube apart and back together
      const inp = set().input;
      if (name === 'main' && (inp === 'virtual' || inp === 'smart') && A.VC.cube && A.VC.cube.isSolved() && A.VC.anim && A.VC.anim.celebrate) A.VC.anim.celebrate(accent());
    });
    A.on('pb', () => {
      if (reduced()) return;
      st.pb = 1; const [x, y] = origin();
      shock(x, y, { life: 1.9, w: 6, r1: Math.hypot(W, H), col: '#fde68a', k: 1.25 });
      setTimeout(() => shock(x, y, { life: 1.5, w: 3, col: accent(), gl: false }), 170);
    });
    A.on('ready', () => { if (reduced() || !on('fxReactive')) return; const [x, y] = origin(); shock(x, y, { life: 0.55, r1: 180, w: 2, col: '#4ade80', gl: false }); });
    A.on('inspect', () => { if (reduced() || !on('fxReactive')) return; const [x, y] = origin(); shock(x, y, { life: 0.8, r1: 260, w: 2, col: high(), gl: false }); });
  }
  function glitch() {
    let el = null; try { el = A.Timer.ctx && A.Timer.ctx.el(); } catch (e) { }
    if (!el) return; el.classList.remove('glitch'); void el.offsetWidth; el.classList.add('glitch'); setTimeout(() => el.classList.remove('glitch'), 1100);
  }

  // ------------------------------------------------------------------ pointer: trail, sparks, tilt, spotlight
  const TILT = '.theme, .tile, .badge, .bg-tile, .font-opt, .more-item, .tr-case, .mission';
  let tiltEl = null, spot = null;
  function untilt() { if (tiltEl) { tiltEl.classList.remove('tilt'); tiltEl.style.removeProperty('--rx'); tiltEl.style.removeProperty('--ry'); tiltEl = null; } }
  let pe = null; // latest mouse position; tilt and spotlight update once per frame
  function pointerFrame() {
    const e = pe; pe = null; if (!e) return;
    const tg = e.target && e.target.closest ? e.target : null; if (!tg) return;
    const solving = document.body.classList.contains('solving');
    if (on('fxTilt') && !reduced() && !solving) {
      const el = tg.closest(TILT);
      if (tiltEl && tiltEl !== el) untilt();
      if (el) {
        const r = el.getBoundingClientRect(), px = (e.x - r.left) / r.width - 0.5, py = (e.y - r.top) / r.height - 0.5;
        el.style.setProperty('--rx', (-py * 9).toFixed(2) + 'deg'); el.style.setProperty('--ry', (px * 11).toFixed(2) + 'deg');
        if (!el.classList.contains('tilt')) el.classList.add('tilt'); tiltEl = el;
      }
    } else untilt();
    const g = on('fxTilt') && !solving ? tg.closest('.glass') : null;
    if (g) { const r = g.getBoundingClientRect(); g.style.setProperty('--sx', (e.x - r.left).toFixed(0) + 'px'); g.style.setProperty('--sy', (e.y - r.top).toFixed(0) + 'px'); if (spot !== g) { if (spot) spot.classList.remove('lit'); g.classList.add('lit'); spot = g; } }
    else if (spot) { spot.classList.remove('lit'); spot = null; }
  }
  function hookPointer() {
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mouse[0] = e.clientX / W; mouse[1] = 1 - e.clientY / H;
      if (on('fxTrail') && !document.body.classList.contains('solving') && !reduced()) { trail.push({ x: e.clientX, y: e.clientY, t: 0 }); if (trail.length > 26) trail.shift(); dirtyT = true; }
      pe = { x: e.clientX, y: e.clientY, target: e.target };
    }, { passive: true });
    document.addEventListener('pointerleave', () => { untilt(); if (spot) { spot.classList.remove('lit'); spot = null; } });
    document.addEventListener('pointerdown', e => {
      if (reduced() || A.Timer.state !== 'idle') return;
      const tg = e.target; if (!tg || !tg.closest || tg.closest('#timerZone, input, select, textarea, .movepad, canvas')) return;
      const x = e.clientX, y = e.clientY;
      if (on('fxReactive')) burst(x, y, 12, { v: 210, life: 0.5, g: 0, drag: 5, s: 1.3 });
      // a tap on the bare background sends a ripple through the GPU scene
      if (!tg.closest('.glass, button, a, label, .modal, .chip, header, nav')) pulse(x, y, 0.6 * K());
    }, { passive: true });
  }

  // ------------------------------------------------------------------ stat tiles count up when a view opens
  function countUp(el) {
    const txt = el.textContent.trim(); let m, to, fmt;
    if ((m = /^(\d+):(\d{2})\.(\d+)$/.exec(txt))) { to = +m[1] * 60 + +(m[2] + '.' + m[3]); const d = m[3].length; fmt = v => { const mm = Math.floor(v / 60), ss = v - mm * 60; return mm + ':' + ss.toFixed(d).padStart(d + 3, '0'); }; }
    else if ((m = /^([\d,]+)(\.(\d+))?(%?)$/.exec(txt))) { to = +(m[1].replace(/,/g, '') + (m[2] || '')); const d = m[3] ? m[3].length : 0, comma = m[1].includes(','); fmt = v => (comma ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : v.toFixed(d)) + m[4]; }
    else return;
    if (!isFinite(to) || to === 0) return;
    const t0 = performance.now(), D = 750;
    (function step(t) { const k = Math.min(1, (t - t0) / D); el.textContent = fmt(to * easeOut(k)); if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = txt; })(t0);
  }
  function hookViews() {
    A.on('view', v => { if (reduced()) return; const el = $(`.view[data-v="${v}"]`); if (el) el.querySelectorAll('.tile .v').forEach(countUp); });
  }

  function init() {
    back = canvas('fxc', 0); top = canvas('fxt', 56);
    bctx = back.getContext('2d'); tctx = top.getContext('2d');
    size(); window.addEventListener('resize', size);
    hookTimer(); hookPointer(); hookViews();
    requestAnimationFrame(t => { last = t; tick(t); });
  }

  function preview() {
    if (reduced()) { A.toast('Effects are paused because your device asks for reduced motion'); return; }
    const x = W / 2, y = H * 0.42; st.pb = 1;
    if (!fireworks()) A.confetti();
    shock(x, y, { life: 1.9, w: 6, r1: Math.hypot(W, H), col: '#fde68a', k: 1.25 }); setTimeout(() => shock(x, y, { life: 1.5, w: 3, col: accent(), gl: false }), 170);
    A.sfx('pb');
  }

  window.SolvoFX = { state: st, fireworks, shock, burst, warp, pulse, glitch, countUp, preview, init };
})();
