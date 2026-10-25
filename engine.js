/* Split Calculator engine - pure functions, no DOM. Works in browser and Node. */
(function (root) {
  'use strict';

  /* group: 'race' = race pacing profiles (from pacing research), 'workout' = common training-run formats */
  const MP_IDS = ['mplong', 'mpfinish', 'mpbuild', 'mpintervals'];
  const STRATEGIES = [
    { id: 'even', group: 'race', name: 'Even pace', blurb: 'One steady pace from start to finish. Recent 5,000 m and 10,000 m world records were run close to this.' },
    { id: 'negative', group: 'race', name: 'Negative split', blurb: 'Run the second part faster than the first. Start controlled, finish strong.' },
    { id: 'positive', group: 'race', name: 'Fast start', blurb: 'Bank time early, then hold on as the pace fades gradually (positive split).' },
    { id: 'ushape', group: 'race', name: 'U-shaped', blurb: 'Faster first and last stretches, steadier middle. The shape of many earlier distance world records.' },
    { id: 'jshape', group: 'race', name: 'J-shaped', blurb: 'Start quicker than the middle, settle, then an end spurt that is the fastest part of the race.' },
    { id: 'revj', group: 'race', name: 'Reverse J', blurb: 'Fastest at the start, settle in the middle, then a smaller end spurt.' },
    { id: 'controlled', group: 'race', name: 'Controlled start', blurb: 'Hold back for the opening stretch while the field settles, then lock into an even pace.' },
    { id: 'sitkick', group: 'race', name: 'Sit and kick', blurb: 'Even pace, saving energy for a hard, short sprint to the line.' },
    { id: 'midsurge', group: 'race', name: 'Mid-race surge', blurb: 'Even running with a sustained tactical surge in the middle to break away, then settle.' },
    { id: 'blocks3', group: 'race', name: 'Three-block plan', blurb: 'Easy, goal pace, then hard, like the 10-10-10 marathon plan (10 mi easy, 10 mi steady, 10K strong).' },
    { id: 'progressive', group: 'workout', name: 'Progression run', blurb: 'Pace drops a little every split, from an easy start to a hard finish.' },
    { id: 'fastfinish', group: 'workout', name: 'Fast-finish long run', blurb: 'Steady running, then the last part at a quicker pace. A staple of marathon long runs.' },
    { id: 'tempo', group: 'workout', name: 'Tempo run', blurb: 'Easy warm-up, a sustained comfortably hard block, easy cool-down.' },
    { id: 'alternating', group: 'workout', name: 'Alternating', blurb: 'Easy and quick stretches take turns. Breaks up the monotony.' },
    { id: 'fartlek', group: 'workout', name: 'Fartlek', blurb: 'Speed play: surges of varied length and effort with easier running between. Change the pattern to reshuffle.' },
    { id: 'pyramids', group: 'workout', name: 'Alternating pyramids', blurb: 'Several pyramids back to back. Each one builds to a fast peak and eases off; alternate flips every other pyramid so it dips slow in the middle.' },
    { id: 'pyramid', group: 'workout', name: 'Pyramid', blurb: 'Ease in, peak, ease out. The fastest splits sit around the peak point.' },
    { id: 'stairs', group: 'workout', name: 'Stair steps', blurb: 'Hold a pace for a block, then step faster. Each block is quicker than the last.' },
    { id: 'mplong', group: 'marathon', mp: true, name: 'Marathon-pace block', blurb: 'Easy running with one block at your marathon pace. The easy parts adjust so the total still matches your goal.' },
    { id: 'mpfinish', group: 'marathon', mp: true, name: 'Marathon-pace finish', blurb: 'Easy start, then the last stretch at marathon pace. A classic long-run finish.' },
    { id: 'mpbuild', group: 'marathon', mp: true, name: 'Marathon pace to faster', blurb: 'Easy, then a marathon-pace block, then a faster finish. Practises moving up a gear on tired legs.' },
    { id: 'mpintervals', group: 'marathon', mp: true, name: 'Marathon-pace repeats', blurb: 'Warm-up, repeated marathon-pace blocks with easy recoveries, then a cool-down.' },
    { id: 'interval', group: 'workout', name: 'Interval style', blurb: 'Easy warm-up, hard blocks with easy recoveries, easy cool-down.' },
    { id: 'ladder', group: 'workout', name: 'Ladder intervals', blurb: 'Hard reps get longer, then shorter (1-2-3-2-1 splits), with easy recoveries between.' },
    { id: 'surges', group: 'workout', name: 'Steady with surges', blurb: 'Steady running with a short surge at regular intervals. Practises changing gear.' },
    { id: 'sandwich', group: 'workout', name: 'Tempo sandwich', blurb: 'Two tempo blocks split by an easy recovery stretch, with a warm-up and cool-down.' },
    { id: 'runwalk', group: 'workout', name: 'Run-walk', blurb: 'Planned walk breaks at fixed distances (Galloway method). Running pace adjusts so the total still hits the goal.' }
  ];

  /* Per-strategy settings. v = pace swing in ± percent around the plan's base pace. */
  const PARAM_DEFAULTS = {
    even: {},
    negative: { v: 2, at: 50 },
    progressive: { v: 2 },
    positive: { v: 2 },
    alternating: { v: 2, len: 1 },
    pyramid: { v: 2, peak: 50, count: 1, alt: 0 },
    stairs: { v: 2, steps: 4 },
    interval: { v: 4, hard: 2, easy: 1, wu: 1, cd: 1 },
    ushape: { v: 2 },
    jshape: { v: 2, low: 50 },
    revj: { v: 2, low: 60 },
    fastfinish: { v: 3, last: 25 },
    tempo: { v: 5, wu: 20, cd: 15 },
    fartlek: { v: 3, seed: 1 },
    runwalk: { every: 1.6, ws: 60, wp: 540 },   // walk 60 s every 1.6 km at 9:00 /km
    controlled: { v: 3, first: 15 },
    sitkick: { v: 6, last: 8 },
    midsurge: { v: 3, at: 50, len: 15 },
    blocks3: { v: 3, a: 38, b: 38 },
    ladder: { v: 4, peak: 3, easy: 1, wu: 1, cd: 1 },
    surges: { v: 5, every: 4, len: 1 },
    sandwich: { v: 5, wu: 15, mid: 15, cd: 10 },
    pyramids: { v: 3, peak: 50, count: 3, alt: 1 },
    mplong: { start: 25, len: 50, n: 1, rest: 1 },
    mpfinish: { len: 40 },
    mpbuild: { easy: 30, mpl: 40, v: 4 },
    mpintervals: { v: 0, n: 3, blk: 0, rest: 1, wu: 3, cd: 2 }
  };
  function params(id, sp) {
    return Object.assign({}, PARAM_DEFAULTS[id] || {}, (sp && sp[id]) || {});
  }

  function buildSegments(totalM, splitM) { return segmentsFor('', totalM, splitM, {}); }

  /* Split boundaries every splitM, plus extra cut points for walk breaks (run-walk). */
  /* Fixed-pace zones for marathon-pace templates: [startM, endM, role]. Roles: mp, fast, wu, cd, rec. */
  /* Lay out n marathon-pace blocks (with easy recoveries between) so they always fill the space exactly:
     no leftover slivers. Block length is "auto" (0) or fixed; warm-up and cool-down take whatever remains. */
  function mpBlocks(T, n, rest, blk, wu, cd) {
    const notes = [];
    n = Math.max(1, Math.round(n)); rest = Math.max(0, rest); wu = Math.max(0, wu); cd = Math.max(0, cd);
    const minBlk = 0.5;
    let b = blk > 0 ? blk : 0;
    const asked = n;
    if (b > 0) {
      while (n > 1 && n * b + (n - 1) * rest > T) n--;
      if (n * b + (n - 1) * rest > T) b = T;
      const left = Math.max(0, T - n * b - (n - 1) * rest), r = wu + cd > 0 ? wu / (wu + cd) : 0.5;
      wu = left * r; cd = left - wu;
    } else {
      while (n > 1 && T - (n - 1) * rest - n * minBlk < 0) n--;
      const room = Math.max(0, T - (n - 1) * rest - n * minBlk);
      if (wu + cd > room) { const k = wu + cd > 0 ? room / (wu + cd) : 0; wu *= k; cd *= k; }
      b = (T - (n - 1) * rest - wu - cd) / n;
    }
    if (n < asked) notes.push('Only ' + n + ' block' + (n > 1 ? 's' : '') + ' fit in this distance.');
    return { n: n, blk: b, rest: rest, wu: wu, cd: cd, notes: notes };
  }

  /* Fixed-pace zones for marathon-pace templates: [startM, endM, role]. Roles: mp, fast, wu, cd, rec. */
  function zonesFor(id, totalM, p) {
    const z = [], f = totalM / 100, notes = [];
    if (id === 'mplong') {
      // n MP blocks spread over the chosen stretch, easy gaps between them
      const a = p.start * f, L = Math.min(100 - p.start, p.len) * f / 1000;
      const L1 = Math.max(L, 0.1);
      const lay = mpBlocks(L1, p.n, p.rest, 0, 0, 0);
      notes.push.apply(notes, lay.notes);
      let pos = a;
      for (let i = 0; i < lay.n; i++) {
        z.push([pos, pos + lay.blk * 1000, 'mp']); pos += lay.blk * 1000;
        if (i < lay.n - 1) { z.push([pos, pos + lay.rest * 1000, 'rec']); pos += lay.rest * 1000; }
      }
      if (lay.n > 1) notes.push(lay.n + ' marathon-pace blocks of ' + (Math.round(lay.blk * 10) / 10) + ' km, ' + lay.rest + ' km easy between.');
    }
    if (id === 'mpfinish') z.push([(100 - p.len) * f, totalM, 'mp']);
    if (id === 'mpbuild') {
      z.push([p.easy * f, Math.min(100, p.easy + p.mpl) * f, 'mp']);
      if (p.easy + p.mpl < 100) z.push([(p.easy + p.mpl) * f, totalM, 'fast']);
    }
    if (id === 'mpintervals') {
      const lay = mpBlocks(totalM / 1000, p.n, p.rest, p.blk, p.wu, p.cd);
      notes.push.apply(notes, lay.notes);
      let pos = 0;
      if (lay.wu > 0.001) { z.push([0, lay.wu * 1000, 'wu']); pos = lay.wu * 1000; }
      for (let i = 0; i < lay.n; i++) {
        z.push([pos, pos + lay.blk * 1000, 'mp']); pos += lay.blk * 1000;
        if (i < lay.n - 1) { z.push([pos, pos + lay.rest * 1000, 'rec']); pos += lay.rest * 1000; }
      }
      if (lay.cd > 0.001) z.push([pos, totalM, 'cd']);
      notes.push(lay.n + ' marathon-pace block' + (lay.n > 1 ? 's' : '') + ' of ' + (Math.round(lay.blk * 10) / 10) + ' km' + (lay.n > 1 ? ', ' + lay.rest + ' km easy between' : '') +
        '; warm-up ' + (Math.round(lay.wu * 10) / 10) + ' km, cool-down ' + (Math.round(lay.cd * 10) / 10) + ' km.');
    }
    return { zones: z, notes: notes };
  }

  function segmentsFor(id, totalM, splitM, p) {
    const cuts = [0, totalM];
    const zones = zonesFor(id, totalM, p).zones;
    zones.forEach(function (z) { cuts.push(z[0], z[1]); });
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
      const zone = zones.filter(function (z) { return mid > z[0] && mid < z[1]; })[0];
      segs.push({
        startM: a, endM: b, d: b - a,
        role: zone ? zone[2] : '',
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
  /* Ladder: +1 easy / -1 hard per split. Reps of 1..peak..1 splits with easy recoveries, repeated to fill. */
  function ladder(n, p) {
    const wu = Math.max(0, p.wu), cd = Math.max(0, p.cd), out = [];
    if (n < wu + cd + 3) { for (let i = 0; i < n; i++) out.push(i % 2 ? -1 : 1); return out; }
    for (let i = 0; i < wu; i++) out.push(1);
    const reps = [];
    for (let k = 1; k <= p.peak; k++) reps.push(k);
    for (let k = p.peak - 1; k >= 1; k--) reps.push(k);
    let r = 0;
    while (out.length < n - cd) {
      const len = reps[r % reps.length]; r++;
      for (let k = 0; k < len && out.length < n - cd; k++) out.push(-1);
      for (let k = 0; k < p.easy && out.length < n - cd; k++) out.push(1);
    }
    while (out.length < n) out.push(1);
    return out;
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
    const lad = id === 'ladder' ? ladder(n, p) : null;
    return segs.map(function (s, i) {
      if (s.walk || s.role === 'mp' || s.role === 'fast') return 0;
      if (s.role === 'wu' || s.role === 'cd') return 1 + v;
      const x = (s.startM + s.d / 2) / totalM;
      switch (id) {
        case 'negative': return x < p.at / 100 ? 1 + v : 1 - v;
        case 'progressive': return 1 + v - 2 * v * x;
        case 'positive': return 1 - v + 2 * v * x;
        case 'alternating': return Math.floor(i / Math.max(1, p.len)) % 2 === 0 ? 1 + v : 1 - v;
        case 'pyramid': case 'pyramids': {
          const pk = Math.min(0.95, Math.max(0.05, p.peak / 100));
          const cnt = Math.max(1, Math.round(p.count || 1));
          const y = x * cnt, k = Math.min(cnt - 1, Math.floor(y)), xl = y - k;
          const tri = xl < pk ? xl / pk : (1 - xl) / (1 - pk);
          const sg = p.alt && k % 2 === 1 ? -1 : 1;
          return 1 + sg * (v - 2 * v * tri);
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
        case 'controlled': return x < p.first / 100 ? 1 + v : 1;
        case 'sitkick': return x > 1 - p.last / 100 ? 1 - v : 1;
        case 'midsurge': {
          const a = p.at / 100 - p.len / 200, b = p.at / 100 + p.len / 200;
          return x >= a && x < b ? 1 - v : 1;
        }
        case 'blocks3': return x < p.a / 100 ? 1 + v : (x < (p.a + p.b) / 100 ? 1 : 1 - v);
        case 'ladder': return 1 + v * lad[i];
        case 'surges': {
          const every = Math.max(2, p.every), len = Math.min(p.len, every - 1);
          return (i % every) >= every - len ? 1 - v : 1;
        }
        case 'sandwich': {
          const wu = p.wu / 100, cd = p.cd / 100, mid = p.mid / 100;
          if (x < wu || x > 1 - cd) return 1 + v;
          const c = (wu + 1 - cd) / 2;
          return Math.abs(x - c) < mid / 2 ? 1 + v : 1 - v * 0.4;
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
    const mp = cfg.mp > 0 ? cfg.mp : 330;
    const totalM = Math.round(cfg.km * 1000);
    const segs = segmentsFor(id, totalM, cfg.splitM, p);
    const m = multipliers(id, segs, totalM, p);
    segs.forEach(function (s) {
      if (s.walk) s.fixedPace = p.wp;
      else if (s.role === 'mp') s.fixedPace = mp;
      else if (s.role === 'fast') s.fixedPace = mp * (1 - p.v / 100);
    });

    // Optional race adjustments: easier first km, faster last km (in s/km on top of the profile).
    const win = Math.min(1000, totalM / 3);
    let add = segs.map(function (s) {
      const mid = s.startM + s.d / 2;
      let a = 0;
      if (s.fixedPace) return s.fixedPace;   // walk breaks and marathon-pace zones keep their own pace
      if (cfg.firstSlow && mid < win) a += cfg.firstSlow;
      if (cfg.kick && mid > totalM - win) a -= cfg.kick;
      return a;
    });
    let num = cfg.T, den = 0;
    segs.forEach(function (s, i) { num -= s.d / 1000 * add[i]; den += s.d / 1000 * m[i]; });
    if (num < 0.3 * cfg.T) {
      add = segs.map(function (s) { return s.fixedPace || 0; });
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
      if (s.fixedPace) key = 'f' + blocks.length;   // fixed-pace zones never merge with the rest
      const last = blocks[blocks.length - 1];
      if (last && last.key === key) last.segs.push(s); else blocks.push({ key: key, segs: [s] });
    });

    let carry = 0, cum = 0;
    blocks.forEach(function (b) {
      let dist = 0, t = 0;
      b.segs.forEach(function (s) { dist += s.d / 1000; t += s.idealT; });
      const fixed = b.segs[0].fixedPace;
      const want = t + (cfg.comp && !fixed ? carry : 0);
      const q = quantize(want, dist, cfg.treadmill, fixed ? (cfg.treadmill ? 0.1 : 0) : step);   // fixed pace is never rounded beyond the belt's own grid
      carry = fixed ? carry + (want - q.pace * dist) : want - q.pace * dist;
      b.segs.forEach(function (s) {
        s.pace = q.pace; s.speed = q.speed;
        delete s.fixedPace;
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
    res.base = base;
    const w = [];
    if (MP_IDS.indexOf(id) >= 0) {
      const q = function (x) { return fmtT(x) + ' /km'; };
      if (num <= 0 || base < mp - 0.5) w.push('To hit your goal, the easy parts would need ' + q(base) + ', faster than your marathon pace (' + q(mp) + '). Raise the goal time, shorten the marathon-pace part, or slow your marathon pace.');
      else if (base > mp * 1.6) w.push('The easy parts would be very slow (' + q(base) + ') next to your marathon pace (' + q(mp) + '). Check the goal time and marathon pace.');
    }
    res.warn = w;
    res.notes = MP_IDS.indexOf(id) >= 0 ? zonesFor(id, totalM, p).notes : [];
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
      if (last && last.label === label && !!last.walk === !!s.walk && last.role === s.role) { last.endM = s.endM; last.endT = s.cum; }
      else out.push({ label: label, walk: s.walk, role: s.role, startM: s.startM, endM: s.endM, startT: s.startT, endT: s.cum });
    });
    return out;
  }

  /* qdomyos-zwift treadmill workout XML. Rows are merged runs of equal speed; durations are whole
     seconds rounded on the cumulative clock so the total never drifts. res must be a treadmill plan. */
  function qzWorkout(res, opts) {
    opts = opts || {};
    const incline = opts.incline || 0;
    const esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
    const hms = function (s) {
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60, p = function (n) { return (n < 10 ? '0' : '') + n; };
      return p(h) + ':' + p(m) + ':' + p(r);
    };
    const rows = runs(res, true).map(function (x, i) {
      const speed = +x.label;
      const dur = Math.round(x.endT) - Math.round(x.startT);
      const msg = 'Interval ' + (i + 1) + (x.walk ? ' walk' : '') + (x.role === 'mp' ? ' MP' : '') + ' (' + fmtKm(x.startM) + '-' + fmtKm(x.endM) + ' km)';
      return { dur: dur, speed: speed, msg: msg };
    }).filter(function (r) { return r.dur > 0; });
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rows device="treadmill">\n';
    rows.forEach(function (r) {
      xml += '    <row duration="' + hms(r.dur) + '" speed="' + r.speed + '" inclination="' + incline + '" forcespeed="1" looptimehr="10">\n' +
        '        <textevent timeoffset="0" message="' + esc(r.msg) + '"/>\n    </row>\n';
    });
    xml += '</rows>\n';
    return { xml: xml, rows: rows, total: rows.reduce(function (a, r) { return a + r.dur; }, 0) };
  }

  const api = { qzWorkout: qzWorkout,
    STRATEGIES: STRATEGIES, MP_IDS: MP_IDS, PARAM_DEFAULTS: PARAM_DEFAULTS, params: params, plan: plan, timeAt: timeAt,
    checkpoints: checkpoints, windows: windows, fmtT: fmtT, fmtSigned: fmtSigned, fmtKm: fmtKm, runs: runs, buildSegments: buildSegments
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SplitEngine = api;
})(typeof self !== 'undefined' ? self : this);
