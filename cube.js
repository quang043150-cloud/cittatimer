/* Solvo Timer — cube model, scrambles, rendering, phase detection.
   Generic NxN sticker model: piece coords run -(N-1)..(N-1) in steps of 2,
   every sticker has a position p and an outward normal n. */
(function () {
  'use strict';
  const COLORS = ['#f4f4f0', '#ffd23f', '#22c55e', '#3b82f6', '#ef4444', '#fb923c']; // U D F B R L
  const FACE_N = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
  const FACE_ORDER = ['U', 'D', 'F', 'B', 'R', 'L'];

  function colorOfNormal(n) {
    if (n[1] === 1) return 0; if (n[1] === -1) return 1;
    if (n[2] === 1) return 2; if (n[2] === -1) return 3;
    if (n[0] === 1) return 4; return 5;
  }

  class Cube {
    constructor(N) { this.N = N; this.reset(); }
    reset() {
      const N = this.N, M = N - 1, st = [];
      for (let x = -M; x <= M; x += 2) for (let y = -M; y <= M; y += 2) for (let z = -M; z <= M; z += 2) {
        const p = [x, y, z];
        for (let a = 0; a < 3; a++) {
          if (Math.abs(p[a]) === M) {
            const n = [0, 0, 0]; n[a] = Math.sign(p[a]);
            st.push({ p: p.slice(), n, c: colorOfNormal(n) });
          }
        }
      }
      this.st = st;
      return this;
    }
    clone() { const c = new Cube(this.N); c.st = this.st.map(s => ({ p: s.p.slice(), n: s.n.slice(), c: s.c })); return c; }

    // rotate stickers matching pred about axis (0,1,2) by k quarter turns, sign +1 = counterclockwise looking from +axis
    _rot(axis, dir, pred) {
      const a1 = (axis + 1) % 3, a2 = (axis + 2) % 3;
      const r = v => { const t = v[a1]; v[a1] = -dir * v[a2]; v[a2] = dir * t; };
      // dir=+1: (a1,a2) -> (-a2, a1)  => +90 about axis
      for (const s of this.st) if (pred(s.p)) { r(s.p); r(s.n); }
    }

    // move string like R, U', F2, Rw, r, M, x, y2 -> { axis, dir, pred, times } (dir +1 = +90° about +axis)
    parse(m) {
      const mt = /^([URFDLB])(w?)|^([urfdlbMESxyz])/.exec(m || '');
      if (!mt) return null;
      const suf = m.slice(mt[0].length);
      const times = suf.startsWith('2') ? 2 : 1;
      const prime = suf.includes("'");
      const M = this.N - 1;
      let face = mt[1], wide = !!mt[2], sp = mt[3], axis = 0, dir = 1, pred = () => false;
      if (sp && 'urfdlb'.includes(sp)) { face = sp.toUpperCase(); wide = true; sp = null; }
      if (face) {
        const n = FACE_N[face], sign = n[0] || n[1] || n[2];
        axis = n[0] ? 0 : n[1] ? 1 : 2;
        const lim = wide ? M - 2 : M;
        pred = p => sign * p[axis] >= lim;
        dir = -sign; // clockwise seen from outside = -90° about the outward normal
      } else if (sp === 'x') { axis = 0; dir = -1; pred = () => true; }
      else if (sp === 'y') { axis = 1; dir = -1; pred = () => true; }
      else if (sp === 'z') { axis = 2; dir = -1; pred = () => true; }
      else if (sp === 'M') { axis = 0; dir = 1; pred = p => Math.abs(p[0]) < M; }  // follows L
      else if (sp === 'E') { axis = 1; dir = 1; pred = p => Math.abs(p[1]) < M; }  // follows D
      else if (sp === 'S') { axis = 2; dir = -1; pred = p => Math.abs(p[2]) < M; } // follows F
      if (prime) dir = -dir;
      return { axis, dir, pred, times };
    }
    move(m) {
      const p = this.parse(m); if (!p) return false;
      for (let i = 0; i < p.times; i++) this._rot(p.axis, p.dir, p.pred);
      return true;
    }
    apply(seq) { for (const m of tokenize(seq)) this.move(m); return this; }

    centerColor(n) { // color of the face whose normal is n (uses centre sticker for odd N, else majority)
      const M = this.N - 1;
      if (this.N % 2) {
        for (const s of this.st) if (s.n[0] === n[0] && s.n[1] === n[1] && s.n[2] === n[2] && s.p[0] === n[0] * M && s.p[1] === n[1] * M && s.p[2] === n[2] * M) return s.c;
      }
      const cnt = [0, 0, 0, 0, 0, 0];
      for (const s of this.st) if (s.n[0] === n[0] && s.n[1] === n[1] && s.n[2] === n[2]) cnt[s.c]++;
      return cnt.indexOf(Math.max(...cnt));
    }
    isSolved() {
      const seen = {};
      for (const s of this.st) { const k = s.n.join(); if (seen[k] === undefined) seen[k] = s.c; else if (seen[k] !== s.c) return false; }
      return true;
    }
    // 3x3 phase status. Returns {cross:faceKey|null, f2l, oll, solved}
    phaseInfo() {
      if (this.N !== 3) return { cross: null, f2l: null, oll: null, solved: this.isSolved() };
      const normals = [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]];
      const cc = {}; normals.forEach(n => cc[n.join()] = this.centerColor(n));
      const ok = s => s.c === cc[s.n.join()];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const res = { cross: [], f2l: [], oll: [], solved: this.isSolved() };
      for (const n of normals) {
        const key = n.join();
        // cross: edges on face n
        let cross = true, f2l = true, oll = true;
        for (const s of this.st) {
          const d = dot(s.p, n);
          const nz = (s.p[0] !== 0) + (s.p[1] !== 0) + (s.p[2] !== 0);
          if (d === 2 && nz === 2 && !ok(s)) cross = false;
          if (d >= 0 && !ok(s)) f2l = false;
          const isOpp = s.n[0] === -n[0] && s.n[1] === -n[1] && s.n[2] === -n[2];
          if (isOpp && !ok(s)) oll = false;
        }
        if (cross) res.cross.push(key);
        if (f2l) res.f2l.push(key);
        if (f2l && oll) res.oll.push(key);
      }
      return res;
    }
  }

  function tokenize(seq) { return (seq || '').trim().split(/\s+/).filter(Boolean); }

  function invertMove(m) {
    if (m.endsWith('2')) return m; if (m.endsWith("'")) return m.slice(0, -1); return m + "'";
  }

  // ----- scrambles (random-move, no redundant same-axis sequences) -----
  const AXIS = { U: 1, D: 1, R: 0, L: 0, F: 2, B: 2 };
  function rnd(n) { return Math.floor(Math.random() * n); }
  function genScramble(type) {
    const cfg = {
      '222': { faces: ['R', 'U', 'F'], len: 10, wide: false },
      '333': { faces: ['R', 'L', 'U', 'D', 'F', 'B'], len: 20 },
      '333oh': { faces: ['R', 'L', 'U', 'D', 'F', 'B'], len: 20 },
      '333bf': { faces: ['R', 'L', 'U', 'D', 'F', 'B'], len: 20, bf: true },
      '444': { faces: ['R', 'L', 'U', 'D', 'F', 'B'], len: 40, wide: ['Rw', 'Uw', 'Fw'] },
      '555': { faces: ['R', 'L', 'U', 'D', 'F', 'B'], len: 60, wide: ['Rw', 'Uw', 'Fw', 'Lw', 'Dw', 'Bw'] },
    }[type] || null;
    if (!cfg) return '';
    const out = []; let lastAxis = -1, axisFaces = [];
    while (out.length < cfg.len) {
      let f;
      if (cfg.wide && Math.random() < 0.35) f = cfg.wide[rnd(cfg.wide.length)];
      else f = cfg.faces[rnd(cfg.faces.length)];
      const ax = AXIS[f[0]];
      if (ax === lastAxis) { if (axisFaces.includes(f)) continue; axisFaces.push(f); }
      else { lastAxis = ax; axisFaces = [f]; }
      out.push(f + ['', "'", '2'][rnd(3)]);
    }
    if (cfg.bf) { const w = ['', 'Rw', 'Uw', 'Fw'][rnd(4)]; if (w) out.push(w + ['', "'", '2'][rnd(3)]); }
    return out.join(' ');
  }
  const EVENT_N = { '222': 2, '333': 3, '333oh': 3, '333bf': 3, '444': 4, '555': 5 };

  // ----- 2D net -----
  function faceUV(face, p, N) {
    const M = N - 1, g = c => (c + M) / 2;
    const [x, y, z] = p;
    switch (face) {
      case 'U': return [g(x), g(z)];
      case 'D': return [g(x), g(-z)];
      case 'F': return [g(x), g(-y)];
      case 'B': return [g(-x), g(-y)];
      case 'R': return [g(-z), g(-y)];
      case 'L': return [g(z), g(-y)];
    }
  }
  const NET_POS = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
  function drawNet(canvas, cube, opts) {
    opts = opts || {};
    const N = cube.N, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth || 200, H = canvas.clientHeight || 150;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const gap = 4; const fs = Math.min((W - gap * 5) / 4, (H - gap * 4) / 3); const cs = fs / N;
    const ox = (W - (fs * 4 + gap * 3)) / 2, oy = (H - (fs * 3 + gap * 2)) / 2;
    for (const s of cube.st) {
      let face = null; for (const k of FACE_ORDER) { const n = FACE_N[k]; if (n[0] === s.n[0] && n[1] === s.n[1] && n[2] === s.n[2]) face = k; }
      const [u, v] = faceUV(face, s.p, N); const [fx, fy] = NET_POS[face];
      const x = ox + fx * (fs + gap) + u * cs, y = oy + fy * (fs + gap) + v * cs;
      ctx.fillStyle = COLORS[s.c];
      roundRect(ctx, x + 0.8, y + 0.8, cs - 1.6, cs - 1.6, Math.min(3, cs * 0.18)); ctx.fill();
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ----- 3D (orthographic, rotatable, with animated layer turns) -----
  const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const LIGHT = (() => { const v = [-0.45, 0.8, 0.6], l = Math.hypot(...v); return v.map(x => x / l); })();
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const RGB = COLORS.map(hexToRgb);
  function roundQuad(ctx, P, rf) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = P[(i + 3) % 4], b = P[i], c = P[(i + 1) % 4];
      const x1 = b[0] + (a[0] - b[0]) * rf, y1 = b[1] + (a[1] - b[1]) * rf, x2 = b[0] + (c[0] - b[0]) * rf, y2 = b[1] + (c[1] - b[1]) * rf;
      if (i === 0) ctx.moveTo(x1, y1); else ctx.lineTo(x1, y1);
      ctx.quadraticCurveTo(b[0], b[1], x2, y2);
    }
    ctx.closePath();
  }
  // anim: { p: parsed move, f: 0..1 } — the layer in p turns by f of its angle
  function draw3D(canvas, cube, view, anim) {
    const dpr = view.w ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const W = view.w || canvas.clientWidth || 300, H = view.h || canvas.clientHeight || 300;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const N = cube.N, M = N - 1;
    const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    const tf = v => { const x1 = v[0] * cy + v[2] * sy, z1 = -v[0] * sy + v[2] * cy; return [x1, v[1] * cp - z1 * sp, v[1] * sp + z1 * cp]; };
    const scale = Math.min(W, H) / (N * 2) / 2.0, cx = W / 2, cyy = H / 2 - scale * 0.15;
    const proj = v => { const t = tf(v); return [cx + t[0] * scale, cyy - t[1] * scale]; };
    // turning layer
    let rot = null;
    if (anim && anim.p && anim.f > 0 && anim.f < 1) {
      const { axis, dir, times, pred } = anim.p, ang = dir * times * Math.PI / 2 * anim.f, c = Math.cos(ang), s = Math.sin(ang), a1 = (axis + 1) % 3, a2 = (axis + 2) % 3;
      rot = { axis, pred, f: v => { const o = v.slice(); o[a1] = v[a1] * c - v[a2] * s; o[a2] = v[a1] * s + v[a2] * c; return o; } };
    }
    // soft floor shadow
    const sh = ctx.createRadialGradient(cx, cyy + scale * N * 1.55, 0, cx, cyy + scale * N * 1.55, scale * N * 1.5);
    sh.addColorStop(0, 'rgba(0,0,0,0.42)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(cx, cyy + scale * N * 1.55); ctx.scale(1, 0.28); ctx.translate(-cx, -(cyy + scale * N * 1.55));
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(cx, cyy + scale * N * 1.55, scale * N * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // cubies (all positions while a layer turns, so the gap shows plastic, not holes)
    const cubies = new Map();
    for (const st of cube.st) { const k = st.p[0] + ',' + st.p[1] + ',' + st.p[2]; let cb = cubies.get(k); if (!cb) cubies.set(k, cb = { p: st.p, st: [] }); cb.st.push(st); }
    if (rot) for (let x = -M; x <= M; x += 2) for (let y = -M; y <= M; y += 2) for (let z = -M; z <= M; z += 2) { const k = x + ',' + y + ',' + z; if (!cubies.has(k)) cubies.set(k, { p: [x, y, z], st: [] }); }
    const list = [...cubies.values()];
    let mvMin = Infinity, mvMax = -Infinity;
    if (rot) for (const cb of list) if (rot.pred(cb.p)) { mvMin = Math.min(mvMin, cb.p[rot.axis]); mvMax = Math.max(mvMax, cb.p[rot.axis]); }
    for (const cb of list) {
      cb.mv = !!(rot && rot.pred(cb.p));
      cb.grp = !rot ? 1 : cb.mv ? 1 : cb.p[rot.axis] < mvMin ? 0 : 2;
      cb.R = cb.mv ? rot.f : (v => v);
      cb.z = tf(cb.R(cb.p))[2];
    }
    // draw groups along the turning axis back-to-front, then cubies by depth inside each group
    const axisToward = rot ? tf(NORMALS[rot.axis * 2])[2] > 0 : true;
    list.sort((a, b) => (a.grp - b.grp) * (axisToward ? 1 : -1) || a.z - b.z);
    const k = 0.985, ks = 0.86;
    for (const cb of list) {
      for (const n of NORMALS) {
        const nr = cb.R(n), nt = tf(nr); if (nt[2] <= 0.002) continue;
        const ax = [0, 1, 2].filter(i => n[i] === 0), c = [cb.p[0] + n[0], cb.p[1] + n[1], cb.p[2] + n[2]];
        const corner = (da, db, sz) => { const v = c.slice(); v[ax[0]] += da * sz; v[ax[1]] += db * sz; return proj(cb.R(v)); };
        const light = Math.max(0, nt[0] * LIGHT[0] + nt[1] * LIGHT[1] + nt[2] * LIGHT[2]);
        const body = [corner(-1, -1, k), corner(1, -1, k), corner(1, 1, k), corner(-1, 1, k)];
        const g = Math.round(14 + 18 * light);
        ctx.fillStyle = `rgb(${g},${g - 2},${g + 6})`; roundQuad(ctx, body, 0.08); ctx.fill();
        const st = cb.st.find(x => x.n[0] === n[0] && x.n[1] === n[1] && x.n[2] === n[2]);
        if (!st) continue;
        const P = [corner(-1, -1, ks), corner(1, -1, ks), corner(1, 1, ks), corner(-1, 1, ks)];
        const [r0, g0, b0] = RGB[st.c], sh2 = 0.62 + 0.38 * light;
        ctx.fillStyle = `rgb(${Math.round(r0 * sh2)},${Math.round(g0 * sh2)},${Math.round(b0 * sh2)})`;
        roundQuad(ctx, P, 0.16); ctx.fill();
        // gloss
        let minY = Infinity, maxY = -Infinity; for (const q of P) { if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1]; }
        if (maxY - minY > 2) { const gl = ctx.createLinearGradient(0, minY, 0, maxY); gl.addColorStop(0, `rgba(255,255,255,${0.10 + 0.16 * light})`); gl.addColorStop(0.55, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.fill(); }
      }
    }
  }
  const reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  // Plays queued moves on a display copy of a cube; the logical cube never waits for the animation.
  class Animator {
    constructor(getCanvas, view, dur) { this.getCanvas = getCanvas; this.view = view; this.dur = dur || 120; this.cube = null; this.q = []; this.cur = null; this.raf = 0; }
    reset(cube) { cancelAnimationFrame(this.raf); this.raf = 0; this.q = []; this.cur = null; this.cube = cube ? cube.clone() : null; this.draw(); }
    idle() { return !this.cur && !this.q.length; }
    push(m) {
      if (!this.cube) return;
      if (reducedMotion()) { this.cube.move(m); this.draw(); return; }
      this.q.push(m);
      while (this.q.length > 10) this.cube.move(this.q.shift()); // never fall far behind fast turning
      if (!this.raf) this.raf = requestAnimationFrame(t => this.step(t));
    }
    step(now) {
      this.raf = 0;
      if (!this.cur) while (this.q.length) { const m = this.q.shift(), p = this.cube.parse(m); if (!p) continue; const speed = 1 + Math.min(4, this.q.length) * 0.9; this.cur = { m, p, t0: now, dur: this.dur * (p.times === 2 ? 1.45 : 1) / speed }; break; }
      if (!this.cur) { this.draw(); return; }
      const k = Math.min(1, (now - this.cur.t0) / this.cur.dur);
      if (k >= 1) { this.cube.move(this.cur.m); this.cur = null; this.draw(); if (this.q.length) this.raf = requestAnimationFrame(t => this.step(t)); return; }
      this.draw({ p: this.cur.p, f: easeOut(k) });
      this.raf = requestAnimationFrame(t => this.step(t));
    }
    draw(anim) { const c = this.getCanvas(); if (c && this.cube && c.isConnected) draw3D(c, this.cube, this.view, anim); }
  }

  // ----- virtual cube keymap (csTimer-style layout) -----
  const KEYMAP = {
    i: 'R', k: "R'", j: 'U', f: "U'", h: 'F', g: "F'", w: 'B', o: "B'", d: 'L', e: "L'", s: 'D', l: "D'",
    u: 'r', m: "r'", v: 'l', r: "l'", ';': 'y', a: "y'", t: 'x', y: 'x', b: "x'", n: "x'", p: 'z', q: "z'",
    '.': "M'", x: "M'", '5': 'M', '6': 'M', z: 'd', '/': "d'", c: "u'", ',': 'u'
  };

  window.SolvoCube = { Cube, COLORS, genScramble, tokenize, invertMove, drawNet, draw3D, Animator, easeOut, reducedMotion, EVENT_N, KEYMAP, roundRect };
})();
