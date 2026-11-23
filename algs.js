/* Solvo Timer — OLL / PLL case library, case diagrams, setup scrambles. */
(function () {
  'use strict';
  const C = window.SolvoCube;

  // [id, group, algorithm]
  const OLL = [
    [1, 'Dot', "R U2 R2 F R F' U2 R' F R F'"],
    [2, 'Dot', "F R U R' U' F' f R U R' U' f'"],
    [3, 'Dot', "f R U R' U' f' U' F R U R' U' F'"],
    [4, 'Dot', "f R U R' U' f' U F R U R' U' F'"],
    [5, 'Square', "r' U2 R U R' U r"],
    [6, 'Square', "r U2 R' U' R U' r'"],
    [7, 'Lightning', "r U R' U R U2 r'"],
    [8, 'Lightning', "l' U' L U' L' U2 l"],
    [9, 'Fish', "R U R' U' R' F R2 U R' U' F'"],
    [10, 'Fish', "R U R' U R' F R F' R U2 R'"],
    [11, 'Lightning', "r U R' U R' F R F' R U2 r'"],
    [12, 'Lightning', "M' R' U' R U' R' U2 R U' R r'"],
    [13, 'Knight', "F U R U' R2 F' R U R U' R'"],
    [14, 'Knight', "R' F R U R' F' R F U' F'"],
    [15, 'Knight', "l' U' l L' U' L U l' U l"],
    [16, 'Knight', "r U r' R U R' U' r U' r'"],
    [17, 'Dot', "R U R' U R' F R F' U2 R' F R F'"],
    [18, 'Dot', "r U R' U R U2 r2 U' R U' R' U2 r"],
    [19, 'Dot', "M U R U R' U' M' R' F R F'"],
    [20, 'Dot', "r U R' U' M2 U R U' R' U' M'"],
    [21, 'Cross', "R U2 R' U' R U R' U' R U' R'"],
    [22, 'Cross', "R U2 R2 U' R2 U' R2 U2 R"],
    [23, 'Cross', "R2 D' R U2 R' D R U2 R"],
    [24, 'Cross', "r U R' U' r' F R F'"],
    [25, 'Cross', "F' r U R' U' r' F R"],
    [26, 'Cross', "R U2 R' U' R U' R'"],
    [27, 'Cross', "R U R' U R U2 R'"],
    [28, 'Corners oriented', "r U R' U' M U R U' R'"],
    [29, 'Awkward', "R U R' U' R U' R' F' U' F R U R'"],
    [30, 'Awkward', "F R' F R2 U' R' U' R U R' F2"],
    [31, 'P', "R' U' F U R U' R' F' R"],
    [32, 'P', "L U F' U' L' U L F L'"],
    [33, 'T', "R U R' U' R' F R F'"],
    [34, 'C', "R U R2 U' R' F R U R U' F'"],
    [35, 'Fish', "R U2 R2 F R F' R U2 R'"],
    [36, 'W', "L' U' L U' L' U L U L F' L' F"],
    [37, 'Fish', "F R' F' R U R U' R'"],
    [38, 'W', "R U R' U R U' R' U' R' F R F'"],
    [39, 'Lightning', "L F' L' U' L U F U' L'"],
    [40, 'Lightning', "R' F R U R' U' F' U R"],
    [41, 'Awkward', "R U R' U R U2 R' F R U R' U' F'"],
    [42, 'Awkward', "R' U' R U' R' U2 R F R U R' U' F'"],
    [43, 'P', "F' U' L' U L F"],
    [44, 'P', "F U R U' R' F'"],
    [45, 'T', "F R U R' U' F'"],
    [46, 'C', "R' U' R' F R F' U R"],
    [47, 'L', "R' U' R' F R F' R' F R F' U R"],
    [48, 'L', "F R U R' U' R U R' U' F'"],
    [49, 'L', "r U' r2 U r2 U r2 U' r"],
    [50, 'L', "r' U r2 U' r2 U' r2 U r'"],
    [51, 'I', "F U R U' R' U R U' R' F'"],
    [52, 'I', "R U R' U R U' B U' B' R'"],
    [53, 'L', "l' U2 L U L' U' L U L' U l"],
    [54, 'L', "r U2 R' U' R U R' U' R U' r'"],
    [55, 'I', "R' F R U R U' R2 F' R2 U' R' U R U R'"],
    [56, 'I', "r' U' r U' R' U R U' R' U R r' U r"],
    [57, 'Corners oriented', "R U R' U' M' U R U' r'"],
  ];
  const OLL_NICK = { 21: 'H', 22: 'Pi', 23: 'Headlights', 24: 'Chameleon', 25: 'Bowtie', 26: 'Antisune', 27: 'Sune', 28: 'Stealth', 33: 'Shoelaces', 45: 'Suit up', 57: 'Mummy' };
  const PLL = [
    ['Aa', 'Adjacent corners', "x R' U R' D2 R U' R' D2 R2 x'"],
    ['Ab', 'Adjacent corners', "x R2 D2 R U R' D2 R U' R x'"],
    ['E', 'Corners only', "x' R U' R' D R U R' D' R U R' D R U' R' D' x"],
    ['F', 'Adjacent swap', "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"],
    ['Ga', 'G perms', "R2 U R' U R' U' R U' R2 U' D R' U R D'"],
    ['Gb', 'G perms', "R' U' R U D' R2 U R' U R U' R U' R2 D"],
    ['Gc', 'G perms', "R2 U' R U' R U R' U R2 U D' R U' R' D"],
    ['Gd', 'G perms', "R U R' U' D R2 U' R U' R' U R' U R2 D'"],
    ['H', 'Edges only', "M2 U M2 U2 M2 U M2"],
    ['Ja', 'Adjacent swap', "R' U L' U2 R U' R' U2 R L"],
    ['Jb', 'Adjacent swap', "R U R' F' R U R' U' R' F R2 U' R'"],
    ['Na', 'Diagonal swap', "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"],
    ['Nb', 'Diagonal swap', "R' U R U' R' F' U' F R U R' F R' F' R U' R"],
    ['Ra', 'Adjacent swap', "R U' R' U' R U R D R' U' R D' R' U2 R'"],
    ['Rb', 'Adjacent swap', "R2 F R U R U' R' F' R U2 R' U2 R"],
    ['T', 'Adjacent swap', "R U R' U' R' F R2 U' R' U' R U R' F'"],
    ['Ua', 'Edges only', "M2 U M U2 M' U M2"],
    ['Ub', 'Edges only', "M2 U' M U2 M' U' M2"],
    ['V', 'Diagonal swap', "R U' R U R' D R D' R U' D R2 U R2 D' R2"],
    ['Y', 'Diagonal swap', "F R U' R' U' R U R' F' R U R' U' R' F R F'"],
    ['Z', 'Edges only', "M' U M2 U M2 U M' U2 M2"],
  ];

  const clean = a => a.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  const inverse = a => C.tokenize(clean(a)).reverse().map(C.invertMove).join(' ');

  // ---- rotation-free translation (so setups can be done on a real cube without rotating it)
  const FACES = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
  const OPP = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' };
  function translate(seq) {
    // tracker: where each original face's centre currently points
    const tr = new C.Cube(3); tr.st = Object.keys(FACES).map(k => ({ p: FACES[k].map(v => v * 2), n: FACES[k].slice(), c: k }));
    const faceAt = dir => tr.st.find(s => s.n[0] === dir[0] && s.n[1] === dir[1] && s.n[2] === dir[2]).c;
    const out = [];
    const emit = (face, suf) => out.push(faceAt(FACES[face]) + suf);
    const rot = (base, suf) => tr.move(suf === '2' ? base[0] + '2' : suf === "'" ? C.invertMove(base) : base);
    for (const tok of C.tokenize(clean(seq))) {
      const m = /^([URFDLBurfdlbMESxyz])(w?)(2?'?|'?2?)$/.exec(tok); if (!m) continue;
      let [, f, w, suf] = m; suf = suf.includes('2') ? '2' : suf.includes("'") ? "'" : '';
      const inv = s => s === '2' ? '2' : s === "'" ? '' : "'";
      if ('xyz'.includes(f)) { tr.move(f + suf); continue; }
      if (w || 'urfdlb'.includes(f)) { // wide = opposite face + rotation
        const F = f.toUpperCase(); emit(OPP[F], suf);
        rot({ R: 'x', L: "x'", U: 'y', D: "y'", F: 'z', B: "z'" }[F], suf); continue;
      }
      if (f === 'M') { emit('R', suf); emit('L', inv(suf)); rot("x'", suf); continue; }
      if (f === 'E') { emit('U', suf); emit('D', inv(suf)); rot("y'", suf); continue; }
      if (f === 'S') { emit('F', inv(suf)); emit('B', suf); rot('z', suf); continue; }
      emit(f, suf);
    }
    return simplify(out);
  }
  function simplify(moves) {
    const amt = s => s.endsWith('2') ? 2 : s.endsWith("'") ? 3 : 1;
    const st = [];
    for (const m of moves) {
      const f = m[0]; let a = amt(m);
      let i = st.length - 1;
      if (i >= 0 && st[i][0] !== f && OPP[st[i][0]] === f) i--; // parallel layer can be skipped
      if (i >= 0 && st[i][0] === f) { a = (st[i][1] + a) % 4; if (a === 0) st.splice(i, 1); else st[i][1] = a; }
      else st.push([f, a]);
    }
    return st.map(([f, a]) => f + ['', '', '2', "'"][a]).join(' ');
  }

  const AUF = ['', 'U', 'U2', "U'"];
  // Setup that produces the case on a solved cube held yellow-up, green-front.
  function setupFor(alg, pre, post) { return translate(`${AUF[pre || 0]} ${inverse(alg)} ${AUF[post || 0]}`); }

  // ---- diagrams: top view of the last layer. Palette for yellow-up / green-front.
  const LLPAL = { 0: '#ffd23f', 1: '#f4f4f0', 2: '#22c55e', 3: '#3b82f6', 4: '#fb923c', 5: '#ef4444' };
  function drawCase(canvas, cube, kind, opts) {
    opts = opts || {};
    const dpr = Math.min(window.devicePixelRatio || 1, 2), S = opts.size || canvas.clientWidth || 120;
    canvas.width = S * dpr; canvas.height = S * dpr; const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, S, S);
    const llColor = cube.centerColor([0, 1, 0]);
    const side = S * 0.1, cell = (S - side * 2 - 8) / 3, o = side + 4, gap = Math.max(1.5, S * 0.012), r = Math.max(2, S * 0.025);
    const fillFor = c => kind === 'oll' ? (c === llColor ? LLPAL[0] : '#3a3450') : LLPAL[c];
    const top = cube.st.filter(s => s.p[1] === 2);
    for (const s of top) {
      const col = (s.p[0] + 2) / 2, row = (s.p[2] + 2) / 2;
      let x, y, w, h;
      if (s.n[1] === 1) { x = o + col * cell; y = o + row * cell; w = h = cell; }
      else if (s.n[2] === -1) { x = o + col * cell; y = o - side; w = cell; h = side - 2; }
      else if (s.n[2] === 1) { x = o + col * cell; y = o + 3 * cell + 2; w = cell; h = side - 2; }
      else if (s.n[0] === -1) { x = o - side; y = o + row * cell; w = side - 2; h = cell; }
      else { x = o + 3 * cell + 2; y = o + row * cell; w = side - 2; h = cell; }
      const c = s.n[1] === 1 ? (kind === 'oll' ? (s.c === llColor ? LLPAL[0] : '#3a3450') : LLPAL[0]) : fillFor(s.c);
      if (kind === 'oll' && s.n[1] !== 1 && s.c !== llColor) continue;
      ctx.fillStyle = c; C.roundRect(ctx, x + gap / 2, y + gap / 2, w - gap, h - gap, r); ctx.fill();
    }
    if (kind === 'pll' && opts.arrows !== false) drawArrows(ctx, cube, o, cell, S);
  }
  function drawArrows(ctx, cube, o, cell, S) {
    // home of each top-layer piece = sum of the normals of the centres matching its colours
    const cc = {}; [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]].forEach(n => cc[cube.centerColor(n)] = n);
    const pieces = {};
    for (const s of cube.st) { if (s.p[1] !== 2) continue; const k = s.p.join(); (pieces[k] = pieces[k] || { p: s.p, cols: [] }).cols.push(s.c); }
    const centre = p => [o + ((p[0] + 2) / 2 + 0.5) * cell, o + ((p[2] + 2) / 2 + 0.5) * cell];
    ctx.strokeStyle = 'rgba(20,14,38,0.9)'; ctx.fillStyle = 'rgba(20,14,38,0.9)'; ctx.lineWidth = Math.max(1.6, S * 0.018); ctx.lineCap = 'round';
    for (const k in pieces) {
      const pc = pieces[k]; if (pc.cols.length < 2) continue;
      const home = [0, 0, 0]; pc.cols.forEach(c => { const n = cc[c]; home[0] += n[0] * 2; home[1] += n[1] * 2; home[2] += n[2] * 2; });
      if (home.join() === pc.p.join()) continue;
      const [x1, y1] = centre(pc.p), [x2, y2] = centre(home);
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, sh = cell * 0.22;
      const ax = x1 + ux * sh, ay = y1 + uy * sh, bx = x2 - ux * sh, by = y2 - uy * sh;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const hs = Math.max(4, S * 0.045); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - ux * hs - uy * hs * 0.6, by - uy * hs + ux * hs * 0.6); ctx.lineTo(bx - ux * hs + uy * hs * 0.6, by - uy * hs - ux * hs * 0.6); ctx.closePath(); ctx.fill();
    }
  }
  function caseCube(alg, pre, post) { return new C.Cube(3).apply(setupFor(alg, pre, post)); }

  // ---- checks used by the trainer for custom algorithms
  function isOriented(cube) { const ll = cube.centerColor([0, 1, 0]); return cube.st.every(s => s.n[1] !== 1 || s.c === ll); }
  function f2lIntact(cube) { const p = cube.phaseInfo(); return p.f2l.includes('0,-1,0'); }
  function solvesUpToAUF(cube) { for (const a of AUF) { const c = cube.clone().apply(a); if (c.isSolved()) return true; } return false; }
  function checkCustom(kind, caseAlg, myAlg) {
    const st = caseCube(caseAlg, 0, 0); try { st.apply(clean(myAlg)); } catch (e) { return false; }
    for (const a of AUF) { const c = st.clone().apply(a); if (kind === 'oll' ? (isOriented(c) && f2lIntact(c)) : c.isSolved()) return true; }
    // allow a pre-AUF too
    for (const pre of AUF) { const s2 = caseCube(caseAlg, 0, 0).apply(pre).apply(clean(myAlg)); for (const a of AUF) { const c = s2.clone().apply(a); if (kind === 'oll' ? (isOriented(c) && f2lIntact(c)) : c.isSolved()) return true; } }
    return false;
  }

  const cases = {
    oll: OLL.map(([n, g, a]) => ({ id: 'oll' + n, kind: 'oll', name: 'OLL ' + n, short: String(n), group: g, nick: OLL_NICK[n] || '', alg: a })),
    pll: PLL.map(([n, g, a]) => ({ id: 'pll' + n, kind: 'pll', name: n + ' perm', short: n, group: g, nick: '', alg: a })),
  };
  window.SolvoAlgs = { cases, OLL, PLL, inverse, translate, simplify, setupFor, caseCube, drawCase, isOriented, f2lIntact, solvesUpToAUF, checkCustom, AUF, LLPAL, clean };
})();
