/* Split Calculator engine - pure functions, no DOM. Works in browser and Node. */
(function (root) {
  'use strict';

  const STRATEGIES = [
    { id: 'even', name: 'Even pace', blurb: 'One steady pace from start to finish. The simplest plan to follow.' },
    { id: 'negative', name: 'Negative split', blurb: 'Second half faster than the first. Start controlled, finish strong.' },
    { id: 'progressive', name: 'Progressive build', blurb: 'Pace drops a little every split, from easy start to hard finish.' },
    { id: 'positive', name: 'Fast start', blurb: 'Bank time early, then hold on. Pace fades gradually (positive split).' },
    { id: 'alternating', name: 'Alternating', blurb: 'Easy and quick splits take turns. Breaks up the monotony.' },
    { id: 'pyramid', name: 'Pyramid', blurb: 'Ease in, peak at the middle, ease out. Fastest splits sit in the centre.' },
    { id: 'stairs', name: 'Stair steps', blurb: 'Pace holds for a block, then steps faster. Four blocks, each quicker.' },
    { id: 'interval', name: 'Interval style', blurb: 'Easy warm-up, then hard blocks with easy recoveries, easy cool-down.' }
  ];

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

  /* Relative pace multipliers (1 = average-ish, <1 faster). Later rescaled so total time = target. */
  function multipliers(id, segs, totalM, cfg) {
    const v = cfg.variation / 100;
    const n = segs.length;
    return segs.map(function (s, i) {
      const x = (s.startM + s.d / 2) / totalM;
      switch (id) {
        case 'even': return 1;
        case 'negative': return x < 0.5 ? 1 + v : 1 - v;
        case 'progressive': return 1 + v - 2 * v * x;
        case 'positive': return 1 - v + 2 * v * x;
        case 'alternating': return i % 2 === 0 ? 1 + v : 1 - v;
        case 'pyramid': return 1 + v - 2 * v * (1 - Math.abs(2 * x - 1));
        case 'stairs': {
          const k = Math.min(4, n);
          if (k < 2) return 1;
          const step = Math.min(k - 1, Math.floor(x * k));
          return 1 + v - 2 * v * step / (k - 1);
        }
        case 'interval': {
          if (n < 5) return i % 2 === 0 ? 1 + v : 1 - v;
          if (i === 0 || i === n - 1) return 1 + 2 * v;
          const hard = Math.max(1, cfg.hard), easy = Math.max(1, cfg.easy);
          return ((i - 1) % (hard + easy)) < hard ? 1 - 2 * v : 1 + 2 * v;
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
   cfg: { km, T (target seconds), treadmill, round, paceStep (s), speedStep (km/h),
          group (km, 0 = each split), comp, variation (%), splitM, hard, easy }
  */
  function plan(id, cfg) {
    const totalM = Math.round(cfg.km * 1000);
    const segs = buildSegments(totalM, cfg.splitM);
    const m = multipliers(id, segs, totalM, cfg);
    let denom = 0;
    segs.forEach(function (s, i) { denom += s.d / 1000 * m[i]; });
    const base = cfg.T / denom;
    segs.forEach(function (s, i) { s.idealT = base * m[i] * s.d / 1000; });

    const step = cfg.treadmill ? (cfg.round ? cfg.speedStep : 0.1) : (cfg.round ? cfg.paceStep : 0);
    const gs = cfg.round && cfg.group > 0 ? Math.max(1, Math.round(cfg.group * 1000 / cfg.splitM)) : 1;

    let carry = 0, cum = 0;
    for (let b = 0; b < segs.length; b += gs) {
      const block = segs.slice(b, b + gs);
      let dist = 0, t = 0;
      block.forEach(function (s) { dist += s.d / 1000; t += s.idealT; });
      const want = t + (cfg.comp ? carry : 0);
      const q = quantize(want, dist, cfg.treadmill, step);
      carry = want - q.pace * dist;
      block.forEach(function (s) {
        s.pace = q.pace;
        s.speed = q.speed;
        s.time = q.pace * s.d / 1000;
        cum += s.time;
        s.cum = cum;
      });
    }
    const paces = segs.map(function (s) { return s.pace; });
    return {
      id: id, segs: segs, finish: cum,
      diff: cum - cfg.T,
      avgPace: cum / cfg.km,
      fastest: Math.min.apply(null, paces),
      slowest: Math.max.apply(null, paces)
    };
  }

  function fmtT(sec) {
    let s = Math.round(sec);
    const sign = s < 0 ? '-' : '';
    s = Math.abs(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    const pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return sign + (h > 0 ? h + ':' + pad(m) + ':' + pad(r) : m + ':' + pad(r));
  }
  function fmtKm(m) {
    return (Math.round(m / 10) / 100).toString();
  }

  /* Consecutive splits with the same shown pace/speed, merged: "0–5 km @ 5:05". */
  function runs(res, treadmill) {
    const out = [];
    res.segs.forEach(function (s) {
      const label = treadmill ? s.speed.toFixed(1) : fmtT(s.pace);
      const last = out[out.length - 1];
      if (last && last.label === label) { last.endM = s.endM; last.time += s.time; }
      else out.push({ label: label, startM: s.startM, endM: s.endM, time: s.time });
    });
    return out;
  }

  const api = { STRATEGIES: STRATEGIES, plan: plan, fmtT: fmtT, fmtKm: fmtKm, runs: runs, buildSegments: buildSegments };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SplitEngine = api;
})(typeof self !== 'undefined' ? self : this);
