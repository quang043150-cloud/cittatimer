/* Solvo Timer — core: state, storage/sync, timer engine, virtual cube, Solve view, widgets, charts, modals. */
(function () {
  'use strict';
  const C = window.SolvoCube, St = window.SolvoStats, BG = window.SolvoBG;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const EVENTS = { '333': '3×3', '222': '2×2', '444': '4×4', '555': '5×5', '333oh': '3×3 OH', '333bf': '3×3 BLD' };
  const WIDGETS = { times: 'Recent times', goals: 'Session goals', averages: 'Averages', trend: 'Solve trend', chart: 'Solve times chart', last12: 'Last 12 solves', ladder: 'Sub-X ladder', net: 'Scramble preview', missions: 'Daily missions', pbs: 'Personal bests' };
  const DEFAULTS = {
    inspection: true, holdMs: 300, timerUpdate: 'full', focus: true, beeps: true, input: 'timer',
    bg: 'bubbles', palette: 0, customPal: { shadow: '#120c22', mid: '#6d3fd6', high: '#c4b5fd' }, bgSpeed: 1, blur: 14, glassA: 0.58, radius: 14, freeze: false, quality: 1,
    accent: '#a78bfa', mode: 'full',
    layout: { left: ['times'], right: ['goals', 'averages', 'trend'], under: ['chart', 'last12', 'ladder'] },
    showNet: true, pbFx: true, missions: true, compBg: 'sakura',
    callout: 'beep', metroOn: false, metroTps: 4, ghost: false, ghostSrc: 'pb',
    goals: { solves: 50, subT: 10, subN: 10, ao5: 9 }
  };
  const LS_KEY = 'solvo.v1';

  // ------------------------------------------------------------------ state
  let S = null;
  function fresh() {
    const s = { v: 1, updatedAt: 0, settings: JSON.parse(JSON.stringify(DEFAULTS)), sessions: [], cur: null, solves: {}, replays: {}, coach: { xp: 0, done: {} } };
    const demo = makeDemo(); s.sessions.push(demo.session); s.solves[demo.session.id] = demo.solves; Object.assign(s.replays, demo.replays);
    s.cur = demo.session.id; return normalize(s);
  }
  function loadLocal() {
    try { const raw = localStorage.getItem(LS_KEY); if (!raw) return null; const s = JSON.parse(raw); return normalize(s); } catch (e) { return null; }
  }
  function normalize(s) {
    const hadCallout = !!(s.settings && 'callout' in s.settings);
    s.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), s.settings || {});
    if (!hadCallout && s.settings.beeps === false) s.settings.callout = 'off';
    s.settings.layout = Object.assign({}, DEFAULTS.layout, s.settings.layout || {});
    s.settings.goals = Object.assign({}, DEFAULTS.goals, s.settings.goals || {});
    s.sessions = s.sessions || []; s.solves = s.solves || {}; s.replays = s.replays || {}; s.coach = s.coach || { xp: 0, done: {} }; s.coach.done = s.coach.done || {};
    s.badges = s.badges || {}; s.meta = s.meta || {};
    const t0 = { oll: {}, pll: {}, custom: {}, sel: null, opts: { angle: true, hide: false }, cross: { col: 0, neutral: false, level: 'any', tries: 0, optimal: 0, lenSum: 0 } };
    s.train = Object.assign(t0, s.train || {}); s.train.opts = Object.assign({ angle: true, hide: false }, s.train.opts); s.train.cross = Object.assign({ col: 0, neutral: false, level: 'any', tries: 0, optimal: 0, lenSum: 0 }, s.train.cross);
    const AL = window.SolvoAlgs; if (!s.train.sel && AL) s.train.sel = { pll: AL.cases.pll.map(c => c.id), oll: AL.cases.oll.filter(c => c.group === 'Cross').map(c => c.id) };
    if (!s.sessions.length) { const id = uid(); s.sessions.push({ id, name: 'Main', event: '333' }); s.solves[id] = []; }
    if (!s.sessions.find(x => x.id === s.cur)) s.cur = s.sessions[0].id;
    for (const se of s.sessions) s.solves[se.id] = s.solves[se.id] || [];
    return s;
  }
  const session = () => S.sessions.find(x => x.id === S.cur);
  const solves = () => (S.solves[S.cur] = S.solves[S.cur] || []);
  const event = () => session().event;
  const set = () => S.settings;

  // ------------------------------------------------------------------ demo data
  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const F2L_INS = ["R U R'", "R U' R'", "U R U' R'", "U' R U R'", "L' U' L", "L' U L", "U L' U' L", "F' U' F", "U' F' U F", "R U2 R'", "U2 R U' R'", "L' U2 L", "B U B'", "U B U' B'", "B' U' B"];
  const OLLS = ["R U R' U R U2 R'", "R U2 R' U' R U' R'", "F R U R' U' F'", "R U2 R2 U' R2 U' R2 U2 R", "F R U R' U' R U R' U' F'", "R U R' U' R' F R F'"];
  const PLLS = ["R U R' U' R' F R2 U' R' U' R U R' F'", "R U' R U R U R U' R' U' R2", "R U R' F' R U R' U' R' F R2 U' R'", "R2 U R U R' U' R' U' R' U R'", "R' U R' U' R' U' R' U R U R2"];
  const inv = seq => C.tokenize(seq).reverse().map(C.invertMove);
  function demoReplay(r, id) {
    const pick = a => a[Math.floor(r() * a.length)];
    const crossFaces = ['F', 'R', 'L', 'B', 'D'], cross = []; let last = '';
    while (cross.length < 5 + Math.floor(r() * 3)) { const f = pick(crossFaces); if (f === last) continue; last = f; cross.push(f + pick(['', "'", '2'])); }
    const f2l = []; for (let i = 0; i < 4; i++) f2l.push(C.tokenize(pick(F2L_INS)));
    const oll = C.tokenize(pick(OLLS)), pll = C.tokenize(pick(PLLS)), auf = pick(['', 'U', "U'", 'U2']);
    const phases = [cross, ...f2l, oll, auf ? pll.concat([auf]) : pll];
    const all = phases.flat();
    const scr = inv(all.join(' ')).join(' ');
    let t = 0; const mv = [];
    phases.forEach((ph, pi) => {
      t += pi === 0 ? 300 + r() * 500 : (pi <= 4 ? 450 + r() * 900 : 350 + r() * 600);
      const tps = pi === 0 ? 4 + r() * 2 : pi <= 4 ? 4.5 + r() * 2.5 : 7 + r() * 3;
      ph.forEach(m => { t += 1000 / tps * (0.6 + r() * 0.8); mv.push([m, Math.round(t)]); });
    });
    return { id, scr, mv, t: Math.round(t), ev: '333' };
  }
  function makeDemo() {
    const r = rng(42), id = 'demo-' + uid(), list = [], replays = {};
    const now = Date.now(), DAY = 864e5, N = 460; const days = [];
    for (let d = 52; d >= 0; d--) if (r() < 0.72 || d < 2) days.push(d);
    const per = Math.ceil(N / days.length);
    let i = 0;
    for (const d of days) {
      const dayStart = new Date(now - d * DAY); dayStart.setHours(17 + Math.floor(r() * 4), Math.floor(r() * 60), 0, 0);
      let ts = dayStart.getTime(); if (ts > now - 60000 * per) ts = now - 60000 * per - 120000;
      for (let k = 0; k < per && i < N; k++, i++) {
        const prog = i / N, mean = 22500 - 9300 * (1 - Math.exp(-3.2 * prog));
        const g = (r() + r() + r() + r() - 2) / 2; let t = mean * (1 + g * 0.22); if (r() < 0.04) t *= 1.35; if (r() < 0.02) t *= 0.78;
        const p = r() < 0.012 ? -1 : r() < 0.02 ? 2000 : 0;
        ts += 35000 + r() * 50000;
        list.push({ id: uid(), t: Math.round(t), p, d: ts, s: C.genScramble('333') });
      }
    }
    for (let k = 0; k < 6; k++) { const rid = 'r' + uid(); const rep = demoReplay(r, rid); const s = list[list.length - 6 + k]; s.t = rep.t; s.p = 0; s.s = rep.scr; s.r = rid; rep.d = s.d; replays[rid] = rep; }
    return { session: { id, name: 'Demo practice', event: '333', demo: true }, solves: list, replays };
  }

  // ------------------------------------------------------------------ storage + cloud sync
  const Store = {
    t: 0,
    pending: false,
    saveSoon() { clearTimeout(this.t); this.pending = true; this.t = setTimeout(() => this.save(), 500); },
    flush() { if (this.pending) { clearTimeout(this.t); this.save(); } },
    save() { this.pending = false;
      S.updatedAt = Date.now();
      try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { pruneReplays(150); try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e2) { } }
      Cloud.push();
    }
  };
  function pruneReplays(max) {
    const ids = Object.keys(S.replays).sort((a, b) => (S.replays[a].d || 0) - (S.replays[b].d || 0));
    while (ids.length > max) { const id = ids.shift(); delete S.replays[id]; Cloud.dirtyRep.add(id); }
  }
  const CHUNK = 500;
  const Cloud = {
    base: null, ready: false, busy: false, again: false, dirty: new Map(), dirtyRep: new Set(), status: 'local',
    mark(sid, from) { const c = Math.floor((from || 0) / CHUNK); const cur = this.dirty.get(sid); this.dirty.set(sid, cur === undefined ? c : Math.min(cur, c)); },
    markAll() { for (const se of S.sessions) this.mark(se.id, 0); Object.keys(S.replays).forEach(id => this.dirtyRep.add(id)); this.profileDirty = true; },
    setStatus(st, text) { this.status = st; const el = $('#sync'); if (!el) return; el.className = 'sync ' + (st === 'ok' ? 'ok' : st === 'busy' ? 'busy' : ''); el.lastChild.textContent = text; },
    async init() {
      if (!window.claude || !window.claude.use) { this.setStatus('local', 'Saved in this browser'); return; }
      try {
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        if (!db || !user) { this.setStatus('local', 'Saved in this browser'); return; }
        const id = await user.id(); if (!id) { this.setStatus('local', 'Saved in this browser'); return; }
        this.db = db; this.user = user; this.uid = id;
        this.base = db.doc('data/users/' + id + '/profile');
        this.setStatus('busy', 'Syncing…');
        const snap = await this.base.get();
        const remote = snap.exists ? snap.data() : null;
        if (remote && (remote.updatedAt || 0) > (S.updatedAt || 0)) await this.pull(remote);
        else this.markAll();
        this.ready = true; await this.push();
      } catch (e) { console.warn('sync', e); this.setStatus('local', 'Saved in this browser'); }
    },
    async pull(remote) {
      const [chunks, reps] = await Promise.all([this.base.collection('chunks').limit(1000).get(), this.base.collection('replays').limit(1000).get()]);
      const s = { v: 1, updatedAt: remote.updatedAt, settings: remote.settings, sessions: remote.sessions, cur: remote.cur, coach: remote.coach, train: remote.train, badges: remote.badges, meta: remote.meta, solves: {}, replays: {} };
      const bySid = {};
      chunks.docs.forEach(d => { const x = d.data(); (bySid[x.sid] = bySid[x.sid] || []).push(x); });
      for (const sid in bySid) { s.solves[sid] = bySid[sid].sort((a, b) => a.idx - b.idx).flatMap(c => c.list.map(unpackSolve)); }
      reps.docs.forEach(d => { const x = d.data(); s.replays[d.id] = { id: d.id, scr: x.scr, t: x.t, d: x.d, ev: x.ev, mv: unpackMoves(x.mv) }; });
      S = normalize(s); try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { }
      App.afterLoad && App.afterLoad();
    },
    async push() {
      if (!this.ready) return;
      if (this.busy) { this.again = true; return; }
      this.busy = true; this.setStatus('busy', 'Syncing…');
      try {
        const col = this.base.collection('chunks');
        for (const [sid, from] of [...this.dirty]) {
          this.dirty.delete(sid);
          const list = S.solves[sid]; const se = S.sessions.find(x => x.id === sid);
          const n = list ? Math.ceil(list.length / CHUNK) : 0; const old = se ? (se.chunks || 0) : ((this.dead && this.dead[sid]) || 0);
          for (let c = from; c < n; c++) await col.doc(sid + '~' + c).set({ sid, idx: c, list: list.slice(c * CHUNK, (c + 1) * CHUNK).map(packSolve) });
          for (let c = Math.max(n, from); c < old; c++) await col.doc(sid + '~' + c).delete();
          if (se) se.chunks = n; else if (this.dead) delete this.dead[sid];
        }
        const rcol = this.base.collection('replays');
        for (const id of [...this.dirtyRep]) {
          this.dirtyRep.delete(id); const r = S.replays[id];
          if (r) await rcol.doc(id).set({ scr: r.scr, t: r.t, d: r.d || 0, ev: r.ev || '333', mv: packMoves(r.mv) }); else await rcol.doc(id).delete();
        }
        await this.base.set({ updatedAt: S.updatedAt || Date.now(), settings: S.settings, sessions: S.sessions, cur: S.cur, coach: S.coach, train: S.train, badges: S.badges, meta: S.meta });
        this.setStatus('ok', 'Synced to your account');
      } catch (e) {
        console.warn('push', e);
        this.setStatus('local', e && e.code === 'quota_exceeded' ? 'Account storage full · saved in browser' : 'Saved in this browser');
      }
      this.busy = false;
      if (this.again) { this.again = false; this.push(); }
    }
  };
  const packSolve = s => [s.t, s.p || 0, s.d, s.s || '', s.r || '', s.c || '', s.id];
  const unpackSolve = a => ({ t: a[0], p: a[1], d: a[2], s: a[3], r: a[4] || undefined, c: a[5] || undefined, id: a[6] || uid() });
  const packMoves = mv => mv.map(m => m[0] + '@' + m[1]).join(' ');
  const unpackMoves = str => (str || '').split(' ').filter(Boolean).map(x => { const i = x.lastIndexOf('@'); return [x.slice(0, i), +x.slice(i + 1)]; });
  function changed(sid, fromIdx) { Cloud.mark(sid, fromIdx); Store.saveSoon(); }

  // ------------------------------------------------------------------ settings → page
  let engine = null;
  function palette() { const s = set(); return s.palette === 'custom' ? s.customPal : (BG.PALETTES[s.palette] || BG.PALETTES[0]); }
  function lum(hex) { const n = parseInt(hex.slice(1), 16); const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  function applySettings() {
    const s = set(), root = document.documentElement.style;
    root.setProperty('--accent', s.accent); root.setProperty('--accent-ink', lum(s.accent) > 0.55 ? '#160e2e' : '#ffffff');
    root.setProperty('--blur', s.blur + 'px'); root.setProperty('--glass', `rgba(18,13,34,${s.glassA})`); root.setProperty('--radius', s.radius + 'px');
    if (engine) { engine.P = palette(); engine.speed = s.bgSpeed; const want = App.view === 'comp' ? s.compBg : s.bg; if (engine.quality !== s.quality) { engine.quality = s.quality; engine.id === want && engine.resize(); } if (engine.id !== want) engine.set(want); else engine.draw(); }
    $('#v-timer').classList.toggle('simple', s.mode === 'simple');
    $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === s.mode)));
    $('#selInput').value = s.input;
  }

  // ------------------------------------------------------------------ icons (stroke SVG, one family)
  const ICONS = {
    x: '<path d="M18 6 6 18M6 6l12 12"/>', play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>', pause: '<path d="M8 5v14M16 5v14"/>',
    first: '<path d="M18 19 9 12l9-7zM6 5v14"/>', last: '<path d="m6 5 9 7-9 7zM18 5v14"/>', prev: '<path d="m15 18-6-6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', compare: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>', repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v1a4 4 0 0 1-3 4M7 5H4v1a4 4 0 0 0 3 4"/>', award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8"/>',
    ghost: '<path d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>', flame: '<path d="M12 22c4.4 0 7-2.9 7-6.8 0-3.7-2.6-5.9-3.7-8.7-1 1.9-2.2 3-3.8 3.8C11.7 7.4 10.6 5 8.5 3 8.5 8 5 10 5 15.2 5 19.1 7.6 22 12 22z"/>',
    share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>'
  };
  function icon(n, sz) { return `<svg class="ic" width="${sz || 15}" height="${sz || 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`; }

  // ------------------------------------------------------------------ toasts / confetti / modal
  function toast(html, ms) { const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html; $('#toasts').appendChild(el); setTimeout(() => el.remove(), ms || 2600); }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = $('#confetti'), ctx = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
    const cols = C.COLORS, ps = []; for (let i = 0; i < 160; i++) ps.push({ x: innerWidth / 2, y: innerHeight * 0.45, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4, s: 5 + Math.random() * 6, c: cols[i % 6], r: Math.random() * 6 });
    let f = 0; (function step() { ctx.clearRect(0, 0, c.width, c.height); for (const p of ps) { p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.r += 0.15; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore(); } if (++f < 120) requestAnimationFrame(step); else ctx.clearRect(0, 0, c.width, c.height); })();
  }
  function modal(html, onMount) {
    const root = $('#modalRoot'); root.innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const bg = root.firstChild; bg.addEventListener('mousedown', e => { if (e.target === bg) closeModal(); });
    $$('[data-close]', bg).forEach(b => b.onclick = closeModal);
    onMount && onMount(bg.firstChild);
    const f = bg.querySelector('input,button,select'); f && f.focus();
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }
  const modalOpen = () => !!$('#modalRoot').firstChild;
  function confirmBox(text, okLabel, fn) {
    modal(`<div class="modal-h"><h3>${esc(text)}</h3></div><p class="muted">This can't be undone.</p><div class="row-actions" style="justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn primary" id="cfOk">${esc(okLabel)}</button></div>`, m => { $('#cfOk', m).onclick = () => { closeModal(); fn(); }; });
  }

  // ------------------------------------------------------------------ charts (SVG)
  function niceStep(raw) { const mag = Math.pow(10, Math.floor(Math.log10(raw))); for (const k of [1, 2, 2.5, 5, 10]) if (k * mag >= raw) return k * mag; return 10 * mag; }
  function lineChart(el, o) {
    const W = Math.max(220, el.clientWidth || 300), H = o.h || 150, pl = o.pl || 40, pr = 10, pt = 10, pb = o.xLabels ? 20 : 8;
    const all = o.series.flatMap(s => s.d).filter(v => v != null && isFinite(v));
    if (all.length < 2) { el.innerHTML = `<div class="empty">${o.empty || 'Not enough solves yet'}</div>`; return; }
    let lo = Math.min(...all), hi = Math.max(...all); if (o.zero) lo = 0; if (hi - lo < 1e-6) { hi += 1; lo -= 1; } const pad = (hi - lo) * 0.08; hi += pad; if (!o.zero) lo -= pad;
    const n = Math.max(...o.series.map(s => s.d.length)); const x = i => pl + (n <= 1 ? 0 : i * (W - pl - pr) / (n - 1)); const y = v => pt + (hi - v) * (H - pt - pb) / (hi - lo);
    const step = niceStep((hi - lo) / 4); let g = '';
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,0.07)"/><text x="${pl - 6}" y="${y(v) + 3}" text-anchor="end">${(o.yfmt || (a => a))(v)}</text>`;
    if (o.xLabels) for (const [i, lab] of o.xLabels) g += `<text x="${clamp(x(i), pl + 14, W - pr - 14)}" y="${H - 5}" text-anchor="middle">${esc(lab)}</text>`;
    let paths = '';
    for (const s of o.series) {
      let d = '', pen = false, first = null, lastI = null;
      s.d.forEach((v, i) => { if (v == null || !isFinite(v)) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; if (first === null) first = i; lastI = i; });
      if (s.area && first !== null) paths += `<path d="${d}L${x(lastI)} ${H - pb}L${x(first)} ${H - pb}Z" fill="${s.c}" opacity="0.12"/>`;
      paths += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="${s.w || 1.6}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
      if (s.dots) s.d.forEach((v, i) => { if (v != null && isFinite(v)) paths += `<circle cx="${x(i)}" cy="${y(v)}" r="2" fill="${s.c}"/>`; });
      if (s.end && lastI !== null) paths += `<circle cx="${x(lastI)}" cy="${y(s.d[lastI])}" r="3.5" fill="${s.c}" stroke="#0d0a18" stroke-width="1.5"/>`;
    }
    if (o.marks) for (const m of o.marks) paths += `<circle cx="${x(m.i)}" cy="${y(m.v)}" r="4" fill="none" stroke="${m.c}" stroke-width="1.5"/><text x="${x(m.i)}" y="${y(m.v) - 8}" text-anchor="middle" style="fill:${m.c}">${esc(m.label)}</text>`;
    el.innerHTML = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}${paths}</svg>`;
  }
  function barChart(el, vals, o) {
    o = o || {}; const W = Math.max(200, el.clientWidth || 300), H = o.h || 120, pb = o.labels ? 18 : 4, pt = o.top ? 14 : 4;
    const mx = Math.max(1e-9, ...vals.filter(v => isFinite(v))); const n = vals.length; const bw = (W - 4) / n;
    let s = '';
    vals.forEach((v, i) => {
      const hh = isFinite(v) ? (v / mx) * (H - pb - pt) : (H - pb - pt); const xx = 2 + i * bw + bw * 0.12, yy = H - pb - hh;
      const col = o.color ? o.color(v, i) : 'var(--accent)';
      s += `<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${Math.max(1, hh).toFixed(1)}" rx="2" style="fill:${col}" ${isFinite(v) ? '' : 'opacity="0.35"'}/>`;
      if (o.top) s += `<text x="${xx + bw * 0.38}" y="${yy - 3}" text-anchor="middle">${esc(o.top(v, i))}</text>`;
      if (o.labels && o.labels[i] !== undefined && o.labels[i] !== '') s += `<text x="${xx + bw * 0.38}" y="${H - 5}" text-anchor="middle">${esc(o.labels[i])}</text>`;
    });
    el.innerHTML = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
  }
  const secFmt = v => (v / 1000).toFixed(v < 10000 ? 1 : 0);

  // ------------------------------------------------------------------ audio
  let actx = null;
  const bus = {};
  function on(n, f) { (bus[n] = bus[n] || []).push(f); }
  function emit(n, ...a) { (bus[n] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); }
  function beep(freq, dur) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = freq; o.type = 'sine'; g.gain.setValueAtTime(0.0001, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur + 0.02); } catch (e) { } }

  // ------------------------------------------------------------------ timer engine
  // ctx: { el, hint, inspection, onDone(t, pen, extra), virtual }
  let wakeLock = null;
  const Timer = {
    state: 'idle', t0: 0, i0: 0, pen: 0, raf: 0, holdTO: 0, ctx: null, ignoreUp: false, beeped: {},
    setCtx(ctx) { this.cancel(); this.ctx = ctx; this.show(); },
    busy() { return this.state !== 'idle'; },
    externalStart() { if (!this.ctx || this.state === 'running') return; this.state = 'ready'; this.startRun(); this.show(); },
    externalStop(ms) { if (this.state === 'running') { this.stop(ms); } },
    down() {
      if (!this.ctx) return;
      if (this.state === 'running') { this.stop(); this.ignoreUp = true; return; }
      if (this.state === 'idle') {
        if (this.ctx.inspection()) { this.state = 'armInsp'; }
        else { this.state = 'hold'; this.armHold('ready'); }
      } else if (this.state === 'inspect') { this.state = 'inspHold'; this.armHold('inspReady'); }
      this.show();
    },
    up() {
      if (this.ignoreUp) { this.ignoreUp = false; return; }
      const st = this.state;
      if (st === 'armInsp') { this.startInspection(); }
      else if (st === 'hold') { clearTimeout(this.holdTO); this.state = 'idle'; }
      else if (st === 'ready' || st === 'inspReady') { this.startRun(); }
      else if (st === 'inspHold') { clearTimeout(this.holdTO); this.state = 'inspect'; }
      this.show();
    },
    armHold(next) { clearTimeout(this.holdTO); this.holdTO = setTimeout(() => { if (this.state === 'hold' || this.state === 'inspHold') { this.state = next; this.show(); } }, set().holdMs); },
    startInspection() {
      this.state = 'inspect'; this.i0 = performance.now(); this.beeped = {}; document.body.classList.add('solving');
      if (this.ctx.onInspect) this.ctx.onInspect();
      emit('inspect', this.ctx.name || 'main');
      this.loop();
    },
    inspPenalty() { if (!this.i0) return 0; const e = (performance.now() - this.i0) / 1000; return e > 17 ? -1 : e > 15 ? 2000 : 0; },
    startRun() {
      this.pen = this.state === 'inspReady' || this.state === 'inspect' ? this.inspPenalty() : 0;
      this.i0 = 0; this.state = 'running'; this.t0 = performance.now(); document.body.classList.add('solving'); if (engine) engine.frozen = set().freeze;
      try { navigator.wakeLock && navigator.wakeLock.request('screen').then(l => wakeLock = l).catch(() => { }); } catch (e) { }
      if (this.ctx.onStart) this.ctx.onStart();
      emit('start', this.ctx.name || 'main');
      this.loop();
    },
    stop(exact) {
      if (this.state !== 'running') return;
      const t = exact != null ? exact : performance.now() - this.t0; this.state = 'idle'; cancelAnimationFrame(this.raf); document.body.classList.remove('solving'); if (engine) engine.frozen = false;
      try { wakeLock && wakeLock.release(); } catch (e) { } wakeLock = null;
      this.lastT = t; this.el().innerHTML = fmtBig(this.pen === -1 ? null : t + (this.pen || 0), this.pen);
      emit('stop', t, this.pen, this.ctx.name || 'main');
      this.ctx.onDone(t, this.pen);
      this.show(true);
    },
    cancel() {
      clearTimeout(this.holdTO); cancelAnimationFrame(this.raf);
      if (this.state !== 'idle') { this.state = 'idle'; document.body.classList.remove('solving'); if (engine) engine.frozen = false; this.i0 = 0; if (this.ctx && this.ctx.onCancel) this.ctx.onCancel(); emit('cancel'); this.show(); }
    },
    el() { return this.ctx.el(); },
    loop() {
      cancelAnimationFrame(this.raf);
      const tick = () => {
        if (this.state === 'running') {
          const e = performance.now() - this.t0, mode = set().timerUpdate;
          this.el().innerHTML = mode === 'hide' ? '<span style="font-size:.45em;letter-spacing:.1em">SOLVE</span>' : mode === 'sec' ? Math.floor(e / 1000) : fmtBig(e, 0);
        } else if (this.state === 'inspect' || this.state === 'inspHold' || this.state === 'inspReady') {
          const e = (performance.now() - this.i0) / 1000; const el = this.el();
          for (const sec of [8, 12, 15, 17]) if (e >= sec && !this.beeped[sec]) { this.beeped[sec] = 1; if (App.callout) App.callout(sec); else if (sec === 8) beep(880, 0.12); }
          el.textContent = e > 17 ? 'DNF' : e > 15 ? '+2' : String(Math.max(1, 15 - Math.floor(e)));
          el.classList.toggle('late', e > 12);
        } else return;
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    },
    show(keepTime) {
      if (!this.ctx) return; const el = this.el(); if (!el) return;
      el.classList.remove('hold', 'ready', 'insp', 'late');
      const st = this.state;
      if (st === 'hold' || st === 'inspHold') el.classList.add('hold');
      if (st === 'ready' || st === 'inspReady') el.classList.add('ready');
      if (st === 'inspect' || st === 'inspHold' || st === 'inspReady') el.classList.add('insp');
      if (st === 'hold' || st === 'ready' || st === 'armInsp') { if (!keepTime) el.innerHTML = fmtBig(0, 0); }
      if (st === 'armInsp') { el.textContent = '15'; el.classList.add('insp'); }
      if (this.ctx.hint) this.ctx.hint(st);
    }
  };
  function fmtBig(ms, pen) {
    if (pen === -1) return 'DNF';
    if (ms === null) return 'DNF';
    const s = St.fmt(ms); const i = s.lastIndexOf('.');
    return (i > 0 ? `${s.slice(0, i)}<small>${s.slice(i)}</small>` : s) + (pen === 2000 ? '<small>+</small>' : '');
  }

  // ------------------------------------------------------------------ scrambles
  const Scr = { hist: [], idx: -1 };
  function curScramble() { return Scr.hist[Scr.idx] || ''; }
  function newScramble() { Scr.hist = Scr.hist.slice(0, Scr.idx + 1); Scr.hist.push(App.nextScramble ? App.nextScramble(event()) : C.genScramble(event())); if (Scr.hist.length > 60) Scr.hist.shift(); Scr.idx = Scr.hist.length - 1; onScramble(); }
  function prevScramble() { if (Scr.idx > 0) { Scr.idx--; onScramble(); } }
  function nextScramble() { if (Scr.idx < Scr.hist.length - 1) { Scr.idx++; onScramble(); } else newScramble(); }
  function onScramble() {
    const el = $('#scramble'); el.textContent = curScramble(); el.classList.toggle('big', event() === '444' || event() === '555');
    if (set().input === 'virtual') VC.load();
    drawNets(); emit('scramble', curScramble());
  }
  function replaceScrambleIfIdle() {
    if (App.view !== 'timer' || Timer.state !== 'idle' || !App.nextScramble) return;
    if (set().input === 'smart' && App.Smart && App.Smart.guide && (App.Smart.guide.idx > 0 || App.Smart.guide.fixes.length)) return;
    Scr.hist[Scr.idx] = App.nextScramble(event()); onScramble();
  }
  function drawNets() {
    const N = C.EVENT_N[event()];
    const cube = new C.Cube(N).apply(curScramble());
    $$('canvas[data-net]').forEach(c => C.drawNet(c, cube));
    const mini = $('#netMini'); mini.hidden = !(set().showNet && set().input !== 'virtual' && set().input !== 'smart' && !set().layout.left.concat(set().layout.right, set().layout.under).includes('net'));
    if (!mini.hidden) C.drawNet(mini, cube);
  }

  // ------------------------------------------------------------------ virtual cube
  const VC = {
    cube: null, view: { yaw: -0.62, pitch: 0.52 }, moves: [], live: false,
    load() { this.cube = new C.Cube(3).apply(curScramble()); this.moves = []; this.live = false; this.draw(); },
    draw() { const c = $('#vcCanvas'); if (c && this.cube && !$('#vcube').hidden) C.draw3D(c, this.cube, this.view); },
    turn(m) {
      if (!this.cube) this.load();
      const rot = /^[xyz]/.test(m);
      if (Timer.state === 'running') { const el = Math.round(performance.now() - Timer.t0); this.cube.move(m); this.moves.push([m, el]); this.draw(); emit('vmove', m, el, this.cube); if (this.cube.isSolved()) Timer.stop(); return; }
      if (rot) { this.cube.move(m); this.moves.push([m, 0]); this.draw(); return; }
      if (Timer.state === 'idle' || Timer.state === 'inspect' || Timer.state === 'inspHold' || Timer.state === 'inspReady' || Timer.state === 'armInsp') {
        if (Timer.state === 'armInsp') Timer.state = 'idle';
        Timer.state = Timer.state === 'idle' ? 'ready' : 'inspReady'; Timer.startRun();
        this.cube.move(m); this.moves.push([m, 0]); this.draw(); emit('vmove', m, 0, this.cube); Timer.show();
      }
    }
  };
  function initVirtual() {
    const pad = $('#movepad'); pad.innerHTML = ["R", "R'", "U", "U'", "F", "F'", "L", "L'", "D", "D'", "B", "B'", "x", "x'", "y", "y'", "M", "M'"].map(m => `<button data-m="${m}">${m}</button>`).join('');
    pad.onclick = e => { const b = e.target.closest('button'); if (b) VC.turn(b.dataset.m); };
    const c = $('#vcCanvas'); dragRotate(c, VC.view, () => VC.draw());
  }
  function dragRotate(c, view, redraw) {
    let drag = null;
    c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing'; });
    c.addEventListener('pointermove', e => { if (!drag) return; view.yaw = drag.yaw + (e.clientX - drag.x) * 0.01; view.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.01, -1.4, 1.4); redraw(); });
    const end = () => { drag = null; c.style.cursor = 'grab'; };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  }

  // ------------------------------------------------------------------ solving + PBs
  function addSolve(t, p, extra) {
    const list = solves();
    const before = { single: St.best(list).v, ao5: St.bestRolling(list, 5).v, ao12: St.bestRolling(list, 12).v };
    const s = Object.assign({ id: uid(), t: Math.round(t), p: p || 0, d: Date.now(), s: curScramble() }, extra || {});
    list.push(s);
    changed(S.cur, list.length - 1);
    if (list.length > 12 && set().pbFx) {
      const v = St.val(s); let msg = null;
      if (before.single !== null && v < before.single) msg = `New PB single <b>${St.fmt(v)}</b>`;
      else { const a5 = St.aoN(list, 5); if (before.ao5 !== null && a5 !== null && a5 < before.ao5) msg = `New PB ao5 <b>${St.fmt(a5)}</b>`; else { const a12 = St.aoN(list, 12); if (before.ao12 !== null && a12 !== null && a12 < before.ao12) msg = `New PB ao12 <b>${St.fmt(a12)}</b>`; } }
      if (msg) { toast(icon('trophy') + ' ' + msg, 3500); confetti(); }
    }
    App.coachCheck && App.coachCheck();
    emit('solve', s);
    return s;
  }
  function onTimerDone(t, pen) {
    let extra = {};
    if ((set().input === 'virtual' || set().input === 'smart') && VC.moves.length) {
      const rid = 'r' + uid(); S.replays[rid] = { id: rid, scr: curScramble(), mv: VC.moves.slice(), t: Math.round(t), d: Date.now(), ev: event() };
      Cloud.dirtyRep.add(rid); extra.r = rid; pruneReplays(400);
    }
    addSolve(t, pen, extra);
    newScramble(); renderSolve();
  }
  function setPenalty(s, p) { const list = solves(); const i = list.indexOf(s); if (i < 0) return; s.p = s.p === p ? 0 : p; changed(S.cur, i); renderSolve(); App.refreshOpen && App.refreshOpen(); }
  function deleteSolve(s) { const list = solves(); const i = list.indexOf(s); if (i < 0) return; list.splice(i, 1); if (s.r && S.replays[s.r]) { delete S.replays[s.r]; Cloud.dirtyRep.add(s.r); } changed(S.cur, i); renderSolve(); App.refreshOpen && App.refreshOpen(); toast('Solve deleted'); }

  // ------------------------------------------------------------------ Solve view
  function timerCtx() {
    return {
      name: 'main', el: () => $('#time'),
      inspection: () => set().inspection && set().input !== 'typing' && set().input !== 'gantimer',
      onDone: onTimerDone,
      onCancel: () => { if (set().input === 'virtual') VC.load(); $('#time').innerHTML = fmtBig(0, 0); },
      hint: st => {
        const h = $('#hint'); const inp = set().input; document.body.classList.toggle('focus', set().focus);
        if (inp === 'typing') { h.innerHTML = 'Type a time and press <span class="kbd">Enter</span>. Add <span class="kbd">+</span> for +2, or type DNF.'; return; }
        if (inp === 'gantimer') { h.innerHTML = App.Smart && App.Smart.kind === 'timer' ? (st === 'running' ? 'Touch the timer to stop' : 'Put your hands on the GAN timer, lift them to start.') : 'Connect your GAN Smart Timer in Settings → Smart cube &amp; timer.'; return; }
        if (inp === 'smart' && !(App.Smart && App.Smart.kind === 'cube')) { h.innerHTML = 'Connect your smart cube in Settings → Smart cube &amp; timer.'; return; }
        if (inp === 'smart' && st === 'idle') { h.innerHTML = 'Do the scramble on your cube. Wrong turns show up in red with the move that undoes them.'; return; }
        const m = {
          idle: inp === 'virtual' ? (set().inspection ? 'Press <span class="kbd">Space</span> to inspect, or start turning. Keys are in Settings → Virtual cube.' : 'Start turning to begin. Keys are in Settings → Virtual cube.') : (set().inspection ? 'Press <span class="kbd">Space</span> to start inspection' : 'Hold <span class="kbd">Space</span> until the time turns green, then release'),
          armInsp: 'Release to start the 15 s inspection', inspect: inp === 'virtual' || inp === 'smart' ? 'Inspecting — your first turn starts the timer' : 'Inspecting — hold <span class="kbd">Space</span> to get ready', inspHold: 'Keep holding…', inspReady: 'Release to start', hold: 'Keep holding…', ready: 'Release to start', running: inp === 'virtual' || inp === 'smart' ? 'Solving — the timer stops when the cube is solved' : 'Any key stops the timer'
        };
        h.innerHTML = m[st] || '';
      }
    };
  }
  function renderSolve() {
    const s = set(), list = solves();
    const inp = s.input, virtualOK = C.EVENT_N[event()] === 3;
    $('#typeIn').hidden = inp !== 'typing';
    const vcOn = (inp === 'virtual' || inp === 'smart') && virtualOK;
    $('#vcube').hidden = !vcOn; $('#timerZone').classList.toggle('vc', vcOn); $('#movepad').hidden = inp !== 'virtual';
    if (App.Ghost) App.Ghost.refresh();
    $('#time').hidden = false;
    if (Timer.state === 'idle') { const last = list[list.length - 1]; $('#time').innerHTML = last ? fmtBig(last.p === -1 ? null : last.t + (last.p || 0), last.p) : fmtBig(0, 0); }
    // chips + penalty buttons
    const last = list[list.length - 1];
    $('#chips').innerHTML = [['ao5', St.aoN(list, 5)], ['ao12', St.aoN(list, 12)], ['best', St.best(list).v], ['mean', St.mean(list)]].map(([k, v]) => `<div class="chip glass"><div class="k">${k}</div><div class="v">${St.fmt(v)}</div></div>`).join('') +
      (last ? `<div class="pen glass" role="group" aria-label="Last solve"><button data-pen="0" class="${!last.p ? 'on' : ''}" title="OK">OK</button><button data-pen="2000" class="${last.p === 2000 ? 'on' : ''}" title="+2 (Alt+2)">+2</button><button data-pen="-1" class="${last.p === -1 ? 'on' : ''}" title="DNF (Alt+D)">DNF</button><button data-del title="Delete (Alt+Z)" aria-label="Delete last solve">${icon('x', 14)}</button></div>` : '') + (list.length ? `<button class="btn sm" id="shareBtn" title="Make a share card">${icon('share', 13)} Share</button>` : '');
    const sb = $('#shareBtn'); if (sb) sb.onclick = () => App.openShareCard && App.openShareCard();
    const pen = $('#chips .pen');
    if (pen) pen.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-del')) deleteSolve(last); else { const p = +b.dataset.pen; last.p = p; changed(S.cur, list.length - 1); renderSolve(); } };
    $('#demoBanner').innerHTML = session().demo ? `<div class="demo-banner glass"><span><b>Demo session</b> · example solves so you can see every feature.</span><button class="btn sm primary" id="startOwn">Start my own session</button></div>` : '';
    const so = $('#startOwn'); if (so) so.onclick = () => { newSession('My solves', event()); };
    // layout
    const L = s.layout, v = $('#v-timer');
    v.classList.toggle('no-left', !L.left.length); v.classList.toggle('no-right', !L.right.length);
    fillCol($('#colL'), L.left); fillCol($('#colR'), L.right); fillCol($('#colU'), L.under);
    drawNets(); VC.draw(); Timer.show(true);
    if (inp === 'smart' && App.Smart) App.Smart.renderGuide();
  }
  function fillCol(el, ids) { el.innerHTML = ids.map(id => `<section class="card glass" data-w="${id}"></section>`).join(''); ids.forEach(id => { const c = el.querySelector(`[data-w="${id}"]`); try { (W[id] || (() => { }))(c); } catch (e) { console.error(e); } }); }

  const W = {
    times(el) {
      const list = solves(), n = list.length, r5 = St.rolling(list, 5), r12 = St.rolling(list, 12), b = St.best(list).at;
      const rows = []; for (let i = n - 1; i >= Math.max(0, n - 200); i--) { const s = list[i]; rows.push(`<tr class="click" data-i="${i}"><td>${i + 1}</td><td class="b ${i === b ? 'pb' : ''}">${St.fmtSolve(s)}${s.r ? ' <span title="Has replay" style="color:var(--accent)">' + icon('play', 10) + '</span>' : ''}</td><td>${St.fmt(r5[i])}</td><td>${St.fmt(r12[i])}</td></tr>`); }
      el.innerHTML = `<div class="card-h"><h3>Recent times</h3><span class="muted mono" style="font-size:12px">${n}</span></div>` + (n ? `<div class="times-scroll"><table class="tbl"><thead><tr><th>#</th><th>Time</th><th>ao5</th><th>ao12</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>` : `<div class="empty">Your solves appear here.</div>`);
      el.onclick = e => { const tr = e.target.closest('tr[data-i]'); if (tr) openSolve(list[+tr.dataset.i]); };
    },
    goals(el) {
      const g = set().goals, list = solves(), sub = list.filter(s => St.val(s) < g.subT * 1000).length, b5 = St.bestRolling(list, 5).v;
      const row = (label, val, pct) => `<div class="goal"><div class="goal-top"><span>${label}</span><span>${val}</span></div><div class="bar"><i style="width:${clamp(pct, 0, 100)}%"></i></div></div>`;
      el.innerHTML = `<div class="card-h"><h3>Session goals</h3><button class="btn sm" id="editGoals">Edit</button></div>` +
        row('Session solves', `${list.length} / ${g.solves}`, list.length / g.solves * 100) +
        row(`Sub-${g.subT} singles`, `${sub} / ${g.subN}`, sub / g.subN * 100) +
        row(`Best ao5 · goal ${g.ao5}s`, St.fmt(b5), b5 ? clamp((g.ao5 * 1000) / b5 * 100, 0, 100) : 0);
      $('#editGoals', el).onclick = editGoals;
    },
    averages(el) {
      const list = solves(); const rows = [5, 12, 25, 50, 100].map(n => `<tr><td>ao${n}</td><td class="b">${St.fmt(St.aoN(list, n))}</td><td>${St.fmt(St.bestRolling(list, n).v)}</td></tr>`).join('');
      el.innerHTML = `<div class="card-h"><h3>Averages</h3></div><table class="tbl"><thead><tr><th></th><th>Current</th><th>Best</th></tr></thead><tbody><tr><td>mo3</td><td class="b">${St.fmt(list.length >= 3 ? St.meanOf(list.slice(-3)) : null)}</td><td>–</td></tr>${rows}</tbody></table>`;
    },
    trend(el) {
      const list = solves(), last = list.slice(-12), a6 = list.length >= 6 ? St.mean(list.slice(-6)) : null, p6 = list.length >= 12 ? St.mean(list.slice(-12, -6)) : null;
      el.innerHTML = `<div class="card-h"><h3>Solve trend · last 12</h3></div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><div><div class="muted">Last 6 average</div><b class="mono">${a6 ? St.fmt(a6) + ' s' : '–'}</b></div><div style="text-align:right"><div class="muted">vs previous 6</div><b class="mono" style="color:${a6 && p6 ? (a6 < p6 ? 'var(--good)' : 'var(--bad)') : 'inherit'}">${a6 && p6 ? (a6 < p6 ? '−' : '+') + St.fmt(Math.abs(a6 - p6)) + ' s' : '–'}</b></div></div><div class="tb"></div><div class="legend" style="justify-content:space-between"><span>Oldest → newest</span><span>Taller = slower</span></div>`;
      requestAnimationFrame(() => barChart($('.tb', el), last.map(St.val), { h: 70, color: (v, i) => i === last.length - 1 ? '#ffffff' : 'var(--accent)' }));
    },
    chart(el) {
      const list = solves(); const key = 'chartN'; const N = App.ui[key] || 50; const win = N === 'all' ? list : list.slice(-N); const off = list.length - win.length;
      el.innerHTML = `<div class="card-h"><h3>Solve times</h3><div class="seg" style="padding:2px">${[50, 100, 500, 'all'].map(n => `<button class="${n === N ? 'on' : ''}" data-n="${n}" style="padding:2px 8px;font-size:12px">${n === 'all' ? 'All' : n}</button>`).join('')}</div></div><div class="cv"></div><div class="legend"><span><i style="background:#c4b5fd"></i>Solve</span><span><i style="background:#5eead4"></i>ao5</span><span><i style="background:#fbbf24"></i>ao12</span></div><div class="stat-grid" style="margin-top:8px;grid-template-columns:repeat(4,1fr)">${[['Best', St.best(win).v], ['Average', St.mean(win)], ['Worst', St.worst(win)]].map(([k, v]) => `<div><div class="eyebrow">${k}</div><b class="mono">${St.fmt(v)}</b></div>`).join('')}<div><div class="eyebrow">Trend (10 vs 10)</div><b class="mono">${(() => { if (list.length < 20) return '–'; const d = St.mean(list.slice(-10)) - St.mean(list.slice(-20, -10)); return (d < 0 ? '▼ faster ' : '▲ slower ') + St.fmt(Math.abs(d)); })()}</b></div></div>`;
      $$('[data-n]', el).forEach(b => b.onclick = () => { App.ui[key] = b.dataset.n === 'all' ? 'all' : +b.dataset.n; W.chart(el); });
      const r5 = St.rolling(list, 5).slice(off), r12 = St.rolling(list, 12).slice(off);
      requestAnimationFrame(() => lineChart($('.cv', el), { h: 130, yfmt: secFmt, series: [{ d: win.map(St.val), c: '#c4b5fd', w: 1.2, dots: win.length <= 60 }, { d: r5, c: '#5eead4', w: 1.6 }, { d: r12, c: '#fbbf24', w: 1.6, end: true }] }));
    },
    last12(el) {
      const list = solves(), last = list.slice(-12), m = last.length ? St.meanOf(last) : null, prev = list.length >= 24 ? St.meanOf(list.slice(-24, -12)) : null;
      el.innerHTML = `<div class="card-h"><h3>Last 12 solves · time per solve</h3></div><div class="cv"></div><div class="legend" style="justify-content:space-between"><span>Mean of 12 <b class="mono" style="color:var(--ink)">${St.fmt(m)}</b></span><span>vs previous 12 ${prev && m && isFinite(m) && isFinite(prev) ? `<b class="mono" style="color:${m < prev ? 'var(--good)' : 'var(--bad)'}">${m < prev ? '▼' : '▲'} ${St.fmt(Math.abs(m - prev))}</b>` : '–'}</span></div>`;
      requestAnimationFrame(() => barChart($('.cv', el), last.map(St.val), { h: 110, top: v => isFinite(v) ? (v / 1000).toFixed(1) : 'DNF', color: (v, i) => `color-mix(in srgb, var(--accent) ${55 + i * 4}%, #ffffff)` }));
    },
    ladder(el) {
      const list = solves(); const b = St.best(list).v || 10000; const top = Math.max(7, Math.floor(b / 1000)); const cuts = []; for (let k = 0; k < 6; k++) cuts.push(top + k * 2);
      const L = St.subLadder(list, cuts);
      el.innerHTML = `<div class="card-h"><h3>Sub-X ladder</h3></div>` + L.map(r => `<div class="ladder-row"><span class="mono">Sub-${r.c}</span><div class="bar"><i style="width:${r.pct}%"></i></div><span>${r.k} · ${r.pct.toFixed(0)}%</span></div>`).join('');
    },
    net(el) { el.innerHTML = `<div class="card-h"><h3>Scramble preview</h3></div><canvas data-net style="width:100%;height:150px"></canvas>`; },
    pbs(el) {
      const list = solves(); const rows = [['Single', St.best(list)], ...[5, 12, 50, 100].map(n => ['ao' + n, St.bestRolling(list, n)])];
      el.innerHTML = `<div class="card-h"><h3>Personal bests</h3></div><table class="tbl"><tbody>${rows.map(([k, r]) => `<tr><td>${k}</td><td class="b">${St.fmt(r.v)}</td><td class="muted">${r.at >= 0 ? '#' + (r.at + 1) : ''}</td></tr>`).join('')}</tbody></table>`;
    },
    missions(el) { App.renderMissionsWidget ? App.renderMissionsWidget(el) : (el.innerHTML = ''); }
  };

  function openSolve(s) {
    const list = solves(), i = list.indexOf(s); const N = C.EVENT_N[event()];
    modal(`<div class="modal-h"><h3>Solve #${i + 1} · <span class="mono">${St.fmtSolve(s)}</span></h3><button class="iconbtn" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="muted" style="font-size:12px">${new Date(s.d).toLocaleString()}</div>
      <div class="row"><div><label>Penalty</label></div><div class="pen glass" id="mPen"><button data-pen="0" class="${!s.p ? 'on' : ''}">OK</button><button data-pen="2000" class="${s.p === 2000 ? 'on' : ''}">+2</button><button data-pen="-1" class="${s.p === -1 ? 'on' : ''}">DNF</button></div></div>
      <div class="row" style="display:block"><label>Scramble</label><div class="scramble big" style="text-align:left;padding:6px 0">${esc(s.s || '—')}</div>${N ? '<canvas data-netm style="width:100%;height:160px"></canvas>' : ''}</div>
      <div class="row" style="display:block"><label for="mCom">Comment</label><input class="field" id="mCom" style="width:100%;margin-top:6px;box-sizing:border-box" value="${esc(s.c || '')}" placeholder="e.g. X-cross, lucky PLL skip"></div>
      <div class="row-actions" style="justify-content:space-between;margin-top:12px"><button class="btn danger" id="mDel">Delete solve</button><div class="row-actions">${s.r && S.replays[s.r] ? `<button class="btn" id="mRep">${icon('play', 12)} Open replay</button>` : ''}<button class="btn" id="mCopy">Copy</button><button class="btn primary" data-close>Done</button></div></div>`,
      m => {
        if (N) C.drawNet($('[data-netm]', m), new C.Cube(N).apply(s.s || ''));
        $('#mPen', m).onclick = e => { const b = e.target.closest('button'); if (!b) return; s.p = +b.dataset.pen; changed(S.cur, i); $$('#mPen button', m).forEach(x => x.classList.toggle('on', x === b)); renderSolve(); };
        $('#mCom', m).onchange = e => { s.c = e.target.value.trim() || undefined; changed(S.cur, i); };
        $('#mDel', m).onclick = () => { closeModal(); deleteSolve(s); };
        $('#mCopy', m).onclick = () => copy(`${St.fmtSolve(s)}   ${s.s || ''}`);
        const r = $('#mRep', m); if (r) r.onclick = () => { closeModal(); App.openReplay(s.r); };
      });
  }
  function copy(text) { try { navigator.clipboard.writeText(text).then(() => toast('Copied'), () => toast('Copy blocked — select the text instead')); } catch (e) { toast('Copy blocked — select the text instead'); } }
  function editGoals() {
    const g = set().goals;
    modal(`<div class="modal-h"><h3>Session goals</h3><button class="iconbtn" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="row"><label for="gS">Solves this session</label><input class="field mono" id="gS" type="number" min="1" value="${g.solves}" style="width:90px"></div>
      <div class="row"><label for="gT">Sub-X target (seconds)</label><input class="field mono" id="gT" type="number" min="1" step="0.5" value="${g.subT}" style="width:90px"></div>
      <div class="row"><label for="gN">How many sub-X singles</label><input class="field mono" id="gN" type="number" min="1" value="${g.subN}" style="width:90px"></div>
      <div class="row"><label for="gA">ao5 goal (seconds)</label><input class="field mono" id="gA" type="number" min="1" step="0.1" value="${g.ao5}" style="width:90px"></div>
      <div class="row-actions" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="gOk">Save goals</button></div>`,
      m => { $('#gOk', m).onclick = () => { g.solves = +$('#gS', m).value || 50; g.subT = +$('#gT', m).value || 10; g.subN = +$('#gN', m).value || 10; g.ao5 = +$('#gA', m).value || 9; Store.saveSoon(); closeModal(); renderSolve(); }; });
  }
  function openArrange() {
    const L = JSON.parse(JSON.stringify(set().layout));
    const opts = sel => Object.entries(WIDGETS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
    const draw = m => {
      const slot = (key, label, max) => `<div class="slot"><div class="slot-h"><span>${label}<div class="muted" style="font-weight:400;font-size:11.5px">${L[key].length} box${L[key].length === 1 ? '' : 'es'}</div></span><span class="stepper"><button data-k="${key}" data-d="-1" aria-label="Fewer">−</button>${L[key].length}<button data-k="${key}" data-d="1" aria-label="More" ${L[key].length >= max ? 'disabled' : ''}>+</button></span></div>${L[key].map((w, i) => `<select class="field" data-k="${key}" data-i="${i}">${opts(w)}</select>`).join('')}</div>`;
      const box = ids => ids.map(id => `<div>${WIDGETS[id]}</div>`).join('');
      $('#arrBody', m).innerHTML = `<div class="arr-prev"><div class="c">${box(L.left)}</div><div class="m"><div class="t">9.17</div>${box(L.under)}</div><div class="c">${box(L.right)}</div></div><div>${slot('left', 'Left side', 4)}${slot('right', 'Right side', 4)}${slot('under', 'Under the timer', 4)}<button class="btn sm" id="onlyTimer">Only the timer</button></div>`;
      $$('.stepper button', m).forEach(b => b.onclick = () => { const k = b.dataset.k, d = +b.dataset.d; if (d < 0) L[k].pop(); else { const used = new Set([...L.left, ...L.right, ...L.under]); const free = Object.keys(WIDGETS).find(w => !used.has(w)) || 'averages'; L[k].push(free); } draw(m); });
      $$('select[data-k]', m).forEach(s => s.onchange = () => { L[s.dataset.k][+s.dataset.i] = s.value; draw(m); });
      $('#onlyTimer', m).onclick = () => { L.left = []; L.right = []; L.under = []; draw(m); };
    };
    modal(`<div class="modal-h"><h3>Arrange your screen</h3><button class="iconbtn" data-close aria-label="Close">${icon('x')}</button></div><p class="muted" style="margin:0">Choose how many boxes go where and what each one shows. The scramble and the time always stay in the middle.</p><div class="arr" id="arrBody"></div><div class="row-actions" style="justify-content:space-between;margin-top:14px"><button class="btn" id="arrReset">Reset to default</button><button class="btn primary" id="arrOk">Done</button></div>`,
      m => { draw(m); $('#arrReset', m).onclick = () => { Object.assign(L, JSON.parse(JSON.stringify(DEFAULTS.layout))); draw(m); }; $('#arrOk', m).onclick = () => { set().layout = L; if (set().mode === 'simple') set().mode = 'full'; Store.saveSoon(); closeModal(); applySettings(); renderSolve(); }; });
  }

  // ------------------------------------------------------------------ sessions
  function fillSelectors() {
    const ev = event();
    $('#selEvent').innerHTML = Object.entries(EVENTS).map(([k, v]) => `<option value="${k}" ${k === ev ? 'selected' : ''}>${v}</option>`).join('');
    $('#selSession').innerHTML = S.sessions.filter(s => s.event === ev).map(s => `<option value="${s.id}" ${s.id === S.cur ? 'selected' : ''}>${esc(s.name)} · ${S.solves[s.id].length}</option>`).join('') + '<option value="__new">+ New session…</option><option value="__manage">Manage sessions…</option>';
  }
  function switchSession(id) { Timer.cancel(); S.cur = id; Scr.hist = []; Scr.idx = -1; newScramble(); fillSelectors(); renderSolve(); Store.saveSoon(); App.refreshOpen && App.refreshOpen(); }
  function newSession(name, ev) { const id = uid(); S.sessions.push({ id, name, event: ev }); S.solves[id] = []; Cloud.profileDirty = true; switchSession(id); toast(`Session “${esc(name)}” created`); }
  function sessionPrompt() {
    modal(`<div class="modal-h"><h3>New session</h3><button class="iconbtn" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="row"><label for="nsName">Name</label><input class="field" id="nsName" value="Session ${S.sessions.length + 1}"></div>
      <div class="row"><label for="nsEv">Event</label><select class="field" id="nsEv">${Object.entries(EVENTS).map(([k, v]) => `<option value="${k}" ${k === event() ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="row-actions" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-close>Cancel</button><button class="btn primary" id="nsOk">Create session</button></div>`,
      m => { $('#nsOk', m).onclick = () => { const n = $('#nsName', m).value.trim() || 'Session'; const e = $('#nsEv', m).value; closeModal(); newSession(n, e); }; });
  }

  // ------------------------------------------------------------------ input handling
  function inputTarget(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  function timingView() { return ['timer', 'comp', 'train', 'play'].includes(App.view); }
  function bindKeys() {
    window.addEventListener('keydown', e => {
      if (modalOpen()) { if (e.key === 'Escape') closeModal(); return; }
      if (inputTarget(e) || !timingView()) return;
      if (App.view === 'comp' && App.compKey && App.compKey(e)) return;
      if (App.keyHooks && App.keyHooks[App.view] && App.keyHooks[App.view](e)) return;
      if (App.view !== 'timer' && !Timer.ctx) return;
      const virtual = App.view === 'timer' && set().input === 'virtual' && C.EVENT_N[event()] === 3;
      if (e.altKey && App.view === 'timer') {
        const list = solves(), last = list[list.length - 1]; const k = e.key.toLowerCase();
        if (k === 'z' && last) { e.preventDefault(); deleteSolve(last); } else if (k === '2' && last) { e.preventDefault(); setPenalty(last, 2000); } else if (k === 'd' && last) { e.preventDefault(); setPenalty(last, -1); } else if (k === 'n') { e.preventDefault(); newScramble(); }
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      if (virtual) {
        if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; if (Timer.state === 'idle' && set().inspection) { VC.load(); Timer.startInspection(); Timer.show(); } else if (Timer.state === 'idle') { VC.load(); } return; }
        if (e.key === 'Escape') { Timer.cancel(); VC.load(); return; }
        const m = C.KEYMAP[e.key.toLowerCase()]; if (m) { e.preventDefault(); VC.turn(m); }
        return;
      }
      if (App.view === 'timer' && (set().input === 'smart' || set().input === 'gantimer')) { if (e.key === 'Escape') Timer.cancel(); return; }
      if (App.view === 'timer' && set().input === 'typing') return;
      if (Timer.state === 'running') { e.preventDefault(); Timer.down(); return; }
      if (e.key === 'Escape') { Timer.cancel(); return; }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) Timer.down(); }
    });
    window.addEventListener('keyup', e => {
      if (modalOpen() || inputTarget(e) || !timingView()) return;
      if (App.view === 'timer' && set().input !== 'timer') return;
      if (e.code === 'Space' || Timer.ignoreUp) { e.preventDefault(); Timer.up(); }
    });
    const zoneDown = e => { if (e.pointerType === 'mouse' || e.target.closest('button,input,canvas,select')) return; e.preventDefault(); Timer.down(); };
    const zoneUp = e => { if (e.pointerType === 'mouse' || e.target.closest('button,input,canvas,select')) return; Timer.up(); };
    $('#timerZone').addEventListener('pointerdown', e => { if (set().input === 'timer') zoneDown(e); });
    $('#timerZone').addEventListener('pointerup', e => { if (set().input === 'timer') zoneUp(e); });
    window.addEventListener('pointerdown', e => { if (Timer.state === 'running' && e.pointerType !== 'mouse' && !(['virtual', 'smart', 'gantimer'].includes(set().input) && App.view === 'timer')) { Timer.down(); } }, true);
  }

  // ------------------------------------------------------------------ routing
  const VIEWS = ['timer', 'analytics', 'replay', 'train', 'coach', 'comp', 'play', 'options'];
  function go(v, sub) {
    if (!VIEWS.includes(v)) v = 'timer';
    if (Timer.state !== 'idle') Timer.cancel();
    App.view = v; App.sub = sub;
    $$('.view').forEach(el => el.hidden = el.dataset.v !== v);
    $$('#tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    const want = v === 'comp' ? set().compBg : set().bg; if (engine && engine.id !== want) engine.set(want);
    if (v === 'timer') { Timer.setCtx(timerCtx()); renderSolve(); }
    else if (App.render[v]) App.render[v](sub);
    const h = '#' + v; if (location.hash !== h) { try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } }
  }

  function fillInputs() {
    const opts = [['timer', 'Timer'], ['typing', 'Typing'], ['virtual', 'Virtual cube']];
    if (App.Smart && App.Smart.supported()) opts.push(['smart', 'Smart cube (GAN)'], ['gantimer', 'GAN smart timer']);
    if (!opts.some(o => o[0] === set().input)) set().input = 'timer';
    $('#selInput').innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); $('#selInput').value = set().input;
  }
  function afterInputChange() {
    Timer.cancel(); Store.saveSoon(); fillInputs();
    if (set().input === 'virtual' && C.EVENT_N[event()] !== 3) toast('The virtual cube works with 3×3 events only');
    if (set().input === 'virtual') VC.load();
    if (set().input === 'smart' && App.Smart && App.Smart.kind === 'cube') App.Smart.newGuide();
    if (App.view !== 'timer') go('timer'); else { renderSolve(); Timer.show(); }
  }

  // ------------------------------------------------------------------ init
  function init() {
    S = loadLocal() || fresh();
    engine = new BG.Engine($('#bg')); engine.P = palette(); engine.quality = set().quality; engine.set(set().bg); engine.start();
    applySettings(); fillSelectors(); initVirtual(); bindKeys();
    newScramble();
    $('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) go(b.dataset.view); };
    $('#btnPrefs').onclick = () => go('options', 'essentials');
    $('#btnStudio').onclick = () => go('options', 'backgrounds');
    $('#btnArrange').onclick = () => { if (App.view !== 'timer') go('timer'); openArrange(); };
    $('#modeSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; set().mode = b.dataset.mode; Store.saveSoon(); applySettings(); if (App.view !== 'timer') go('timer'); else renderSolve(); };
    $('#selEvent').onchange = e => { const ev = e.target.value; const s = S.sessions.find(x => x.event === ev); if (s) switchSession(s.id); else newSession(EVENTS[ev] + ' session', ev); };
    $('#selSession').onchange = e => { const v = e.target.value; if (v === '__new') { fillSelectors(); sessionPrompt(); } else if (v === '__manage') { fillSelectors(); go('options', 'sessions'); } else switchSession(v); };
    fillInputs();
    $('#selInput').onchange = e => {
      const v = e.target.value, sm = App.Smart;
      if ((v === 'smart' && !(sm && sm.kind === 'cube')) || (v === 'gantimer' && !(sm && sm.kind === 'timer'))) { fillInputs(); go('options', 'smart'); toast('Connect your device first'); return; }
      set().input = v; afterInputChange();
    };
    $('#scrPrev').onclick = prevScramble; $('#scrNext').onclick = newScramble;
    $('#scramble').onclick = () => copy(curScramble());
    const typeGo = () => { const r = St.parseTime($('#typeField').value); if (!r) { toast('Type a time like 12.34, 1:05.20 or DNF'); return; } addSolve(r.t, r.p); $('#typeField').value = ''; newScramble(); renderSolve(); $('#typeField').focus(); };
    $('#typeGo').onclick = typeGo; $('#typeField').onkeydown = e => { if (e.key === 'Enter') typeGo(); };
    window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== App.view) go(v); });
    let rT = 0; window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (App.view === 'timer') renderSolve(); else App.render[App.view] && App.render[App.view](App.sub); }, 150); });
    window.addEventListener('pagehide', () => Store.flush());
    document.addEventListener('visibilitychange', () => { if (document.hidden) Store.flush(); });
    go((location.hash || '#timer').slice(1));
    Cloud.init();
  }

  const App = window.SolvoApp = {
    view: 'timer', sub: null, ui: {}, render: {},
    get S() { return S; }, set S(v) { S = v; },
    C, St, BG, $, $$, esc, uid, clamp, EVENTS, WIDGETS, DEFAULTS,
    session, solves, event, set, Store, Cloud, changed, applySettings, palette,
    icon, toast, confetti, modal, closeModal, confirmBox, copy, lineChart, barChart, secFmt,
    Timer, fmtBig, addSolve, deleteSolve, openSolve, renderSolve, newScramble, curScramble,
    fillSelectors, switchSession, newSession, sessionPrompt, go, dragRotate, beep, unpackMoves, packMoves, normalize, makeDemo,
    on, emit, VC, replaceScrambleIfIdle, afterInputChange, fillInputs, keyHooks: {},
    engine: () => engine,
    afterLoad() { applySettings(); fillSelectors(); Scr.hist = []; Scr.idx = -1; newScramble(); go(App.view, App.sub); },
    init
  };
})();
