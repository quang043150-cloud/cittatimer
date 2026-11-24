/* Solvo Timer — Analytics, Replay, Coach, Comp practice and Settings views. */
(function () {
  'use strict';
  const A = window.SolvoApp, { C, St, BG, $, $$, esc, clamp } = A;
  const DAY = 864e5;
  const PH_COL = { Cross: '#60a5fa', F2L: '#a78bfa', OLL: '#fbbf24', PLL: '#f472b6' };
  const fmtDate = d => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' });
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  function allSolvesOfEvent(ev) { return A.S.sessions.filter(s => s.event === ev).flatMap(s => A.S.solves[s.id]).slice().sort((a, b) => a.d - b.d); }
  function allSolves() { return A.S.sessions.flatMap(s => A.S.solves[s.id]); }

  // =============================================================== ANALYTICS
  A.render.analytics = function () {
    const ui = A.ui; ui.anScope = ui.anScope || 'session'; ui.anRange = ui.anRange || 'all';
    const base = ui.anScope === 'session' ? A.solves() : allSolvesOfEvent(A.event());
    const now = Date.now(), span = { week: 7 * DAY, month: 30 * DAY, year: 365 * DAY, all: Infinity }[ui.anRange];
    const list = base.filter(s => now - s.d <= span);
    const prevList = span === Infinity ? [] : base.filter(s => now - s.d > span && now - s.d <= 2 * span);
    const el = $('#v-analytics');
    const bS = St.best(list), b5 = St.bestRolling(list, 5), bigN = list.length >= 100 ? 100 : 12, bBig = St.bestRolling(list, bigN);
    const thisWeek = base.filter(s => now - s.d <= 7 * DAY).length;
    const tile = (k, v, s) => `<div class="tile glass"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    const atDate = r => r.at >= 0 ? fmtDate(list[r.at].d) : '—';
    el.innerHTML = `<div class="panel">
      <div class="panel-h"><div><h2>Analytics</h2><p>${A.EVENTS[A.event()]} · ${ui.anScope === 'session' ? esc(A.session().name) : 'all ' + A.EVENTS[A.event()] + ' sessions'} · ${list.length.toLocaleString()} solves</p></div>
        <div class="row-actions"><button class="btn" id="anShare">Share card</button><div class="seg" id="anScope"><button data-v="session">This session</button><button data-v="event">All sessions</button></div><div class="seg" id="anRange"><button data-v="week">Week</button><button data-v="month">Month</button><button data-v="year">Year</button><button data-v="all">All time</button></div></div></div>
      <div class="grid4">${tile('Best single', St.fmt(bS.v), atDate(bS))}${tile('Best ao5', St.fmt(b5.v), atDate(b5))}${tile('Best ao' + bigN, St.fmt(bBig.v), atDate(bBig))}${tile('Solves', list.length.toLocaleString(), '▲ ' + thisWeek + ' this week')}</div>
      <div class="grid2"><section class="card glass"><div class="card-h"><h3>Am I getting faster?</h3><span class="muted" style="font-size:11.5px">Your ao${bigN} over time. Lower is better.</span></div><div id="anFaster"></div></section>
        <section class="card glass"><div class="card-h"><h3>Highlights</h3><span class="muted" style="font-size:12px">${ui.anRange === 'all' ? 'all time' : 'this ' + ui.anRange}</span></div><ul class="hl" id="anHl"></ul></section></div>
      <div class="grid3"><section class="card glass"><div class="card-h"><h3>Where are my times?</h3></div><div id="anHist"></div><div class="legend" id="anHistL"></div></section>
        <section class="card glass"><div class="card-h"><h3>This week</h3><span class="muted" style="font-size:12px">solves per day</span></div><div id="anWeekTop"></div><div id="anWeek"></div></section>
        <section class="card glass"><div class="card-h"><h3>Records</h3></div><table class="tbl" id="anRec"></table></section></div>
      <div class="grid2"><section class="card glass"><div class="card-h"><h3>Average trend</h3><span class="muted" style="font-size:12px">last 200 solves</span></div><div id="anAvg"></div><div class="legend"><span><i style="background:#5eead4"></i>ao5</span><span><i style="background:#c4b5fd"></i>ao12</span><span><i style="background:#fbbf24"></i>ao50</span><span><i style="background:#f472b6"></i>ao100</span></div></section>
        <section class="card glass"><div class="card-h"><h3>Progress windows</h3></div><table class="tbl" id="anWin"></table><div class="muted" style="font-size:12px;margin-top:6px">σ is the spread (lower means more consistent). “vs before” compares with the block of the same size right before it.</div></section></div>
      <div class="grid3"><section class="card glass"><div class="card-h"><h3>Training days</h3><span class="muted" style="font-size:12px">last 52 weeks</span></div><div class="heat" id="anHeat"></div></section>
        <section class="card glass"><div class="card-h"><h3>When you are fastest</h3><span class="muted" style="font-size:12px">mean by hour</span></div><div id="anHour"></div></section>
        <section class="card glass"><div class="card-h"><h3>Sub-X per month</h3><span class="muted" style="font-size:12px">share of solves</span></div><div id="anSubM"></div><div class="legend" id="anSubML"></div></section></div>
      <section class="card glass"><div class="card-h"><h3>Session details</h3><button class="btn sm" id="anCsv">Export CSV</button></div><div class="stat-grid" id="anDet"></div></section>
    </div>`;
    $$('#anScope button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === ui.anScope)); b.onclick = () => { ui.anScope = b.dataset.v; A.render.analytics(); }; });
    $$('#anRange button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === ui.anRange)); b.onclick = () => { ui.anRange = b.dataset.v; A.render.analytics(); }; });
    $('#anCsv').onclick = () => exportCSV(list);
    $('#anShare').onclick = () => A.openShareCard({ kind: 'progress' });
    requestAnimationFrame(() => drawAnalytics(list, prevList, bigN));
  };
  function drawAnalytics(list, prevList, bigN) {
    const now = Date.now();
    // faster
    const roll = St.rolling(list, bigN); const lbls = []; const n = list.length; if (n) for (const f of [0, 0.33, 0.66, 1]) { const i = Math.min(n - 1, Math.round(f * (n - 1))); lbls.push([i, fmtDate(list[i].d)]); }
    A.lineChart($('#anFaster'), { h: 190, yfmt: A.secFmt, xLabels: lbls, series: [{ d: roll, c: '#5eead4', w: 2, area: true, end: true }], empty: `Needs at least ${bigN} solves`, tip: i => roll[i] == null ? `<div class="muted">Solve #${i + 1}</div>` : `<div class="muted">${fmtDate(list[i].d)} · solve #${i + 1}</div><div><i style="background:#5eead4"></i>ao${bigN} <b>${St.fmt(roll[i])}</b></div>` });
    // highlights
    const hl = [], m = St.mean(list);
    if (m) hl.push(['∅', `Your mean is <b>${St.fmt(m)}</b>${prevList.length ? (() => { const pm = St.mean(prevList); return pm ? `, <b>${St.fmt(Math.abs(pm - m))}</b> ${m < pm ? 'faster' : 'slower'} than the period before` : ''; })() : ''}.`]);
    let pbs = 0, cur = Infinity, last = null; list.forEach(s => { const v = St.val(s); if (v < cur) { cur = v; pbs++; last = s; } });
    if (last) hl.push(['★', `<b>${pbs}</b> single PBs along the way. The newest is <b>${St.fmt(cur)}</b> on ${fmtDate(last.d)}.`]);
    const tot = list.reduce((a, s) => a + s.t, 0); if (list.length) hl.push(['Σ', `<b>${list.length.toLocaleString()}</b> solves, ${(tot / 36e5).toFixed(1)} h of solving.`]);
    const byH = hourMeans(list); const bh = byH.reduce((b, x, h) => x && x.n >= 5 && (!b || x.m < b.m) ? { h, m: x.m } : b, null); if (bh) hl.push(['◷', `You are fastest around <b>${String(bh.h).padStart(2, '0')}:00</b> (mean ${St.fmt(bh.m)}).`]);
    if (m) { const th = Math.floor(m / 1000); const k = list.filter(s => St.val(s) < th * 1000).length; hl.push(['%', `<b>${Math.round(k / list.length * 100)}%</b> of your solves are sub-${th}.`]); }
    const days = {}; list.forEach(s => { const k = St.dayKey(s.d); days[k] = (days[k] || 0) + 1; }); const busiest = Object.entries(days).sort((a, b) => b[1] - a[1])[0]; if (busiest) hl.push(['▦', `Busiest day: <b>${busiest[1]}</b> solves on ${fmtDate(new Date(busiest[0]))}.`]);
    $('#anHl').innerHTML = hl.length ? hl.map(([i, t]) => `<li><span>${i}</span><span>${t}</span></li>`).join('') : '<li class="empty">Solve a few times to see highlights.</li>';
    // histogram
    const hg = St.histogram(list, 16); const med = St.median(list);
    A.barChart($('#anHist'), hg.bins, { h: 140, top: v => v || '', labels: hg.bins.map((_, i) => i % 3 === 0 ? ((hg.lo + i * hg.w) / 1000).toFixed(hg.w < 1000 ? 1 : 0) : ''), color: (v, i) => med && hg.lo + i * hg.w <= med && med < hg.lo + (i + 1) * hg.w ? '#fbbf24' : '#5eead4', tip: (v, i) => `<div class="muted">${((hg.lo + i * hg.w) / 1000).toFixed(2)}–${((hg.lo + (i + 1) * hg.w) / 1000).toFixed(2)} s</div><b>${v} solve${v === 1 ? '' : 's'}</b>` });
    $('#anHistL').innerHTML = `<span>${(hg.w / 1000).toFixed(2)} s per bar</span><span><i style="background:#fbbf24"></i>median ${St.fmt(med)}</span><span>mean ${St.fmt(m)}</span>`;
    // week
    const wk = [], wl = []; for (let d = 6; d >= 0; d--) { const s0 = startOfDay(now - d * DAY); wk.push(list.filter(s => s.d >= s0 && s.d < s0 + DAY).length); wl.push(new Date(s0).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)); }
    const tw = list.filter(s => now - s.d <= 7 * DAY), lw = list.filter(s => now - s.d > 7 * DAY && now - s.d <= 14 * DAY); const mtw = St.mean(tw), mlw = St.mean(lw);
    $('#anWeekTop').innerHTML = `<div style="display:flex;gap:24px;margin-bottom:6px"><div><div class="eyebrow">Mean this week</div><b class="mono" style="font-size:20px">${St.fmt(mtw)}</b>${mtw && mlw ? `<div style="font-size:12px;color:${mtw < mlw ? 'var(--good)' : 'var(--bad)'}">${mtw < mlw ? '▼' : '▲'} ${St.fmt(Math.abs(mtw - mlw))} vs last week (${St.fmt(mlw)})</div>` : ''}</div><div><div class="eyebrow">Solves</div><b class="mono" style="font-size:20px">${tw.length}</b></div></div>`;
    A.barChart($('#anWeek'), wk, { h: 100, labels: wl, top: v => v || '', color: () => '#5eead4', tip: (v, i) => `<div class="muted">${new Date(startOfDay(now - (6 - i) * DAY)).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</div><b>${v} solve${v === 1 ? '' : 's'}</b>` });
    // records
    const rec = [['Single', St.best(list)], ['ao5', St.bestRolling(list, 5)], ['ao12', St.bestRolling(list, 12)], ['ao50', St.bestRolling(list, 50)], ['ao100', St.bestRolling(list, 100)]];
    $('#anRec').innerHTML = rec.map(([k, r]) => `<tr><td>${k}</td><td class="b">${St.fmt(r.v)}</td><td class="muted">${r.at >= 0 ? fmtDate(list[r.at].d) : ''}</td></tr>`).join('') + `<tr><td>Mean</td><td class="b">${St.fmt(m)}</td><td class="muted">all solves</td></tr>`;
    // average trend
    const tail = list.slice(-200), off = list.length - tail.length; const r = k => St.rolling(list, k).slice(off);
    A.lineChart($('#anAvg'), { h: 170, yfmt: A.secFmt, series: [{ d: r(5), c: '#5eead4', w: 1.4, label: 'ao5' }, { d: r(12), c: '#c4b5fd', w: 1.6, label: 'ao12' }, { d: r(50), c: '#fbbf24', w: 1.8, label: 'ao50' }, { d: r(100), c: '#f472b6', w: 2, label: 'ao100' }], tip: i => { const S5 = r(5), S12 = r(12), S50 = r(50), S100 = r(100); return `<div class="muted">Solve #${off + i + 1}</div>` + [['ao5', S5, '#5eead4'], ['ao12', S12, '#c4b5fd'], ['ao50', S50, '#fbbf24'], ['ao100', S100, '#f472b6']].filter(x => x[1][i] != null).map(([l, d, c]) => `<div><i style="background:${c}"></i>${l} <b>${St.fmt(d[i])}</b></div>`).join(''); } });
    // windows
    const W = St.windows(list, [12, 50, 100, 500, 'all']);
    $('#anWin').innerHTML = `<thead><tr><th>Window</th><th>Mean</th><th>Best</th><th>σ</th><th>vs before</th></tr></thead><tbody>` + W.map(w => w.empty ? `<tr><td>Last ${w.n}</td><td colspan="4" class="muted">not enough solves</td></tr>` : `<tr><td>${w.n === 'all' ? 'All ' + list.length : 'Last ' + w.n}</td><td class="b">${St.fmt(w.mean)}</td><td>${St.fmt(w.best)}</td><td>${w.sd ? (w.sd / 1000).toFixed(2) : '–'}</td><td style="color:${w.delta == null ? 'inherit' : w.delta < 0 ? 'var(--good)' : 'var(--bad)'}">${w.delta == null ? '–' : (w.delta < 0 ? '▼ ' : '▲ ') + (Math.abs(w.delta) / 1000).toFixed(2)}</td></tr>`).join('') + '</tbody>';
    // heatmap
    const all = allSolvesOfEvent(A.event()), cnt = {}; all.forEach(s => { const k = St.dayKey(s.d); cnt[k] = (cnt[k] || 0) + 1; });
    const mx = Math.max(1, ...Object.values(cnt)); const start = startOfDay(now) - (51 * 7 + new Date().getDay()) * DAY; let cells = '';
    for (let t = start; t <= now; t += DAY) { const c = cnt[St.dayKey(t)] || 0; const a = c ? 0.25 + 0.75 * c / mx : 0; cells += `<i title="${fmtDate(t)}: ${c} solves" style="${c ? `background:rgba(94,234,212,${a.toFixed(2)})` : ''}"></i>`; }
    $('#anHeat').innerHTML = cells;
    // hours
    const hv = byH.map(x => x && x.n >= 3 ? x.m : 0); const best = Math.min(...hv.filter(v => v > 0));
    A.barChart($('#anHour'), hv, { h: 120, labels: hv.map((_, i) => i % 6 === 0 ? i + 'h' : ''), color: v => v === best ? '#fde68a' : '#5eead4', tip: (v, i) => `<div class="muted">${String(i).padStart(2, '0')}:00–${String(i).padStart(2, '0')}:59</div><b>${v ? 'mean ' + St.fmt(v) : 'fewer than 3 solves'}</b>` });
    // sub-x per month
    const months = {}; list.forEach(s => { const d = new Date(s.d); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); (months[k] = months[k] || []).push(s); });
    const keys = Object.keys(months).sort().slice(-12); const base = m ? Math.floor(m / 1000) : 15; const ths = [base - 2, base, base + 2].filter(x => x > 0);
    const cols = ['#5eead4', '#c4b5fd', '#fbbf24'];
    A.lineChart($('#anSubM'), { h: 120, zero: true, yfmt: v => Math.round(v) + '%', xLabels: keys.length ? [[0, keys[0]], [keys.length - 1, keys[keys.length - 1]]] : null, series: ths.map((t, i) => ({ c: cols[i], w: 2, dots: true, label: 'sub-' + t, d: keys.map(k => months[k].filter(s => St.val(s) < t * 1000).length / months[k].length * 100) })), empty: 'Needs solves in two different months', fmt: v => Math.round(v) + '%', tip: i => `<div class="muted">${keys[i]} · ${months[keys[i]].length} solves</div>` + ths.map((t, k) => `<div><i style="background:${cols[k]}"></i>sub-${t} <b>${Math.round(months[keys[i]].filter(s => St.val(s) < t * 1000).length / months[keys[i]].length * 100)}%</b></div>`).join('') });
    $('#anSubML').innerHTML = ths.map((t, i) => `<span><i style="background:${cols[i]}"></i>sub-${t}</span>`).join('');
    // details
    const dnf = list.filter(s => s.p === -1).length, p2 = list.filter(s => s.p === 2000).length, sd = St.stdev(list);
    const det = [['Worst', St.fmt(St.worst(list))], ['Median', St.fmt(St.median(list))], ['Mean', St.fmt(m)], ['Std dev', sd ? (sd / 1000).toFixed(2) : '–'], ['Valid', (list.length - dnf).toLocaleString()], ['DNF', dnf], ['+2', p2], ['Consistency', sd && m ? Math.round(100 - sd / m * 100) + ' / 100' : '–']];
    $('#anDet').innerHTML = det.map(([k, v]) => `<div><div class="eyebrow">${k}</div><b class="mono" style="font-size:17px">${v}</b></div>`).join('');
  }
  function hourMeans(list) { const b = Array.from({ length: 24 }, () => []); list.forEach(s => { const v = St.val(s); if (isFinite(v)) b[new Date(s.d).getHours()].push(v); }); return b.map(a => a.length ? { n: a.length, m: a.reduce((x, y) => x + y, 0) / a.length } : null); }

  // ---------- downloads helper
  async function saveFile(filename, data, mime) {
    let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { }
    if (dl) { try { const r = await dl.save({ filename, data: data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain' }) }); if (r && r.status === 'saved') A.toast('Saved ' + esc(filename)); return; } catch (e) { if (e && e.code === 'declined') return; } }
    if (!window.claude) { // standalone website: normal browser download
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain' }));
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000); A.toast('Downloaded ' + esc(filename)); return;
    }
    if (typeof data === 'string') A.modal(`<div class="modal-h"><h3>${esc(filename)}</h3><button class="iconbtn" data-close aria-label="Close">${A.icon('x')}</button></div><p class="muted">Saving files isn't available here. Copy the text below instead.</p><textarea class="field mono" style="width:100%;height:260px;box-sizing:border-box" readonly>${esc(data.slice(0, 2e6))}</textarea><div class="row-actions" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="cpAll">Copy all</button></div>`, m => { $('#cpAll', m).onclick = () => A.copy(data); });
    else A.toast('Saving files isn’t available in this view');
  }
  A.saveFile = (n, d, m) => saveFile(n, d, m);
  function exportCSV(list) {
    const rows = [['No', 'Time', 'Penalty', 'Date', 'Scramble', 'Comment']].concat(list.map((s, i) => [i + 1, (s.t / 1000).toFixed(3), s.p === -1 ? 'DNF' : s.p ? '+2' : '', new Date(s.d).toISOString(), s.s || '', s.c || '']));
    saveFile(`solvo-${A.session().name.replace(/\W+/g, '-')}.csv`, rows.map(r => r.map(x => /[",;\n]/.test(String(x)) ? '"' + String(x).replace(/"/g, '""') + '"' : x).join(',')).join('\n'), 'text/csv');
  }

  // =============================================================== REPLAY
  function analyze(rep) {
    const cube = new C.Cube(3).apply(rep.scr), mv = rep.mv; let base = null, iC = -1, iF = -1, iO = -1;
    for (let i = 0; i < mv.length; i++) {
      cube.move(mv[i][0]); const p = cube.phaseInfo();
      if (iC < 0 && p.cross.length) { iC = i; base = p.cross.includes('0,-1,0') ? '0,-1,0' : p.cross[0]; }
      if (iC >= 0 && iF < 0 && p.f2l.includes(base)) iF = i;
      if (iF >= 0 && iO < 0 && p.oll.includes(base)) iO = i;
    }
    const end = mv.length - 1, isRot = m => /^[xyz]/.test(m);
    const count = (a, b) => { let k = 0; for (let i = a; i <= b; i++) if (mv[i] && !isRot(mv[i][0])) k++; return k; };
    let phases = null;
    if (iC >= 0 && iF >= 0 && iO >= 0) {
      const cut = [[0, iC, 'Cross'], [iC + 1, iF, 'F2L'], [iF + 1, iO, 'OLL'], [iO + 1, end, 'PLL']];
      phases = cut.map(([a, b, name]) => { const t0 = a === 0 ? 0 : mv[a - 1][1], t1 = b >= a ? mv[b][1] : t0, mvs = count(a, b); return { name, a, b, t: t1 - t0, moves: mvs, tps: t1 > t0 ? mvs / ((t1 - t0) / 1000) : 0, t0, t1 }; });
    }
    const pauses = []; for (let i = 1; i < mv.length; i++) { const g = mv[i][1] - mv[i - 1][1]; if (g >= 400) pauses.push({ i, g, at: mv[i - 1][1] }); }
    const total = mv.filter(m => !isRot(m[0])).length; const dur = rep.t || (mv.length ? mv[end][1] : 0);
    const tps = []; for (let t = 0; t <= dur; t += 250) { let k = 0; for (const m of mv) if (m[1] > t - 1000 && m[1] <= t && !isRot(m[0])) k++; tps.push(k); }
    return { phases, pauses, total, dur, tps, base };
  }
  A.analyze = analyze;
  const P = { rep: null, an: null, t: 0, k: 0, cube: null, playing: false, speed: 1, loop: false, view: { yaw: -0.62, pitch: 0.52 }, raf: 0, last: 0 };
  A.openReplay = id => { A.ui.rep = id; A.go('replay'); };
  function replayList() { return Object.values(A.S.replays).sort((a, b) => (b.d || 0) - (a.d || 0)); }
  A.render.replay = function () {
    const el = $('#v-replay'); const ui = A.ui; ui.repF = ui.repF || 'all';
    let list = replayList(); const now = Date.now();
    if (ui.repF === 'fastest') list = list.slice().sort((a, b) => a.t - b.t); if (ui.repF === 'today') list = list.filter(r => r.d >= startOfDay(now));
    if (ui.repQ) list = list.filter(r => St.fmt(r.t).includes(ui.repQ));
    if (!ui.rep || !A.S.replays[ui.rep]) ui.rep = list[0] ? list[0].id : null;
    cancelAnimationFrame(P.raf); P.playing = false;
    el.innerHTML = `<div class="panel" style="max-width:1300px">
      <div class="panel-h"><div><h2>Replay</h2><p>Watch any virtual-cube solve again, split into Cross, F2L, OLL and PLL.</p></div></div>
      <div class="replay-grid">
        <section class="card glass"><div class="card-h"><h3>Solves with replay</h3><span class="muted mono" style="font-size:12px">${Object.keys(A.S.replays).length}</span></div>
          <div class="muted" style="font-size:11.5px;margin-bottom:8px">Replays exist for solves done with the virtual cube. Timer and typed times have no moves to replay.</div>
          <input class="field" id="repQ" aria-label="Find a solve by time" placeholder="Find a solve by time…" value="${esc(ui.repQ || '')}" style="width:100%;box-sizing:border-box;margin-bottom:8px">
          <div class="seg" id="repF" style="margin-bottom:8px"><button data-v="all">All</button><button data-v="fastest">Fastest</button><button data-v="today">Today</button></div>
          <div class="rlist" id="rlist">${list.map(r => `<button data-id="${r.id}" class="${r.id === ui.rep ? 'on' : ''}"><span>${St.fmt(r.t)}</span><small>${r.d ? fmtDate(r.d) : ''}</small></button>`).join('') || '<div class="empty">No replays yet. Switch the timing input to “Virtual cube” and solve.</div>'}</div></section>
        <section class="card glass player" id="player"></section>
        <section class="card glass" id="pside"></section>
      </div></div>`;
    $$('#repF button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === ui.repF)); b.onclick = () => { ui.repF = b.dataset.v; A.render.replay(); }; });
    $('#repQ').oninput = e => { ui.repQ = e.target.value.trim(); const pos = e.target.selectionStart; A.render.replay(); const q = $('#repQ'); q.focus(); q.setSelectionRange(pos, pos); };
    $('#rlist').onclick = e => { const b = e.target.closest('button[data-id]'); if (b) { ui.rep = b.dataset.id; A.render.replay(); } };
    if (ui.rep) loadReplay(A.S.replays[ui.rep]); else { $('#player').innerHTML = '<div class="empty" style="padding:80px 0">Pick a solve on the left.</div>'; $('#pside').innerHTML = ''; }
  };
  function setK(k) { if (k < P.k || !P.cube) { P.cube = new C.Cube(3).apply(P.rep.scr); P.k = 0; } while (P.k < k) { P.cube.move(P.rep.mv[P.k][0]); P.k++; } }
  function kAt(t) { const mv = P.rep.mv; let k = 0; while (k < mv.length && mv[k][1] <= t) k++; return k; }
  function phaseAt(k) { if (!P.an.phases) return null; for (const ph of P.an.phases) if (k - 1 <= ph.b) return ph; return P.an.phases[3]; }
  function loadReplay(rep) {
    P.rep = rep; P.an = analyze(rep); P.t = 0; P.k = 0; P.cube = null; setK(0);
    const an = P.an;
    $('#player').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div><div class="eyebrow">Replay time</div><div class="ptime"><span id="pT">0.00</span> <span class="muted" style="font-size:14px">of ${St.fmt(an.dur)} s</span></div><div class="muted" style="font-size:12px" id="pPh"></div></div>
      <div class="seg" id="pView"><button data-v="front">Front</button><button data-v="top">Top</button><button data-v="back">Back</button></div></div>
      <canvas id="pCanvas" aria-label="Replay cube"></canvas>
      <input type="range" class="scrub" id="pScrub" min="0" max="${an.dur}" step="10" value="0" aria-label="Seek">
      <div class="controls"><button class="btn sm" id="pStart" aria-label="Start">${A.icon('first')}</button><button class="btn sm" id="pBack" aria-label="Previous move">${A.icon('prev')}</button><button class="btn sm primary" id="pPlay" style="min-width:86px">${A.icon('play', 12)} Play</button><button class="btn sm" id="pFwd" aria-label="Next move">${A.icon('next')}</button><button class="btn sm" id="pEnd" aria-label="End">${A.icon('last')}</button>
        <div class="seg" id="pSpeed">${[0.25, 0.5, 1, 2].map(s => `<button data-s="${s}" aria-label="Speed ${s} times" style="padding:3px 9px;font-size:12px">${s}×</button>`).join('')}</div>
        <button class="btn sm" id="pLoop" aria-pressed="false">${A.icon('repeat', 13)} Loop phase</button></div>
      <div class="moves" id="pMoves" style="margin-top:10px"></div>`;
    const ph = an.phases;
    $('#pside').innerHTML = `<div class="stat-grid" style="grid-template-columns:repeat(3,1fr)"><div class="tile glass" style="padding:8px 10px"><div class="k">Time</div><div class="v" style="font-size:18px">${St.fmt(an.dur)}</div></div><div class="tile glass" style="padding:8px 10px"><div class="k">Moves</div><div class="v" style="font-size:18px">${an.total}</div></div><div class="tile glass" style="padding:8px 10px"><div class="k">TPS</div><div class="v" style="font-size:18px">${an.dur ? (an.total / (an.dur / 1000)).toFixed(1) : '–'}</div></div></div>
      <div class="card-h" style="margin-top:12px"><h3>Phases</h3><span class="muted" style="font-size:12px">auto-detected</span></div>
      ${ph ? `<table class="tbl"><thead><tr><th>Phase</th><th>Time</th><th>Moves</th><th>TPS</th></tr></thead><tbody>${ph.map(p => `<tr><td style="color:var(--ink)"><span class="phase-dot" style="background:${PH_COL[p.name]}"></span>${p.name}</td><td class="b">${(p.t / 1000).toFixed(2)}</td><td>${p.moves}</td><td>${p.tps.toFixed(1)}</td></tr>`).join('')}</tbody></table><div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-top:8px">${ph.map(p => `<i style="flex:${Math.max(1, p.t)};background:${PH_COL[p.name]}"></i>`).join('')}</div>` : '<div class="empty">Phases could not be detected for this solve.</div>'}
      <div class="card-h" style="margin-top:14px"><h3>TPS</h3><span class="muted" style="font-size:12px">turns per second</span></div><div id="pTps"></div>
      <div class="muted" style="font-size:12px">${an.pauses.length} pauses ≥ 0.4 s · longest ${an.pauses.length ? (Math.max(...an.pauses.map(p => p.g)) / 1000).toFixed(2) + ' s' : '–'}</div>
      <div class="card-h" style="margin-top:14px"><h3>Scramble</h3></div><div class="mono" style="font-size:12.5px;line-height:1.6">${esc(P.rep.scr)}</div>
      <div class="row-actions" style="margin-top:12px"><button class="btn sm" id="pCmp">${A.icon('compare', 13)} Compare</button><button class="btn sm" id="pCopy">Copy solution</button><button class="btn sm" id="pVid">${A.icon('download', 13)} Video (WebM)</button><button class="btn sm primary" id="pRace">${A.icon('ghost', 13)} Race this solve</button></div>`;
    requestAnimationFrame(() => {
      const tp = $('#pTps'); if (!tp) return;
      A.lineChart(tp, { h: 90, pl: 26, zero: true, yfmt: v => v.toFixed(0), series: [{ d: an.tps, c: '#a78bfa', w: 1.6, area: true }], tip: i => `<div class="muted">${(i * 0.25).toFixed(2)} s</div><b>${an.tps[i]} turns/s</b>`, onPick: i => { P.t = Math.min(an.dur, i * 250); pause(); paint(); } });
      const svg = tp.querySelector('svg'); if (svg && an.dur) { const Wd = +svg.getAttribute('width'); an.pauses.forEach(p => { const x = 26 + (p.at / an.dur) * (Wd - 36); svg.insertAdjacentHTML('beforeend', `<line x1="${x}" x2="${x}" y1="10" y2="82" stroke="#fbbf24" stroke-dasharray="2 3" opacity="0.7"/>`); }); }
    });
    // moves list
    const starts = ph ? new Set(ph.map(p => p.a)) : new Set();
    $('#pMoves').innerHTML = P.rep.mv.map((m, i) => `<span data-i="${i}" class="${starts.has(i) && i > 0 ? 'ph' : ''}" title="${(m[1] / 1000).toFixed(2)} s">${esc(m[0])}</span>`).join('');
    $('#pMoves').onclick = e => { const s = e.target.closest('span[data-i]'); if (s) { const i = +s.dataset.i; P.t = P.rep.mv[i][1]; pause(); paint(); } };
    const c = $('#pCanvas'); A.dragRotate(c, P.view, paint);
    $$('#pView button').forEach(b => b.onclick = () => { Object.assign(P.view, { front: { yaw: -0.62, pitch: 0.52 }, top: { yaw: -0.3, pitch: 1.25 }, back: { yaw: 2.52, pitch: -0.5 } }[b.dataset.v]); paint(); });
    $('#pScrub').oninput = e => { P.t = +e.target.value; pause(); paint(); };
    $('#pPlay').onclick = () => P.playing ? pause() : play();
    $('#pStart').onclick = () => { P.t = 0; pause(); paint(); };
    $('#pEnd').onclick = () => { P.t = an.dur; pause(); paint(); };
    $('#pBack').onclick = () => { const k = kAt(P.t); P.t = k >= 2 ? P.rep.mv[k - 2][1] : 0; pause(); paint(); };
    $('#pFwd').onclick = () => { const k = kAt(P.t); if (k < P.rep.mv.length) P.t = P.rep.mv[k][1]; pause(); paint(); };
    $$('#pSpeed button').forEach(b => { b.classList.toggle('on', +b.dataset.s === P.speed); b.onclick = () => { P.speed = +b.dataset.s; $$('#pSpeed button').forEach(x => x.classList.toggle('on', x === b)); }; });
    $('#pLoop').onclick = e => { P.loop = !P.loop; e.currentTarget.setAttribute('aria-pressed', String(P.loop)); P.loopPh = P.loop ? phaseAt(Math.max(1, kAt(P.t))) : null; e.currentTarget.classList.toggle('primary', P.loop); };
    $('#pCopy').onclick = () => A.copy(solutionText());
    $('#pCmp').onclick = compare;
    $('#pVid').onclick = exportVideo;
    $('#pRace').onclick = () => { const st = A.set(); st.ghost = true; st.ghostSrc = P.rep.id; st.input = 'virtual'; A.Store.saveSoon(); A.applySettings(); A.go('timer'); A.afterInputChange(); A.toast('Race on: your ghost replays the ' + St.fmt(P.rep.t) + ' solve'); };
    paint();
  }
  function solutionText() {
    const ph = P.an.phases, mv = P.rep.mv.map(m => m[0]);
    if (!ph) return mv.join(' ');
    return `Scramble: ${P.rep.scr}\n` + ph.map(p => `${mv.slice(p.a, p.b + 1).join(' ')}  // ${p.name} (${(p.t / 1000).toFixed(2)}s)`).join('\n') + `\nTime: ${St.fmt(P.an.dur)}, ${P.an.total} moves`;
  }
  function paint() {
    if (!P.rep || !$('#pCanvas')) return;
    const k = kAt(P.t), mv = P.rep.mv; let an = null;
    if (P.playing && k > 0 && !C.reducedMotion()) { const ms = mv[k - 1][1], nx = k < mv.length ? mv[k][1] : Infinity, d = Math.min(110, Math.max(28, (nx - ms) * 0.9)), f = (P.t - ms) / d; if (f < 1) an = Math.max(0, f); }
    if (an != null) { setK(k - 1); C.draw3D($('#pCanvas'), P.cube, P.view, { p: P.cube.parse(mv[k - 1][0]), f: C.easeOut(an) }); }
    else { setK(k); C.draw3D($('#pCanvas'), P.cube, P.view); }
    $('#pT').textContent = St.fmt(P.t); $('#pScrub').value = P.t;
    const ph = phaseAt(k); $('#pPh').innerHTML = ph ? `<span class="phase-dot" style="background:${PH_COL[ph.name]}"></span>${ph.name} · ${k === 0 ? 'Start' : P.rep.mv[k - 1][0]}` : (k === 0 ? 'Start' : '');
    $$('#pMoves span').forEach((s, i) => { s.classList.toggle('done', i < k - 1); s.classList.toggle('cur', i === k - 1); });
  }
  function play() { if (P.t >= P.an.dur) P.t = 0; if (P.loop) P.loopPh = phaseAt(Math.max(1, kAt(P.t))); P.playing = true; P.last = performance.now(); $('#pPlay').innerHTML = A.icon('pause', 12) + ' Pause'; const step = now => { if (!P.playing || !$('#pCanvas')) return; P.t += (now - P.last) * P.speed; P.last = now; if (P.loop && P.loopPh && P.t > P.loopPh.t1 + 300) P.t = P.loopPh.t0; if (P.t >= P.an.dur) { P.t = P.an.dur; paint(); pause(); return; } paint(); P.raf = requestAnimationFrame(step); }; P.raf = requestAnimationFrame(step); }
  function pause() { P.playing = false; cancelAnimationFrame(P.raf); const b = $('#pPlay'); if (b) b.innerHTML = A.icon('play', 12) + ' Play'; }
  function compare() {
    const reps = replayList().filter(r => r.id !== P.rep.id); if (!reps.length) { A.toast('Do another virtual-cube solve to compare'); return; }
    const best = reps.slice().sort((a, b) => a.t - b.t)[0]; const other = analyze(best); const a = P.an.phases, b = other.phases;
    A.modal(`<div class="modal-h"><h3>This solve vs your fastest replay</h3><button class="iconbtn" data-close aria-label="Close">${A.icon('x')}</button></div>
      <table class="tbl" style="margin-top:10px"><thead><tr><th>Phase</th><th>This (${St.fmt(P.an.dur)})</th><th>Fastest (${St.fmt(other.dur)})</th><th>Δ</th></tr></thead><tbody>
      ${a && b ? a.map((p, i) => { const d = p.t - b[i].t; return `<tr><td style="color:var(--ink)"><span class="phase-dot" style="background:${PH_COL[p.name]}"></span>${p.name}</td><td>${(p.t / 1000).toFixed(2)} · ${p.moves} mv</td><td>${(b[i].t / 1000).toFixed(2)} · ${b[i].moves} mv</td><td style="color:${d <= 0 ? 'var(--good)' : 'var(--bad)'}">${d <= 0 ? '−' : '+'}${(Math.abs(d) / 1000).toFixed(2)}</td></tr>`; }).join('') : '<tr><td colspan="4" class="muted">Phases missing for one of the solves.</td></tr>'}
      <tr><td>TPS</td><td>${(P.an.total / (P.an.dur / 1000)).toFixed(1)}</td><td>${(other.total / (other.dur / 1000)).toFixed(1)}</td><td></td></tr><tr><td>Pauses ≥ 0.4 s</td><td>${P.an.pauses.length}</td><td>${other.pauses.length}</td><td></td></tr></tbody></table>
      <div class="row-actions" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="cmpOpen">Open fastest replay</button><button class="btn primary" data-close>Done</button></div>`, m => { $('#cmpOpen', m).onclick = () => { A.closeModal(); A.ui.rep = best.id; A.render.replay(); }; });
  }
  async function exportVideo() {
    const probe = document.createElement('canvas');
    if (!probe.captureStream || !window.MediaRecorder) { A.toast('Video export needs Chrome, Edge or Firefox'); return; }
    const btn = $('#pVid'); btn.disabled = true; btn.textContent = 'Recording…'; pause();
    const W = 720, H = 720, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
    const stream = cv.captureStream(30); const chunks = []; let rec;
    try { rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' }); } catch (e) { A.toast('This browser cannot record WebM'); btn.disabled = false; btn.innerHTML = A.icon('download', 13) + ' Video (WebM)'; return; }
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => rec.onstop = r); rec.start();
    const cube = new C.Cube(3).apply(P.rep.scr), mv = P.rep.mv, dur = P.an.dur; let k = 0; const t0 = performance.now(); const view = { yaw: -0.62, pitch: 0.52, w: W, h: H - 140 };
    const pal = A.palette();
    await new Promise(resolve => {
      const frame = () => {
        const t = performance.now() - t0 - 600;
        let K = k; while (K < mv.length && mv[K][1] <= t) K++;
        let an = null; if (K > 0) { const ms = mv[K - 1][1], nx = K < mv.length ? mv[K][1] : Infinity, d = Math.min(110, Math.max(28, (nx - ms) * 0.9)), f = (t - ms) / d; if (f < 1) an = { i: K - 1, f: Math.max(0, f) }; }
        const tgt = an ? K - 1 : K; while (k < tgt) { cube.move(mv[k][0]); k++; }
        const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, BG.mix(pal.shadow, pal.mid, 0.4)); g.addColorStop(1, pal.shadow); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        C.draw3D(layer, cube, view, an ? { p: cube.parse(mv[an.i][0]), f: C.easeOut(an.f) } : undefined); ctx.drawImage(layer, 0, 40);
        const ph = phaseAt(k);
        ctx.fillStyle = '#fff'; ctx.font = '800 64px Outfit, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(St.fmt(clamp(t, 0, dur)), W / 2, H - 50);
        ctx.font = '600 22px Inter, sans-serif'; ctx.fillStyle = ph ? PH_COL[ph.name] : '#c9c2e6'; ctx.fillText(ph && t > 0 ? ph.name : 'Inspection', W / 2, 44);
        ctx.font = '500 16px "JetBrains Mono", monospace'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('Solvo Timer', W / 2, H - 18);
        if (t < dur + 1200) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    rec.stop(); await done;
    btn.disabled = false; btn.innerHTML = A.icon('download', 13) + ' Video (WebM)';
    saveFile(`solvo-replay-${St.fmt(dur).replace(/[:.]/g, '-')}.webm`, new Blob(chunks, { type: 'video/webm' }));
  }

  // =============================================================== COACH
  const XP_PER_LEVEL = 300;
  function todaysSolves() { const s0 = startOfDay(Date.now()); return allSolves().filter(s => s.d >= s0).sort((a, b) => a.d - b.d); }
  function streak() { const days = new Set(allSolves().map(s => St.dayKey(s.d))); let n = 0, t = Date.now(); if (!days.has(St.dayKey(t))) t -= DAY; while (days.has(St.dayKey(t))) { n++; t -= DAY; } return n; }
  function missionParams() {
    const key = St.dayKey(Date.now()), c = A.S.coach;
    if (c.day && c.day.key === key) return c.day;
    const list = A.solves(), a12 = St.aoN(list, 12), m = (a12 && isFinite(a12)) ? a12 : (St.mean(list) || 20000);
    const lvl = Math.floor((c.xp || 0) / XP_PER_LEVEL) + 1;
    c.day = { key, n: Math.min(60, 20 + lvl * 5), x: Math.max(1, Math.floor(m * 0.96 / 500) / 2), k: 5, y: Math.max(1, Math.floor(m * 0.99 / 500) / 2) };
    A.Store.saveSoon(); return c.day;
  }
  function missions() {
    const p = missionParams(), td = todaysSolves(); const r5 = St.rolling(td, 5).filter(v => v !== null && isFinite(v));
    return [
      { id: 'n', text: `Do ${p.n} solves today`, goal: p.n, prog: td.length, xp: 60 },
      { id: 'x', text: `${p.k} solves under ${p.x} s`, goal: p.k, prog: td.filter(s => St.val(s) < p.x * 1000).length, xp: 90 },
      { id: 'y', text: `An ao5 below ${p.y} s`, goal: 1, prog: r5.some(v => v < p.y * 1000) ? 1 : 0, xp: 120 }
    ].map(m => Object.assign(m, { done: m.prog >= m.goal }));
  }
  A.coachCheck = function () {
    const c = A.S.coach; c.xp = (c.xp || 0) + 2;
    if (!A.set().missions) return;
    const key = St.dayKey(Date.now());
    for (const m of missions()) { const k = key + ':' + m.id; if (m.done && !c.done[k]) { c.done[k] = 1; c.xp += m.xp; A.toast(`Mission complete · <b>+${m.xp} XP</b> · ${esc(m.text)}`, 3200); } }
    if (missions().every(m => m.done) && !c.done[key + ':all']) { c.done[key + ':all'] = 1; A.S.meta.missionDays = (A.S.meta.missionDays || 0) + 1; }
    for (const k of Object.keys(c.done)) if (!k.startsWith(key)) delete c.done[k];
    A.Store.saveSoon();
  };
  function missionsHTML(compact) {
    const c = A.S.coach, xp = c.xp || 0, lvl = Math.floor(xp / XP_PER_LEVEL) + 1, inL = xp % XP_PER_LEVEL, st = streak();
    return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><div style="flex:1"><div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px"><span>Level ${lvl}</span><span class="mono muted" style="font-size:12px">${inL} / ${XP_PER_LEVEL} XP</span></div><div class="bar" style="margin-top:5px"><i style="width:${inL / XP_PER_LEVEL * 100}%"></i></div></div><div style="text-align:center"><div class="mono" style="font-weight:700;font-size:16px;color:var(--warn)">${A.icon('flame', 15)} ${st}</div><div class="muted" style="font-size:11.5px">day streak</div></div></div>` +
      `<div style="display:grid;gap:6px">${missions().map(m => `<div class="mission ${m.done ? 'done' : ''}"><span class="chk">${m.done ? '✓' : ''}</span><div><div class="mt">${esc(m.text)}</div><div class="bar"><i style="width:${clamp(m.prog / m.goal * 100, 0, 100)}%"></i></div></div><div class="xp">${Math.min(m.prog, m.goal)} / ${m.goal}${compact ? '' : `<br>+${m.xp} XP`}</div></div>`).join('')}</div>`;
  }
  A.renderMissionsWidget = el => { el.innerHTML = `<div class="card-h"><h3>Daily missions</h3><button class="btn sm" id="wCoach">Coach</button></div>` + missionsHTML(true); $('#wCoach', el).onclick = () => A.go('coach'); };
  function lookahead() {
    const reps = Object.values(A.S.replays).sort((a, b) => (b.d || 0) - (a.d || 0)).slice(0, 50); if (!reps.length) return null;
    const an = reps.map(analyze); const n = an.length;
    const pausesPer = an.reduce((a, x) => a + x.pauses.filter(p => p.g >= 500).length, 0) / n;
    const longest = an.reduce((a, x) => a + (x.pauses.length ? Math.max(...x.pauses.map(p => p.g)) : 0), 0) / n / 1000;
    const tps = an.reduce((a, x) => a + (x.dur ? x.total / (x.dur / 1000) : 0), 0) / n;
    const score = Math.round(clamp(100 - pausesPer * 6 - longest * 12 + (tps - 4) * 3, 0, 100));
    const withPh = an.filter(x => x.phases); const split = withPh.length ? ['Cross', 'F2L', 'OLL', 'PLL'].map((name, i) => ({ name, t: withPh.reduce((a, x) => a + x.phases[i].t, 0) / withPh.length, mv: withPh.reduce((a, x) => a + x.phases[i].moves, 0) / withPh.length })) : null;
    return { n, pausesPer, longest, tps, score, split };
  }
  A.render.coach = function () {
    const el = $('#v-coach'), la = lookahead(), list = A.solves(), sd = St.stdev(list), m = St.mean(list), dnf = list.length ? list.filter(s => s.p === -1).length / list.length * 100 : 0;
    const REF = { Cross: 0.12, F2L: 0.5, OLL: 0.17, PLL: 0.21 };
    const tips = [];
    if (la && la.split) { const tot = la.split.reduce((a, p) => a + p.t, 0); const worst = la.split.map(p => ({ ...p, over: p.t / tot - REF[p.name] })).sort((a, b) => b.over - a.over)[0]; if (worst.over > 0.03) tips.push({ name: worst.name, text: { Cross: 'Cross takes a big share of your time. Plan the whole cross during inspection and aim for 8 moves or fewer.', F2L: 'F2L is where most time goes. Do slow solves where you never stop turning, and look for the next pair while inserting the current one.', OLL: 'OLL recognition is slowing you down. Drill 2-look OLL to full OLL with a case trainer, 10 minutes a day.', PLL: 'PLL is above average. Learn to recognise PLL from two sides and drill the slowest algorithms.' }[worst.name] }); }
    if (la && la.pausesPer > 2.5) tips.push({ name: 'Lookahead', text: `You average ${la.pausesPer.toFixed(1)} stops of half a second or more per solve. Try metronome solves at a slower, steady TPS.` });
    if (sd && m && sd / m > 0.14) tips.push({ name: 'Consistency', text: `Your times spread ±${(sd / 1000).toFixed(1)} s. Average-of-12 sessions with a fixed routine help more than chasing singles.` });
    if (dnf > 3) tips.push({ name: 'DNFs', text: `${dnf.toFixed(1)}% of solves are DNF. Slow down the last layer and check the cube before stopping the timer.` });
    if (!tips.length) tips.push({ name: 'Keep going', text: 'No weak spot stands out. Keep your daily missions going and do one virtual-cube session a week so the coach can check your phases.' });
    el.innerHTML = `<div class="panel">
      <div class="panel-h"><div><h2>Coach</h2><p>Works on its own after every solve. Phase and lookahead analysis use your virtual-cube solves.</p></div></div>
      ${!la ? `<div class="glass" style="padding:10px 14px;font-size:13px;border-color:rgba(251,191,36,0.35)"><b style="color:var(--warn)">Lookahead coach is waiting.</b> It works with the virtual cube on 3×3. Your timer and typed times still count for missions. <button class="btn sm" id="useVC" style="margin-left:8px">Use the virtual cube</button></div>` : ''}
      <div class="grid2"><section class="card glass"><div class="card-h"><h3>Daily missions · ${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h3></div>${missionsHTML(false)}</section>
        <section class="card glass"><div class="card-h"><h3>Lookahead coach</h3><span class="muted" style="font-size:12px">${la ? la.n + ' virtual 3×3 solves analysed' : 'no replays yet'}</span></div>
          ${la ? `<div style="display:flex;gap:16px;align-items:center"><svg class="gauge" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="9"/><circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(la.score / 100 * 264).toFixed(1)} 264" transform="rotate(-90 50 50)"/><text x="50" y="57" text-anchor="middle" style="font:800 24px Outfit,sans-serif;fill:var(--ink)">${la.score}</text></svg>
            <div class="stat-grid" style="flex:1;grid-template-columns:repeat(2,1fr)"><div><div class="eyebrow">Pauses ≥ 0.5 s</div><b class="mono">${la.pausesPer.toFixed(1)} / solve</b></div><div><div class="eyebrow">Longest stop</div><b class="mono">${la.longest.toFixed(2)} s</b></div><div><div class="eyebrow">Average TPS</div><b class="mono">${la.tps.toFixed(1)}</b></div><div><div class="eyebrow">Score</div><b class="mono">${la.score} / 100</b></div></div></div>` : '<div class="empty">Solve with the virtual cube to get a lookahead score.</div>'}
        </section></div>
      <div class="grid2"><section class="card glass"><div class="card-h"><h3>Phase balance</h3><span class="muted" style="font-size:12px">your split vs a typical CFOP split</span></div>
          ${la && la.split ? (() => { const tot = la.split.reduce((a, p) => a + p.t, 0); return ['You', 'Typical'].map(who => `<div style="margin:8px 0"><div class="eyebrow" style="margin-bottom:4px">${who}</div><div style="display:flex;height:22px;border-radius:6px;overflow:hidden">${la.split.map(p => { const f = who === 'You' ? p.t / tot : REF[p.name]; return `<i style="flex:${f};background:${PH_COL[p.name]};display:grid;place-items:center;font:600 10px Inter;color:#160e2e">${Math.round(f * 100)}%</i>`; }).join('')}</div></div>`).join('') + `<table class="tbl" style="margin-top:8px"><thead><tr><th>Phase</th><th>Avg time</th><th>Avg moves</th></tr></thead><tbody>${la.split.map(p => `<tr><td style="color:var(--ink)"><span class="phase-dot" style="background:${PH_COL[p.name]}"></span>${p.name}</td><td>${(p.t / 1000).toFixed(2)}</td><td>${p.mv.toFixed(1)}</td></tr>`).join('')}</tbody></table>`; })() : '<div class="empty">Needs virtual-cube solves with a detectable cross.</div>'}</section>
        <section class="card glass"><div class="card-h"><h3>What to practise next</h3></div><ul class="hl">${tips.map(t => `<li><span>→</span><span><b style="font-family:var(--f-body)">${esc(t.name)}.</b> ${esc(t.text)}</span></li>`).join('')}</ul></section></div>
      ${(() => { const bs = A.badgeStatus ? A.badgeStatus() : []; const got = bs.filter(b => b.at).length; return `<section class="card glass"><div class="card-h"><h3>Badges · ${got} of ${bs.length}</h3><span class="muted" style="font-size:12px">Demo solves don't count</span></div><div class="badges">${bs.sort((a, b) => (b.at ? 1 : 0) - (a.at ? 1 : 0) || b.p - a.p).map(b => `<div class="badge ${b.at ? 'on' : ''}" title="${esc(b.desc)}">${A.medal(b, 54)}<div><div class="bn">${esc(b.name)}</div><div class="bd">${esc(b.desc)}</div>${b.at ? `<div class="bt">Unlocked ${new Date(b.at).toLocaleDateString()}</div>` : `<div class="bar" style="margin-top:5px"><i style="width:${Math.round(b.p * 100)}%"></i></div><div class="bt">${esc(b.label)}</div>`}</div></div>`).join('')}</div></section>`; })()}
    </div>`;
    const u = $('#useVC'); if (u) u.onclick = () => { A.set().input = 'virtual'; A.Store.saveSoon(); A.applySettings(); A.go('timer'); };
  };

  // =============================================================== COMP PRACTICE
  function compState() {
    const ui = A.ui; if (!ui.comp) ui.comp = newComp(A.event(), 1); return ui.comp;
  }
  function newComp(ev, round) { return { ev, round, group: 1 + Math.floor(Math.random() * 4), att: Array.from({ length: 5 }, () => ({ s: C.genScramble(ev), r: null })), i: 0, keep: true, timing: 'timer' }; }
  function compAvg(att) { const rs = att.filter(a => a.r).map(a => a.r); if (rs.length < 5) return null; return St.avgOf(rs); }
  A.render.comp = function () {
    const c = compState(), el = $('#v-comp'), cur = c.att[c.i], done = c.i >= 5;
    const vals = c.att.map(a => a.r ? St.val(a.r) : null), fin = vals.filter(v => v !== null), bestV = fin.length ? Math.min(...fin) : null, worstV = fin.length === 5 ? Math.max(...fin) : null;
    let bi = vals.indexOf(bestV), wi = worstV !== null ? vals.lastIndexOf(worstV) : -1; if (wi === bi) wi = vals.indexOf(worstV, bi + 1);
    el.innerHTML = `<div class="panel"><div class="comp-grid">
      <section class="card glass" style="display:grid;gap:12px">
        <button class="btn" id="cBack">← Back to the timer</button>
        <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px"><input type="checkbox" class="switch" id="cKeep" ${c.keep ? 'checked' : ''}><span><b>Keep solves</b><div class="muted" style="font-size:11.5px">Off: this round is not saved in your sessions.</div></span></label>
        <div><div class="eyebrow" style="margin-bottom:4px">Event</div><select class="field" id="cEv" aria-label="Event" style="width:100%">${Object.entries(A.EVENTS).map(([k, v]) => `<option value="${k}" ${k === c.ev ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><div class="eyebrow" style="margin-bottom:4px">Timing</div><select class="field" id="cTiming" aria-label="Timing" style="width:100%"><option value="timer" ${c.timing === 'timer' ? 'selected' : ''}>Stackmat-style (Space)</option><option value="typing" ${c.timing === 'typing' ? 'selected' : ''}>Typing (own timer)</option></select><div class="muted" style="font-size:11.5px;margin-top:4px">Inspection is always on: +2 after 15 s, DNF after 17 s.</div></div>
        <div><div class="eyebrow" style="margin-bottom:4px">Background</div><select class="field" id="cBg" aria-label="Background" style="width:100%">${BG.scenes.map(s => `<option value="${s.id}" ${s.id === A.set().compBg ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
      </section>
      <section class="glass comp-stage">
        <div class="eyebrow">Competition practice</div><div style="font-family:var(--f-display);font-weight:700;font-size:20px">Round ${c.round} · Group ${c.group}</div>
        ${done ? `<div class="attempt">Round complete</div><div class="time" style="font-size:clamp(48px,7vw,90px)">${St.fmt(compAvg(c.att))}</div><div class="muted">Average of 5 · best single ${St.fmt(bestV)}</div><div class="row-actions"><button class="btn primary" id="cNext">Next round</button><button class="btn" id="cNew">New competition</button><button class="btn" id="cShare">Share card</button></div>`
        : `<div class="attempt">Attempt ${c.i + 1} of 5</div><div class="scramble" style="max-width:640px">${A.scrHTML(cur.s)}</div>
          <div class="time mono" id="compTime">${c.timing === 'typing' ? '0.00' : '0.00'}</div>
          ${c.timing === 'typing' ? `<div class="type-in"><input id="cType" inputmode="decimal" autocomplete="off" placeholder="e.g. 9.42 · 9.42+ · DNF"><button class="btn primary" id="cTypeGo">Enter</button></div><div class="hint">Solve with your own timer, then type the result and press Enter.</div>` : `<div class="hint" id="compHint">Press <span class="kbd">Space</span> to start inspection</div>`}`}
      </section>
      <section class="card glass"><div class="card-h"><h3>Scorecard</h3><span class="muted mono" style="font-size:12px">${A.EVENTS[c.ev]} · R${c.round}</span></div>
        <table class="tbl score"><thead><tr><th>#</th><th>Result</th></tr></thead><tbody>${c.att.map((a, i) => `<tr class="${i === c.i ? 'cur' : ''}"><td>${i + 1}</td><td class="b">${a.r ? ((i === bi || i === wi) && fin.length === 5 ? '(' + St.fmtSolve(a.r) + ')' : St.fmtSolve(a.r)) : '—'}</td></tr>`).join('')}</tbody></table>
        <div class="row" style="margin-top:6px"><span class="muted">Average of 5</span><b class="mono" style="font-size:18px">${St.fmt(compAvg(c.att))}</b></div>
        <div class="row"><span class="muted">Best</span><b class="mono">${St.fmt(bestV)}</b></div>
        <div class="row"><span class="muted">Mean so far</span><b class="mono">${fin.length ? St.fmt(St.meanOf(c.att.filter(a => a.r).map(a => a.r))) : '–'}</b></div>
      </section></div></div>`;
    $('#cBack').onclick = () => A.go('timer');
    $('#cKeep').onchange = e => { c.keep = e.target.checked; };
    $('#cEv').onchange = e => { A.ui.comp = newComp(e.target.value, 1); A.render.comp(); };
    $('#cTiming').onchange = e => { c.timing = e.target.value; A.render.comp(); };
    $('#cBg').onchange = e => { A.set().compBg = e.target.value; A.Store.saveSoon(); A.applySettings(); };
    if (done) { $('#cNext').onclick = () => { A.ui.comp = newComp(c.ev, c.round + 1); A.ui.comp.keep = c.keep; A.ui.comp.timing = c.timing; A.render.comp(); }; $('#cNew').onclick = () => { A.ui.comp = newComp(c.ev, 1); A.render.comp(); }; $('#cShare').onclick = () => A.openShareCard({ kind: 'comp', comp: { round: c.round, avg: compAvg(c.att), times: c.att.map(a => St.fmtSolve(a.r)) } }); A.Timer.setCtx(null); return; }
    if (c.timing === 'typing') {
      const go = () => { const r = St.parseTime($('#cType').value); if (!r) { A.toast('Type a time like 9.42, 9.42+ or DNF'); return; } record(r.t, r.p); };
      $('#cTypeGo').onclick = go; $('#cType').onkeydown = e => { if (e.key === 'Enter') go(); }; $('#cType').focus(); A.Timer.setCtx(null);
    } else {
      const stg = $('.comp-stage', el); stg.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && !e.target.closest('button,select,input')) { e.preventDefault(); A.Timer.down(); } }); stg.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse' && !e.target.closest('button,select,input')) A.Timer.up(); });
      A.Timer.setCtx({ el: () => $('#compTime'), inspection: () => true, onDone: (t, p) => setTimeout(() => record(t, p), 650), hint: st => { const h = $('#compHint'); if (h) h.innerHTML = { idle: 'Press <span class="kbd">Space</span> to start inspection', armInsp: 'Release to start the 15 s inspection', inspect: 'Inspecting — hold <span class="kbd">Space</span> when ready', inspHold: 'Keep holding…', inspReady: 'Release to start', running: 'Any key stops the timer' }[st] || ''; } });
    }
    function record(t, p) {
      const r = { id: A.uid(), t: Math.round(t), p: p || 0, d: Date.now(), s: cur.s, c: `Comp R${c.round} #${c.i + 1}` }; cur.r = r; c.i++;
      if (c.keep) {
        let se = A.S.sessions.find(s => s.event === c.ev && s.comp);
        if (!se) { se = { id: A.uid(), name: 'Comp practice', event: c.ev, comp: true }; A.S.sessions.push(se); A.S.solves[se.id] = []; }
        A.S.solves[se.id].push(r); A.changed(se.id, A.S.solves[se.id].length - 1); A.fillSelectors();
      }
      if (c.i >= 5) { const av = compAvg(c.att); A.toast(`Average of 5: <b>${St.fmt(av)}</b>`, 3500); A.S.meta.comps = (A.S.meta.comps || 0) + 1; A.Store.saveSoon(); A.checkBadges(); }
      A.render.comp();
    }
  };
  A.compKey = e => { const c = compState(); if (c.timing === 'typing') return true; return false; };

  // =============================================================== SETTINGS
  const SECTIONS = [
    ['Essentials', [['essentials', 'Essentials'], ['solving', 'While solving']]],
    ['Appearance', [['themes', 'Themes'], ['colours', 'Colours & timer font'], ['backgrounds', 'Backgrounds'], ['glass', 'Cards & glass']]],
    ['Training', [['coach', 'Coach modes'], ['goals', 'Session goals']]],
    ['Workspace', [['sessions', 'Sessions'], ['scramble', 'Scramble'], ['keys', 'Virtual cube keys'], ['smart', 'Smart cube & timer'], ['shortcuts', 'Shortcuts']]],
    ['Data', [['data', 'Import & export']]]
  ];
  A.render.options = function (sub) {
    sub = sub || A.ui.optSub || 'essentials'; A.ui.optSub = sub;
    const el = $('#v-options');
    el.innerHTML = `<div class="panel"><div class="set-grid"><nav class="set-nav glass" aria-label="Settings sections"><input class="field" id="setQ" aria-label="Search settings" placeholder="Search settings…" style="margin-bottom:6px">${SECTIONS.map(([g, items]) => `<div class="grp">${g}</div>` + items.map(([id, label]) => `<button data-s="${id}" class="${id === sub ? 'on' : ''}">${label}</button>`).join('')).join('')}</nav><section class="set-body glass" id="setBody"></section></div></div>`;
    $$('.set-nav button').forEach(b => b.onclick = () => A.render.options(b.dataset.s));
    $('#setQ').oninput = e => { const q = e.target.value.toLowerCase(); $$('.set-nav button').forEach(b => b.hidden = q && !b.textContent.toLowerCase().includes(q)); };
    (SET[sub] || SET.essentials)($('#setBody'));
  };
  const THEMES = [
    { id: 'amethyst', name: 'Amethyst', bg: 'bubbles', pal: 0, accent: '#a78bfa', blur: 14, glassA: 0.58, radius: 14, font: 'bold', speed: 1 },
    { id: 'sakura', name: 'Sakura Night', bg: 'sakura', pal: 7, accent: '#f9a8c9', blur: 16, glassA: 0.5, radius: 18, font: 'thin', speed: 0.8 },
    { id: 'neon', name: 'Neon Arcade', bg: 'scramblerain', pal: 9, accent: '#22d3ee', blur: 8, glassA: 0.7, radius: 6, font: 'future', speed: 1.2 },
    { id: 'ocean', name: 'Ocean Glass', bg: 'rain', pal: 2, accent: '#5eead4', blur: 18, glassA: 0.45, radius: 16, font: 'bold', speed: 1 },
    { id: 'ember', name: 'Ember', bg: 'plasma', pal: 3, accent: '#fb923c', blur: 12, glassA: 0.62, radius: 12, font: 'bold', speed: 0.7 },
    { id: 'mono', name: 'Minimal Mono', bg: 'studio', pal: 6, accent: '#e4e4e7', blur: 0, glassA: 0.82, radius: 6, font: 'mono', speed: 0.6 },
    { id: 'aurora', name: 'Aurora', bg: 'aurora', pal: 4, accent: '#7dd3fc', blur: 14, glassA: 0.5, radius: 16, font: 'thin', speed: 1 },
    { id: 'topo', name: 'Topo Rose', bg: 'topo', pal: 1, accent: '#f9a8d4', blur: 14, glassA: 0.55, radius: 14, font: 'bold', speed: 0.8 },
    { id: 'horizon', name: 'Event Horizon', bg: 'horizon', pal: 8, accent: '#fde68a', blur: 12, glassA: 0.6, radius: 10, font: 'future', speed: 1 },
    { id: 'stackmat', name: 'Stackmat', bg: 'hex', pal: 5, accent: '#a3e635', blur: 10, glassA: 0.66, radius: 8, font: 'digital', speed: 0.9 },
  ];
  A.THEMES = THEMES;
  const s = () => A.set();
  const save = (rerender) => { A.Store.saveSoon(); A.applySettings(); if (rerender) A.render.options(A.ui.optSub); };
  const tog = (id, label, desc, on) => `<div class="row"><div><label for="${id}">${label}</label><div class="d">${desc}</div></div><input type="checkbox" class="switch" id="${id}" ${on ? 'checked' : ''}></div>`;
  const bindTog = (el, id, key) => { $('#' + id, el).onchange = e => { s()[key] = e.target.checked; save(); }; };
  const SET = {
    essentials(el) {
      el.innerHTML = `<h2>Essentials</h2><p>How the timer starts and stops.</p>
        ${tog('oInsp', 'WCA inspection', '15 seconds to look at the cube. +2 after 15 s, DNF after 17 s.', s().inspection)}
        <div class="row"><div><label for="oHold">Hold time</label><div class="d">How long to hold Space before the timer turns green: <b class="mono" id="oHoldV">${(s().holdMs / 1000).toFixed(2)} s</b></div></div><input type="range" id="oHold" min="0" max="1000" step="50" value="${s().holdMs}"></div>
        <div class="row"><div><label for="oCall">Inspection callouts</label><div class="d">At 8 and 12 seconds, like a WCA judge. Voice uses your device's speech.</div></div><select class="field" id="oCall"><option value="beep">Beeps</option><option value="voice-en">Voice · English</option><option value="voice-vi">Voice · Tiếng Việt</option><option value="off">Off</option></select></div>
        <div class="row"><div><label for="oSfx">Sounds</label><div class="d">A chime for new PBs and badges. "All" also clicks when the timer starts and stops.</div></div><select class="field" id="oSfx"><option value="pb">PBs and badges</option><option value="all">All</option><option value="off">Off</option></select></div>
        ${tog('oHap', 'Vibration on phones', 'A short buzz when the timer starts, turns green and stops. Android phones only.', s().haptics)}
        <div class="row"><div><label for="oInput">Timing input</label><div class="d">Timer uses Space or a tap. Typing is for your own stackmat. Virtual cube records replays.</div></div><select class="field" id="oInput"><option value="timer">Timer</option><option value="typing">Typing</option><option value="virtual">Virtual cube</option></select></div>`;
      bindTog(el, 'oInsp', 'inspection'); bindTog(el, 'oHap', 'haptics');
      $('#oSfx', el).value = s().uiSounds; $('#oSfx', el).onchange = e => { s().uiSounds = e.target.value; save(); A.sfx('pb'); };
      $('#oCall', el).value = s().callout; $('#oCall', el).onchange = e => { s().callout = e.target.value; save(); A.callout(8); };
      $('#oHold', el).oninput = e => { s().holdMs = +e.target.value; $('#oHoldV', el).textContent = (s().holdMs / 1000).toFixed(2) + ' s'; save(); };
      $('#oInput', el).value = s().input; $('#oInput', el).onchange = e => { s().input = e.target.value; save(); };
    },
    solving(el) {
      el.innerHTML = `<h2>While solving</h2><p>What you see while the clock runs.</p>
        ${tog('oFocus', 'Focus mode', 'Hide everything except the time while you solve.', s().focus)}
        <div class="row"><div><label for="oUpd">Time display while solving</label><div class="d">Some cubers solve better without watching the clock.</div></div><select class="field" id="oUpd"><option value="full">Full (0.01 s)</option><option value="sec">Seconds only</option><option value="hide">Hidden</option></select></div>
        ${tog('oFreeze', 'Freeze background during solves', 'Off: the background keeps moving while you solve.', s().freeze)}
        ${tog('oPar', 'Background parallax', 'The background drifts slightly with your mouse. Turns off while you solve.', s().parallax !== false)}
        ${tog('oMetro', 'Metronome during solves', 'Clicks at a steady pace while the timer runs, to train smooth turning.', s().metroOn)}
        <div class="row"><div><label for="oTps">Metronome pace</label><div class="d"><b class="mono" id="oTpsV">${s().metroTps.toFixed(1)} TPS</b> · ${'more options in Train → Metronome'}</div></div><input type="range" id="oTps" min="1" max="12" step="0.5" value="${s().metroTps}"></div>`;
      bindTog(el, 'oFocus', 'focus'); bindTog(el, 'oFreeze', 'freeze'); bindTog(el, 'oMetro', 'metroOn'); bindTog(el, 'oPar', 'parallax');
      $('#oTps', el).oninput = e => { s().metroTps = +e.target.value; $('#oTpsV', el).textContent = s().metroTps.toFixed(1) + ' TPS'; save(); };
      $('#oUpd', el).value = s().timerUpdate; $('#oUpd', el).onchange = e => { s().timerUpdate = e.target.value; save(); };
    },
    themes(el) {
      el.innerHTML = `<h2>Themes</h2><p>One tap sets the background, colours, glass and timer font together. Fine-tune any part afterwards.</p>
        <div class="theme-grid">${THEMES.map(t => { const f = A.TIMER_FONTS[t.font]; return `<button class="theme ${s().theme === t.id ? 'on' : ''}" data-t="${t.id}" aria-pressed="${s().theme === t.id}"><canvas width="240" height="150"></canvas><span class="th-time" style='font-family:${f.f};font-weight:${f.w};letter-spacing:${f.ls}'>12.34</span><span class="th-name"><i style="background:${t.accent}"></i>${esc(t.name)}${s().theme === t.id ? ' <b>· Active</b>' : ''}</span></button>`; }).join('')}</div>
        <div class="row-actions" style="margin-top:14px"><button class="btn" id="thBg">Fine-tune background</button><button class="btn" id="thCol">Accent &amp; timer font</button><button class="btn" id="thGl">Cards &amp; glass</button></div>`;
      $$('.theme', el).forEach((b, i) => { const t = THEMES[i]; setTimeout(() => { const cv = b.querySelector('canvas'); if (cv) cv.getContext('2d').drawImage(BG.thumb(t.bg, BG.PALETTES[t.pal], 240, 150), 0, 0); }, 20 + i * 25); b.onclick = () => { Object.assign(s(), { theme: t.id, bg: t.bg, palette: t.pal, accent: t.accent, blur: t.blur, glassA: t.glassA, radius: t.radius, timerFont: t.font, bgSpeed: t.speed }); const m = A.S.meta; m.bgs = m.bgs || []; if (!m.bgs.includes(t.bg)) { m.bgs.push(t.bg); A.checkBadges && A.checkBadges(); } save(true); A.toast(`${A.icon('palette')} Theme: <b>${esc(t.name)}</b>`); }; });
      $('#thBg', el).onclick = () => A.render.options('backgrounds'); $('#thCol', el).onclick = () => A.render.options('colours'); $('#thGl', el).onclick = () => A.render.options('glass');
    },
    colours(el) {
      const acc = ['#a78bfa', '#f472b6', '#5eead4', '#60a5fa', '#fbbf24', '#4ade80', '#fb923c', '#e4e4e7'];
      el.innerHTML = `<h2>Colours &amp; timer font</h2><p>The accent colour for buttons, highlights and charts, and the typeface of the big time.</p>
        <div class="row"><label>Accent</label><div class="swatches">${acc.map(c => `<button class="sw ${c === s().accent ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="Accent ${c}"></button>`).join('')}<input type="color" id="oAcc" value="${s().accent}" aria-label="Custom accent" style="width:34px;height:30px;border:0;background:none;padding:0"></div></div>
        <div class="row" style="display:block"><label>Timer font</label><div class="font-grid">${Object.entries(A.TIMER_FONTS).map(([k, f]) => `<button class="font-opt ${s().timerFont === k ? 'on' : ''}" data-f="${k}" aria-pressed="${s().timerFont === k}"><span style='font-family:${f.f};font-weight:${f.w};letter-spacing:${f.ls}'>12.34</span><small>${f.name}</small></button>`).join('')}</div></div>`;
      $$('.sw', el).forEach(b => b.onclick = () => { s().accent = b.dataset.c; save(true); });
      $$('.font-opt', el).forEach(b => b.onclick = () => { s().timerFont = b.dataset.f; save(true); });
      $('#oAcc', el).onchange = e => { s().accent = e.target.value; save(true); };
    },
    backgrounds(el) {
      const P = A.palette();
      el.innerHTML = `<h2>Backgrounds</h2><p>Current: <b>${(BG.scenes.find(x => x.id === s().bg) || {}).name}</b>. Laggy? Lower the quality below. Animated scenes run best in Chrome or Edge.</p>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:16px" class="bgwrap">
          <div class="bg-grid" id="bgGrid">${BG.scenes.map((sc, i) => `<button class="bg-tile ${sc.id === s().bg ? 'on' : ''}" data-id="${sc.id}"><canvas width="208" height="130"></canvas><span>${i + 1} · ${sc.name}</span></button>`).join('')}</div>
          <div class="glass" style="padding:12px;align-self:start;display:grid;gap:12px">
            <div class="eyebrow">Background controls</div>
            <div><div style="display:flex;justify-content:space-between;font-size:12.5px"><label for="oSpd">Speed</label><b class="mono" id="oSpdV">${s().bgSpeed.toFixed(1)}×</b></div><input type="range" id="oSpd" min="0" max="3" step="0.1" value="${s().bgSpeed}" style="width:100%"></div>
            <div><div style="font-size:12.5px;margin-bottom:6px">Palette</div><div class="swatches">${BG.PALETTES.map((p, i) => `<button class="pal ${s().palette === i ? 'on' : ''}" data-p="${i}" title="${p.name}" aria-label="${p.name}"><i style="background:${p.shadow}"></i><i style="background:${p.mid}"></i><i style="background:${p.high}"></i></button>`).join('')}<button class="pal ${s().palette === 'custom' ? 'on' : ''}" data-p="custom" title="Custom" aria-label="Custom palette"><i style="background:${s().customPal.shadow}"></i><i style="background:${s().customPal.mid}"></i><i style="background:${s().customPal.high}"></i></button></div></div>
            <div><div style="font-size:12.5px;margin-bottom:6px">Custom colours</div><div style="display:flex;gap:10px;font-size:12px;color:var(--ink-3)">${['shadow', 'mid', 'high'].map(k => `<label style="display:grid;gap:3px;justify-items:center">${{ shadow: 'Shadows', mid: 'Midtones', high: 'Highlights' }[k]}<input type="color" data-k="${k}" value="${s().customPal[k]}" style="width:40px;height:28px;border:0;background:none;padding:0"></label>`).join('')}</div></div>
            <div><div style="display:flex;justify-content:space-between;font-size:12.5px"><label for="oQ">Quality</label><b class="mono" id="oQV">${Math.round(s().quality * 100)}%</b></div><input type="range" id="oQ" min="0.4" max="1" step="0.1" value="${s().quality}" style="width:100%"></div>
            <label style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px">Freeze during solves<input type="checkbox" class="switch" id="oFrz" ${s().freeze ? 'checked' : ''}></label>
          </div></div>`;
      if (innerWidth < 900) $('.bgwrap', el).style.gridTemplateColumns = 'minmax(0,1fr)';
      $$('.bg-tile', el).forEach((b, i) => { const cv = b.querySelector('canvas'); setTimeout(() => { const t = BG.thumb(b.dataset.id, P, 208, 130); cv.getContext('2d').drawImage(t, 0, 0); }, 20 + i * 15); b.onclick = () => { s().bg = b.dataset.id; const m = A.S.meta; m.bgs = m.bgs || []; if (!m.bgs.includes(b.dataset.id)) { m.bgs.push(b.dataset.id); A.checkBadges(); } save(true); }; });
      $('#oSpd', el).oninput = e => { s().bgSpeed = +e.target.value; $('#oSpdV', el).textContent = s().bgSpeed.toFixed(1) + '×'; save(); };
      $('#oQ', el).onchange = e => { s().quality = +e.target.value; $('#oQV', el).textContent = Math.round(s().quality * 100) + '%'; save(); };
      $$('.pal', el).forEach(b => b.onclick = () => { s().palette = b.dataset.p === 'custom' ? 'custom' : +b.dataset.p; save(true); });
      $$('input[data-k]', el).forEach(i => i.onchange = () => { s().customPal[i.dataset.k] = i.value; s().palette = 'custom'; save(true); });
      $('#oFrz', el).onchange = e => { s().freeze = e.target.checked; save(); };
    },
    glass(el) {
      el.innerHTML = `<h2>Cards & glass</h2><p>How the boxes sit on top of the background.</p>
        <div class="row"><div><label for="oBlur">Glass blur</label><div class="d">0 keeps the background sharp behind the cards: <b class="mono" id="oBlurV">${s().blur} px</b></div></div><input type="range" id="oBlur" min="0" max="30" step="1" value="${s().blur}"></div>
        <div class="row"><div><label for="oGA">Card opacity</label><div class="d"><b class="mono" id="oGAV">${Math.round(s().glassA * 100)}%</b></div></div><input type="range" id="oGA" min="0.15" max="0.95" step="0.05" value="${s().glassA}"></div>
        <div class="row"><div><label for="oRad">Corner radius</label><div class="d"><b class="mono" id="oRadV">${s().radius} px</b></div></div><input type="range" id="oRad" min="0" max="24" step="1" value="${s().radius}"></div>`;
      const r = (id, key, f, out) => $('#' + id, el).oninput = e => { s()[key] = +e.target.value; $('#' + id + 'V', el).textContent = out(s()[key]); save(); };
      r('oBlur', 'blur', 0, v => v + ' px'); r('oGA', 'glassA', 0, v => Math.round(v * 100) + '%'); r('oRad', 'radius', 0, v => v + ' px');
    },
    coach(el) {
      el.innerHTML = `<h2>Coach modes</h2><p>Coaching runs by itself after each solve. Turn single parts off here.</p>
        ${tog('oMis', 'Daily missions', 'Three goals a day, sized to your current ao12. Completing them earns XP and keeps your streak.', s().missions)}
        ${tog('oPb', 'PB celebrations', 'Confetti and a message when you set a new single, ao5 or ao12 PB.', s().pbFx)}
        <div class="row"><div><label>Reset level</label><div class="d">Level ${Math.floor((A.S.coach.xp || 0) / 300) + 1} · ${A.S.coach.xp || 0} XP</div></div><button class="btn danger" id="oXp">Reset XP</button></div>`;
      bindTog(el, 'oMis', 'missions'); bindTog(el, 'oPb', 'pbFx');
      $('#oXp', el).onclick = () => A.confirmBox('Reset your XP and level?', 'Reset XP', () => { A.S.coach.xp = 0; A.Store.saveSoon(); A.render.options('coach'); });
    },
    goals(el) {
      const g = s().goals;
      el.innerHTML = `<h2>Session goals</h2><p>Shown in the Session goals box on the Solve screen.</p>
        <div class="row"><label for="gS2">Solves this session</label><input class="field mono" id="gS2" type="number" min="1" value="${g.solves}" style="width:90px"></div>
        <div class="row"><label for="gT2">Sub-X target (seconds)</label><input class="field mono" id="gT2" type="number" min="1" step="0.5" value="${g.subT}" style="width:90px"></div>
        <div class="row"><label for="gN2">How many sub-X singles</label><input class="field mono" id="gN2" type="number" min="1" value="${g.subN}" style="width:90px"></div>
        <div class="row"><label for="gA2">ao5 goal (seconds)</label><input class="field mono" id="gA2" type="number" min="1" step="0.1" value="${g.ao5}" style="width:90px"></div>`;
      [['gS2', 'solves'], ['gT2', 'subT'], ['gN2', 'subN'], ['gA2', 'ao5']].forEach(([id, k]) => $('#' + id, el).onchange = e => { g[k] = +e.target.value || g[k]; save(); });
    },
    sessions(el) {
      el.innerHTML = `<h2>Sessions</h2><p>Group solves by event, cube or goal. Each session keeps its own stats.</p>
        <div style="display:grid;gap:6px">${A.S.sessions.map(se => `<div class="row" data-id="${se.id}" style="gap:8px"><input class="field" data-f="name" value="${esc(se.name)}" aria-label="Session name" style="flex:1;min-width:140px"><select class="field" data-f="event" aria-label="Event">${Object.entries(A.EVENTS).map(([k, v]) => `<option value="${k}" ${k === se.event ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="mono muted" style="width:80px;text-align:right">${A.S.solves[se.id].length} solves</span><button class="btn sm" data-a="open">Open</button><button class="btn sm danger" data-a="del" ${A.S.sessions.length < 2 ? 'disabled' : ''}>Delete</button></div>`).join('')}</div>
        <div class="row-actions" style="margin-top:12px"><button class="btn primary" id="oNewS">+ New session</button></div>`;
      $$('[data-id]', el).forEach(row => {
        const se = A.S.sessions.find(x => x.id === row.dataset.id);
        row.querySelector('[data-f=name]').onchange = e => { se.name = e.target.value.trim() || se.name; A.Store.saveSoon(); A.fillSelectors(); };
        row.querySelector('[data-f=event]').onchange = e => { se.event = e.target.value; A.Store.saveSoon(); A.fillSelectors(); };
        row.querySelector('[data-a=open]').onclick = () => { A.switchSession(se.id); A.go('timer'); };
        row.querySelector('[data-a=del]').onclick = () => A.confirmBox(`Delete “${se.name}” and its ${A.S.solves[se.id].length} solves?`, 'Delete session', () => {
          A.Cloud.dead = A.Cloud.dead || {}; A.Cloud.dead[se.id] = se.chunks || 0;
          A.S.solves[se.id].forEach(x => { if (x.r && A.S.replays[x.r]) { delete A.S.replays[x.r]; A.Cloud.dirtyRep.add(x.r); } });
          A.S.sessions = A.S.sessions.filter(x => x !== se); delete A.S.solves[se.id]; A.Cloud.mark(se.id, 0);
          if (A.S.cur === se.id) A.S.cur = A.S.sessions[0].id; A.Store.saveSoon(); A.fillSelectors(); A.render.options('sessions');
        });
      });
      $('#oNewS', el).onclick = () => A.sessionPrompt();
    },
    scramble(el) {
      const rs = A.Scrambler ? A.Scrambler.status : 'off';
      el.innerHTML = `<h2>Scramble</h2><p>3×3 and 2×2 use random-state scrambles like WCA competitions: a random cube position, solved by Solvo's own two-phase solver, then reversed. 4×4 and 5×5 use random-move scrambles (40 and 60 moves).</p>
        <div class="row"><div><label>Random-state generator</label><div class="d">${rs === 'ready' ? 'Ready. New 3×3 scrambles are random-state.' : rs === 'warming' ? 'Warming up in the background (a few seconds). Until then you get random-move scrambles.' : 'Not available in this browser, so 3×3 uses random-move scrambles.'}</div></div><b style="color:${rs === 'ready' ? 'var(--good)' : 'var(--warn)'}">${rs === 'ready' ? 'Ready' : rs === 'warming' ? 'Warming up' : 'Off'}</b></div>
        ${tog('oNet', 'Scramble preview', 'Show the scrambled cube as a flat net under the scramble.', s().showNet)}
        ${tog('oCol', 'Colour-coded moves', 'Each face gets its own colour. Hover or tap a move to see the cube right after it.', s().colorScr !== false)}
        <div class="row"><div><label>Current event</label><div class="d">Change the event from the selector in the top bar.</div></div><b>${A.EVENTS[A.event()]}</b></div>
        <div class="row" style="display:block"><label>Preview</label><div class="mono" style="margin:8px 0">${esc(A.curScramble())}</div><canvas data-net style="width:100%;max-width:360px;height:200px"></canvas></div>`;
      bindTog(el, 'oNet', 'showNet'); $('#oCol', el).onchange = e => { s().colorScr = e.target.checked; save(); A.newScramble && A.renderSolve && document.querySelector('#scramble') && (document.querySelector('#scramble').innerHTML = A.scrHTML(A.curScramble(), true)); };
      const N = C.EVENT_N[A.event()]; C.drawNet($('[data-net]', el), new C.Cube(N).apply(A.curScramble()));
    },
    keys(el) {
      const k = C.KEYMAP;
      el.innerHTML = `<h2>Virtual cube keys</h2><p>Turn the virtual cube with your keyboard, in the same layout many online timers use. On a phone, use the move buttons under the cube. Space starts inspection, Esc resets the cube.</p><div class="keys">${Object.entries(k).map(([key, m]) => `<div><span class="kbd">${esc(key.toUpperCase())}</span><b>${esc(m)}</b></div>`).join('')}</div>`;
    },
    smart(el) {
      const Sm = A.Smart, ok = Sm.supported();
      el.innerHTML = `<h2>Smart cube &amp; timer</h2><p>Connect a GAN Bluetooth smart cube to time solves automatically and record full replays, or a GAN Smart Timer to time with real hardware.</p>
        ${!ok ? `<div class="glass" style="padding:12px 14px;border-color:rgba(251,191,36,0.35);font-size:13px">${esc(Sm.why())}</div>` : ''}
        <div class="row"><div><label>Smart cube</label><div class="d">${Sm.kind === 'cube' ? `Connected: <b>${esc(Sm.name)}</b>${Sm.battery != null ? ' · battery ' + Sm.battery + '%' : ''}` : 'GAN Gen2/Gen3/Gen4 cubes (GAN 356 i, GAN12 ui, GAN14, Monster Go AI, MoYu AI 2023).'}</div></div>
          <div class="row-actions">${Sm.kind === 'cube' ? `<button class="btn" id="smSolved">Mark as solved</button><button class="btn danger" id="smOff">Disconnect</button>` : `<button class="btn primary" id="smCube" ${ok ? '' : 'disabled'}>Connect cube</button>`}</div></div>
        <div class="row"><div><label>Smart timer</label><div class="d">${Sm.kind === 'timer' ? `Connected: <b>${esc(Sm.name)}</b>` : 'GAN Smart Timer and GAN Halo Smart Timer.'}</div></div>
          <div class="row-actions">${Sm.kind === 'timer' ? `<button class="btn danger" id="smOff2">Disconnect</button>` : `<button class="btn" id="smTimer" ${ok ? '' : 'disabled'}>Connect timer</button>`}</div></div>
        <div class="row" style="display:block"><label>How it works</label><ul class="hl" style="margin-top:8px">
          <li><span>1</span><span>Start with a solved cube. Solvo shows the scramble and ticks off each turn; a wrong turn shows the move that undoes it.</span></li>
          <li><span>2</span><span>When the cube matches the scramble, inspection starts. Your first turn starts the timer and solving the cube stops it.</span></li>
          <li><span>3</span><span>Every smart-cube solve gets a replay with Cross, F2L, OLL and PLL splits.</span></li></ul></div>
        ${Sm.error ? `<div class="muted" style="font-size:12px">Last error: ${esc(Sm.error)}</div>` : ''}`;
      const b = id => $('#' + id, el);
      b('smCube') && (b('smCube').onclick = () => Sm.connectCube()); b('smTimer') && (b('smTimer').onclick = () => Sm.connectTimer());
      b('smOff') && (b('smOff').onclick = () => { Sm.disconnect(); s().input = 'timer'; A.Store.saveSoon(); A.fillInputs(); A.render.options('smart'); });
      b('smOff2') && (b('smOff2').onclick = () => { Sm.disconnect(); s().input = 'timer'; A.Store.saveSoon(); A.fillInputs(); A.render.options('smart'); });
      b('smSolved') && (b('smSolved').onclick = () => Sm.markSolved());
    },
    shortcuts(el) {
      el.innerHTML = `<h2>Shortcuts</h2><p>Press <span class="kbd">?</span> anywhere to see this list.</p>` + A.SHORTCUTS.map(([k, v]) => `<div class="row"><span class="kbd">${esc(k)}</span><span class="muted">${esc(v)}</span></div>`).join('');
    },
    data(el) {
      const demo = A.S.sessions.find(x => x.demo);
      el.innerHTML = `<h2>Import & export</h2><p>Where your data lives: <b>${A.Cloud.status === 'ok' ? 'synced to your Claude account (private to you)' : 'this browser only'}</b>.</p>
        ${A.installPrompt ? `<div class="row"><div><label>Install Solvo</label><div class="d">Add Solvo to your home screen or desktop. It works offline once installed.</div></div><button class="btn primary" id="oInstall">Install app</button></div>` : ''}
        <div class="row"><div><label>Export everything</label><div class="d">All sessions, solves, replays and settings as one JSON file.</div></div><button class="btn" id="oExp">Export JSON</button></div>
        <div class="row"><div><label>Export this session</label><div class="d">${esc(A.session().name)} as a CSV spreadsheet.</div></div><button class="btn" id="oCsv">Export CSV</button></div>
        <div class="row"><div><label for="oImp">Import</label><div class="d">A Solvo JSON export, or a csTimer export file (.txt / .json). Imported sessions are added next to yours.</div></div><input type="file" id="oImp" accept=".json,.txt,application/json,text/plain" class="field"></div>
        ${demo ? `<div class="row"><div><label>Demo session</label><div class="d">${A.S.solves[demo.id].length} example solves and ${Object.keys(A.S.replays).filter(id => A.S.solves[demo.id].some(x => x.r === id)).length} replays.</div></div><button class="btn danger" id="oDemo">Remove demo session</button></div>` : `<div class="row"><div><label>Demo session</label><div class="d">Add example solves to explore the charts.</div></div><button class="btn" id="oDemoAdd">Add demo session</button></div>`}
        <div class="row"><div><label>Delete all data</label><div class="d">Removes every session, solve and replay.</div></div><button class="btn danger" id="oWipe">Delete all data</button></div>`;
      $('#oExp', el).onclick = () => saveFile(`solvo-backup-${St.dayKey(Date.now())}.json`, JSON.stringify({ app: 'solvo', v: 1, sessions: A.S.sessions, solves: A.S.solves, replays: A.S.replays, settings: A.S.settings, coach: A.S.coach, train: A.S.train, badges: A.S.badges, meta: A.S.meta }), 'application/json');
      const ins = $('#oInstall', el); if (ins) ins.onclick = () => A.install();
      $('#oCsv', el).onclick = () => exportCSV(A.solves());
      $('#oImp', el).onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => importData(rd.result); rd.readAsText(f); };
      const d = $('#oDemo', el); if (d) d.onclick = () => { const dl = A.S.solves[demo.id]; A.Cloud.dead = A.Cloud.dead || {}; A.Cloud.dead[demo.id] = demo.chunks || 0; dl.forEach(x => { if (x.r) { delete A.S.replays[x.r]; A.Cloud.dirtyRep.add(x.r); } }); A.S.sessions = A.S.sessions.filter(x => x !== demo); delete A.S.solves[demo.id]; A.Cloud.mark(demo.id, 0); if (!A.S.sessions.length) { const id = A.uid(); A.S.sessions.push({ id, name: 'Main', event: '333' }); A.S.solves[id] = []; } if (A.S.cur === demo.id) A.S.cur = A.S.sessions[0].id; A.Store.saveSoon(); A.fillSelectors(); A.toast('Demo session removed'); A.render.options('data'); };
      const da = $('#oDemoAdd', el); if (da) da.onclick = () => { const dm = A.makeDemo(); A.S.sessions.push(dm.session); A.S.solves[dm.session.id] = dm.solves; Object.assign(A.S.replays, dm.replays); Object.keys(dm.replays).forEach(id => A.Cloud.dirtyRep.add(id)); A.Cloud.mark(dm.session.id, 0); A.Store.saveSoon(); A.fillSelectors(); A.toast('Demo session added'); A.render.options('data'); };
      $('#oWipe', el).onclick = () => A.confirmBox('Delete all sessions, solves and replays?', 'Delete everything', () => {
        A.Cloud.dead = A.Cloud.dead || {}; A.S.sessions.forEach(se => { A.Cloud.dead[se.id] = se.chunks || 0; A.Cloud.mark(se.id, 0); }); Object.keys(A.S.replays).forEach(id => A.Cloud.dirtyRep.add(id));
        const id = A.uid(); A.S.sessions = [{ id, name: 'Main', event: '333' }]; A.S.solves = { [id]: [] }; A.S.replays = {}; A.S.cur = id; A.S.coach = { xp: 0, done: {} };
        A.Store.save(); A.fillSelectors(); A.newScramble(); A.toast('All data deleted'); A.render.options('data');
      });
    }
  };
  function importData(text) {
    let j; try { j = JSON.parse(text); } catch (e) { A.toast('That file is not valid JSON'); return; }
    let added = 0, sessionsAdded = 0;
    if (j && j.app === 'solvo') {
      for (const se of j.sessions || []) { const id = A.uid(); A.S.sessions.push({ id, name: se.name + ' (imported)', event: se.event || '333' }); A.S.solves[id] = (j.solves[se.id] || []).map(x => Object.assign({}, x)); added += A.S.solves[id].length; sessionsAdded++; A.Cloud.mark(id, 0); }
      Object.assign(A.S.replays, j.replays || {}); Object.keys(j.replays || {}).forEach(id => A.Cloud.dirtyRep.add(id));
    } else if (j && Object.keys(j).some(k => /^session\d+$/.test(k))) {
      let meta = {}; try { meta = JSON.parse((j.properties && j.properties.sessionData) || '{}'); } catch (e) { }
      const evMap = { '333': '333', '222so': '222', '444wca': '444', '555wca': '555', '333oh': '333', '333ni': '333bf' };
      for (const k of Object.keys(j).filter(k => /^session\d+$/.test(k))) {
        const arr = j[k]; if (!Array.isArray(arr) || !arr.length) continue; const n = k.replace('session', ''); const m = meta[n] || {};
        const id = A.uid(); const ev = evMap[(m.opt && m.opt.scrType) || '333'] || '333';
        A.S.sessions.push({ id, name: (m.name ? String(m.name) : 'csTimer ' + n) + ' (csTimer)', event: ev });
        A.S.solves[id] = arr.map(x => { const pen = x[0][0]; return { id: A.uid(), t: x[0][1], p: pen === -1 ? -1 : pen === 2000 ? 2000 : 0, s: x[1] || '', c: x[2] || undefined, d: (x[3] || 0) * 1000 }; }).filter(x => x.t > 0);
        added += A.S.solves[id].length; sessionsAdded++; A.Cloud.mark(id, 0);
      }
    } else { A.toast('This file is not a Solvo or csTimer export'); return; }
    A.Store.saveSoon(); A.fillSelectors(); A.toast(`Imported <b>${added.toLocaleString()}</b> solves in ${sessionsAdded} session${sessionsAdded === 1 ? '' : 's'}`, 3500); A.render.options('data');
  }

  A.refreshOpen = () => { if (A.view !== 'timer' && A.render[A.view]) A.render[A.view](A.sub); };
  A.init();
})();
