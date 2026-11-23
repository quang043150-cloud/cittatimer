/* Solvo Timer — Train view: OLL / PLL trainer, cross trainer, metronome. */
(function () {
  'use strict';
  const A = window.SolvoApp, { C, St, $, $$, esc, clamp } = A, AL = window.SolvoAlgs, SV = window.SolvoSolvers;
  const T = { cur: null, pre: 0, post: 0, last: null, cr: null };
  const tr = () => A.S.train;
  const stat = (kind, id) => { const t = tr()[kind]; return t[id] || (t[id] = { n: 0, t: [], best: null, fails: 0 }); };
  const algOf = c => (tr().custom || {})[c.id] || c.alg;
  const avg = s => s && s.t.length ? s.t.slice(-5).reduce((a, b) => a + b, 0) / s.t.slice(-5).length : null;

  function pick(kind) {
    const sel = new Set(tr().sel[kind]), pool = AL.cases[kind].filter(c => sel.has(c.id)); if (!pool.length) return null;
    const known = pool.map(c => avg(tr()[kind][c.id])).filter(v => v != null), gm = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 3000;
    const w = pool.map(c => { if (T.cur && c.id === T.cur.id && pool.length > 1) return 0; const s = tr()[kind][c.id]; if (!s || !s.n) return 4; const r = (avg(s) || gm) / gm; return Math.max(0.3, r * r) * (1 + Math.min(4, s.fails || 0) * 0.6); });
    let x = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i]; } return pool[pool.length - 1];
  }
  function nextCase(kind) {
    T.cur = pick(kind); const ang = tr().opts.angle;
    T.pre = ang ? Math.floor(Math.random() * 4) : 0; T.post = ang ? Math.floor(Math.random() * 4) : 0;
  }

  A.render.train = function (sub) {
    const ui = A.ui; ui.trTab = sub && ['pll', 'oll', 'cross', 'metro'].includes(sub) ? sub : (ui.trTab || 'pll');
    const el = $('#v-train');
    el.innerHTML = `<div class="panel" style="max-width:1320px"><div class="panel-h"><div><h2>Train</h2><p>Drill last-layer algorithms, plan crosses like the fastest solvers, and practise smooth turning with a metronome.</p></div>
      <div class="seg" id="trTabs"><button data-t="pll">PLL</button><button data-t="oll">OLL</button><button data-t="cross">Cross</button><button data-t="metro">Metronome</button></div></div><div id="trBody"></div></div>`;
    $$('#trTabs button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.t === ui.trTab)); b.onclick = () => { A.Timer.cancel(); A.render.train(b.dataset.t); }; });
    if (ui.trTab === 'cross') renderCross(); else if (ui.trTab === 'metro') renderMetro(); else renderAlg(ui.trTab);
  };

  // ------------------------------------------------------------ OLL / PLL
  function renderAlg(kind) {
    if (!T.cur || T.cur.kind !== kind || !tr().sel[kind].includes(T.cur.id)) nextCase(kind);
    const body = $('#trBody'), cases = AL.cases[kind], sel = new Set(tr().sel[kind]);
    const groups = []; cases.forEach(c => { let g = groups.find(x => x.name === c.group); if (!g) groups.push(g = { name: c.group, cases: [] }); g.cases.push(c); });
    body.innerHTML = `<div class="tr-grid">
      <section class="card glass tr-pick"><div class="card-h"><h3>Cases · ${sel.size} of ${cases.length}</h3><div class="row-actions"><button class="btn sm" id="trAll">All</button><button class="btn sm" id="trNone">None</button></div></div>
        <div class="tr-groups">${groups.map(g => `<div class="tr-group"><button class="tr-gh" data-g="${esc(g.name)}">${esc(g.name)} <span class="muted">${g.cases.filter(c => sel.has(c.id)).length}/${g.cases.length}</span></button><div class="tr-cases">${g.cases.map(c => `<button class="tr-case ${sel.has(c.id) ? 'on' : ''}" data-id="${c.id}" title="${esc(c.name + (c.nick ? ' · ' + c.nick : ''))}"><canvas data-case="${c.id}" width="46" height="46"></canvas><span>${esc(c.short)}</span></button>`).join('')}</div></div>`).join('')}</div></section>
      <section class="glass tr-stage" id="trStage"></section>
      <aside class="tr-side"><section class="card glass" id="trLast"></section><section class="card glass" id="trStats"></section></aside></div>`;
    // thumbnails, drawn in small batches so the tab opens instantly
    const cvs = $$('canvas[data-case]', body); let i = 0; const batch = () => { const end = Math.min(cvs.length, i + 12); for (; i < end; i++) { const c = cases.find(x => x.id === cvs[i].dataset.case); AL.drawCase(cvs[i], AL.caseCube(c.alg, 0, 0), kind, { size: 46, arrows: kind === 'pll' }); } if (i < cvs.length) requestAnimationFrame(batch); }; requestAnimationFrame(batch);
    const saveSel = () => { A.Store.saveSoon(); if (!tr().sel[kind].includes((T.cur || {}).id)) nextCase(kind); renderAlg(kind); };
    $$('.tr-case', body).forEach(b => b.onclick = () => { const s = tr().sel[kind], id = b.dataset.id; tr().sel[kind] = s.includes(id) ? s.filter(x => x !== id) : s.concat(id); saveSel(); });
    $$('.tr-gh', body).forEach(b => b.onclick = () => { const ids = cases.filter(c => c.group === b.dataset.g).map(c => c.id), s = tr().sel[kind], all = ids.every(id => s.includes(id)); tr().sel[kind] = all ? s.filter(x => !ids.includes(x)) : [...new Set(s.concat(ids))]; saveSel(); });
    $('#trAll', body).onclick = () => { tr().sel[kind] = cases.map(c => c.id); saveSel(); };
    $('#trNone', body).onclick = () => { tr().sel[kind] = []; T.cur = null; saveSel(); };
    renderStage(kind); renderLast(kind); renderStats(kind);
  }
  function renderStage(kind) {
    const st = $('#trStage'); if (!st) return; const c = T.cur, o = tr().opts;
    if (!c) { st.innerHTML = '<div class="empty" style="padding:80px 20px">Pick at least one case on the left to start training.</div>'; A.Timer.setCtx(null); return; }
    const setup = AL.setupFor(c.alg, T.pre, T.post);
    st.innerHTML = `<div class="eyebrow">${kind.toUpperCase()} trainer · ${tr().sel[kind].length} case${tr().sel[kind].length === 1 ? '' : 's'}</div>
      <canvas id="trCase" class="tr-big" aria-label="Case diagram"></canvas>
      <div class="tr-name">${o.hide ? '<span class="muted">Name hidden</span>' : esc(c.name) + (c.nick ? ` <span class="muted">· ${esc(c.nick)}</span>` : '')}</div>
      <div class="tr-setup"><div class="eyebrow">Setup · hold yellow on top, green in front</div><div class="mono" id="trSetup">${esc(setup)}</div></div>
      <div class="time mono" id="trTime">0.00</div>
      <div class="hint" id="trHint"></div>
      <div class="row-actions" style="justify-content:center"><label class="tog"><input type="checkbox" class="switch" id="trAngle" ${o.angle ? 'checked' : ''}> Random angle</label><label class="tog"><input type="checkbox" class="switch" id="trHide" ${o.hide ? 'checked' : ''}> Hide case name</label><button class="btn sm" id="trSkip">Skip case</button></div>`;
    requestAnimationFrame(() => { const cv = $('#trCase'); if (cv) AL.drawCase(cv, AL.caseCube(c.alg, T.pre, T.post), kind, { size: cv.clientWidth || 200 }); });
    $('#trAngle').onchange = e => { o.angle = e.target.checked; A.Store.saveSoon(); nextCase(kind); renderStage(kind); };
    $('#trHide').onchange = e => { o.hide = e.target.checked; A.Store.saveSoon(); renderStage(kind); };
    $('#trSkip').onclick = () => { nextCase(kind); renderStage(kind); };
    $('#trSetup').onclick = () => A.copy(setup);
    A.Timer.setCtx({
      name: 'train', el: () => $('#trTime'), inspection: () => false,
      onDone: t => record(kind, t),
      hint: s => { const h = $('#trHint'); if (h) h.innerHTML = s === 'running' ? 'Any key stops' : s === 'hold' ? 'Keep holding…' : s === 'ready' ? 'Release to start' : 'Set up the case, hold <span class="kbd">Space</span> and release to start. <span class="kbd">F</span> marks the last case as failed.'; }
    });
  }
  function record(kind, t) {
    const c = T.cur, s = stat(kind, c.id); s.n++; s.t.push(Math.round(t)); if (s.t.length > 12) s.t.shift(); if (s.best == null || t < s.best) s.best = Math.round(t); s.fails = Math.max(0, (s.fails || 0) - 1);
    T.last = { c, t, pre: T.pre, post: T.post, failed: false }; A.Store.saveSoon(); A.checkBadges();
    nextCase(kind); renderStage(kind); renderLast(kind); renderStats(kind);
  }
  function markFailed(kind) {
    const L = T.last; if (!L || L.failed) return; const s = stat(kind, L.c.id); s.t.pop(); s.fails = (s.fails || 0) + 2; L.failed = true; A.Store.saveSoon(); renderLast(kind); renderStats(kind); A.toast(`${esc(L.c.name)} marked as failed. It will come up more often.`);
  }
  A.keyHooks = A.keyHooks || {};
  A.keyHooks.train = e => { const k = A.ui.trTab; if ((k === 'oll' || k === 'pll') && e.key.toLowerCase() === 'f' && A.Timer.state === 'idle') { markFailed(k); return true; } if (k === 'cross') return crossKey(e); return false; };
  function renderLast(kind) {
    const el = $('#trLast'); if (!el) return; const L = T.last && T.last.c.kind === kind ? T.last : null;
    if (!L) { el.innerHTML = '<div class="card-h"><h3>Last case</h3></div><div class="empty">Your last case and its algorithm show up here.</div>'; return; }
    el.innerHTML = `<div class="card-h"><h3>Last case</h3><span class="mono ${L.failed ? 'muted' : ''}" style="font-weight:700">${L.failed ? 'failed' : St.fmt(L.t)}</span></div>
      <div style="display:flex;gap:12px;align-items:center"><canvas id="trLastCv" width="84" height="84" style="width:84px;height:84px;flex:none"></canvas><div style="min-width:0"><div style="font-weight:700">${esc(L.c.name)}${L.c.nick ? ` <span class="muted">· ${esc(L.c.nick)}</span>` : ''}</div><div class="mono" style="font-size:13px;line-height:1.5;margin-top:4px">${esc(algOf(L.c))}</div></div></div>
      <div class="row-actions" style="margin-top:10px"><button class="btn sm" id="trFail" ${L.failed ? 'disabled' : ''}>Failed (F)</button><button class="btn sm" id="trEdit">Edit algorithm</button></div>`;
    AL.drawCase($('#trLastCv'), AL.caseCube(L.c.alg, L.pre, L.post), kind, { size: 84 });
    $('#trFail').onclick = () => markFailed(kind); $('#trEdit').onclick = () => editAlg(L.c);
  }
  function editAlg(c) {
    A.modal(`<div class="modal-h"><h3>Algorithm for ${esc(c.name)}</h3><button class="iconbtn" data-close aria-label="Close">${A.icon('x')}</button></div>
      <p class="muted">Use your own algorithm. It is checked before saving. Default: <span class="mono">${esc(c.alg)}</span></p>
      <input class="field mono" id="algIn" value="${esc(algOf(c))}" style="width:100%;box-sizing:border-box">
      <div class="row-actions" style="justify-content:space-between;margin-top:12px"><button class="btn" id="algReset">Use default</button><div class="row-actions"><button class="btn" data-close>Cancel</button><button class="btn primary" id="algOk">Save</button></div></div>`, m => {
      $('#algOk', m).onclick = () => { const v = AL.clean($('#algIn', m).value); if (!v) return; if (!AL.checkCustom(c.kind, c.alg, v)) { A.toast("That algorithm doesn't solve this case"); return; } tr().custom[c.id] = v; A.Store.saveSoon(); A.closeModal(); A.toast('Algorithm saved'); renderLast(c.kind); };
      $('#algReset', m).onclick = () => { delete tr().custom[c.id]; A.Store.saveSoon(); A.closeModal(); renderLast(c.kind); };
    });
  }
  function renderStats(kind) {
    const el = $('#trStats'); if (!el) return; const sel = new Set(tr().sel[kind]);
    const rows = AL.cases[kind].filter(c => sel.has(c.id)).map(c => ({ c, s: tr()[kind][c.id] })).sort((a, b) => (avg(b.s) || -1) - (avg(a.s) || -1));
    const trained = rows.filter(r => r.s && r.s.n).length, all = rows.map(r => avg(r.s)).filter(v => v != null);
    el.innerHTML = `<div class="card-h"><h3>Case stats</h3><span class="muted" style="font-size:12px">${trained}/${rows.length} trained${all.length ? ' · avg ' + St.fmt(all.reduce((a, b) => a + b, 0) / all.length) : ''}</span></div>
      <div class="tr-stats"><table class="tbl"><thead><tr><th>Case</th><th>n</th><th>avg 5</th><th>best</th></tr></thead><tbody>${rows.map(r => `<tr class="click" data-id="${r.c.id}"><td><canvas data-mini="${r.c.id}" width="22" height="22" style="width:22px;height:22px;vertical-align:middle;margin-right:6px"></canvas><span style="color:var(--ink)">${esc(r.c.short)}</span></td><td>${r.s ? r.s.n : 0}</td><td class="b">${St.fmt(avg(r.s))}</td><td>${St.fmt(r.s ? r.s.best : null)}</td></tr>`).join('')}</tbody></table></div>
      <div class="row-actions" style="margin-top:8px"><button class="btn sm danger" id="trReset">Reset ${kind.toUpperCase()} stats</button></div>`;
    requestAnimationFrame(() => $$('canvas[data-mini]', el).forEach(cv => { const c = AL.cases[kind].find(x => x.id === cv.dataset.mini); AL.drawCase(cv, AL.caseCube(c.alg, 0, 0), kind, { size: 22, arrows: false }); }));
    $$('tr[data-id]', el).forEach(r => r.onclick = () => editAlg(AL.cases[kind].find(c => c.id === r.dataset.id)));
    $('#trReset', el).onclick = () => A.confirmBox(`Reset all ${kind.toUpperCase()} training stats?`, 'Reset stats', () => { tr()[kind] = {}; A.Store.saveSoon(); renderStats(kind); });
  }

  // ------------------------------------------------------------ CROSS
  function crossState() { if (!T.cr) T.cr = { scr: null, phase: 'idle', t0: 0, iv: 0, res: null, mine: null }; return T.cr; }
  function newCross() {
    const cr = crossState(), o = tr().cross; clearInterval(cr.iv); cr.phase = 'idle'; cr.res = null; cr.mine = null;
    const want = o.level, col = o.neutral ? 0 : o.col; let scr = null;
    const fits = s => { if (want === 'any') return true; const L = SV.crossLen(s, col); return want === '4' ? L <= 4 : want === '78' ? L >= 7 : L === +want; };
    const first = A.Scrambler ? A.Scrambler.next('333') : C.genScramble('333');
    if (fits(first)) scr = first; else for (let i = 0; i < 6000 && !scr; i++) { const s = C.genScramble('333'); if (fits(s)) scr = s; }
    cr.scr = scr || first; renderCross();
  }
  function revealCross() { const cr = crossState(), o = tr().cross; clearInterval(cr.iv); cr.phase = 'reveal'; cr.res = SV.solveCross(cr.scr, o.neutral ? [0, 1, 2, 3, 4, 5] : [o.col], 4); o.tries = (o.tries || 0) + 1; o.lenSum = (o.lenSum || 0) + Math.min(...cr.res.map(r => r.len)); A.Store.saveSoon(); renderCross(); }
  function startPlan() { const cr = crossState(); cr.phase = 'plan'; cr.t0 = performance.now(); clearInterval(cr.iv); cr.iv = setInterval(() => { const left = 15 - (performance.now() - cr.t0) / 1000; const el = $('#crTime'); if (!el || A.view !== 'train') { clearInterval(cr.iv); return; } if (left <= 0) { revealCross(); return; } el.textContent = Math.ceil(left); if (left <= 8 && !cr.b8) { cr.b8 = 1; A.callout(8); } }, 100); cr.b8 = 0; renderCross(); }
  function crossKey(e) {
    if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return true; const cr = crossState(); if (cr.phase === 'idle') startPlan(); else if (cr.phase === 'plan') revealCross(); else newCross(); return true; }
    if (e.key.toLowerCase() === 'n') { newCross(); return true; }
    return false;
  }
  function renderCross() {
    A.Timer.setCtx(null);
    const cr = crossState(), o = tr().cross, body = $('#trBody'); if (!body) return; if (!cr.scr) { newCross(); return; }
    const cols = SV.CROSS_ORIENT;
    body.innerHTML = `<div class="grid2">
      <section class="card glass cr-stage">
        <div class="row-actions" style="justify-content:space-between;width:100%"><div class="row-actions"><select class="field" id="crCol" aria-label="Cross colour">${cols.map(x => `<option value="${x.col}" ${!o.neutral && o.col === x.col ? 'selected' : ''}>${x.name} cross</option>`).join('')}<option value="cn" ${o.neutral ? 'selected' : ''}>Colour neutral (all six)</option></select>
          <select class="field" id="crLvl" aria-label="Difficulty"><option value="any">Any scramble</option><option value="4">Easy · 4 moves or fewer</option><option value="5">5 moves</option><option value="6">6 moves</option><option value="78">Hard · 7–8 moves</option></select></div>
          <button class="btn" id="crNew">New scramble (N)</button></div>
        <div class="scramble" style="margin:14px 0 6px">${esc(cr.scr)}</div>
        <canvas data-cnet style="width:100%;max-width:340px;height:190px"></canvas>
        <div class="time mono" id="crTime" style="font-size:clamp(56px,7vw,96px)">${cr.phase === 'plan' ? '15' : cr.phase === 'reveal' ? '✓' : '15'}</div>
        <div class="hint">${cr.phase === 'idle' ? 'Press <span class="kbd">Space</span> to start 15 seconds of planning, like WCA inspection.' : cr.phase === 'plan' ? 'Plan your cross. Press <span class="kbd">Space</span> to reveal early.' : 'Press <span class="kbd">Space</span> or <span class="kbd">N</span> for the next scramble.'}</div>
        <div class="type-in" style="width:100%;max-width:520px"><input id="crMine" style="flex:1;width:auto" placeholder="Your cross, e.g. D' R F2 L" autocomplete="off" value="${esc(cr.mine || '')}"><button class="btn primary" id="crCheck">Check</button></div>
        <div id="crRes" style="min-height:22px;font-size:13px"></div>
        <div class="muted" style="font-size:11.5px;text-align:center">Scramble with white on top and green in front. Solutions assume you then turn the cross colour to the bottom (shown next to each colour).</div>
      </section>
      <section class="card glass"><div class="card-h"><h3>Optimal crosses</h3><span class="muted" id="crStats" style="font-size:12px">${o.tries || 0} planned · ${o.optimal || 0} found optimal${o.tries ? ' · avg ' + ((o.lenSum || 0) / o.tries).toFixed(1) + ' moves' : ''}</span></div>
        ${cr.phase === 'reveal' && cr.res ? cr.res.slice().sort((a, b) => a.len - b.len).map(r => `<div class="cr-sol"><div class="cr-h"><span class="cr-dot" style="background:${C.COLORS[r.col]}"></span><b>${r.name}</b><span class="muted">${r.rot ? 'hold: ' + r.rot : 'no rotation'}</span><span class="mono cr-len">${r.len} move${r.len === 1 ? '' : 's'}</span></div>${r.sols.map(s => `<div class="mono cr-line">${esc(s) || '(already solved)'}</div>`).join('')}</div>`).join('') : `<div class="empty" style="padding:40px 0">Solutions appear after planning. ${o.neutral ? 'All six colours are shown, best first.' : ''}</div>`}
      </section></div>`;
    C.drawNet($('[data-cnet]', body), new C.Cube(3).apply(cr.scr));
    $('#crCol').onchange = e => { if (e.target.value === 'cn') o.neutral = true; else { o.neutral = false; o.col = +e.target.value; } A.Store.saveSoon(); if (cr.phase === 'reveal') revealCross(); else renderCross(); };
    $('#crLvl').value = o.level; $('#crLvl').onchange = e => { o.level = e.target.value; A.Store.saveSoon(); newCross(); };
    $('#crNew').onclick = newCross;
    const check = () => {
      const v = $('#crMine').value.trim(); cr.mine = v; if (!v) return;
      const col = o.neutral ? (cr.res ? cr.res.slice().sort((a, b) => a.len - b.len)[0].col : 0) : o.col;
      const cols2 = o.neutral ? [0, 1, 2, 3, 4, 5] : [col]; const all = SV.solveCross(cr.scr, cols2, 1);
      let best = null; for (const r of all) { const ck = SV.checkCross(cr.scr, r.col, v); if (ck.ok && (!best || ck.moves - r.len < best.ck.moves - best.r.len)) best = { r, ck }; }
      const out = $('#crRes');
      if (!best) { out.innerHTML = `<span style="color:var(--bad)">That doesn't solve the ${o.neutral ? '' : SV.CROSS_ORIENT.find(x => x.col === col).name.toLowerCase() + ' '}cross. Remember to turn the cross colour to the bottom first.</span>`; return; }
      if (best.ck.moves <= best.r.len) { out.innerHTML = `<span style="color:var(--good)">Optimal! ${best.ck.moves} moves on ${best.r.name.toLowerCase()}.</span>`; if (!cr.counted) { cr.counted = true; o.optimal = (o.optimal || 0) + 1; A.Store.saveSoon(); A.checkBadges(); const cs = $('#crStats'); if (cs) cs.textContent = `${o.tries || 0} planned · ${o.optimal} found optimal${o.tries ? ' · avg ' + ((o.lenSum || 0) / o.tries).toFixed(1) + ' moves' : ''}`; } }
      else out.innerHTML = `<span style="color:var(--warn)">Works: ${best.ck.moves} moves. The optimal ${best.r.name.toLowerCase()} cross is ${best.r.len}.</span>`;
      if (cr.phase !== 'reveal') revealCross();
    };
    $('#crCheck').onclick = check; $('#crMine').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') check(); };
    cr.counted = cr.counted && cr.phase === 'reveal';
  }

  // ------------------------------------------------------------ METRONOME
  function renderMetro() {
    A.Timer.setCtx(null);
    const s = A.set(), M = A.Metro, body = $('#trBody');
    body.innerHTML = `<div class="grid2"><section class="card glass metro">
        <div class="eyebrow">Turns per second</div>
        <div class="metro-row"><button class="btn" id="mMinus" aria-label="Slower">−</button><div class="metro-v mono" id="mV">${s.metroTps.toFixed(1)}</div><button class="btn" id="mPlus" aria-label="Faster">+</button></div>
        <div class="muted mono">${Math.round(s.metroTps * 60)} beats per minute</div>
        <input type="range" id="mR" min="1" max="12" step="0.5" value="${s.metroTps}" style="width:100%;max-width:360px" aria-label="Turns per second">
        <div class="metro-dots" id="mDots">${[0, 1, 2, 3].map(i => `<i data-i="${i}"></i>`).join('')}</div>
        <button class="btn primary" id="mGo" style="min-width:140px">${M.on && M.free ? 'Stop' : 'Start'}</button>
        <label class="tog"><input type="checkbox" class="switch" id="mSolve" ${s.metroOn ? 'checked' : ''}> Click during timed solves</label>
      </section>
      <section class="card glass"><div class="card-h"><h3>How to use it</h3></div><ul class="hl">
        <li><span>1</span><span>Pick a pace where you can turn on every beat without stopping. For most people that is 2 to 4 TPS.</span></li>
        <li><span>2</span><span>Do full solves with one turn per click. Look ahead to the next pair while your hands keep the rhythm.</span></li>
        <li><span>3</span><span>When ten solves in a row feel smooth, raise the pace by 0.5 TPS.</span></li>
        <li><span>4</span><span>Turn on “Click during timed solves” to keep the beat in your normal sessions.</span></li></ul></section></div>`;
    const setV = v => { s.metroTps = clamp(Math.round(v * 2) / 2, 1, 12); A.Store.saveSoon(); $('#mV').textContent = s.metroTps.toFixed(1); $('#mR').value = s.metroTps; body.querySelector('.metro .muted').textContent = Math.round(s.metroTps * 60) + ' beats per minute'; if (M.on && M.free) M.start(s.metroTps, true); };
    $('#mMinus').onclick = () => setV(s.metroTps - 0.5); $('#mPlus').onclick = () => setV(s.metroTps + 0.5); $('#mR').oninput = e => setV(+e.target.value);
    $('#mGo').onclick = () => { if (M.on && M.free) { M.stop(); } else M.start(s.metroTps, true); renderMetro(); };
    $('#mSolve').onchange = e => { s.metroOn = e.target.checked; A.Store.saveSoon(); };
    const dots = () => { if (A.view !== 'train' || A.ui.trTab !== 'metro') return; const on = M.on && M.ctx; $$('#mDots i').forEach((d, i) => d.classList.toggle('on', !!on && ((M.beat - 1) % 4 + 4) % 4 === i)); requestAnimationFrame(dots); }; dots();
  }
})();
