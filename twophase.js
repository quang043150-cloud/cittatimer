/* Solvo Timer — Kociemba two-phase solver for random-state 3×3 scrambles.
   Cubie tables are derived from the sticker model in cube.js, so both always agree. */
(function (root) {
  'use strict';
  const C = root.SolvoCube;
  const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  const MOVES = []; for (const f of ['U', 'R', 'F', 'D', 'L', 'B']) for (const s of ['', '2', "'"]) MOVES.push(f + s);
  const OPP = [3, 4, 5, 0, 1, 2];
  const P2 = [0, 1, 2, 9, 10, 11, 4, 13, 7, 16]; // U U2 U' D D2 D' R2 L2 F2 B2

  // slots
  const CORN = []; for (const y of [2, -2]) for (const x of [2, -2]) for (const z of [2, -2]) CORN.push([x, y, z]);
  const EDGE = [];
  for (const y of [2, -2]) for (const [x, z] of [[2, 0], [0, 2], [-2, 0], [0, -2]]) EDGE.push([x, y, z]); // 0..7 U/D layers
  for (const [x, z] of [[2, 2], [-2, 2], [-2, -2], [2, -2]]) EDGE.push([x, 0, z]);                    // 8..11 E slice
  const cIdx = p => CORN.findIndex(s => eq(s, p)), eIdx = p => EDGE.findIndex(s => eq(s, p));
  function triple(p) {
    const ny = [0, Math.sign(p[1]), 0], nx = [Math.sign(p[0]), 0, 0], nz = [0, 0, Math.sign(p[2])];
    const cr = [ny[1] * nx[2] - ny[2] * nx[1], ny[2] * nx[0] - ny[0] * nx[2], ny[0] * nx[1] - ny[1] * nx[0]];
    return cr[0] * nz[0] + cr[1] * nz[1] + cr[2] * nz[2] > 0 ? [ny, nz, nx] : [ny, nx, nz];
  }
  const eRef = p => p[1] !== 0 ? [0, Math.sign(p[1]), 0] : [0, 0, Math.sign(p[2])];
  const eOther = p => { const r = eRef(p); for (let a = 0; a < 3; a++) if (p[a] !== 0 && r[a] === 0) { const n = [0, 0, 0]; n[a] = Math.sign(p[a]); return n; } };
  function moveSticker(p, n, m) { const t = new C.Cube(3); t.st = [{ p: p.slice(), n: n.slice(), c: 0 }]; t.move(m); return t.st[0]; }

  let CT, ET; // CT[m][slot*3+ori] = newSlot*3+newOri ; ET[m][slot*2+ori] = newSlot*2+newOri
  function buildTransitions() {
    CT = MOVES.map(m => { const t = new Int8Array(24); CORN.forEach((p, s) => { for (let o = 0; o < 3; o++) { const st = moveSticker(p, triple(p)[o], m); const s2 = cIdx(st.p); t[s * 3 + o] = s2 * 3 + triple(st.p).findIndex(n => eq(n, st.n)); } }); return t; });
    ET = MOVES.map(m => { const t = new Int8Array(24); EDGE.forEach((p, s) => { for (let o = 0; o < 2; o++) { const st = moveSticker(p, o ? eOther(p) : eRef(p), m); const s2 = eIdx(st.p); t[s * 2 + o] = s2 * 2 + (eq(st.n, eRef(st.p)) ? 0 : 1); } }); return t; });
  }
  // cubie state: cp/co (8), ep/eo (12); index = slot, value = piece
  function solvedState() { return { cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }; }
  function applyMove(s, m) {
    const ct = CT[m], et = ET[m], cp = new Array(8), co = new Array(8), ep = new Array(12), eo = new Array(12);
    for (let i = 0; i < 8; i++) { const v = ct[i * 3 + s.co[i]]; cp[v / 3 | 0] = s.cp[i]; co[v / 3 | 0] = v % 3; }
    for (let i = 0; i < 12; i++) { const v = et[i * 2 + s.eo[i]]; ep[v >> 1] = s.ep[i]; eo[v >> 1] = v & 1; }
    return { cp, co, ep, eo };
  }

  // coordinates
  const F = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
  function lehmer(a) { const n = a.length; let x = 0; for (let i = 0; i < n; i++) { let k = 0; for (let j = i + 1; j < n; j++) if (a[j] < a[i]) k++; x += k * F[n - 1 - i]; } return x; }
  function unlehmer(x, n) { const left = [...Array(n).keys()], out = []; for (let i = 0; i < n; i++) { const f = F[n - 1 - i], q = Math.floor(x / f); x %= f; out.push(left.splice(q, 1)[0]); } return out; }
  const MASK2SL = new Int16Array(4096).fill(-1), SL2MASK = [];
  for (let m = 0; m < 4096; m++) { let b = 0; for (let k = 0; k < 12; k++) if (m >> k & 1) b++; if (b === 4) { MASK2SL[m] = SL2MASK.length; SL2MASK.push(m); } }
  const coC = co => { let x = 0; for (let i = 0; i < 7; i++) x = x * 3 + co[i]; return x; };
  const eoC = eo => { let x = 0; for (let i = 0; i < 11; i++) x = x * 2 + eo[i]; return x; };
  const slC = ep => { let m = 0; for (let i = 0; i < 12; i++) if (ep[i] >= 8) m |= 1 << i; return MASK2SL[m]; };
  function coFrom(x) { const co = new Array(8); let s = 0; for (let i = 6; i >= 0; i--) { co[i] = x % 3; x = Math.floor(x / 3); s += co[i]; } co[7] = (3 - s % 3) % 3; return co; }
  function eoFrom(x) { const eo = new Array(12); let s = 0; for (let i = 10; i >= 0; i--) { eo[i] = x & 1; x >>= 1; s += eo[i]; } eo[11] = s & 1; return eo; }

  let COM, EOM, SLM, CPM, EPM, SPM, P1A, P1B, P2A, P2B, SL0, ready = false;
  function bfs(size, start, nMoves, next) {
    const d = new Int8Array(size).fill(-1); d[start] = 0; let depth = 0, done = 1;
    while (done < size) {
      let found = 0;
      for (let i = 0; i < size; i++) if (d[i] === depth) for (let m = 0; m < nMoves; m++) { const j = next(i, m); if (d[j] < 0) { d[j] = depth + 1; found++; } }
      if (!found) break; done += found; depth++;
    }
    return d;
  }
  function init() {
    if (ready) return;
    buildTransitions();
    const sol = solvedState();
    COM = new Int16Array(2187 * 18); EOM = new Int16Array(2048 * 18); SLM = new Int16Array(495 * 18);
    for (let x = 0; x < 2187; x++) { const s = { cp: sol.cp, co: coFrom(x), ep: sol.ep, eo: sol.eo }; for (let m = 0; m < 18; m++) COM[x * 18 + m] = coC(applyMove(s, m).co); }
    for (let x = 0; x < 2048; x++) { const s = { cp: sol.cp, co: sol.co, ep: sol.ep, eo: eoFrom(x) }; for (let m = 0; m < 18; m++) EOM[x * 18 + m] = eoC(applyMove(s, m).eo); }
    for (let x = 0; x < 495; x++) { const mask = SL2MASK[x], ep = new Array(12); let a = 8, b = 0; for (let i = 0; i < 12; i++) ep[i] = mask >> i & 1 ? a++ : b++; const s = { cp: sol.cp, co: sol.co, ep, eo: sol.eo }; for (let m = 0; m < 18; m++) SLM[x * 18 + m] = slC(applyMove(s, m).ep); }
    CPM = new Uint16Array(40320 * 10); EPM = new Uint16Array(40320 * 10); SPM = new Int8Array(24 * 10);
    for (let x = 0; x < 40320; x++) {
      const cp = unlehmer(x, 8), s1 = { cp, co: sol.co, ep: sol.ep, eo: sol.eo };
      const e8 = unlehmer(x, 8), s2 = { cp: sol.cp, co: sol.co, ep: e8.concat([8, 9, 10, 11]), eo: sol.eo };
      for (let j = 0; j < 10; j++) { CPM[x * 10 + j] = lehmer(applyMove(s1, P2[j]).cp); EPM[x * 10 + j] = lehmer(applyMove(s2, P2[j]).ep.slice(0, 8)); }
    }
    for (let x = 0; x < 24; x++) { const sp = unlehmer(x, 4).map(v => v + 8), s = { cp: sol.cp, co: sol.co, ep: [0, 1, 2, 3, 4, 5, 6, 7].concat(sp), eo: sol.eo }; for (let j = 0; j < 10; j++) SPM[x * 10 + j] = lehmer(applyMove(s, P2[j]).ep.slice(8).map(v => v - 8)); }
    SL0 = slC(sol.ep);
    P1A = bfs(2187 * 495, 0 * 495 + SL0, 18, (i, m) => COM[(i / 495 | 0) * 18 + m] * 495 + SLM[(i % 495) * 18 + m]);
    P1B = bfs(2048 * 495, 0 * 495 + SL0, 18, (i, m) => EOM[(i / 495 | 0) * 18 + m] * 495 + SLM[(i % 495) * 18 + m]);
    P2A = bfs(40320 * 24, 0, 10, (i, j) => CPM[(i / 24 | 0) * 10 + j] * 24 + SPM[(i % 24) * 10 + j]);
    P2B = bfs(40320 * 24, 0, 10, (i, j) => EPM[(i / 24 | 0) * 10 + j] * 24 + SPM[(i % 24) * 10 + j]);
    ready = true;
  }

  function solve(state, maxTotal, deadline) {
    init();
    maxTotal = maxTotal || 22; deadline = deadline || (Date.now() + 4000);
    const co0 = coC(state.co), eo0 = eoC(state.eo), sl0 = slC(state.ep);
    const p1 = [], p2 = []; let result = null, limit = maxTotal;
    function phase2(cp, ep, sp, depth, last) {
      if (depth === 0) return cp === 0 && ep === 0 && sp === 0;
      if (Math.max(P2A[cp * 24 + sp], P2B[ep * 24 + sp]) > depth) return false;
      for (let j = 0; j < 10; j++) {
        const f = P2[j] / 3 | 0; if (f === last || (OPP[f] === last && f < last)) continue;
        p2.push(P2[j]); if (phase2(CPM[cp * 10 + j], EPM[ep * 10 + j], SPM[sp * 10 + j], depth - 1, f)) return true; p2.pop();
      }
      return false;
    }
    function goal() {
      let s = state; for (const m of p1) s = applyMove(s, m);
      const cp = lehmer(s.cp), ep = lehmer(s.ep.slice(0, 8)), sp = lehmer(s.ep.slice(8).map(v => v - 8));
      const last = p1.length ? p1[p1.length - 1] / 3 | 0 : -1;
      for (let d2 = Math.max(P2A[cp * 24 + sp], P2B[ep * 24 + sp]); d2 <= limit - p1.length; d2++) { p2.length = 0; if (phase2(cp, ep, sp, d2, last)) { result = p1.concat(p2); return true; } }
      return false;
    }
    function phase1(co, eo, sl, depth, last) {
      if (Date.now() > deadline) return true;
      const h = Math.max(P1A[co * 495 + sl], P1B[eo * 495 + sl]);
      if (depth === 0) return h === 0 && goal();
      if (h > depth) return false;
      for (let m = 0; m < 18; m++) {
        const f = m / 3 | 0; if (f === last || (OPP[f] === last && f < last)) continue;
        p1.push(m); if (phase1(COM[co * 18 + m], EOM[eo * 18 + m], SLM[sl * 18 + m], depth - 1, f)) return true; p1.pop();
      }
      return false;
    }
    while (!result && limit <= 30 && Date.now() <= deadline) {
      for (let d1 = Math.max(P1A[co0 * 495 + sl0], P1B[eo0 * 495 + sl0]); d1 <= Math.min(14, limit) && !result; d1++) { p1.length = 0; phase1(co0, eo0, sl0, d1, -1); if (Date.now() > deadline) break; }
      limit++;
    }
    return result ? result.map(m => MOVES[m]) : null;
  }

  function randomState(rand) {
    rand = rand || Math.random;
    const shuffle = n => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const parity = a => { let p = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[j] < a[i]) p ^= 1; return p; };
    const cp = shuffle(8), ep = shuffle(12); if (parity(cp) !== parity(ep)) [ep[10], ep[11]] = [ep[11], ep[10]];
    const co = [], eo = []; let cs = 0, es = 0;
    for (let i = 0; i < 7; i++) { co[i] = Math.floor(rand() * 3); cs += co[i]; } co[7] = (3 - cs % 3) % 3;
    for (let i = 0; i < 11; i++) { eo[i] = Math.floor(rand() * 2); es += eo[i]; } eo[11] = es & 1;
    return { cp, co, ep, eo };
  }
  function scramble(rand) {
    for (let tries = 0; tries < 5; tries++) {
      const st = randomState(rand); const sol = solve(st, 22);
      if (sol && sol.length >= 2) return sol.slice().reverse().map(C.invertMove).join(' ');
    }
    return null;
  }
  // read a sticker cube (3×3, centres in standard place) into cubie form — used by tests and the smart cube sync
  function read(cube) {
    const solved = new C.Cube(3); const key = (cb, p) => cb.st.filter(s => eq(s.p, p)).map(s => s.c).sort().join();
    const cHome = CORN.map(p => key(solved, p)), eHome = EDGE.map(p => key(solved, p));
    const st = { cp: [], co: [], ep: [], eo: [] };
    CORN.forEach((p, i) => { const s = cube.st.filter(x => eq(x.p, p)); st.cp[i] = cHome.indexOf(s.map(x => x.c).sort().join()); const ud = s.find(x => x.c === 0 || x.c === 1); st.co[i] = triple(p).findIndex(n => eq(n, ud.n)); });
    EDGE.forEach((p, i) => { const s = cube.st.filter(x => eq(x.p, p)); st.ep[i] = eHome.indexOf(s.map(x => x.c).sort().join()); const pr = s.find(x => x.c === 0 || x.c === 1) || s.find(x => x.c === 2 || x.c === 3); st.eo[i] = eq(pr.n, eRef(p)) ? 0 : 1; });
    return st;
  }
  root.SolvoTwoPhase = { init, solve, scramble, randomState, read, applyMove, MOVES, isReady: () => ready };
})(typeof self !== 'undefined' ? self : this);
