/* Solvo Timer — Play view: weekly challenge (shared leaderboard) and live 1v1 battles. */
(function () {
  'use strict';
  const A = window.SolvoApp, { C, St, $, $$, esc, clamp } = A;

  function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return `${y}-W${String(w).padStart(2, '0')}`; }
  function weekEnd() { const d = new Date(); const day = d.getDay() || 7; const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - day), 23, 59, 59); return end; }
  const P = A.ui.play = A.ui.play || {};

  A.render.play = function (sub) {
    P.tab = sub === 'battle' || sub === 'weekly' ? sub : (P.tab || 'weekly');
    const el = $('#v-play');
    el.innerHTML = `<div class="panel" style="max-width:1200px"><div class="panel-h"><div><h2>Play</h2><p>The same five scrambles for everyone each week, and live races with friends.</p></div>
      <div class="seg" id="plTabs"><button data-t="weekly">Weekly challenge</button><button data-t="battle">1v1 battle</button></div></div><div id="plBody"></div></div>`;
    $$('#plTabs button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.t === P.tab)); b.onclick = () => { A.Timer.cancel(); A.render.play(b.dataset.t); }; });
    if (P.tab === 'battle') renderBattle(); else renderWeekly();
  };

  // ============================================================ WEEKLY
  const W = { week: null, scr: null, loading: false, unsub: null, rows: [], live: 'idle' };
  function weekState() { const wk = isoWeek(new Date()); const m = A.S.meta; m.weekly = m.weekly || {}; return m.weekly[wk] || (m.weekly[wk] = { res: [], submitted: false }); }
  function loadScrambles() {
    const wk = isoWeek(new Date()); if (W.week === wk && (W.scr || W.loading)) return; W.week = wk; W.loading = true; W.scr = null;
    A.Scrambler.seeded('solvo-weekly-333-' + wk, 5, list => { W.loading = false; W.scr = list.map((s, i) => s || A.C.genScramble('333')); if (A.view === 'play' && P.tab === 'weekly') renderWeekly(); });
  }
  function subscribeBoard() {
    if (W.unsub || !A.Cloud.db) return;
    W.live = 'loading'; const timer = setTimeout(() => { if (W.live === 'loading') { W.live = 'slow'; if (A.view === 'play' && P.tab === 'weekly') renderBoard(); } }, 10000);
    W.unsub = A.Cloud.db.collection('challenge').limit(500).onSnapshot(snap => { clearTimeout(timer); W.live = 'ok'; W.rows = snap.docs.map(d => ({ id: d.id, data: d.data() })); if (A.view === 'play' && P.tab === 'weekly') renderBoard(); }, err => { clearTimeout(timer); W.live = 'error'; W.err = err && err.code; W.unsub = null; if (A.view === 'play' && P.tab === 'weekly') renderBoard(); });
  }
  function renderWeekly() {
    loadScrambles(); subscribeBoard();
    const ws = weekState(), i = ws.res.length, done = i >= 5, wk = isoWeek(new Date());
    const body = $('#plBody'); const end = weekEnd(); const hoursLeft = Math.max(0, Math.round((end - Date.now()) / 36e5));
    body.innerHTML = `<div class="grid2">
      <section class="glass comp-stage" style="min-height:420px">
        <div class="eyebrow">Weekly challenge · ${wk} · 3×3</div>
        <div class="muted" style="font-size:12.5px">Ends in ${hoursLeft >= 48 ? Math.round(hoursLeft / 24) + ' days' : hoursLeft + ' hours'} · one try per week · average of 5</div>
        ${done ? `<div class="attempt">Your result</div><div class="time" style="font-size:clamp(48px,7vw,90px)">${St.fmt(St.avgOf(ws.res))}</div><div class="muted">best ${St.fmt(St.best(ws.res).v)} · ${ws.res.map(St.fmtSolve).join(' · ')}</div><div class="muted" style="font-size:12px">${ws.submitted ? 'Submitted to the leaderboard.' : A.Cloud.db ? 'Saving to the leaderboard…' : 'Saved in this browser. The shared leaderboard works in the Claude version.'}</div><button class="btn" id="wkCard">Make a share card</button>`
        : !W.scr ? `<div class="empty" style="padding:60px 0">Preparing this week's scrambles…</div>`
          : `<div class="attempt">Attempt ${i + 1} of 5</div><div class="scramble" style="max-width:620px">${A.scrHTML(W.scr[i])}</div><div class="time mono" id="wkTime">0.00</div><div class="hint" id="wkHint"></div>
             <div class="muted" style="font-size:12px">${ws.res.length ? 'So far: ' + ws.res.map(St.fmtSolve).join(' · ') : 'Everyone gets these exact cube states this week.'}</div>`}
      </section>
      <section class="card glass"><div class="card-h"><h3>Leaderboard · ${wk}</h3><span class="muted" id="wkLive" style="font-size:12px"></span></div><div id="wkBoard"></div></section></div>`;
    const card = $('#wkCard'); if (card) card.onclick = () => A.openShareCard({ kind: 'comp', comp: { round: 'weekly ' + wk, avg: St.avgOf(ws.res), times: ws.res.map(St.fmtSolve) } });
    renderBoard();
    if (!done && W.scr) {
      A.Timer.setCtx({ name: 'weekly', el: () => $('#wkTime'), inspection: () => A.set().inspection, onDone: (t, p) => setTimeout(() => recordWeekly(t, p), 600), hint: s => { const h = $('#wkHint'); if (h) h.innerHTML = { idle: A.set().inspection ? 'Press <span class="kbd">Space</span> to start inspection' : 'Hold <span class="kbd">Space</span>, release to start', armInsp: 'Release to start the 15 s inspection', inspect: 'Inspecting — hold <span class="kbd">Space</span> when ready', inspHold: 'Keep holding…', inspReady: 'Release to start', hold: 'Keep holding…', ready: 'Release to start', running: 'Any key stops the timer' }[s] || ''; } });
      const stg = $('.comp-stage', body); stg.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && !e.target.closest('button,select,input')) { e.preventDefault(); A.Timer.down(); } }); stg.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse' && !e.target.closest('button,select,input')) A.Timer.up(); });
    } else A.Timer.setCtx(null);
    if (done && !ws.submitted) submitWeekly();
  }
  function recordWeekly(t, p) {
    const ws = weekState(); if (ws.res.length >= 5) return;
    ws.res.push({ id: A.uid(), t: Math.round(t), p: p || 0, d: Date.now(), s: W.scr[ws.res.length], c: 'Weekly ' + isoWeek(new Date()) }); A.Store.saveSoon();
    if (ws.res.length >= 5) { A.toast(`Weekly average: <b>${St.fmt(St.avgOf(ws.res))}</b>`, 3500); A.S.meta.challenges = (A.S.meta.challenges || 0) + 1; A.checkBadges(); }
    renderWeekly();
  }
  async function submitWeekly() {
    const ws = weekState(); if (ws.submitted || !A.Cloud.db || !A.Cloud.uid || W.submitting) return; W.submitting = true;
    const wk = isoWeek(new Date()), av = St.avgOf(ws.res), entry = { avg: isFinite(av) ? Math.round(av) : -1, best: St.best(ws.res).v || -1, times: ws.res.map(s => [s.t, s.p || 0]), at: Date.now() };
    try {
      const ref = A.Cloud.db.doc('challenge/' + A.Cloud.uid), snap = await ref.get();
      if (snap.exists) await ref.update({ entries: { [wk]: entry } }); else await ref.set({ entries: { [wk]: entry } });
      ws.submitted = true; A.Store.saveSoon(); A.toast('Submitted to the weekly leaderboard');
    } catch (e) { A.toast(e && e.code === 'invalid_argument' ? 'Could not submit your result' : 'You can view the leaderboard, but this page does not let you post to it'); }
    W.submitting = false; if (A.view === 'play' && P.tab === 'weekly') renderWeekly();
  }
  async function renderBoard() {
    const el = $('#wkBoard'), live = $('#wkLive'); if (!el) return;
    if (!A.Cloud.db) { el.innerHTML = `<div class="empty" style="padding:40px 10px">The shared leaderboard needs the Claude version of Solvo, signed in. Your own result is still saved here.</div>`; return; }
    live.textContent = W.live === 'ok' ? 'live' : W.live === 'slow' ? 'cannot reach the leaderboard yet' : W.live === 'error' ? 'leaderboard unavailable' : 'loading…';
    const wk = isoWeek(new Date());
    const rows = W.rows.map(r => ({ id: r.id, e: r.data && r.data.entries && r.data.entries[wk] })).filter(r => r.e).sort((a, b) => ((a.e.avg < 0 ? 1e12 : a.e.avg) - (b.e.avg < 0 ? 1e12 : b.e.avg)) || (a.e.best - b.e.best));
    if (!rows.length) { el.innerHTML = `<div class="empty" style="padding:40px 10px">No results yet this week. Be the first.</div>`; return; }
    const ps = A.Cloud.user && A.Cloud.user.profiles ? await A.Cloud.user.profiles(rows.map(r => r.id)) : {};
    el.innerHTML = `<table class="tbl score"><thead><tr><th>#</th><th style="text-align:left">Cuber</th><th>Avg</th><th>Best</th></tr></thead><tbody>${rows.map((r, i) => { const p = ps[r.id] || {}; const me = r.id === A.Cloud.uid; return `<tr class="${me ? 'cur' : ''}"><td>${i + 1}</td><td style="text-align:left;color:var(--ink)"><span class="who">${p.avatarUrl ? `<img src="${esc(p.avatarUrl)}" alt="">` : ''}<span data-name></span>${me ? ' <span class="muted">(you)</span>' : ''}</span></td><td class="b">${r.e.avg < 0 ? 'DNF' : St.fmt(r.e.avg)}</td><td>${r.e.best < 0 ? 'DNF' : St.fmt(r.e.best)}</td></tr>`; }).join('')}</tbody></table>`;
    $$('[data-name]', el).forEach((s, i) => { const p = ps[rows[i].id] || {}; s.textContent = p.name || 'Someone'; });
  }

  // ============================================================ BATTLE
  const B = { room: null, R: null, code: '', me: { role: 'player', st: 'lobby', r: 0 }, g: null, unsub: null, myRound: 0, countdown: 0, cdT: 0, lastPeers: [], counted: {}, nick: '' };
  async function roomApi() { if (B.api !== undefined) return B.api; try { B.api = window.claude && window.claude.use ? await window.claude.use('room') : null; } catch (e) { B.api = null; } return B.api; }
  const myKey = () => A.Cloud.uid || (B.R && (B.R.peers().find(p => p.isMe && p.sameTab) || {}).peer) || 'me';
  const keyOf = p => p.by || (p.presence && p.presence.uid) || p.peer;
  async function joinRoom(code, host) {
    const api = await roomApi(); if (!api) { A.toast('Battles need the Claude version of Solvo'); return; }
    try {
      B.R = await api.join('solvo-' + code); B.code = code; B.myRound = 0; B.counted = {};
      B.me = { v: 1, nick: B.nick || '', uid: A.Cloud.uid || null, role: host ? 'host' : 'player', st: 'lobby', r: 0, t: null, p: 0 };
      if (host) { B.g = { r: 0, scr: '', firstTo: 3, scores: {}, hist: [], done: 0, winner: null }; B.me.g = B.g; }
      await B.R.presence(B.me);
      B.unsub = B.R.onPeers(ch => onPeers(ch.peers));
      renderBattle();
    } catch (e) { A.toast(e && e.code === 'not_permitted' ? 'Battles are not available for this viewer' : 'Could not join the battle room'); B.R = null; }
  }
  async function leaveRoom() { try { B.unsub && B.unsub(); await B.R.leave(); } catch (e) { } B.R = null; B.g = null; B.unsub = null; A.Timer.setCtx(null); clearInterval(B.cdT); renderBattle(); }
  const setMe = patch => { Object.assign(B.me, patch); if (B.R) B.R.presence(patch).catch(() => { }); };
  function hostPeer(peers) { return peers.find(p => p.presence && p.presence.role === 'host' && p.presence.g); }
  function onPeers(peers) {
    B.lastPeers = peers; const host = hostPeer(peers); const g = host ? host.presence.g : null; if (g) B.lastG = g;
    // new round from the host
    if (g && g.r > B.myRound && g.scr) { B.myRound = g.r; startCountdown(); }
    // host: close a round when every racer is done
    if (B.me.role === 'host' && B.g && B.g.r && B.g.done !== B.g.r) {
      const racers = peers.filter(p => p.presence && p.presence.role !== 'spectator' && p.presence.r === B.g.r);
      const joinedRound = peers.filter(p => p.presence && p.presence.role !== 'spectator' && (p.presence.st !== 'lobby'));
      if (racers.length && racers.length === joinedRound.length && racers.every(p => p.presence.st === 'done')) {
        const res = {}; racers.forEach(p => res[keyOf(p)] = [p.presence.t, p.presence.p || 0]);
        let win = null, bestV = Infinity; for (const k in res) { const v = res[k][1] === -1 ? Infinity : res[k][0] + res[k][1]; if (v < bestV) { bestV = v; win = k; } }
        const scores = Object.assign({}, B.g.scores); if (win) scores[win] = (scores[win] || 0) + 1;
        const winner = win && scores[win] >= B.g.firstTo ? win : null;
        B.g = Object.assign({}, B.g, { done: B.g.r, scores, winner, hist: [{ r: B.g.r, w: win, res }].concat(B.g.hist).slice(0, 6) }); setMe({ g: B.g });
      }
    }
    // count my round wins once
    if (g && g.done && g.hist && g.hist[0] && g.hist[0].r === g.done && !B.counted[g.done]) { B.counted[g.done] = true; if (g.hist[0].w === myKey()) { A.S.meta.battleWins = (A.S.meta.battleWins || 0) + 1; A.Store.saveSoon(); A.checkBadges(); } }
    if (A.view === 'play' && P.tab === 'battle') renderRoom();
  }
  function startCountdown() {
    A.Timer.setCtx(null); clearInterval(B.cdT); B.countdown = 3; setMe({ st: 'ready', r: B.myRound, t: null, p: 0 });
    B.cdT = setInterval(() => { B.countdown--; if (B.countdown <= 0) { clearInterval(B.cdT); armTimer(); } if (A.view === 'play' && P.tab === 'battle') renderRoom(); }, 1000);
    if (A.view === 'play' && P.tab === 'battle') renderRoom();
  }
  function armTimer() {
    if (!(A.view === 'play' && P.tab === 'battle')) return;
    A.Timer.setCtx({ name: 'battle', el: () => $('#btTime'), inspection: () => A.set().inspection,
      onInspect: () => setMe({ st: 'inspect' }), onStart: () => setMe({ st: 'solve' }),
      onDone: (t, p) => { setMe({ st: 'done', t: Math.round(t), p: p || 0, r: B.myRound }); A.Timer.setCtx(null); },
      hint: s => { const h = $('#btHint'); if (h) h.innerHTML = { idle: A.set().inspection ? 'Press <span class="kbd">Space</span> to start inspection' : 'Hold <span class="kbd">Space</span>, release to start', armInsp: 'Release to start inspection', inspect: 'Inspecting — hold <span class="kbd">Space</span> when ready', inspHold: 'Keep holding…', inspReady: 'Release to start', hold: 'Keep holding…', ready: 'Release to start', running: 'Any key stops the timer' }[s] || ''; } });
  }
  function hostStart() {
    if (B.me.role !== 'host' || !B.g) return; const scr = A.Scrambler.next('333');
    const fresh = B.g.winner ? { scores: {}, hist: [], winner: null } : {};
    B.g = Object.assign({}, B.g, fresh, { r: B.g.r + 1, scr, done: 0 }); setMe({ g: B.g });
  }
  function becomeHost() { const g = Object.assign({ r: 0, scr: '', firstTo: 3, scores: {}, hist: [], done: 0, winner: null }, B.lastG || {}); B.g = g; setMe({ role: 'host', g }); renderRoom(); }

  async function renderBattle() {
    const body = $('#plBody'); if (!body) return;
    if (B.R) { renderRoom(); return; }
    A.Timer.setCtx(null);
    const api = await roomApi();
    body.innerHTML = `<div class="grid2"><section class="card glass" style="display:grid;gap:12px;align-content:start">
        <div class="card-h"><h3>Start a battle</h3></div>
        ${api ? `<label class="eyebrow" for="btNick">Nickname (optional)</label><input class="field" id="btNick" maxlength="20" placeholder="Shown if your name isn't" value="${esc(B.nick)}">
        <button class="btn primary" id="btCreate">Create a battle room</button>
        <div class="row" style="gap:8px;justify-content:flex-start"><input class="field mono" id="btCode" aria-label="Room code" placeholder="code" maxlength="8" style="width:120px;text-transform:lowercase"><button class="btn" id="btJoin">Join with code</button></div>`
        : `<div class="empty" style="text-align:left">Live battles run inside the Claude version of Solvo. Open it there, signed in, and share the page with your friends so they can join with a code.</div>`}
      </section>
      <section class="card glass"><div class="card-h"><h3>How battles work</h3></div><ul class="hl">
        <li><span>1</span><span>One person creates a room and shares the 4-letter code.</span></li>
        <li><span>2</span><span>Everyone gets the same scramble and a 3-second countdown, then solves on their own cube with the normal timer.</span></li>
        <li><span>3</span><span>The fastest time wins the round. First to the target number of round wins takes the match.</span></li>
        <li><span>4</span><span>Friends need access to this page (Share menu) and must be signed in to Claude.</span></li></ul></section></div>`;
    if (!api) return;
    $('#btNick').oninput = e => { B.nick = e.target.value.trim(); };
    $('#btCreate').onclick = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let c = ''; for (let i = 0; i < 4; i++) c += a[Math.floor(Math.random() * a.length)]; joinRoom(c, true); };
    const join = () => { const c = $('#btCode').value.trim().toLowerCase().replace(/[^a-z0-9]/g, ''); if (c.length < 3) { A.toast('Type the room code'); return; } joinRoom(c, false); };
    $('#btJoin').onclick = join; $('#btCode').onkeydown = e => { if (e.key === 'Enter') join(); };
  }
  async function renderRoom() {
    const body = $('#plBody'); if (!body || !B.R) return;
    const peers = B.R.peers().filter(p => p.kind === 'viewer'), host = hostPeer(peers), g = host ? host.presence.g : (B.me.role === 'host' ? B.g : null);
    const ids = peers.map(p => p.by).filter(Boolean); const ps = ids.length && A.Cloud.user && A.Cloud.user.profiles ? await A.Cloud.user.profiles(ids) : {};
    const nameOf = p => (p.by && ps[p.by] && ps[p.by].name) || (p.presence && p.presence.nick) || (p.isMe ? 'You' : 'Player');
    const byKey = {}; peers.forEach(p => byKey[keyOf(p)] = p);
    const stLabel = p => { const pr = p.presence || {}; if (!g || pr.r !== g.r) return pr.role === 'host' ? 'host' : 'waiting'; return { ready: 'ready', inspect: 'inspecting', solve: 'solving', done: pr.p === -1 ? 'DNF' : St.fmt(pr.t + (pr.p || 0)) }[pr.st] || pr.st; };
    const roundOpen = g && g.r && g.done !== g.r, iAmHost = B.me.role === 'host';
    const last = g && g.hist && g.hist[0];
    const winnerName = k => k && byKey[k] ? nameOf(byKey[k]) : 'Someone';
    body.innerHTML = `<div class="comp-grid" style="grid-template-columns:260px minmax(0,1fr) 280px">
      <section class="card glass" style="display:grid;gap:10px;align-content:start">
        <div class="eyebrow">Room code</div><div class="mono" style="font-size:34px;font-weight:700;letter-spacing:.12em">${esc(B.code)}</div>
        <button class="btn sm" id="btCopy">Copy code</button>
        ${iAmHost ? `<label class="eyebrow" for="btFirst">First to</label><select class="field" id="btFirst">${[1, 3, 5, 7].map(n => `<option value="${n}" ${g && g.firstTo === n ? 'selected' : ''}>${n} round win${n === 1 ? '' : 's'}</option>`).join('')}</select>` : `<div class="muted" style="font-size:12px">First to ${g ? g.firstTo : 3} round wins</div>`}
        ${!host && !iAmHost ? `<div class="muted" style="font-size:12px">The host left the room.</div><button class="btn sm" id="btTake">Become host</button>` : ''}
        <button class="btn sm danger" id="btLeave">Leave room</button>
      </section>
      <section class="glass comp-stage">
        <div class="eyebrow">${g && g.r ? 'Round ' + g.r : 'Lobby'}</div>
        ${g && g.winner ? `<div style="font-family:var(--f-display);font-size:26px;font-weight:700">${A.icon('trophy', 22)} ${esc(winnerName(g.winner))} wins the match</div>` : ''}
        ${roundOpen ? (B.countdown > 0 && B.myRound === g.r ? `<div class="scramble" style="max-width:620px">${A.scrHTML(g.scr)}</div><div class="time" style="color:var(--warn)">${B.countdown}</div><div class="hint">Get ready…</div>`
          : B.me.r === g.r && B.me.st === 'done' ? `<div class="scramble" style="max-width:620px;opacity:.6">${A.scrHTML(g.scr)}</div><div class="time mono">${B.me.p === -1 ? 'DNF' : St.fmt(B.me.t + (B.me.p || 0))}</div><div class="hint">Waiting for the others…</div>`
          : B.myRound === g.r ? `<div class="scramble" style="max-width:620px">${A.scrHTML(g.scr)}</div><div class="time mono" id="btTime">0.00</div><div class="hint" id="btHint"></div>`
          : `<div class="empty">A round is in progress. You join from the next one.</div>`)
        : last && g.done === last.r ? `<div class="attempt">Round ${last.r} result</div><div style="font-family:var(--f-display);font-size:30px;font-weight:700">${last.w ? esc(winnerName(last.w)) + ' wins' : 'No winner'}</div><div class="muted mono">${Object.entries(last.res).map(([k, v]) => `${esc(winnerName(k))} ${v[1] === -1 ? 'DNF' : St.fmt(v[0] + v[1])}`).join(' · ')}</div>`
        : `<div class="empty">${iAmHost ? 'Share the code, then start the first round.' : 'Waiting for the host to start a round.'}</div>`}
        ${iAmHost && !roundOpen ? `<button class="btn primary" id="btStart">${g && g.winner ? 'New match' : g && g.r ? 'Next round' : 'Start round'}</button>` : ''}
      </section>
      <section class="card glass"><div class="card-h"><h3>Racers · ${peers.length}</h3></div>
        <div style="display:grid;gap:6px">${peers.map(p => { const k = keyOf(p); return `<div class="racer ${p.isMe && p.sameTab ? 'me' : ''}"><span class="rn" data-pn="${esc(p.peer)}"></span><span class="rs">${esc(stLabel(p))}</span><b class="mono">${g && g.scores && g.scores[k] ? g.scores[k] : 0}</b></div>`; }).join('')}</div>
        <div class="muted" style="font-size:12px;margin-top:8px">Names come from Claude. Times are measured on each player's device.</div></section></div>`;
    $$('[data-pn]', body).forEach(s => { const p = peers.find(x => x.peer === s.dataset.pn); s.textContent = nameOf(p) + (p.isMe && p.sameTab ? ' (you)' : '') + (p.presence && p.presence.role === 'host' ? ' · host' : ''); });
    $('#btCopy').onclick = () => A.copy(B.code); $('#btLeave').onclick = leaveRoom;
    const f = $('#btFirst'); if (f) f.onchange = e => { B.g = Object.assign({}, B.g, { firstTo: +e.target.value }); setMe({ g: B.g }); };
    const tk = $('#btTake'); if (tk) tk.onclick = becomeHost;
    const s = $('#btStart'); if (s) s.onclick = hostStart;
    if (roundOpen && B.myRound === g.r && B.countdown <= 0 && B.me.st !== 'done' && $('#btTime')) { if (!A.Timer.ctx || A.Timer.ctx.name !== 'battle') armTimer(); else A.Timer.show(); }
    const stg = $('.comp-stage', body); if (stg) { stg.addEventListener('pointerdown', e => { if (A.Timer.ctx && A.Timer.ctx.name === 'battle' && e.pointerType !== 'mouse' && !e.target.closest('button,select,input')) { e.preventDefault(); A.Timer.down(); } }); stg.addEventListener('pointerup', e => { if (A.Timer.ctx && A.Timer.ctx.name === 'battle' && e.pointerType !== 'mouse' && !e.target.closest('button,select,input')) A.Timer.up(); }); }
  }
  A.on('start', name => { if (name === 'battle') setMe({ st: 'solve' }); });
})();
