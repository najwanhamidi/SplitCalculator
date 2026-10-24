/* Split Calculator engine - pure functions, no DOM. Works in browser and Node. */
(function (root) {
  'use strict';

  /* group: 'race' = race pacing profiles (from pacing research), 'workout' = common training-run formats */
  const STRATEGIES = [
    { id: 'even', group: 'race', name: 'Even pace', blurb: 'One steady pace from start to finish. Recent 5,000 m and 10,000 m world records were run close to this.' },
    { id: 'negative', group: 'race', name: 'Negative split', blurb: 'Run the second part faster than the first. Start controlled, finish strong.' },
    { id: 'positive', group: 'race', name: 'Fast start', blurb: 'Bank time early, then hold on as the pace fades gradually (positive split).' },
    { id: 'ushape', group: 'race', name: 'U-shaped', blurb: 'Faster first and last stretches, steadier middle. The shape of many earlier distance world records.' },
    { id: 'jshape', group: 'race', name: 'J-shaped', blurb: 'Start quicker than the middle, settle, then an end spurt that is the fastest part of the race.' },
    { id: 'revj', group: 'race', name: 'Reverse J', blurb: 'Fastest at the start, settle in the middle, then a smaller end spurt.' },
    { id: 'progressive', group: 'workout', name: 'Progression run', blurb: 'Pace drops a little every split, from an easy start to a hard finish.' },
    { id: 'fastfinish', group: 'workout', name: 'Fast-finish long run', blurb: 'Steady running, then the last part at a quicker pace. A staple of marathon long runs.' },
    { id: 'tempo', group: 'workout', name: 'Tempo run', blurb: 'Easy warm-up, a sustained comfortably hard block, easy cool-down.' },
    { id: 'alternating', group: 'workout', name: 'Alternating', blurb: 'Easy and quick stretches take turns. Breaks up the monotony.' },
    { id: 'fartlek', group: 'workout', name: 'Fartlek', blurb: 'Speed play: surges of varied length and effort with easier running between. Change the pattern to reshuffle.' },
    { id: 'pyramid', group: 'workout', name: 'Pyramid', blurb: 'Ease in, peak, ease out. The fastest splits sit around the peak point.' },
    { id: 'stairs', group: 'workout', name: 'Stair steps', blurb: 'Hold a pace for a block, then step faster. Each block is quicker than the last.' },
    { id: 'interval', group: 'workout', name: 'Interval style', blurb: 'Easy warm-up, hard blocks with easy recoveries, easy cool-down.' },
    { id: 'runwalk', group: 'workout', name: 'Run-walk', blurb: 'Planned walk breaks at fixed distances (Galloway method). Running pace adjusts so the total still hits the goal.' }
  ];

  /* Per-strategy settings. v = pace swing in ± percent around the plan's base pace. */
  const PARAM_DEFAULTS = {
    even: {},
    negative: { v: 2, at: 50 },
    progressive: { v: 2 },
    positive: { v: 2 },
    alternating: { v: 2, len: 1 },
    pyramid: { v: 2, peak: 50 },
    stairs: { v: 2, steps: 4 },
    interval: { v: 4, hard: 2, easy: 1, wu: 1, cd: 1 },
    ushape: { v: 2 },
    jshape: { v: 2, low: 50 },
    revj: { v: 2, low: 60 },
    fastfinish: { v: 3, last: 25 },
    tempo: { v: 5, wu: 20, cd: 15 },
    fartlek: { v: 3, seed: 1 },
    runwalk: { every: 1.6, ws: 60, wp: 540 }   // walk 60 s every 1.6 km at 9:00 /km
  };
  function params(id, sp) {
    return Object.assign({}, PARAM_DEFAULTS[id] || {}, (sp && sp[id]) || {});
  }

  function buildSegments(totalM, splitM) { return segmentsFor('', totalM, splitM, {}); }

  /* Split boundaries every splitM, plus extra cut points for walk breaks (run-walk). */
  function segmentsFor(id, totalM, splitM, p) {
    const cuts = [0, totalM];
    for (let pos = splitM; pos < totalM - 0.5; pos += splitM) cuts.push(pos);
    const walks = [];
    if (id === 'runwalk') {
      const every = Math.max(0.2, p.every) * 1000;
      const wd = Math.min(every * 0.5, p.ws / p.wp * 1000);   // metres walked per break
      for (let k = 1; k * every < totalM - 1; k++) {
        const end = k * every, start = end - wd;
        if (start > 0) { walks.push([start, end]); cuts.push(start, end); }
      }
    }
    cuts.sort(function (a, b) { return a - b; });
    const pts = [0];
    cuts.forEach(function (c) {
      if (c - pts[pts.length - 1] >= 0.5) pts.push(c);
      else if (c === totalM) pts[pts.length - 1] = totalM;   // nearly-equal cut: keep the exact finish
    });
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], mid = (a + b) / 2;
      segs.push({
        startM: a, endM: b, d: b - a,
        walk: walks.some(function (w) { return mid > w[0] && mid < w[1]; })
      });
    }
    return segs;
  }

  /* Two-sided parabola through (0,a) -> slowest point (xv, peak) -> (1,b). */
  function parab(x, a, xv, peak, b) {
    return x < xv ? peak - (peak - a) * Math.pow((xv - x) / xv, 2) : peak - (peak - b) * Math.pow((x - xv) / (1 - xv), 2);
  }
  function rng(seed) {
    let t = seed * 2654435761 >>> 0;
    return function () {
      t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t);
      r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }
  function fartlek(n, v, seed) {
    const R = rng(seed), out = [];
    let surge = false;
    while (out.length < n) {
      const len = 1 + Math.floor(R() * (surge ? 2 : 3));
      const amp = v * (0.5 + R() * 0.5);
      for (let k = 0; k < len && out.length < n; k++) out.push(surge ? 1 - amp : 1 + amp * 0.6);
      surge = !surge;
    }
    return out;
  }

  /* Relative pace multipliers (<1 = faster). Rescaled later so total time = target. */
  function multipliers(id, segs, totalM, p) {
    const v = (p.v || 0) / 100;
    const n = segs.length;
    const fk = id === 'fartlek' ? fartlek(n, v, p.seed) : null;
    return segs.map(function (s, i) {
      if (s.walk) return 0;
      const x = (s.startM + s.d / 2) / totalM;
      switch (id) {
        case 'negative': return x < p.at / 100 ? 1 + v : 1 - v;
        case 'progressive': return 1 + v - 2 * v * x;
        case 'positive': return 1 - v + 2 * v * x;
        case 'alternating': return Math.floor(i / Math.max(1, p.len)) % 2 === 0 ? 1 + v : 1 - v;
        case 'pyramid': {
          const pk = Math.min(0.95, Math.max(0.05, p.peak / 100));
          const tri = x < pk ? x / pk : (1 - x) / (1 - pk);
          return 1 + v - 2 * v * tri;
        }
        case 'stairs': {
          const k = Math.min(Math.max(2, p.steps), n);
          if (k < 2) return 1;
          const step = Math.min(k - 1, Math.floor(x * k));
          return 1 + v - 2 * v * step / (k - 1);
        }
        case 'interval': {
          const wu = Math.max(0, p.wu), cd = Math.max(0, p.cd);
          const hard = Math.max(1, p.hard), easy = Math.max(1, p.easy);
          if (n < wu + cd + 2) return i % 2 === 0 ? 1 + v : 1 - v;
          if (i < wu || i >= n - cd) return 1 + v;
          return ((i - wu) % (hard + easy)) < hard ? 1 - v : 1 + v;
        }
        case 'ushape': return parab(x, 1 - v, 0.5, 1 + v, 1 - v);
        case 'jshape': return parab(x, 1 - 0.2 * v, p.low / 100, 1 + v, 1 - 1.5 * v);
        case 'revj': return parab(x, 1 - 1.5 * v, p.low / 100, 1 + v, 1 - 0.2 * v);
        case 'fastfinish': return x > 1 - p.last / 100 ? 1 - v : 1 + v * 0.3;
        case 'tempo': return (x < p.wu / 100 || x > 1 - p.cd / 100) ? 1 + v : 1 - v * 0.4;
        case 'fartlek': return fk[i];
        default: return 1;
      }
    });
  }

  /* Snap a wanted block time to something followable. Returns {pace (s/km), speed (km/h)}. */
  function quantize(wantSec, distKm, treadmill, step) {
    if (treadmill) {
      const sp = distKm * 3600 / wantSec;
      let q = Math.round(sp / step) * step;
      q = Math.max(0.1, Math.round(q * 10) / 10);
      return { pace: 3600 / q, speed: q };
    }
    let pace = wantSec / distKm;
    if (step > 0) pace = Math.max(step, Math.round(pace / step) * step);
    return { pace: pace, speed: 3600 / pace };
  }

  /*
   cfg: { km, T (target s), treadmill, round, paceStep (s), speedStep (km/h), group (km, 0 = each split),
          comp, splitM (m), sp (per-strategy params), firstSlow (s/km, first km), kick (s/km, last km) }
  */
  function plan(id, cfg) {
    const p = params(id, cfg.sp);
    const totalM = Math.round(cfg.km * 1000);
    const segs = segmentsFor(id, totalM, cfg.splitM, p);
    const m = multipliers(id, segs, totalM, p);

    // Optional race adjustments: easier first km, faster last km (in s/km on top of the profile).
    const win = Math.min(1000, totalM / 3);
    let add = segs.map(function (s) {
      const mid = s.startM + s.d / 2;
      let a = 0;
      if (s.walk) return p.wp;   // walk breaks: fixed walking pace
      if (cfg.firstSlow && mid < win) a += cfg.firstSlow;
      if (cfg.kick && mid > totalM - win) a -= cfg.kick;
      return a;
    });
    let num = cfg.T, den = 0;
    segs.forEach(function (s, i) { num -= s.d / 1000 * add[i]; den += s.d / 1000 * m[i]; });
    if (num < 0.3 * cfg.T) {
      add = segs.map(function (s) { return s.walk ? p.wp : 0; });
      num = cfg.T; segs.forEach(function (s, i) { num -= s.d / 1000 * add[i]; });
    }
    const base = Math.max(num, 1) / Math.max(den, 1e-9);
    segs.forEach(function (s, i) { s.idealT = (base * m[i] + add[i]) * s.d / 1000; });

    const step = cfg.treadmill ? (cfg.round ? cfg.speedStep : 0.1) : (cfg.round ? cfg.paceStep : 0);
    const groupM = cfg.round && cfg.group > 0 ? cfg.group * 1000 : 0;

    // Blocks: consecutive splits that hold one pace (every split, or splits whose midpoint is in the same group window).
    const blocks = [];
    segs.forEach(function (s) {
      let key = groupM ? Math.floor((s.startM + s.d / 2) / groupM) : blocks.length;
      if (s.walk) key = 'w' + blocks.length;   // walk breaks never merge with running
      const last = blocks[blocks.length - 1];
      if (last && last.key === key) last.segs.push(s); else blocks.push({ key: key, segs: [s] });
    });

    let carry = 0, cum = 0;
    blocks.forEach(function (b) {
      let dist = 0, t = 0;
      b.segs.forEach(function (s) { dist += s.d / 1000; t += s.idealT; });
      const want = t + (cfg.comp ? carry : 0);
      const q = quantize(want, dist, cfg.treadmill, step);
      carry = want - q.pace * dist;
      b.segs.forEach(function (s) {
        s.pace = q.pace; s.speed = q.speed;
        s.time = q.pace * s.d / 1000;
        s.startT = cum;
        cum += s.time;
        s.cum = cum;
        s.bank = cum - cfg.T * s.endM / totalM;   // + behind even pace, − ahead
      });
    });
    const paces = segs.filter(function (s) { return !s.walk; }).map(function (s) { return s.pace; });
    const res = {
      id: id, params: p, segs: segs, totalM: totalM, T: cfg.T, finish: cum, diff: cum - cfg.T,
      avgPace: cum / (totalM / 1000),
      fastest: Math.min.apply(null, paces), slowest: Math.max.apply(null, paces)
    };
    res.half1 = timeAt(res, totalM / 2);
    res.half2 = cum - res.half1;
    return res;
  }

  /* Elapsed time when reaching distance M (metres). Pace is constant inside a split. */
  function timeAt(res, M) {
    for (let i = 0; i < res.segs.length; i++) {
      const s = res.segs[i];
      if (M <= s.endM + 1e-9) return s.startT + (M - s.startM) / 1000 * s.pace;
    }
    return res.finish;
  }

  /* Table rows for any window length (selected split, 1 km, 5 km): time, average pace, elapsed, vs even. */
  function windows(res, lenM) {
    const rows = [];
    for (let a = 0; a < res.totalM - 0.5; a += lenM) {
      const b = Math.min(a + lenM, res.totalM);
      const t0 = timeAt(res, a), t1 = timeAt(res, b), t = t1 - t0;
      const inside = res.segs.filter(function (s) { return s.endM > a + 1e-6 && s.startM < b - 1e-6; });
      const kinds = {};
      inside.forEach(function (s) { kinds[s.pace.toFixed(4)] = 1; });
      rows.push({
        startM: a, endM: b, d: b - a, time: t, cum: t1,
        pace: t / ((b - a) / 1000), speed: (b - a) / 1000 / t * 3600,
        mixed: Object.keys(kinds).length > 1,
        walk: inside.some(function (s) { return s.walk; }),
        bank: t1 - res.T * b / res.totalM
      });
    }
    return rows;
  }

  /* Time at every 5 km plus the half-marathon mark, for distances that pass them. */
  function checkpoints(res) {
    const marks = [];
    for (let k = 5000; k < res.totalM - 1; k += 5000) marks.push({ M: k, label: (k / 1000) + 'K' });
    if (res.totalM > 21200) marks.push({ M: 21097.5, label: 'Half' });
    marks.sort(function (a, b) { return a.M - b.M; });
    return marks.map(function (c) { return { label: c.label, M: c.M, t: timeAt(res, c.M) }; });
  }

  function fmtT(sec) {
    let s = Math.round(sec);
    const sign = s < 0 ? '−' : '';
    s = Math.abs(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    const pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return sign + (h > 0 ? h + ':' + pad(m) + ':' + pad(r) : m + ':' + pad(r));
  }
  function fmtSigned(sec) {
    const r = Math.round(sec);
    if (r === 0) return '0:00';
    return (r > 0 ? '+' : '−') + fmtT(Math.abs(r));
  }
  function fmtKm(m) { return (Math.round(m / 10) / 100).toString(); }

  /* Consecutive splits with the same shown pace/speed, merged. */
  function runs(res, treadmill) {
    const out = [];
    res.segs.forEach(function (s) {
      const label = treadmill ? s.speed.toFixed(1) : fmtT(s.pace);
      const last = out[out.length - 1];
      if (last && last.label === label && !!last.walk === !!s.walk) { last.endM = s.endM; last.endT = s.cum; }
      else out.push({ label: label, walk: s.walk, startM: s.startM, endM: s.endM, startT: s.startT, endT: s.cum });
    });
    return out;
  }

  const api = {
    STRATEGIES: STRATEGIES, PARAM_DEFAULTS: PARAM_DEFAULTS, params: params, plan: plan, timeAt: timeAt,
    checkpoints: checkpoints, windows: windows, fmtT: fmtT, fmtSigned: fmtSigned, fmtKm: fmtKm, runs: runs, buildSegments: buildSegments
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SplitEngine = api;
})(typeof self !== 'undefined' ? self : this);
