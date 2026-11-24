/* Solvo Timer — random-state scrambler, metronome, voice callouts, badges, share cards,
   ghost race and GAN smart cube / timer support. */
(function () {
  'use strict';
  const A = window.SolvoApp, { C, St, BG, $, $$, esc, clamp } = A;
  const DAY = 864e5;

  // ================================================================ SCRAMBLER
  const typeOf = ev => ev === '222' ? '222' : (ev === '333' || ev === '333oh' || ev === '333bf') ? '333' : null;
  const Scr = A.Scrambler = { w: null, ready: false, status: 'off', q: { '333': [], '222': [] }, busy: {}, cbs: {}, swapped: false };
  Scr.start = function () {
    if (typeof Worker === 'undefined') { this.status = 'unavailable'; return; }
    try { this.w = new Worker('scramble-worker.js'); } catch (e) { this.status = 'unavailable'; return; }
    this.status = 'warming';
    this.w.onmessage = e => {
      const m = e.data || {};
      if (m.cmd === 'ready') { this.ready = true; this.status = 'ready'; this.fill(typeOf(A.event()) || '333'); this.fill('333'); this.fill('222'); }
      else if (m.cmd === 'list') {
        this.busy[m.type] = false; this.q[m.type].push(...m.list);
        if (!this.swapped && m.type === typeOf(A.event())) { this.swapped = true; A.replaceScrambleIfIdle && A.replaceScrambleIfIdle(); }
        this.fill(m.type);
      } else if (m.cmd === 'seeded') { const cb = this.cbs[m.seed]; delete this.cbs[m.seed]; cb && cb(m.list); }
    };
    this.w.onerror = () => { this.status = 'unavailable'; this.ready = false; Object.keys(this.cbs).forEach(k => { const cb = this.cbs[k]; delete this.cbs[k]; seededMain(k, 5, cb); }); };
    this.w.postMessage({ cmd: 'init' });
  };
  Scr.fill = function (t) { if (!t || !this.ready || this.busy[t] || this.q[t].length >= 4) return; this.busy[t] = true; this.w.postMessage({ cmd: 'gen', type: t, n: 4 - this.q[t].length }); };
  Scr.next = function (ev) {
    const t = typeOf(ev);
    if (t && this.q[t].length) { const s = this.q[t].shift(); this.fill(t); A.lastScrambleKind = 'random-state'; return ev === '333bf' ? s + ' ' + bfOrient() : s; }
    this.fill(t);
    if (t === '222' && window.SolvoSolvers) { A.lastScrambleKind = 'random-state'; return window.SolvoSolvers.scramble222(); }
    A.lastScrambleKind = 'random-move'; return C.genScramble(ev);
  };
  function bfOrient() { const r = a => a[Math.floor(Math.random() * a.length)]; return [r(['', 'Rw', 'Rw2', "Rw'"]), r(['', 'Uw', 'Uw2', "Uw'"])].filter(Boolean).join(' '); }
  function seededMain(seed, n, cb) {
    setTimeout(() => { const T = window.SolvoTwoPhase, rand = window.SolvoSolvers.seeded(seed), out = []; for (let i = 0; i < n; i++) { const st = T.randomState(rand); const sol = T.solve(st, 22, Date.now() + 8000); out.push(sol ? sol.slice().reverse().map(C.invertMove).join(' ') : ''); } cb(out); }, 30);
  }
  // identical random states for everyone who uses the same seed
  Scr.seeded = function (seed, n, cb) {
    if (this.ready) { this.cbs[seed] = cb; this.w.postMessage({ cmd: 'seeded', seed, n }); }
    else if (this.status === 'warming') { const t0 = Date.now(); const wait = () => { if (this.ready) this.seeded(seed, n, cb); else if (this.status !== 'warming' || Date.now() - t0 > 15000) seededMain(seed, n, cb); else setTimeout(wait, 250); }; wait(); }
    else seededMain(seed, n, cb);
  };
  A.nextScramble = ev => Scr.next(ev);

  // ================================================================ METRONOME
  const Metro = A.Metro = {
    ctx: null, on: false, free: false, tps: 4, nextT: 0, beat: 0, iv: 0, accent: 4,
    start(tps, free) {
      try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.tps = tps; this.free = !!free; this.on = true; this.beat = 0; this.nextT = this.ctx.currentTime + 0.05;
      clearInterval(this.iv); this.iv = setInterval(() => this.tick(), 25); this.tick(); return true;
    },
    tick() { if (!this.on) return; const ahead = this.ctx.currentTime + 0.12, step = 1 / this.tps; while (this.nextT < ahead) { this.click(this.nextT, this.accent && this.beat % this.accent === 0); this.nextT += step; this.beat++; } },
    click(t, accent) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'triangle'; o.frequency.value = accent ? 1600 : 1050; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.32 : 0.2, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045); o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.06); },
    stop() { this.on = false; this.free = false; clearInterval(this.iv); }
  };
  A.on('start', () => { if (A.set().metroOn && !Metro.free) Metro.start(A.set().metroTps); });
  A.on('stop', () => { if (!Metro.free) Metro.stop(); });
  A.on('cancel', () => { if (!Metro.free) Metro.stop(); });

  // ================================================================ CALLOUTS
  const SAY = { en: { 8: 'Eight seconds', 12: 'Twelve seconds', 15: 'Plus two', 17: 'D N F' }, vi: { 8: 'Tám giây', 12: 'Mười hai giây', 15: 'Cộng hai', 17: 'D N F' } };
  A.callout = function (sec) {
    const mode = A.set().callout || 'beep';
    if (mode === 'off') return;
    if (mode.startsWith('voice') && window.speechSynthesis && window.SpeechSynthesisUtterance) {
      let lang = mode === 'voice-vi' ? 'vi' : 'en';
      const voices = speechSynthesis.getVoices(); let v = voices.find(x => (x.lang || '').toLowerCase().startsWith(lang));
      if (!v && lang === 'vi') { lang = 'en'; v = voices.find(x => (x.lang || '').toLowerCase().startsWith('en')); }
      const txt = SAY[lang][sec]; if (!txt) return;
      try { const u = new SpeechSynthesisUtterance(txt); u.lang = lang === 'vi' ? 'vi-VN' : 'en-US'; if (v) u.voice = v; u.rate = 1.1; speechSynthesis.cancel(); speechSynthesis.speak(u); return; } catch (e) { /* fall back to beeps */ }
    }
    if (sec === 8) A.beep(880, 0.12); else if (sec === 12) { A.beep(880, 0.12); setTimeout(() => A.beep(1100, 0.15), 160); }
  };
  if (window.speechSynthesis) try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); } catch (e) { }

  // ================================================================ BADGES
  const TIER = { bronze: ['#e3a46b', '#8a4b1f'], silver: ['#e5e7eb', '#6b7280'], gold: ['#fde68a', '#b45309'], platinum: ['#a5f3fc', '#0e7490'] };
  const cnt = (n, goal) => ({ done: n >= goal, p: Math.min(1, n / goal), label: `${Math.min(n, goal).toLocaleString()} / ${goal.toLocaleString()}` });
  const fast = (best, goal) => ({ done: best != null && best < goal * 1000, p: best ? Math.min(1, goal * 1000 / best) : 0, label: best ? `best ${St.fmt(best)}` : 'no 3×3 solves yet' });
  const flag = (b, hint) => ({ done: !!b, p: b ? 1 : 0, label: b ? 'done' : hint || 'not yet' });
  const BADGES = [
    ['first', 'First solve', 'Time your first solve.', 'bronze', '1', c => cnt(c.total, 1)],
    ['s100', 'Century', 'Finish 100 solves.', 'bronze', '100', c => cnt(c.total, 100)],
    ['s1000', 'Thousand club', 'Finish 1,000 solves.', 'silver', '1K', c => cnt(c.total, 1000)],
    ['s5000', 'Machine', 'Finish 5,000 solves.', 'gold', '5K', c => cnt(c.total, 5000)],
    ['sub30', 'Sub-30', 'A 3×3 single under 30 seconds.', 'bronze', '30', c => fast(c.best, 30)],
    ['sub20', 'Sub-20', 'A 3×3 single under 20 seconds.', 'bronze', '20', c => fast(c.best, 20)],
    ['sub15', 'Sub-15', 'A 3×3 single under 15 seconds.', 'silver', '15', c => fast(c.best, 15)],
    ['sub12', 'Sub-12', 'A 3×3 single under 12 seconds.', 'silver', '12', c => fast(c.best, 12)],
    ['sub10', 'Sub-10', 'A 3×3 single under 10 seconds.', 'gold', '10', c => fast(c.best, 10)],
    ['sub8', 'Sub-8', 'A 3×3 single under 8 seconds.', 'platinum', '8', c => fast(c.best, 8)],
    ['a20', 'Steady 20', 'A 3×3 ao5 under 20 seconds.', 'bronze', 'Ø20', c => fast(c.ao5, 20)],
    ['a15', 'Steady 15', 'A 3×3 ao5 under 15 seconds.', 'silver', 'Ø15', c => fast(c.ao5, 15)],
    ['a12', 'Steady 12', 'A 3×3 ao5 under 12 seconds.', 'gold', 'Ø12', c => fast(c.ao5, 12)],
    ['a10', 'Sub-10 average', 'A 3×3 ao5 under 10 seconds.', 'platinum', 'Ø10', c => fast(c.ao5, 10)],
    ['st3', 'Warming up', 'Solve on 3 days in a row.', 'bronze', '3d', c => cnt(c.streakMax, 3)],
    ['st7', 'Week streak', 'Solve on 7 days in a row.', 'silver', '7d', c => cnt(c.streakMax, 7)],
    ['st30', 'Habit', 'Solve on 30 days in a row.', 'gold', '30d', c => cnt(c.streakMax, 30)],
    ['marathon', 'Marathon', '100 solves in one day.', 'silver', '100d', c => cnt(c.maxDay, 100)],
    ['clean', 'Clean run', '50 solves in a row with no +2 or DNF.', 'silver', '✓50', c => cnt(c.cleanRun, 50)],
    ['consistent', 'Metronome hands', 'An ao12 with a spread under 8% of its mean.', 'gold', 'σ', c => flag(c.consistent, 'keep your ao12 tight')],
    ['owl', 'Night owl', 'Solve between midnight and 5 am.', 'bronze', '☾', c => flag(c.owl)],
    ['bird', 'Early bird', 'Solve between 5 and 7 am.', 'bronze', 'AM', c => flag(c.bird)],
    ['palin', 'Palindrome', 'A time that reads the same both ways, like 12.21.', 'bronze', '⇄', c => flag(c.palin)],
    ['lucky', 'Lucky sevens', 'A time ending in .77.', 'bronze', '77', c => flag(c.lucky)],
    ['virtual', 'Digital cuber', '10 virtual-cube solves.', 'bronze', 'VC', c => cnt(c.reps, 10)],
    ['flow', 'Flow state', 'A virtual solve with no stop of half a second or more.', 'gold', '∿', c => flag(c.flow, 'turn without stopping')],
    ['tps6', 'Speed demon', 'A virtual solve at 6 TPS or more.', 'silver', '6t', c => flag(c.tps6)],
    ['pllskip', 'PLL skip', 'Get a PLL skip in a virtual solve.', 'silver', 'P∅', c => flag(c.pllSkip)],
    ['ollskip', 'OLL skip', 'Get an OLL skip in a virtual solve.', 'gold', 'O∅', c => flag(c.ollSkip)],
    ['comp', 'Comp ready', 'Finish a round of 5 in Comp practice.', 'bronze', 'R1', c => cnt(c.comps, 1)],
    ['missions', 'Mission complete', 'Finish all three daily missions in one day.', 'silver', '★', c => cnt(c.missionDays, 1)],
    ['lvl5', 'Level 5', 'Reach coach level 5.', 'silver', 'L5', c => cnt(c.level, 5)],
    ['pll', 'PLL master', 'Train every PLL at least 3 times.', 'gold', 'PLL', c => cnt(c.pllDone, 21)],
    ['oll', 'OLL master', 'Train every OLL at least twice.', 'platinum', 'OLL', c => cnt(c.ollDone, 57)],
    ['cross', 'Cross planner', 'Find the optimal cross 10 times in the Cross trainer.', 'silver', '✚', c => cnt(c.crossOpt, 10)],
    ['card', 'Show-off', 'Make a share card.', 'bronze', '▣', c => cnt(c.cards, 1)],
    ['ghost', 'Ghost buster', 'Beat your ghost in a race.', 'silver', 'GB', c => cnt(c.ghostWins, 1)],
    ['battle', 'Duelist', 'Win a round in a live battle.', 'silver', 'VS', c => cnt(c.battleWins, 1)],
    ['weekly', 'Challenger', 'Submit a weekly challenge.', 'bronze', 'W', c => cnt(c.challenges, 1)],
    ['events', 'Explorer', 'Solve 4 different events.', 'bronze', '4', c => cnt(c.events, 4)],
    ['studio', 'Set designer', 'Try 5 different backgrounds.', 'bronze', '✦', c => cnt(c.bgs, 5)],
  ].map(([id, name, desc, tier, glyph, fn]) => ({ id, name, desc, tier, glyph, fn }));
  A.BADGES = BADGES;
  const anCache = {};
  function badgeCtx() {
    const S = A.S, meta = S.meta || {}, real = S.sessions.filter(s => !s.demo);
    const c = { total: 0, best: null, ao5: null, streakMax: 0, maxDay: 0, cleanRun: 0, consistent: false, owl: false, bird: false, palin: false, lucky: false, reps: 0, flow: false, tps6: false, pllSkip: false, ollSkip: false };
    const days = {}, evs = new Set(); let run = 0;
    for (const se of real) {
      const list = S.solves[se.id]; if (!list.length) continue; evs.add(se.event); c.total += list.length; run = 0;
      for (const s of list) {
        const h = new Date(s.d).getHours(); if (h < 5) c.owl = true; else if (h < 7) c.bird = true;
        const k = St.dayKey(s.d); days[k] = (days[k] || 0) + 1;
        if (s.p) run = 0; else { run++; if (run > c.cleanRun) c.cleanRun = run; }
        if (s.p !== -1) { const f = St.fmt(St.val(s)).replace(/[:.]/g, ''); if (f.length >= 3 && f === f.split('').reverse().join('')) c.palin = true; if (/\.77$/.test(St.fmt(St.val(s)))) c.lucky = true; }
      }
      if (se.event === '333') {
        const b = St.best(list).v; if (b != null && (c.best == null || b < c.best)) c.best = b;
        const a5 = St.bestRolling(list, 5).v; if (a5 != null && (c.ao5 == null || a5 < c.ao5)) c.ao5 = a5;
        if (!c.consistent) { const tail = list.slice(-3000); for (let i = 12; i <= tail.length; i++) { const w = tail.slice(i - 12, i).map(St.val); if (w.some(v => !isFinite(v))) continue; w.sort((x, y) => x - y); const mid = w.slice(1, 11), m = mid.reduce((a, b) => a + b, 0) / 10, sd = Math.sqrt(mid.reduce((a, b) => a + (b - m) ** 2, 0) / 9); if (sd / m < 0.08) { c.consistent = true; break; } } }
      }
    }
    c.events = evs.size; c.maxDay = Math.max(0, ...Object.values(days));
    const dk = Object.keys(days).sort(); let cur = 0, prev = null; for (const k of dk) { const t = new Date(k + 'T12:00:00').getTime(); cur = prev && Math.round((t - prev) / DAY) === 1 ? cur + 1 : 1; prev = t; if (cur > c.streakMax) c.streakMax = cur; }
    const demoReps = new Set(S.sessions.filter(s => s.demo).flatMap(s => S.solves[s.id].map(x => x.r).filter(Boolean)));
    for (const r of Object.values(S.replays)) {
      if (demoReps.has(r.id)) continue; c.reps++;
      const an = anCache[r.id] || (anCache[r.id] = A.analyze(r));
      if (an.dur && an.total / (an.dur / 1000) >= 6) c.tps6 = true;
      if (an.total > 15 && !an.pauses.some(p => p.g >= 500)) c.flow = true;
      if (an.phases) { if (an.phases[3].moves <= 1) c.pllSkip = true; if (an.phases[2].moves <= 1) c.ollSkip = true; }
    }
    const tr = S.train || {};
    c.pllDone = Object.values(tr.pll || {}).filter(x => x.n >= 3).length; c.ollDone = Object.values(tr.oll || {}).filter(x => x.n >= 2).length;
    c.crossOpt = (tr.cross && tr.cross.optimal) || 0;
    c.level = Math.floor((S.coach.xp || 0) / 300) + 1;
    Object.assign(c, { comps: meta.comps || 0, missionDays: meta.missionDays || 0, cards: meta.cards || 0, ghostWins: meta.ghostWins || 0, battleWins: meta.battleWins || 0, challenges: meta.challenges || 0, bgs: (meta.bgs || []).length });
    return c;
  }
  A.badgeStatus = () => { const c = badgeCtx(); return BADGES.map(b => Object.assign({ at: A.S.badges[b.id] || null }, b, b.fn(c))); };
  let bT = 0, firstCheck = true;
  A.checkBadges = function (now) {
    clearTimeout(bT);
    const run = () => {
      const st = A.badgeStatus(), fresh = st.filter(b => b.done && !A.S.badges[b.id]);
      if (!fresh.length) { firstCheck = false; return; }
      fresh.forEach(b => A.S.badges[b.id] = Date.now()); A.Store.saveSoon(); if (!firstCheck) A.sfx('badge');
      if (fresh.length > 2) A.toast(`${A.icon('award')} You unlocked <b>${fresh.length} badges</b> · see them in Coach`, 3800);
      else fresh.forEach((b, i) => setTimeout(() => A.toast(`${A.icon('award')} Badge unlocked · <b>${esc(b.name)}</b>`, 3200), i * 900));
      if (!firstCheck) A.confetti(); firstCheck = false;
      if (A.view === 'coach') A.render.coach();
    };
    if (now) run(); else bT = setTimeout(run, 400);
  };
  A.on('solve', () => A.checkBadges());
  A.medal = function (b, size) {
    const s = size || 56, [hi, lo] = TIER[b.tier], gid = 'g' + b.id + s, on = !!(b.at || b.done);
    const hex = [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i - Math.PI / 2; return `${(50 + 44 * Math.cos(a)).toFixed(1)},${(50 + 44 * Math.sin(a)).toFixed(1)}`; }).join(' ');
    const glyphSize = b.glyph.length > 2 ? 22 : b.glyph.length > 1 ? 28 : 34;
    return `<svg width="${s}" height="${s}" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${on ? hi : '#3a3452'}"/><stop offset="1" stop-color="${on ? lo : '#211c33'}"/></linearGradient></defs><polygon points="${hex}" fill="url(#${gid})" stroke="${on ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.14)'}" stroke-width="3" ${on ? '' : 'stroke-dasharray="6 5"'}/><text x="50" y="${50 + glyphSize * 0.36}" text-anchor="middle" style="font:800 ${glyphSize}px Unbounded,sans-serif;fill:${on ? '#1a1030' : '#6e6690'}">${esc(b.glyph)}</text></svg>`;
  };

  // ================================================================ SHARE CARD
  A.openShareCard = function (preset) {
    const ui = A.ui.card = Object.assign({ kind: 'single', ratio: '9:16', bg: A.set().bg, handle: '' }, A.ui.card || {}, preset || {});
    const kinds = [['single', 'Best single'], ['ao5', 'Best ao5'], ['ao12', 'Best ao12'], ['session', 'Session summary'], ['progress', 'Progress'], ...(preset && preset.kind === 'comp' ? [['comp', 'Comp round']] : [])];
    A.modal(`<div class="modal-h"><h3>Share card</h3><button class="iconbtn" data-close aria-label="Close">${A.icon('x')}</button></div>
      <p class="muted" style="margin:0 0 10px">A ready-to-post image of your stats. Pick a card, then save it or copy it.</p>
      <div class="card-wrap"><div class="card-prev"><img id="cardImg" alt="Share card preview"></div>
        <div style="display:grid;gap:10px;align-content:start">
          <label class="eyebrow" for="cKind">Card</label><select class="field" id="cKind">${kinds.map(([k, l]) => `<option value="${k}" ${k === ui.kind ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <label class="eyebrow" for="cRatio">Size</label><select class="field" id="cRatio"><option value="9:16">Story 9:16 (TikTok, Reels)</option><option value="1:1">Square 1:1 (post)</option></select>
          <label class="eyebrow" for="cBg">Background</label><select class="field" id="cBg">${BG.scenes.map(s => `<option value="${s.id}" ${s.id === ui.bg ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
          <label class="eyebrow" for="cHandle">Your name or handle</label><input class="field" id="cHandle" placeholder="@yourname" maxlength="32" value="${esc(ui.handle)}">
          <div class="row-actions" style="margin-top:6px"><button class="btn primary" id="cSave">Save PNG</button><button class="btn" id="cCopy">Copy image</button></div>
        </div></div>`, m => {
      $('#cRatio', m).value = ui.ratio;
      let canvas = null; const redraw = async () => { canvas = await renderCard(ui); $('#cardImg', m).src = canvas.toDataURL('image/png'); };
      ['cKind', 'cRatio', 'cBg'].forEach(id => $('#' + id, m).onchange = e => { ui[{ cKind: 'kind', cRatio: 'ratio', cBg: 'bg' }[id]] = e.target.value; redraw(); });
      let hT = 0; $('#cHandle', m).oninput = e => { ui.handle = e.target.value; clearTimeout(hT); hT = setTimeout(redraw, 250); };
      const done = () => { A.S.meta.cards = (A.S.meta.cards || 0) + 1; A.Store.saveSoon(); A.checkBadges(); };
      $('#cSave', m).onclick = () => canvas && canvas.toBlob(b => { A.saveFile(`solvo-${ui.kind}-${St.dayKey(Date.now())}.png`, b, 'image/png'); done(); }, 'image/png');
      $('#cCopy', m).onclick = () => canvas && canvas.toBlob(async b => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); A.toast('Image copied'); done(); } catch (e) { A.toast('Copying images is blocked here — use Save PNG'); } }, 'image/png');
      redraw();
    });
  };
  async function renderCard(ui) {
    const W = 1080, H = ui.ratio === '1:1' ? 1080 : 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    try { await Promise.all(['800 200px Unbounded', '700 60px Unbounded', '600 40px Manrope', '700 50px "Geist Mono"'].map(f => document.fonts.load(f))); } catch (e) { }
    const P = A.palette(); BG.paint(ctx, ui.bg, P, W, H, 9);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(8,5,18,0.25)'); g.addColorStop(0.55, 'rgba(8,5,18,0.45)'); g.addColorStop(1, 'rgba(8,5,18,0.82)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const accent = A.set().accent, list = A.solves(), sq = H === W, pad = 80;
    const glass = (x, y, w, h, r) => { ctx.fillStyle = 'rgba(14,9,30,0.55)'; C.roundRect(ctx, x, y, w, h, r || 36); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; ctx.stroke(); };
    const text = (t, x, y, font, color, align) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.fillText(t, x, y); };
    // header
    ctx.fillStyle = accent; C.roundRect(ctx, pad, pad, 72, 72, 18); ctx.fill();
    ctx.fillStyle = '#160e2e'; for (let i = 0; i < 9; i++) { if (i === 4) continue; ctx.fillRect(pad + 14 + (i % 3) * 16, pad + 14 + Math.floor(i / 3) * 16, 12, 12); }
    text('SOLVO TIMER', pad + 96, pad + 48, '700 34px Unbounded, sans-serif', '#ffffff');
    text(A.EVENTS[A.event()], W - pad, pad + 48, '600 34px Manrope, sans-serif', 'rgba(255,255,255,0.75)', 'right');
    const big = (label, value, sub) => {
      const y0 = sq ? 300 : 560;
      text(label.toUpperCase(), W / 2, y0, '700 40px Manrope, sans-serif', accent, 'center');
      let fs = sq ? 250 : 300; ctx.font = `800 ${fs}px Unbounded, sans-serif`; while (fs > 60 && ctx.measureText(value).width > W - pad * 2) { fs -= 10; ctx.font = `800 ${fs}px Unbounded, sans-serif`; }
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; text(value, W / 2, y0 + (sq ? 230 : 290), `800 ${fs}px Unbounded, sans-serif`, '#ffffff', 'center'); ctx.restore();
      if (sub) text(sub, W / 2, y0 + (sq ? 300 : 380), '600 38px Manrope, sans-serif', 'rgba(255,255,255,0.75)', 'center');
    };
    const tiles = (items, y) => { const w = (W - pad * 2 - 40) / 3; items.forEach(([k, v], i) => { const x = pad + i * (w + 20); glass(x, y, w, 170, 30); text(k.toUpperCase(), x + w / 2, y + 60, '700 28px Manrope, sans-serif', 'rgba(255,255,255,0.6)', 'center'); text(v, x + w / 2, y + 128, '700 54px "Geist Mono", monospace', '#fde68a', 'center'); }); };
    const chart = (vals, x, y, w, h, color) => {
      const v = vals.filter(a => a != null && isFinite(a)); if (v.length < 2) return; let lo = Math.min(...v), hi = Math.max(...v); if (hi - lo < 1) { hi += 500; lo -= 500; }
      ctx.beginPath(); let pen = false; vals.forEach((a, i) => { if (a == null || !isFinite(a)) { pen = false; return; } const px = x + i / (vals.length - 1) * w, py = y + (hi - a) / (hi - lo) * h; pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py); pen = true; });
      ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
      text(St.fmt(hi), x, y - 14, '600 26px "Geist Mono", monospace', 'rgba(255,255,255,0.55)'); text(St.fmt(lo), x, y + h + 40, '600 26px "Geist Mono", monospace', 'rgba(255,255,255,0.55)');
    };
    const date = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    const tileY = sq ? 680 : 1080;
    if (ui.kind === 'single' || ui.kind === 'ao5' || ui.kind === 'ao12') {
      const r = ui.kind === 'single' ? St.best(list) : St.bestRolling(list, ui.kind === 'ao5' ? 5 : 12);
      big(ui.kind === 'single' ? 'Personal best · single' : `Personal best · ${ui.kind}`, St.fmt(r.v), r.at >= 0 ? date(list[r.at].d) : 'Solve more to set a PB');
      tiles(ui.kind === 'single' ? [['ao5', St.fmt(St.bestRolling(list, 5).v)], ['ao12', St.fmt(St.bestRolling(list, 12).v)], ['solves', list.length.toLocaleString()]] : [['single', St.fmt(St.best(list).v)], [ui.kind === 'ao5' ? 'ao12' : 'ao5', St.fmt(St.bestRolling(list, ui.kind === 'ao5' ? 12 : 5).v)], ['solves', list.length.toLocaleString()]], tileY);
      if (!sq) { glass(pad, 1300, W - pad * 2, 380); text('LAST 50 SOLVES', pad + 40, 1360, '700 28px Manrope, sans-serif', 'rgba(255,255,255,0.6)'); chart(list.slice(-50).map(St.val), pad + 50, 1420, W - pad * 2 - 100, 200, accent); }
    } else if (ui.kind === 'session' || ui.kind === 'comp') {
      if (ui.kind === 'comp' && ui.comp) {
        big(`Comp practice · round ${ui.comp.round}`, St.fmt(ui.comp.avg), 'Average of 5');
        const y = sq ? 640 : 1040; glass(pad, y, W - pad * 2, sq ? 330 : 420);
        ui.comp.times.forEach((t, i) => text(`${i + 1}.  ${t}`, pad + 60, y + 80 + i * (sq ? 50 : 66), '700 44px "Geist Mono", monospace', '#ffffff'));
      } else {
        big(A.session().name, list.length.toLocaleString() + ' solves', `mean ${St.fmt(St.mean(list))}`);
        tiles([['best', St.fmt(St.best(list).v)], ['ao5', St.fmt(St.aoN(list, 5))], ['ao12', St.fmt(St.aoN(list, 12))]], tileY);
        if (!sq) { glass(pad, 1300, W - pad * 2, 380); text('SOLVE TIMES', pad + 40, 1360, '700 28px Manrope, sans-serif', 'rgba(255,255,255,0.6)'); chart(list.slice(-100).map(St.val), pad + 50, 1420, W - pad * 2 - 100, 200, accent); }
      }
    } else if (ui.kind === 'progress') {
      const n = list.length >= 100 ? 100 : 12, roll = St.rolling(list, n), vals = roll.filter(v => v != null && isFinite(v));
      const first = vals[0], last = vals[vals.length - 1], days = list.length ? Math.max(1, Math.round((list[list.length - 1].d - list[0].d) / DAY)) : 0;
      big(`My ao${n} progress`, first && last ? `${St.fmt(first)} → ${St.fmt(last)}` : '–', `${list.length.toLocaleString()} solves in ${days} days`);
      const step = Math.max(1, Math.floor(roll.length / 300)); const pts = roll.filter((_, i) => i % step === 0);
      glass(pad, sq ? 650 : 1060, W - pad * 2, sq ? 330 : 620); chart(pts, pad + 50, (sq ? 650 : 1060) + 80, W - pad * 2 - 100, sq ? 180 : 440, accent);
    }
    // footer
    const fy = H - pad;
    if (ui.handle) text(ui.handle, pad, fy, '700 40px Manrope, sans-serif', '#ffffff');
    text(date(Date.now()), W - pad, fy, '600 32px Manrope, sans-serif', 'rgba(255,255,255,0.6)', 'right');
    return cv;
  }

  // ================================================================ GHOST RACE
  const Ghost = A.Ghost = { rep: null, an: null, cube: null, k: 0, raf: 0, view: { yaw: -0.62, pitch: 0.52 }, me: null };
  function ghostReplay() {
    const src = A.set().ghostSrc, S = A.S;
    const demo = new Set(S.sessions.filter(s => s.demo).flatMap(s => S.solves[s.id].map(x => x.r).filter(Boolean)));
    let reps = Object.values(S.replays).filter(r => (r.ev || '333') !== '222');
    const realReps = reps.filter(r => !demo.has(r.id)); if (realReps.length) reps = realReps;
    if (!reps.length) return null;
    if (src && src !== 'pb' && src !== 'last' && S.replays[src]) return S.replays[src];
    return src === 'last' ? reps.slice().sort((a, b) => (b.d || 0) - (a.d || 0))[0] : reps.slice().sort((a, b) => a.t - b.t)[0];
  }
  Ghost.refresh = function () {
    const on = A.set().ghost && A.set().input !== 'typing', wrap = $('#ghost'), sel = $('#ghSel'); if (!wrap || !sel) return;
    const rep = on ? ghostReplay() : null;
    const src = A.set().ghostSrc, special = src && src !== 'pb' && src !== 'last' && A.S.replays[src];
    sel.innerHTML = `<option value="off">Ghost off</option><option value="pb">Race my best replay</option><option value="last">Race my last replay</option>${special ? `<option value="${esc(src)}">Race the ${St.fmt(A.S.replays[src].t)} solve</option>` : ''}`;
    sel.value = A.set().ghost ? (special ? src : (src === 'last' ? 'last' : 'pb')) : 'off';
    const changedRep = !rep || !this.rep || rep.id !== this.rep.id;
    wrap.hidden = !rep; this.rep = rep; this.an = rep ? A.analyze(rep) : null;
    if (rep && (changedRep || !this.finished)) { $('#ghLabel').innerHTML = `Ghost · <b class="mono">${St.fmt(rep.t)}</b>`; this.cube = new C.Cube(3).apply(rep.scr); this.k = 0; this.finished = false; }
    if (rep) this.draw();
    if (!rep || changedRep) { $('#splits').innerHTML = ''; }
  };
  Ghost.draw = function (anim) { const c = $('#ghCanvas'); if (c && this.cube && !$('#ghost').hidden) C.draw3D(c, this.cube, this.view, anim); };
  Ghost.start = function () {
    if (!this.rep || A.set().input === 'typing') return;
    this.cube = new C.Cube(3).apply(this.rep.scr); this.k = 0; this.finished = false; this.me = { base: null, marks: {} }; $('#splits').innerHTML = '';
    cancelAnimationFrame(this.raf);
    const mv = this.rep.mv, loop = () => {
      if (A.Timer.state !== 'running') return;
      const el = performance.now() - A.Timer.t0;
      let K = this.k; while (K < mv.length && mv[K][1] <= el) K++;
      let an = null; if (K > 0 && !C.reducedMotion()) { const ms = mv[K - 1][1], nx = K < mv.length ? mv[K][1] : Infinity, d = Math.min(110, Math.max(28, (nx - ms) * 0.9)), f = (el - ms) / d; if (f < 1) an = { i: K - 1, f: Math.max(0, f) }; }
      const tgt = an ? K - 1 : K; while (this.k < tgt) { this.cube.move(mv[this.k][0]); this.k++; }
      this.draw(an ? { p: this.cube.parse(mv[an.i][0]), f: C.easeOut(an.f) } : undefined);
      const ph = this.an.phases ? this.an.phases.find(p => el <= p.t1) : null;
      $('#ghLabel').innerHTML = this.k >= mv.length ? `Ghost finished · <b class="mono">${St.fmt(this.rep.t)}</b>` : `Ghost · ${ph ? ph.name : 'solving'}`;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  };
  // live splits from the player's virtual cube
  Ghost.onMove = function (cube, el) {
    if (!this.rep || !this.me || !this.an || !this.an.phases) return;
    const p = cube.phaseInfo(), me = this.me;
    if (!me.base && p.cross.length) { me.base = p.cross.includes('0,-1,0') ? '0,-1,0' : p.cross[0]; me.marks.Cross = el; }
    if (me.base && !me.marks.F2L && p.f2l.includes(me.base)) me.marks.F2L = el;
    if (me.marks.F2L && !me.marks.OLL && p.oll.includes(me.base)) me.marks.OLL = el;
    const names = ['Cross', 'F2L', 'OLL'];
    $('#splits').innerHTML = names.filter(n => me.marks[n] != null).map(n => { const g = this.an.phases.find(x => x.name === n).t1, d = me.marks[n] - g; return `<span class="split ${d <= 0 ? 'good' : 'bad'}">${n} <b class="mono">${St.fmt(me.marks[n])}</b> <i class="mono">${d <= 0 ? '−' : '+'}${St.fmt(Math.abs(d))}</i></span>`; }).join('');
  };
  Ghost.finish = function (t) {
    if (!this.rep) return; cancelAnimationFrame(this.raf); this.finished = true;
    const d = t - this.rep.t;
    if (d < 0) { A.toast(`${A.icon('ghost')} You beat your ghost by <b>${St.fmt(-d)}</b>`, 3500); A.S.meta.ghostWins = (A.S.meta.ghostWins || 0) + 1; A.Store.saveSoon(); A.checkBadges(); }
    else A.toast(`${A.icon('ghost')} Your ghost won by <b>${St.fmt(d)}</b>`, 3000);
    // let the ghost finish its solve on screen
    while (this.k < this.rep.mv.length) { this.cube.move(this.rep.mv[this.k][0]); this.k++; } this.draw();
  };
  document.addEventListener('change', e => { if (e.target && e.target.id === 'ghSel') { const v = e.target.value, st = A.set(); if (v === 'off') st.ghost = false; else { st.ghost = true; st.ghostSrc = v; } A.Store.saveSoon(); e.target.blur(); Ghost.refresh(); } });
  A.on('start', name => { if (name === 'main' && A.set().ghost && (A.set().input === 'virtual' || A.set().input === 'smart')) Ghost.start(); });
  A.on('vmove', (m, el, cube) => Ghost.onMove(cube, el));
  A.on('stop', (t, pen, name) => { if (name === 'main' && A.set().ghost && (A.set().input === 'virtual' || A.set().input === 'smart') && Ghost.rep && pen !== -1) Ghost.finish(t + (pen || 0)); });

  // ================================================================ SMART CUBE / TIMER (GAN, Web Bluetooth)
  const LIB = 'https://cdn.jsdelivr.net/npm/gan-web-bluetooth@3.0.2/+esm';
  const FPOS = { U: (r, c) => [-2 + 2 * c, 2, -2 + 2 * r], R: (r, c) => [2, 2 - 2 * r, 2 - 2 * c], F: (r, c) => [-2 + 2 * c, 2 - 2 * r, 2], D: (r, c) => [-2 + 2 * c, -2, 2 - 2 * r], L: (r, c) => [-2, 2 - 2 * r, -2 + 2 * c], B: (r, c) => [2 - 2 * c, 2 - 2 * r, -2] };
  const FN = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
  const LETTER_COL = { U: 0, D: 1, F: 2, B: 3, R: 4, L: 5 };
  function cubeFromFacelets(str) {
    const cube = new C.Cube(3); let i = 0;
    for (const f of 'URFDLB') for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const p = FPOS[f](r, c), n = FN[f], s = cube.st.find(x => x.p[0] === p[0] && x.p[1] === p[1] && x.p[2] === p[2] && x.n[0] === n[0] && x.n[1] === n[1] && x.n[2] === n[2]);
      s.c = LETTER_COL[str[i++]];
    }
    return cube;
  }
  A.cubeFromFacelets = cubeFromFacelets;
  const sameState = (a, b) => { const k = s => s.p.join() + '|' + s.n.join(); const m = {}; a.st.forEach(s => m[k(s)] = s.c); return b.st.every(s => m[k(s)] === s.c); };
  const Smart = A.Smart = { lib: null, conn: null, sub: null, kind: null, name: '', battery: null, synced: false, phase: 'idle', guide: null, error: '' };
  Smart.supported = () => !!(navigator.bluetooth && !window.claude && window.isSecureContext);
  Smart.why = () => window.claude ? 'Bluetooth is blocked inside Claude. Open the standalone Solvo website in Chrome or Edge.' : !window.isSecureContext ? 'Bluetooth needs the site to be served over https.' : !navigator.bluetooth ? 'This browser has no Web Bluetooth. Use Chrome or Edge on a computer or Android phone.' : '';
  Smart.load = async function () { if (!this.lib) this.lib = await import(LIB); return this.lib; };
  function askMac() {
    return new Promise(resolve => {
      A.modal(`<div class="modal-h"><h3>Cube MAC address</h3></div><p class="muted">Your browser could not read the cube's address automatically. It looks like <span class="mono">AB:12:CD:34:EF:56</span>. You can find it in the GAN app or in csTimer's Bluetooth settings.</p><input class="field mono" id="macIn" placeholder="AB:12:CD:34:EF:56" style="width:100%;box-sizing:border-box"><div class="row-actions" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="macNo">Cancel</button><button class="btn primary" id="macOk">Connect</button></div>`, m => {
        $('#macOk', m).onclick = () => { const v = $('#macIn', m).value.trim().toUpperCase(); if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(v)) { A.toast('Use the format AB:12:CD:34:EF:56'); return; } A.closeModal(); resolve(v); };
        $('#macNo', m).onclick = () => { A.closeModal(); resolve(null); };
      });
    });
  }
  Smart.connectCube = async function () {
    if (!this.supported()) { A.toast(this.why()); return; }
    try {
      const lib = await this.load();
      const conn = await lib.connectGanCube(async (device, fallback) => fallback ? askMac() : null);
      this.disconnect(true); this.conn = conn; this.kind = 'cube'; this.name = conn.deviceName || 'GAN cube'; this.synced = false; this.error = '';
      this.sub = conn.events$.subscribe(ev => this.onEvent(ev));
      await conn.sendCubeCommand({ type: 'REQUEST_HARDWARE' }); await conn.sendCubeCommand({ type: 'REQUEST_FACELETS' }); await conn.sendCubeCommand({ type: 'REQUEST_BATTERY' });
      A.set().input = 'smart'; A.Store.saveSoon(); A.toast(`Connected to <b>${esc(this.name)}</b>`); A.afterInputChange && A.afterInputChange();
    } catch (e) { this.error = (e && e.message) || String(e); if (!/cancel/i.test(this.error)) A.toast('Could not connect: ' + esc(this.error)); }
    A.refreshOpen && A.refreshOpen();
  };
  Smart.connectTimer = async function () {
    if (!this.supported()) { A.toast(this.why()); return; }
    try {
      const lib = await this.load(); const conn = await lib.connectGanTimer();
      this.disconnect(true); this.conn = conn; this.kind = 'timer'; this.name = 'GAN Smart Timer'; this.error = '';
      const S = lib.GanTimerState;
      this.sub = conn.events$.subscribe(ev => {
        const el = $('#time');
        if (ev.state === S.HANDS_ON) { el && el.classList.add('hold'); }
        else if (ev.state === S.GET_SET) { if (el) { el.classList.remove('hold'); el.classList.add('ready'); } }
        else if (ev.state === S.HANDS_OFF || ev.state === S.IDLE) { el && el.classList.remove('hold', 'ready'); }
        else if (ev.state === S.RUNNING) A.Timer.externalStart();
        else if (ev.state === S.STOPPED && ev.recordedTime) A.Timer.externalStop(ev.recordedTime.asTimestamp);
        else if (ev.state === S.DISCONNECT) { this.cleanup(); A.toast('Smart timer disconnected'); }
      });
      A.set().input = 'gantimer'; A.Store.saveSoon(); A.toast('Connected to the GAN Smart Timer'); A.afterInputChange && A.afterInputChange();
    } catch (e) { this.error = (e && e.message) || String(e); if (!/cancel/i.test(this.error)) A.toast('Could not connect: ' + esc(this.error)); }
    A.refreshOpen && A.refreshOpen();
  };
  Smart.cleanup = function () { try { this.sub && this.sub.unsubscribe(); } catch (e) { } this.sub = null; this.conn = null; this.kind = null; this.battery = null; this.synced = false; A.refreshOpen && A.refreshOpen(); };
  Smart.disconnect = function (silent) { const c = this.conn; this.cleanup(); if (c) { try { c.disconnect(); } catch (e) { } if (!silent) A.toast('Disconnected'); } };
  Smart.markSolved = async function () { if (this.kind !== 'cube' || !this.conn) return; try { await this.conn.sendCubeCommand({ type: 'REQUEST_RESET' }); } catch (e) { } A.VC.setCube(new C.Cube(3)); this.newGuide(); A.toast('Cube marked as solved'); };
  Smart.onEvent = function (ev) {
    if (ev.type === 'MOVE') this.onMove(ev.move);
    else if (ev.type === 'FACELETS' && !this.synced) { this.synced = true; A.VC.setCube(cubeFromFacelets(ev.facelets)); A.VC.moves = []; this.newGuide(); }
    else if (ev.type === 'BATTERY') { this.battery = ev.batteryLevel; A.view === 'options' && A.refreshOpen(); }
    else if (ev.type === 'DISCONNECT') { this.cleanup(); A.toast('Smart cube disconnected'); }
  };
  // scramble guide: tracks progress through the scramble and asks the solver to undo wrong turns
  Smart.newGuide = function () {
    if (this.kind !== 'cube') return;
    const moves = C.tokenize(A.curScramble()).filter(m => /^[URFDLB]['2]?$/.test(m));
    this.guide = { moves, idx: 0, partial: 0, fixes: [] }; this.phase = A.VC.cube && A.VC.cube.isSolved() ? 'scrambling' : 'unsolved';
    this.renderGuide();
  };
  const qt = m => m.endsWith('2') ? 2 : m.endsWith("'") ? 3 : 1;
  Smart.onMove = function (m) {
    if (A.set().input !== 'smart' || A.view !== 'timer') { if (A.VC.cube) { A.VC.cube.move(m); A.VC.show(m); } return; }
    if (A.Timer.state === 'running' || this.phase === 'ready' || this.phase === 'inspect') { this.phase = 'solving'; A.VC.turn(m); return; }
    A.VC.cube.move(m); A.VC.show(m);
    if (this.phase === 'unsolved') { if (A.VC.cube.isSolved()) this.newGuide(); else this.renderGuide(); return; }
    const g = this.guide; if (!g) return;
    if (g.fixes.length) { const top = g.fixes[g.fixes.length - 1]; if (m === C.invertMove(top) || (top[0] === m[0] && (qt(top) + qt(m)) % 4 === 0)) g.fixes.pop(); else g.fixes.push(m); }
    else if (g.idx < g.moves.length) {
      const e = g.moves[g.idx];
      if (m[0] === e[0]) { g.partial = (g.partial + qt(m)) % 4; if (g.partial === qt(e)) { g.idx++; g.partial = 0; } }
      else if (g.partial) g.fixes.push(m); else g.fixes.push(m);
    } else g.fixes.push(m);
    const target = new C.Cube(3).apply(A.curScramble());
    if (sameState(A.VC.cube, target)) { this.phase = 'ready'; g.idx = g.moves.length; g.fixes = []; A.VC.moves = []; if (A.set().inspection) { this.phase = 'inspect'; A.Timer.startInspection(); A.Timer.show(); } }
    this.renderGuide();
  };
  Smart.renderGuide = function () {
    const el = $('#scramble'); if (!el || A.set().input !== 'smart' || this.kind !== 'cube') return;
    const g = this.guide, h = $('#hint');
    if (this.phase === 'unsolved') { el.innerHTML = `<span class="muted">Solve your cube first, or press “Mark as solved” in Settings → Smart cube.</span>`; return; }
    if (!g) return;
    if (this.phase === 'ready' || this.phase === 'inspect' || this.phase === 'solving') { el.innerHTML = g.moves.map(m => `<span class="gd">${m}</span>`).join(' '); if (h) h.innerHTML = this.phase === 'ready' ? 'Scrambled. Your first turn starts the timer.' : h.innerHTML; return; }
    if (g.fixes.length) { el.innerHTML = `<span class="gfix">Undo ${esc(C.invertMove(g.fixes[g.fixes.length - 1]))}</span> ` + g.moves.slice(g.idx).map(m => `<span class="gt">${m}</span>`).join(' '); return; }
    el.innerHTML = g.moves.map((m, i) => { if (i < g.idx) return `<span class="gd">${m}</span>`; if (i === g.idx) { const rem = (qt(m) - g.partial + 4) % 4; const lab = m[0] + ({ 1: '', 2: '2', 3: "'" }[rem] || ''); return `<span class="gc">${g.partial ? lab : m}</span>`; } return `<span class="gt">${m}</span>`; }).join(' ');
  };
  A.on('scramble', () => { if (A.set().input === 'smart' && Smart.kind === 'cube') Smart.newGuide(); });
  A.on('stop', (t, pen, name) => { if (name === 'main' && Smart.kind === 'cube') Smart.phase = 'idle'; });

  // ================================================================ PWA install (standalone site)
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); A.installPrompt = e; });
  A.install = async () => { const p = A.installPrompt; if (!p) return; p.prompt(); try { await p.userChoice; } catch (e) { } A.installPrompt = null; A.refreshOpen && A.refreshOpen(); };

  Scr.start();
  setTimeout(() => A.checkBadges(true), 3000);
  const _afterLoad = A.afterLoad; A.afterLoad = function () { _afterLoad.apply(A, arguments); setTimeout(() => A.checkBadges(true), 500); };
})();
