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

    // move string like R, U', F2, Rw, r, M, x, y2
    move(m) {
      const mt = /^([URFDLB])(w?)|^([urfdlbMESxyz])/.exec(m);
      if (!mt) return false;
      const suf = m.slice(mt[0].length);
      const times = suf.startsWith('2') ? 2 : 1;
      const prime = suf.includes("'");
      const N = this.N, M = N - 1;
      let face = mt[1], wide = !!mt[2], sp = mt[3];
      let axis, sign, pred;
      if (sp && 'urfdlb'.includes(sp)) { face = sp.toUpperCase(); wide = true; sp = null; }
      if (face) {
        const n = FACE_N[face];
        axis = n[0] ? 0 : n[1] ? 1 : 2;
        sign = n[axis];
        const depth = wide ? (N <= 3 ? 2 : 2) : 1;
        const lim = M - 2 * (depth - 1);
        pred = p => sign * p[axis] >= lim;
        // clockwise from outside = -90 about +n
        var dir = -sign;
      } else {
        if (sp === 'x') { axis = 0; dir = -1; pred = () => true; }
        else if (sp === 'y') { axis = 1; dir = -1; pred = () => true; }
        else if (sp === 'z') { axis = 2; dir = -1; pred = () => true; }
        else if (sp === 'M') { axis = 0; dir = 1; pred = p => Math.abs(p[0]) < M; } // follows L
        else if (sp === 'E') { axis = 1; dir = 1; pred = p => Math.abs(p[1]) < M; } // follows D
        else if (sp === 'S') { axis = 2; dir = -1; pred = p => Math.abs(p[2]) < M; } // follows F
      }
      if (prime) dir = -dir;
      for (let i = 0; i < times; i++) this._rot(axis, dir, pred);
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

  // ----- 3D (orthographic, rotatable) -----
  function draw3D(canvas, cube, view) {
    const dpr = view.w ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const W = view.w || canvas.clientWidth || 300, H = view.h || canvas.clientHeight || 300;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const yaw = view.yaw, pitch = view.pitch, N = cube.N;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const tf = v => { // rotate yaw around y, then pitch around x
      const x1 = v[0] * cy + v[2] * sy, z1 = -v[0] * sy + v[2] * cy, y1 = v[1];
      const y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp;
      return [x1, y2, z2];
    };
    const scale = Math.min(W, H) / (N * 2) / 1.85;
    const cx = W / 2, cyy = H / 2;
    const proj = v => { const t = tf(v); return [cx + t[0] * scale, cyy - t[1] * scale, t[2]]; };
    // body
    const faces = [];
    for (const s of cube.st) {
      const nt = tf(s.n); if (nt[2] <= 0.02) continue;
      const a = s.n[0] ? 1 : 0, b = s.n[2] ? 1 : 2; // two in-plane axes
      const ax = [0, 1, 2].filter(i => s.n[i] === 0);
      const c = [s.p[0] + s.n[0], s.p[1] + s.n[1], s.p[2] + s.n[2]];
      const k = 0.9, pts = [];
      for (const [da, db] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const v = c.slice(); v[ax[0]] += da * k; v[ax[1]] += db * k; pts.push(proj(v)); }
      // backing square (black plastic)
      const bp = [];
      for (const [da, db] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const v = c.slice(); v[ax[0]] += da * 1.0; v[ax[1]] += db * 1.0; bp.push(proj(v)); }
      faces.push({ pts, bp, c: s.c, light: nt[2] });
    }
    for (const f of faces) { ctx.fillStyle = '#0d0b14'; poly(ctx, f.bp); ctx.fill(); }
    for (const f of faces) {
      ctx.fillStyle = COLORS[f.c]; poly(ctx, f.pts); ctx.fill();
      ctx.fillStyle = `rgba(0,0,0,${(1 - f.light) * 0.35})`; ctx.fill();
    }
  }
  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }

  // ----- virtual cube keymap (csTimer-style layout) -----
  const KEYMAP = {
    i: 'R', k: "R'", j: 'U', f: "U'", h: 'F', g: "F'", w: 'B', o: "B'", d: 'L', e: "L'", s: 'D', l: "D'",
    u: 'r', m: "r'", v: 'l', r: "l'", ';': 'y', a: "y'", t: 'x', y: 'x', b: "x'", n: "x'", p: 'z', q: "z'",
    '.': "M'", x: "M'", '5': 'M', '6': 'M', z: 'd', '/': "d'", c: "u'", ',': 'u'
  };

  window.SolvoCube = { Cube, COLORS, genScramble, tokenize, invertMove, drawNet, draw3D, EVENT_N, KEYMAP, roundRect };
})();
