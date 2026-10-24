/* Split Calculator engine - pure functions, no DOM. Works in browser and Node. */
(function (root) {
  'use strict';

  const STRATEGIES = [
    { id: 'even', name: 'Even pace', blurb: 'One steady pace from start to finish. The simplest plan to follow.' },
    { id: 'negative', name: 'Negative split', blurb: 'Run the second part faster than the first. Start controlled, finish strong.' },
    { id: 'progressive', name: 'Progressive build', blurb: 'Pace drops a little every split, from an easy start to a hard finish.' },
    { id: 'positive', name: 'Fast start', blurb: 'Bank time early, then hold on as the pace fades gradually (positive split).' },
    { id: 'alternating', name: 'Alternating', blurb: 'Easy and quick stretches take turns. Breaks up the monotony.' },
    { id: 'pyramid', name: 'Pyramid', blurb: 'Ease in, peak, ease out. The fastest splits sit around the peak point.' },
    { id: 'stairs', name: 'Stair steps', blurb: 'Hold a pace for a block, then step faster. Each block is quicker than the last.' },
    { id: 'interval', name: 'Interval style', blurb: 'Easy warm-up, hard blocks with easy recoveries, easy cool-down.' }
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
    interval: { v: 4, hard: 2, easy: 1, wu: 1, cd: 1 }
  };
  function params(id, sp) {
    return Object.assign({}, PARAM_DEFAULTS[id] || {}, (sp && sp[id]) || {});
  }

  function buildSegments(totalM, splitM) {
    const segs = [];
    let pos = 0;
    while (pos < totalM - 0.5) {
      const d = Math.min(splitM, totalM - pos);
      segs.push({ startM: pos, endM: pos + d, d: d });
      pos += d;
    }
    return segs;
  }

  /* Relative pace multipliers (<1 = faster). Rescaled later so total time = target. */
  function multipliers(id, segs, totalM, p) {
    const v = (p.v || 0) / 100;
    const n = segs.length;
    return segs.map(function (s, i) {
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
    const segs = buildSegments(totalM, cfg.splitM);
    const m = multipliers(id, segs, totalM, p);

    // Optional race adjustments: easier first km, faster last km (in s/km on top of the profile).
    const win = Math.min(1000, totalM / 3);
    let add = segs.map(function (s) {
      const mid = s.startM + s.d / 2;
      let a = 0;
      if (cfg.firstSlow && mid < win) a += cfg.firstSlow;
      if (cfg.kick && mid > totalM - win) a -= cfg.kick;
      return a;
    });
    let num = cfg.T, den = 0;
    segs.forEach(function (s, i) { num -= s.d / 1000 * add[i]; den += s.d / 1000 * m[i]; });
    if (num < 0.3 * cfg.T) { add = add.map(function () { return 0; }); num = cfg.T; }
    const base = num / den;
    segs.forEach(function (s, i) { s.idealT = (base * m[i] + add[i]) * s.d / 1000; });

    const step = cfg.treadmill ? (cfg.round ? cfg.speedStep : 0.1) : (cfg.round ? cfg.paceStep : 0);
    const groupM = cfg.round && cfg.group > 0 ? cfg.group * 1000 : 0;

    // Blocks: consecutive splits that hold one pace (every split, or splits whose midpoint is in the same group window).
    const blocks = [];
    segs.forEach(function (s) {
      const key = groupM ? Math.floor((s.startM + s.d / 2) / groupM) : blocks.length;
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
    const paces = segs.map(function (s) { return s.pace; });
    const res = {
      id: id, params: p, segs: segs, totalM: totalM, finish: cum, diff: cum - cfg.T,
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
      if (last && last.label === label) { last.endM = s.endM; last.endT = s.cum; }
      else out.push({ label: label, startM: s.startM, endM: s.endM, startT: s.startT, endT: s.cum });
    });
    return out;
  }

  const api = {
    STRATEGIES: STRATEGIES, PARAM_DEFAULTS: PARAM_DEFAULTS, params: params, plan: plan, timeAt: timeAt,
    checkpoints: checkpoints, fmtT: fmtT, fmtSigned: fmtSigned, fmtKm: fmtKm, runs: runs, buildSegments: buildSegments
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SplitEngine = api;
})(typeof self !== 'undefined' ? self : this);
