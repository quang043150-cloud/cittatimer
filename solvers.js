/* Solvo Timer — optimal cross solver (3×3) and random-state 2×2 scrambler. */
(function () {
  'use strict';
  const C = window.SolvoCube;
  const FACE_MOVES = [];
  for (const f of ['U', 'D', 'F', 'B', 'R', 'L']) for (const s of ['', '2', "'"]) FACE_MOVES.push(f + s);
  const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  function moveSticker(N, p, n, m) { const t = new C.Cube(N); t.st = [{ p: p.slice(), n: n.slice(), c: 0 }]; t.move(m); return t.st[0]; }

  // =========================================================== CROSS
  // 12 edge slots on a 3×3; orientation 0 = cross-colour sticker on the slot's U/D face (or F/B face for E-slice slots)
  const SLOTS = [];
  for (const x of [-2, 0, 2]) for (const y of [-2, 0, 2]) for (const z of [-2, 0, 2]) if ((x !== 0) + (y !== 0) + (z !== 0) === 2) SLOTS.push([x, y, z]);
  const slotIdx = p => SLOTS.findIndex(s => eq(s, p));
  const refN = p => p[1] !== 0 ? [0, Math.sign(p[1]), 0] : [0, 0, Math.sign(p[2])];
  const otherN = p => { const r = refN(p); for (let a = 0; a < 3; a++) if (p[a] !== 0 && r[a] === 0) { const n = [0, 0, 0]; n[a] = Math.sign(p[a]); return n; } };
  const HOME = [[0, -2, 2], [2, -2, 0], [0, -2, -2], [-2, -2, 0]]; // DF DR DB DL
  const SIDE_N = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]];
  let MT = null, DIST = null, SOLVED = 0;
  const enc = es => ((es[0] * 24 + es[1]) * 24 + es[2]) * 24 + es[3];
  const dec = i => [Math.floor(i / 13824) % 24, Math.floor(i / 576) % 24, Math.floor(i / 24) % 24, i % 24];
  function buildCross() {
    if (DIST) return;
    MT = FACE_MOVES.map(m => {
      const t = new Int8Array(24);
      SLOTS.forEach((p, s) => [0, 1].forEach(o => {
        const st = moveSticker(3, p, o === 0 ? refN(p) : otherN(p), m); const s2 = slotIdx(st.p);
        t[s * 2 + o] = s2 * 2 + (eq(st.n, refN(st.p)) ? 0 : 1);
      }));
      return t;
    });
    SOLVED = enc(HOME.map(h => slotIdx(h) * 2));
    DIST = new Int8Array(331776).fill(-1); DIST[SOLVED] = 0;
    let frontier = [SOLVED], d = 0;
    while (frontier.length) {
      const next = [];
      for (const i of frontier) {
        const es = dec(i);
        for (let m = 0; m < 18; m++) { const t = MT[m]; const j = enc([t[es[0]], t[es[1]], t[es[2]], t[es[3]]]); if (DIST[j] < 0) { DIST[j] = d + 1; next.push(j); } }
      }
      frontier = next; d++;
    }
  }
  // cube already oriented so the cross colour is on D
  function crossState(cube) {
    const dCol = cube.centerColor([0, -1, 0]);
    const sideCol = SIDE_N.map(n => cube.centerColor(n));
    const es = [0, 0, 0, 0];
    for (const p of SLOTS) {
      const st = cube.st.filter(s => eq(s.p, p)); const cs = st.find(s => s.c === dCol); if (!cs) continue;
      const other = st.find(s => s !== cs); const k = sideCol.indexOf(other.c); if (k < 0) continue;
      es[k] = slotIdx(p) * 2 + (eq(cs.n, refN(p)) ? 0 : 1);
    }
    return enc(es);
  }
  const OPPF = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' };
  const ORDER = 'UDFBRL';
  function solveCrossIdx(idx, max) {
    buildCross(); const d = DIST[idx]; const sols = [];
    const rec = (i, path, last) => {
      if (sols.length >= max) return;
      if (DIST[i] === 0) { sols.push(path.join(' ')); return; }
      const es = dec(i);
      for (let m = 0; m < 18; m++) {
        const f = FACE_MOVES[m][0];
        if (last && (f === last || (OPPF[last] === f && ORDER.indexOf(f) < ORDER.indexOf(last)))) continue;
        const t = MT[m]; const j = enc([t[es[0]], t[es[1]], t[es[2]], t[es[3]]]);
        if (DIST[j] === DIST[i] - 1) { path.push(FACE_MOVES[m]); rec(j, path, f); path.pop(); }
      }
    };
    rec(idx, [], null);
    return { len: d, sols };
  }
  // colour → rotation that brings that centre to D (white-top / green-front scramble orientation)
  const CROSS_ORIENT = [
    { col: 0, name: 'White', rot: 'z2' }, { col: 1, name: 'Yellow', rot: '' }, { col: 2, name: 'Green', rot: "x'" },
    { col: 3, name: 'Blue', rot: 'x' }, { col: 4, name: 'Red', rot: 'z' }, { col: 5, name: 'Orange', rot: "z'" },
  ];
  function solveCross(scramble, colours, max) {
    buildCross();
    return (colours || [0]).map(col => {
      const o = CROSS_ORIENT.find(x => x.col === col);
      const cube = new C.Cube(3).apply(scramble); if (o.rot) cube.apply(o.rot);
      const r = solveCrossIdx(crossState(cube), max || 6);
      return Object.assign({ col, name: o.name, rot: o.rot }, r);
    });
  }
  function crossLen(scramble, col) { return solveCross(scramble, [col === undefined ? 0 : col], 1)[0].len; }
  // does the user's solution solve the cross of colour col?
  function checkCross(scramble, col, solution) {
    const o = CROSS_ORIENT.find(x => x.col === col); const cube = new C.Cube(3).apply(scramble); if (o.rot) cube.apply(o.rot);
    try { cube.apply(solution); } catch (e) { return { ok: false, moves: 0 }; }
    const p = cube.phaseInfo(); const ok = p.cross.some(k => cube.centerColor(k.split(',').map(Number)) === col);
    const moves = C.tokenize(solution).filter(m => !/^[xyz]/.test(m)).length;
    return { ok, moves };
  }

  // =========================================================== 2×2 random state
  // 7 corner slots (DBL fixed), orientation by U/D-colour sticker position in a clockwise triple
  const CSLOTS = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) if (!(x === -1 && y === -1 && z === -1)) CSLOTS.push([x, y, z]);
  const cIdx = p => CSLOTS.findIndex(s => eq(s, p));
  function triple(p) {
    const ny = [0, p[1], 0], nx = [p[0], 0, 0], nz = [0, 0, p[2]];
    const cross = [ny[1] * nx[2] - ny[2] * nx[1], ny[2] * nx[0] - ny[0] * nx[2], ny[0] * nx[1] - ny[1] * nx[0]];
    const dot = cross[0] * nz[0] + cross[1] * nz[1] + cross[2] * nz[2];
    return dot > 0 ? [ny, nz, nx] : [ny, nx, nz];
  }
  const M2 = ['U', 'U2', "U'", 'R', 'R2', "R'", 'F', 'F2', "F'"];
  let CT = null, PPRUNE = null, OPRUNE = null, PMOVE = null, OMOVE = null;
  const FACT = [1, 1, 2, 6, 24, 120, 720, 5040];
  function permIdx(p) { let i = 0; const a = p.slice(); for (let k = 0; k < 7; k++) { let s = 0; for (let j = k + 1; j < 7; j++) if (a[j] < a[k]) s++; i += s * FACT[6 - k]; } return i; }
  function permFrom(i) { const left = [0, 1, 2, 3, 4, 5, 6], p = []; for (let k = 0; k < 7; k++) { const f = FACT[6 - k]; const q = Math.floor(i / f); i %= f; p.push(left.splice(q, 1)[0]); } return p; }
  function oriIdx(o) { let i = 0; for (let k = 0; k < 6; k++) i = i * 3 + o[k]; return i; }
  function oriFrom(i) { const o = new Array(7); let s = 0; for (let k = 5; k >= 0; k--) { o[k] = i % 3; i = Math.floor(i / 3); s += o[k]; } o[6] = (3 - s % 3) % 3; return o; }
  function build2() {
    if (CT) return;
    CT = M2.map(m => CSLOTS.map((p, s) => [0, 1, 2].map(o => { const st = moveSticker(2, p, triple(p)[o], m); const s2 = cIdx(st.p); return [s2, triple(st.p).findIndex(n => eq(n, st.n))]; })));
    const applyP = (perm, m) => { const np = new Array(7); for (let s = 0; s < 7; s++) np[CT[m][s][0][0]] = perm[s]; return np; };
    const applyO = (ori, m) => { const no = new Array(7); for (let s = 0; s < 7; s++) { const [s2, o2] = CT[m][s][ori[s]]; no[s2] = o2; } return no; };
    PMOVE = Array.from({ length: 5040 }, (_, i) => { const p = permFrom(i); return M2.map((_, m) => permIdx(applyP(p, m))); });
    OMOVE = Array.from({ length: 729 }, (_, i) => { const o = oriFrom(i); return M2.map((_, m) => oriIdx(applyO(o, m))); });
    const bfs = (n, mv, start) => { const d = new Int8Array(n).fill(-1); d[start] = 0; let f = [start], k = 0; while (f.length) { const nx = []; for (const i of f) for (let m = 0; m < 9; m++) { const j = mv[i][m]; if (d[j] < 0) { d[j] = k + 1; nx.push(j); } } f = nx; k++; } return d; };
    PPRUNE = bfs(5040, PMOVE, 0); OPRUNE = bfs(729, OMOVE, 0);
  }
  function solve2(pi, oi) {
    build2();
    for (let depth = Math.max(PPRUNE[pi], OPRUNE[oi]); depth <= 14; depth++) {
      const path = [];
      const dfs = (p, o, d, last) => {
        if (d === 0) return p === 0 && o === 0;
        for (let m = 0; m < 9; m++) {
          const f = Math.floor(m / 3); if (f === last) continue;
          const p2 = PMOVE[p][m], o2 = OMOVE[o][m]; if (Math.max(PPRUNE[p2], OPRUNE[o2]) > d - 1) continue;
          path.push(M2[m]); if (dfs(p2, o2, d - 1, f)) return true; path.pop();
        }
        return false;
      };
      if (dfs(pi, oi, depth, -1)) return path;
    }
    return null;
  }
  function scramble222(rand) {
    rand = rand || Math.random;
    for (let tries = 0; tries < 20; tries++) {
      const pi = Math.floor(rand() * 5040), oi = Math.floor(rand() * 729);
      const sol = solve2(pi, oi); if (!sol || sol.length < 4) continue;
      return sol.slice().reverse().map(C.invertMove).join(' ');
    }
    return C.genScramble('222');
  }
  // read a 2×2 sticker cube into (perm, ori) — used by tests
  function read2(cube) {
    const solved = new C.Cube(2); const key = p => solved.st.filter(s => eq(s.p, p)).map(s => s.c).sort().join();
    const homeKey = CSLOTS.map(key); const perm = new Array(7), ori = new Array(7);
    CSLOTS.forEach((p, s) => { const st = cube.st.filter(x => eq(x.p, p)); const k = st.map(x => x.c).sort().join(); perm[s] = homeKey.indexOf(k); const ud = st.find(x => x.c === 0 || x.c === 1); ori[s] = triple(p).findIndex(n => eq(n, ud.n)); });
    return { pi: permIdx(perm), oi: oriIdx(ori), perm, ori };
  }

  // seeded RNG (weekly challenge)
  function seeded(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
  function seededScramble(type, rand) {
    if (type === '222') return scramble222(rand);
    const save = Math.random; Math.random = rand; try { return C.genScramble(type); } finally { Math.random = save; }
  }

  window.SolvoSolvers = { buildCross, solveCross, crossLen, checkCross, CROSS_ORIENT, scramble222, solve2, read2, build2, seeded, seededScramble, FACE_MOVES };
})();
