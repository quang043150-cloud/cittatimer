/* Solvo Timer — random-state scrambles off the main thread. */
self.window = self;
importScripts('cube.js', 'twophase.js', 'solvers.js');
self.onmessage = (e) => {
  const m = e.data || {};
  if (m.cmd === 'init') { const t = Date.now(); self.SolvoTwoPhase.init(); self.SolvoSolvers.build2(); self.postMessage({ cmd: 'ready', ms: Date.now() - t }); }
  else if (m.cmd === 'gen') {
    const list = [];
    for (let i = 0; i < (m.n || 1); i++) list.push(m.type === '222' ? self.SolvoSolvers.scramble222() : self.SolvoTwoPhase.scramble());
    self.postMessage({ cmd: 'list', type: m.type, list: list.filter(Boolean) });
  } else if (m.cmd === 'seeded') {
    const rand = self.SolvoSolvers.seeded(m.seed), T = self.SolvoTwoPhase, list = [];
    for (let i = 0; i < (m.n || 5); i++) { const st = T.randomState(rand); const sol = T.solve(st, 22, Date.now() + 8000); list.push(sol ? sol.slice().reverse().map(self.SolvoCube.invertMove).join(' ') : ''); }
    self.postMessage({ cmd: 'seeded', seed: m.seed, list });
  }
};
