/* Solvo Timer — statistics (WCA-style averages, distributions, records). */
(function () {
  'use strict';
  const DNF = Infinity;
  // solve: {t: ms, p: 0 | 2000 | -1, d: epoch ms, s: scramble}
  const val = s => s.p === -1 ? DNF : s.t + (s.p || 0);
  const trimOf = n => n <= 4 ? 0 : Math.ceil(n * 0.05);

  function avgOf(list) { // list of solves (already the window)
    const n = list.length; if (!n) return null;
    if (n < 3) return null;
    const v = list.map(val).sort((a, b) => a - b), k = trimOf(n);
    const kept = v.slice(k, n - k);
    if (kept.some(x => x === DNF)) return DNF;
    return kept.reduce((a, b) => a + b, 0) / kept.length;
  }
  function meanOf(list) { if (!list.length) return null; const v = list.map(val); if (v.some(x => x === DNF)) return DNF; return v.reduce((a, b) => a + b, 0) / v.length; }
  function aoN(solves, n, end) { end = end === undefined ? solves.length : end; if (end < n) return null; return avgOf(solves.slice(end - n, end)); }
  function rolling(solves, n) { const out = new Array(solves.length).fill(null); for (let i = n; i <= solves.length; i++) out[i - 1] = avgOf(solves.slice(i - n, i)); return out; }
  function bestRolling(solves, n) { let best = null, at = -1; const r = rolling(solves, n); r.forEach((v, i) => { if (v !== null && v !== DNF && (best === null || v < best)) { best = v; at = i; } }); return { v: best, at }; }
  function best(solves) { let b = null, at = -1; solves.forEach((s, i) => { const v = val(s); if (v !== DNF && (b === null || v < b)) { b = v; at = i; } }); return { v: b, at }; }
  function worst(solves) { let b = null; solves.forEach(s => { const v = val(s); if (v !== DNF && (b === null || v > b)) b = v; }); return b; }
  function validTimes(solves) { return solves.map(val).filter(v => v !== DNF); }
  function mean(solves) { const v = validTimes(solves); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }
  function median(solves) { const v = validTimes(solves).sort((a, b) => a - b); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; }
  function stdev(solves) { const v = validTimes(solves); if (v.length < 2) return null; const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); }

  function fmt(ms, opts) {
    if (ms === null || ms === undefined) return '–';
    if (ms === DNF) return 'DNF';
    opts = opts || {};
    const dec = opts.dec === undefined ? 2 : opts.dec;
    const f = Math.pow(10, dec); let v = Math.floor(ms / (1000 / f)) / f; // truncate like WCA displays
    if (v >= 60) { const m = Math.floor(v / 60); const s = (v - m * 60).toFixed(dec).padStart(dec ? dec + 3 : 2, '0'); return m + ':' + s; }
    return v.toFixed(dec);
  }
  function fmtSolve(s) { if (s.p === -1) return 'DNF(' + fmt(s.t) + ')'; if (s.p) return fmt(s.t + s.p) + '+'; return fmt(s.t); }
  function parseTime(str) { // "12.34", "1:02.34", "1234" (=12.34), "DNF", "12.34+"
    str = (str || '').trim().toUpperCase(); if (!str) return null;
    if (str.startsWith('DNF')) { const inner = str.match(/\(([^)]+)\)/); const r = inner ? parseTime(inner[1]) : null; return { t: r ? r.t : 0, p: -1 }; }
    let p = 0; if (str.endsWith('+')) { p = 2000; str = str.slice(0, -1); }
    let ms;
    if (str.includes(':')) { const [m, s] = str.split(':'); ms = (parseInt(m, 10) * 60 + parseFloat(s)) * 1000; }
    else if (/^\d+$/.test(str)) { const n = parseInt(str, 10); ms = str.length <= 2 ? n * 10 : (Math.floor(n / 10000) * 60 + (n % 10000) / 100) * 1000; }
    else ms = parseFloat(str) * 1000;
    if (!isFinite(ms) || ms <= 0) return null;
    return { t: Math.round(ms), p };
  }

  function histogram(solves, bins) {
    const v = validTimes(solves); if (!v.length) return { bins: [], lo: 0, hi: 0, w: 0 };
    const s = v.slice().sort((a, b) => a - b); const lo = s[Math.floor(s.length * 0.02)], hi = s[Math.min(s.length - 1, Math.floor(s.length * 0.98))];
    const w = Math.max(250, Math.ceil((hi - lo) / (bins || 14) / 250) * 250); const start = Math.floor(lo / w) * w; const nb = Math.max(1, Math.ceil((hi - start) / w) + 1);
    const b = new Array(nb).fill(0); for (const x of v) { let i = Math.floor((x - start) / w); i = Math.max(0, Math.min(nb - 1, i)); b[i]++; }
    return { bins: b, lo: start, w };
  }
  function subLadder(solves, cuts) { const n = solves.length || 1; return cuts.map(c => { const k = solves.filter(s => val(s) < c * 1000).length; return { c, k, pct: k / n * 100 }; }); }
  function windows(solves, sizes) {
    return sizes.map(n => {
      const all = n === 'all'; const N = all ? solves.length : n; if (solves.length < (all ? 1 : n)) return { n, empty: true };
      const cur = solves.slice(-N), prev = all ? [] : solves.slice(-2 * N, -N);
      const m = mean(cur), pm = prev.length === N ? mean(prev) : null;
      return { n, mean: m, best: best(cur).v, sd: stdev(cur), delta: pm !== null && m !== null ? m - pm : null };
    });
  }
  function dayKey(d) { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }

  window.SolvoStats = { DNF, val, avgOf, meanOf, aoN, rolling, bestRolling, best, worst, mean, median, stdev, fmt, fmtSolve, parseTime, histogram, subLadder, windows, dayKey, validTimes };
})();
