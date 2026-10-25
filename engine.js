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
    mpintervals: { v: 0, n: 3, blkLen: 0, rest: 1, wu: 3, cd: 2 }
  };
  function params(id, sp) {
    return Object.assign({}, PARAM_DEFAULTS[id] || (LR[id] && LR[id].d) || {}, (sp && sp[id]) || {});
  }

  function buildSegments(totalM, splitM) { return segmentsFor('', totalM, splitM, {}); }

  /* Split boundaries every splitM, plus extra cut points for walk breaks (run-walk). */
  /* Fixed-pace zones for marathon-pace templates: [startM, endM, role]. Roles: mp, fast, wu, cd, rec. */
  /* Lay out n marathon-pace blocks (with easy recoveries between) so they always fill the space exactly:
     no leftover slivers. Block length is "auto" (0) or fixed; warm-up and cool-down take whatever remains. */
  function mpBlocks(T, n, rest, blk, wu, cd) {
    const notes = [];
    n = Math.max(1, Math.round(n)); rest = Math.max(0, rest); wu = Math.max(0, wu); cd = Math.max(0, cd);
    const minBlk = 0.5, asked = n, wuAsked = wu, cdAsked = cd;
    let b = blk > 0 ? blk : 0, fixedLen = b > 0;
    if (fixedLen) {
      // Block length is fixed: warm-up stays as set, the cool-down takes whatever is left.
      while (n > 1 && wu + n * b + (n - 1) * rest > T) n--;
      if (wu + n * b + (n - 1) * rest > T) wu = Math.max(0, T - n * b - (n - 1) * rest);
      if (wu + n * b + (n - 1) * rest > T) b = Math.max(0.1, (T - wu - (n - 1) * rest) / n);
      cd = Math.max(0, T - wu - n * b - (n - 1) * rest);
      if (Math.abs(cd - cdAsked) > 0.05) notes.push('With a fixed block length the cool-down takes the rest of the run: ' + (Math.round(cd * 10) / 10) + ' km.');
    } else {
      // Block length is automatic: warm-up, cool-down and recoveries stay as set, blocks fill the rest.
      while (n > 1 && T - (n - 1) * rest - n * minBlk < 0) n--;
      const room = Math.max(0, T - (n - 1) * rest - n * minBlk);
      if (wu + cd > room) {
        const k = wu + cd > 0 ? room / (wu + cd) : 0; wu *= k; cd *= k;
        notes.push('Warm-up and cool-down were shortened to ' + (Math.round(wu * 10) / 10) + ' km and ' + (Math.round(cd * 10) / 10) + ' km to fit the blocks.');
      }
      b = (T - (n - 1) * rest - wu - cd) / n;
    }
    if (n < asked) notes.push('Only ' + n + ' block' + (n > 1 ? 's' : '') + ' fit in this distance.');
    return { n: n, blk: b, rest: rest, wu: wu, cd: cd, notes: notes };
  }

  /* Fixed-pace zones for marathon-pace templates: [startM, endM, role]. Roles: mp, fast, wu, cd, rec. */
  /* Fixed-pace zones for marathon-pace templates: [startM, endM, role]. Roles: mp, fast, wu, cd, rec. */
  function zonesFor(id, totalM, p) {
    const z = [], f = totalM / 100, notes = [];
    if (id === 'mplong') {
      // n MP blocks spread over the chosen stretch, easy gaps between them
      const a = p.start * f, L = Math.min(100 - p.start, p.len) * f / 1000;
      if (p.start + p.len > 100) notes.push('The marathon-pace stretch was shortened to end at the finish.');
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
      const lay = mpBlocks(totalM / 1000, p.n, p.rest, p.blkLen, p.wu, p.cd);
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

  /* Exact boundaries (as fractions of the run) for settings given as a percentage, so the plan changes
     where the setting says, not at the nearest split. */
  function fracCuts(id, p) {
    switch (id) {
      case 'negative': return [p.at / 100];
      case 'controlled': return [p.first / 100];
      case 'sitkick': case 'fastfinish': return [1 - p.last / 100];
      case 'midsurge': return [p.at / 100 - p.len / 200, p.at / 100 + p.len / 200];
      case 'blocks3': return [p.a / 100, (p.a + p.b) / 100];
      case 'tempo': return [p.wu / 100, 1 - p.cd / 100];
      case 'sandwich': { const wu = p.wu / 100, cd = p.cd / 100, md = p.mid / 100, c = (wu + 1 - cd) / 2; return [wu, 1 - cd, c - md / 2, c + md / 2]; }
      case 'stairs': { const k = Math.max(2, Math.round(p.steps)), o = []; for (let i = 1; i < k; i++) o.push(i / k); return o; }
      case 'pyramid': case 'pyramids': { const c = Math.max(1, Math.round(p.count || 1)), o = []; for (let i = 1; i < c; i++) o.push(i / c); return o; }
      default: return [];
    }
  }

  function segmentsFor(id, totalM, splitM, p, extra, zonesOverride) {
    const cuts = [0, totalM];
    fracCuts(id, p).forEach(function (f) { if (f > 0 && f < 1) cuts.push(f * totalM); });
    (extra || []).forEach(function (c) { if (c > 0 && c < totalM) cuts.push(c); });
    const zones = zonesOverride || zonesFor(id, totalM, p).zones;
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
        zonePace: zone ? zone[3] : undefined,
        incline: zone ? zone[4] : undefined,
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
      if (s.walk || s.zonePace || s.role === 'mp' || s.role === 'fast') return 0;
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

  /* ===== Structured long runs (from the long-run workout guides) =====
     A structure is a list of steps. Each step is a fixed distance (km), a fixed time (min), or an easy "fill"
     that absorbs whatever distance is left. Zone steps keep a fixed pace set from your marathon pace plus a
     zone offset; easy steps share one pace that is solved so the whole run still matches distance and goal. */
  const ZONE_DEFAULTS = { steady: 20, float: 18, sub: -8, lt: -15, hmp: -12, k10: -28, k5: -38 };
  const ZONE_LABELS = { steady: 'Steady (LT1)', float: 'Float', sub: 'Sub-threshold', lt: 'Threshold (LT2)', hmp: 'Half-marathon pace', k10: '10K pace', k5: '5K pace' };
  const ZONE_TAG = { steady: 'steady', float: 'float', mp: 'MP', fast: 'MP+', sub: 'sub-T', lt: 'threshold', hmp: 'HMP', k10: '10K', k5: '5K', hill: 'hill' };
  const En = function (km) { return { z: 'easy', km: km }; };
  const Fl = function (w) { return { z: 'easy', fill: w === undefined ? 1 : w }; };
  const Zn = function (z, km, o) { return Object.assign({ z: z, km: km }, o || {}); };
  const Tm = function (z, min, o) { return Object.assign({ z: z, min: min }, o || {}); };
  const Jg = function (sec) { return { z: 'easy', min: sec / 60 }; };   // easy jog by time
  const times = function (n, fn) { const o = []; for (let i = 0; i < Math.max(0, Math.round(n)); i++) fn(i, o); return o; };

  const LR = {
    pfitz: { g: 'lrmp', name: 'Pfitzinger classic', blurb: 'Easy running, then one long continuous block at marathon pace, then a short cool-down. The benchmark long run for marathon readiness.',
      d: { mp: 19, cd: 2.5 }, ui: [['mp', 'Marathon-pace block', 6, 26, 1, 'km'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) { return [Fl(), Zn('mp', p.mp), En(p.cd)]; } },
    mcmillan: { g: 'lrmp', name: 'McMillan fast-finish', blurb: 'Long easy running, a marathon-pace block, with the last kilometres a touch faster than marathon pace.',
      d: { mp: 8, fast: 2, fo: -7, cd: 2 }, ui: [['mp', 'Total at marathon pace or faster', 4, 14, 1, 'km'], ['fast', 'Faster final part', 0, 4, 0.5, 'km'], ['fo', 'Final part pace', -15, 0, 1, 'off'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) { return [Fl(), Zn('mp', Math.max(0, p.mp - p.fast)), Zn('fast', p.fast, { off: p.fo }), En(p.cd)]; } },
    mpsandwich: { g: 'lrmp', name: 'Marathon-pace sandwich', blurb: 'Early marathon-pace block, a long easy stretch, then a second block on tired legs, then a cool-down.',
      d: { wu: 3, a: 7, b: 7, cd: 2 }, ui: [['wu', 'Easy start', 1, 8, 0.5, 'km'], ['a', 'First MP block', 3, 12, 1, 'km'], ['b', 'Second MP block', 3, 12, 1, 'km'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) { return [En(p.wu), Zn('mp', p.a), Fl(), Zn('mp', p.b), En(p.cd)]; } },
    belly: { g: 'lrmp', name: 'Mid-run belly block', blurb: 'Easy running, a big marathon-pace block in the middle, then easy running to finish with good form.',
      d: { mp: 15, share: 50 }, ui: [['mp', 'Marathon-pace block', 6, 22, 1, 'km'], ['share', 'Easy km before the block', 10, 90, 5, 'pct']],
      build: function (p) { return [Fl(p.share), Zn('mp', p.mp), Fl(100 - p.share)]; } },
    broken: { g: 'lrmp', name: 'Classic broken MP reps', blurb: 'Several marathon-pace reps (like 4 × 5 km) with short easy or float recoveries. Easier on the legs than one long block.',
      d: { n: 4, blk: 5, rest: 1, fl: 0, cd: 3 }, ui: [['n', 'Reps', 2, 8, 1, 'x'], ['blk', 'Rep length', 2, 10, 0.5, 'km'], ['rest', 'Recovery', 0.5, 3, 0.5, 'km'], ['fl', 'Recovery type', 0, 1, 1, 'fl'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.n, function (i, o) { o.push(Zn('mp', p.blk)); if (i < p.n - 1) o.push(p.fl ? Zn('float', p.rest) : En(p.rest)); }), [En(p.cd)]); } },
    mpladder: { g: 'lrmp', name: 'Descending MP ladder', blurb: 'Marathon-pace reps that shrink (8, 6, 4 km) with easy gaps, then a short faster finish.',
      d: { top: 8, step: 2, rungs: 3, rest: 1.5, fin: 2, cd: 2 }, ui: [['top', 'Longest rep', 3, 12, 1, 'km'], ['step', 'Shrinks by', 0.5, 4, 0.5, 'km'], ['rungs', 'Reps', 2, 5, 1, 'x'], ['rest', 'Easy gap', 0.5, 3, 0.5, 'km'], ['fin', 'HMP finish', 0, 5, 0.5, 'km'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) {
        const o = [Fl()];
        times(p.rungs, function (r) { o.push(Zn('mp', Math.max(0.5, p.top - p.step * r))); if (r < p.rungs - 1 || p.fin > 0) o.push(En(p.rest)); });
        o.push(Zn('hmp', p.fin), En(p.cd)); return o;
      } },
    micro: { g: 'lrmp', name: 'MP micro-blocks', blurb: 'Many short marathon-pace blocks (like 9 × 2 km) with 1 km easy between. Low damage, high volume.',
      d: { n: 9, blk: 2, rest: 1, cd: 2 }, ui: [['n', 'Blocks', 4, 14, 1, 'x'], ['blk', 'Block length', 1, 4, 0.5, 'km'], ['rest', 'Easy between', 0.5, 2, 0.5, 'km'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.n, function (i, o) { o.push(Zn('mp', p.blk)); if (i < p.n - 1) o.push(En(p.rest)); }), [En(p.cd)]); } },
    mtm: { g: 'lrmp', name: 'Daniels M-T-M', blurb: 'Marathon pace, two threshold reps to spike lactate, then back down to marathon pace.',
      d: { a: 10, reps: 2, lt: 3, jog: 2, b: 6, cd: 3 }, ui: [['a', 'First MP block', 4, 16, 1, 'km'], ['reps', 'Threshold reps', 1, 4, 1, 'x'], ['lt', 'Threshold rep', 1, 5, 0.5, 'km'], ['jog', 'Jog between', 1, 4, 0.5, 'min'], ['b', 'Last MP block', 3, 12, 1, 'km'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) { return [Fl(), Zn('mp', p.a)].concat(times(p.reps, function (i, o) { o.push(Zn('lt', p.lt)); if (i < p.reps - 1) o.push(Jg(p.jog * 60)); }), [Zn('mp', p.b), En(p.cd)]); } },
    canova: { g: 'lrmp', name: 'Canova over/under', blurb: 'Continuous alternation: longer stretches just under marathon pace, short stretches faster. Goal pace becomes the "recovery".',
      d: { n: 5, under: 3, over: 1, up: 99, op: 104, cd: 3 }, ui: [['n', 'Pairs', 2, 8, 1, 'x'], ['under', 'Under stretch', 1, 5, 0.5, 'km'], ['over', 'Over stretch', 0.5, 3, 0.5, 'km'], ['up', 'Under speed', 95, 100, 1, 'pctmp'], ['op', 'Over speed', 101, 110, 1, 'pctmp'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.n, function (i, o) { o.push(Zn('mp', p.under, { pct: p.up }), Zn('hmp', p.over, { pct: p.op })); }), [En(p.cd)]); } },
    onoff: { g: 'lrmp', name: 'On/off float', blurb: 'Marathon-pace blocks with a steady float (not a jog) between them, keeping aerobic demand high.',
      d: { n: 6, mp: 3, fl: 1, off: 18, cd: 2 }, ui: [['n', 'Cycles', 3, 10, 1, 'x'], ['mp', 'MP block', 1, 6, 0.5, 'km'], ['fl', 'Float', 0.5, 3, 0.5, 'km'], ['off', 'Float pace', 5, 35, 1, 'off'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.n, function (i, o) { o.push(Zn('mp', p.mp), Zn('float', p.fl, { off: p.off })); }), [En(p.cd)]); } },
    ratchet: { g: 'lrmp', name: '1K/1K ratchet', blurb: 'Alternate 1 km at marathon pace with 1 km slower. Trains pace judgment and control.',
      d: { n: 10, km: 1, off: 25, cd: 2 }, ui: [['n', 'Pairs', 4, 14, 1, 'x'], ['km', 'Each stretch', 0.5, 2, 0.5, 'km'], ['off', 'Slower stretch', 10, 40, 1, 'off'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.n, function (i, o) { o.push(Zn('mp', p.km), Zn('float', p.km, { off: p.off })); }), [En(p.cd)]); } },
    thirds: { g: 'lrmp', name: 'Thirds progression', blurb: 'Easy first third, steady middle third, marathon pace for the last third. Teaches patience early and grit late.',
      d: { st: 22 }, ui: [['st', 'Middle third pace', 10, 35, 1, 'off']],
      build: function (p, c) { const t = c.tot / 3; return [En(t), Zn('steady', t, { off: p.st }), Zn('mp', t)]; } },
    stepdown: { g: 'lrmp', name: 'Step-down cutdown', blurb: 'Pace drops every 5 km through steady and high aerobic to marathon pace, then a faster finish.',
      d: { a: 5, b: 5, c: 5, d: 3, cd: 2, o1: 30, o2: 15, o3: -12 }, ui: [['a', 'Steady stretch', 2, 8, 1, 'km'], ['o1', 'Steady pace', 15, 45, 1, 'off'], ['b', 'High aerobic stretch', 2, 8, 1, 'km'], ['o2', 'High aerobic pace', 5, 30, 1, 'off'], ['c', 'Marathon-pace stretch', 2, 10, 1, 'km'], ['d', 'Sub-threshold finish', 1, 6, 0.5, 'km'], ['o3', 'Finish pace', -25, 0, 1, 'off'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) { return [Fl(), Zn('steady', p.a, { off: p.o1 }), Zn('float', p.b, { off: p.o2 }), Zn('mp', p.c), Zn('hmp', p.d, { off: p.o3 }), En(p.cd)]; } },
    squires: { g: 'lrmp', name: 'Squires surge long run', blurb: 'Long steady running with regular short surges at half-marathon or 10K effort, then straight back to rhythm.',
      d: { n: 8, every: 2.5, start: 8, len: 2, zn: 0 }, ui: [['n', 'Surges', 3, 12, 1, 'x'], ['every', 'Every', 1.5, 4, 0.5, 'km'], ['start', 'First surge at', 3, 14, 1, 'km'], ['len', 'Surge length', 1, 4, 0.5, 'min'], ['zn', 'Surge pace', 0, 1, 1, 'z2']],
      build: function (p, c) {
        const z = p.zn ? 'k10' : 'hmp', sk = p.len * 60 / c.pace(z);
        const gap = Math.max(0.2, p.every - sk), o = [En(p.start)];
        times(p.n, function (i) { o.push(Tm(z, p.len)); o.push(i < p.n - 1 ? En(gap) : Fl()); });
        return o;
      } },

    subt: { g: 'lrot', name: 'Sub-threshold embedded long run', blurb: 'Long run with several sub-threshold reps and short jogs, keeping lactate controlled across lots of volume.',
      d: { n: 4, rep: 3, jog: 75, cd: 4 }, ui: [['n', 'Reps', 2, 6, 1, 'x'], ['rep', 'Rep length', 1.5, 5, 0.5, 'km'], ['jog', 'Jog between', 30, 120, 15, 's'], ['cd', 'Easy finish', 0, 6, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.n, function (i, o) { o.push(Zn('sub', p.rep)); if (i < p.n - 1) o.push(Jg(p.jog)); }), [En(p.cd)]); } },
    bookend: { g: 'lrot', name: 'Bookend threshold sandwich', blurb: 'A threshold block early, a long easy middle, another threshold block late, then a cool-down.',
      d: { wu: 3, a: 3.5, b: 3.5, cd: 2 }, ui: [['wu', 'Easy start', 1, 6, 0.5, 'km'], ['a', 'First threshold block', 2, 6, 0.5, 'km'], ['b', 'Second threshold block', 2, 6, 0.5, 'km'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) { return [En(p.wu), Zn('lt', p.a), Fl(), Zn('lt', p.b), En(p.cd)]; } },
    cruise: { g: 'lrot', name: 'Late-run cruise intervals', blurb: 'Lots of easy running, then threshold cruise intervals at the end on tired legs.',
      d: { n: 4, rep: 2, jog: 90, cd: 2 }, ui: [['n', 'Reps', 2, 6, 1, 'x'], ['rep', 'Rep length', 1, 4, 0.5, 'km'], ['jog', 'Jog between', 30, 150, 15, 's'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.n, function (i, o) { o.push(Zn('lt', p.rep)); if (i < p.n - 1) o.push(Jg(p.jog)); }), [En(p.cd)]); } },
    tlt: { g: 'lrot', name: 'Daniels T-L-T', blurb: 'Threshold reps, a long steady bridge, then threshold reps again. Nearly 10 km of threshold work in one run.',
      d: { wu: 3, n: 3, rep: 1.6, rest: 60, cd: 2 }, ui: [['wu', 'Easy start', 1, 6, 0.5, 'km'], ['n', 'Reps per set', 2, 5, 1, 'x'], ['rep', 'Rep length', 1, 3, 0.2, 'km'], ['rest', 'Rest', 30, 120, 15, 's'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) {
        const set = function () { return times(p.n, function (i, o) { o.push(Zn('lt', p.rep)); if (i < p.n - 1) o.push(Jg(p.rest)); }); };
        return [En(p.wu)].concat(set(), [Fl()], set(), [En(p.cd)]);
      } },
    cutdown: { g: 'lrot', name: 'Multi-stage cutdown pyramid', blurb: 'Steady, then marathon pace, then half-marathon pace, then 10K pace as the blocks get shorter.',
      d: { st: 6, mp: 5, hm: 4, tk: 2, cd: 3 }, ui: [['st', 'Steady block', 2, 10, 1, 'km'], ['mp', 'Marathon-pace block', 2, 8, 1, 'km'], ['hm', 'HMP block', 1, 6, 0.5, 'km'], ['tk', '10K block', 0.5, 4, 0.5, 'km'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) { return [Fl(), Zn('steady', p.st), Zn('mp', p.mp), Zn('hmp', p.hm), Zn('k10', p.tk), En(p.cd)]; } },
    kitchen: { g: 'lrot', name: 'Kitchen sink hybrid', blurb: 'Steady running, threshold kilometres, then 400 m reps at 5K pace. Aerobic, threshold and speed in one run.',
      d: { st: 6, nt: 4, tk: 1, tj: 90, n5: 4, d5: 0.4, j5: 60, cd: 3 }, ui: [['st', 'Steady/MP block', 3, 10, 1, 'km'], ['nt', 'Threshold reps', 2, 6, 1, 'x'], ['tk', 'Threshold rep', 0.5, 2, 0.5, 'km'], ['tj', 'Threshold jog', 45, 120, 15, 's'], ['n5', '5K-pace reps', 2, 8, 1, 'x'], ['d5', '5K rep', 0.2, 1, 0.2, 'km'], ['j5', '5K jog', 30, 90, 15, 's'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) {
        return [Fl(), Zn('mp', p.st), Jg(180)].concat(
          times(p.nt, function (i, o) { o.push(Zn('lt', p.tk), Jg(p.tj)); }),
          times(p.n5, function (i, o) { o.push(Zn('k5', p.d5)); if (i < p.n5 - 1) o.push(Jg(p.j5)); }), [En(p.cd)]);
      } },
    wave: { g: 'lrot', name: 'Alternating wave', blurb: 'Continuous waves of half-marathon pace and steady running, with no slow jog. Spikes lactate then clears it.',
      d: { sets: 3, hmp: 2, st: 3, cd: 3 }, ui: [['sets', 'Waves', 2, 6, 1, 'x'], ['hmp', 'HMP stretch', 1, 4, 0.5, 'km'], ['st', 'Steady stretch', 1, 5, 0.5, 'km'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.sets, function (i, o) { o.push(Zn('hmp', p.hmp), Zn('steady', p.st)); }), [En(p.cd)]); } },
    michigan: { g: 'lrot', name: 'Road Michigan', blurb: 'A race-simulation run: surges at HMP, 10K and 5K effort separated by steady floats.',
      d: { h: 3, gap: 2.5, a: 2, b: 1.5, c: 1, cd: 3 }, ui: [['h', 'HMP surge', 1, 5, 0.5, 'km'], ['gap', 'Steady float', 1, 4, 0.5, 'km'], ['a', '10–15K surge', 1, 4, 0.5, 'km'], ['b', '10K surge', 0.5, 3, 0.5, 'km'], ['c', '5K surge', 0.5, 2, 0.5, 'km'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) { return [Fl(), Zn('hmp', p.h), Zn('steady', p.gap), Zn('k10', p.a, { add: 5 }), Zn('steady', p.gap), Zn('k10', p.b), Zn('steady', p.gap), Zn('k5', p.c), En(p.cd)]; } },
    rhythm: { g: 'lrot', name: '1/4 rhythm disrupter', blurb: 'Time-based fartlek: 1 minute fast, 4 minutes steady, repeated. The fast minute breaks rhythm; the steady float settles you back.',
      d: { n: 10, on: 1, off: 4, fo: 15, cd: 3 }, ui: [['n', 'Cycles', 4, 14, 1, 'x'], ['on', 'Fast', 0.5, 3, 0.5, 'min'], ['off', 'Steady', 2, 8, 1, 'min'], ['fo', 'Steady pace', 5, 30, 1, 'off'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.n, function (i, o) { o.push(Tm('k10', p.on), Tm('float', p.off, { off: p.fo })); }), [En(p.cd)]); } },
    deek: { g: 'lrot', name: 'Deek 5-on / 5-off', blurb: 'Time-based fartlek: 5 minutes near marathon-to-half-marathon effort, 5 minutes easy-moderate, repeated.',
      d: { n: 6, on: 5, off: 5, so: -6, cd: 3 }, ui: [['n', 'Cycles', 3, 10, 1, 'x'], ['on', 'On', 2, 8, 1, 'min'], ['off', 'Off (easy)', 2, 8, 1, 'min'], ['so', 'On pace', -15, 0, 1, 'off'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.n, function (i, o) { o.push(Tm('hmp', p.on, { off: p.so }), { z: 'easy', min: p.off }); }), [En(p.cd)]); } },
    kenyan: { g: 'lrot', name: 'Kenyan ladder fartlek', blurb: 'Time-based ladder of 1-2-3-2-1 minutes fast, each followed by an equal float.',
      d: { sets: 2, peak: 3, on: -18, cd: 4 }, ui: [['sets', 'Sets', 1, 4, 1, 'x'], ['peak', 'Longest rep', 2, 5, 1, 'min'], ['on', 'Fast pace', -30, -5, 1, 'off'], ['cd', 'Cool-down', 0, 6, 0.5, 'km']],
      build: function (p) {
        const reps = []; for (let k = 1; k <= p.peak; k++) reps.push(k); for (let k = p.peak - 1; k >= 1; k--) reps.push(k);
        return [Fl()].concat(times(p.sets, function (i, o) { reps.forEach(function (m) { o.push(Tm('hmp', m, { off: p.on }), Tm('float', m)); }); }), [En(p.cd)]);
      } },
    mona: { g: 'lrot', name: 'Double Mona fartlek', blurb: 'Late-run Mona fartlek sets (2×90 s, 4×60 s, 4×30 s, 4×15 s fast, equal float) done twice on tired legs.',
      d: { sets: 2, jog: 5, cd: 2 }, ui: [['sets', 'Mona sets', 1, 3, 1, 'x'], ['jog', 'Jog between sets', 2, 8, 1, 'min'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) {
        const pat = [[2, 90], [4, 60], [4, 30], [4, 15]], o = [Fl()];
        times(p.sets, function (i) {
          pat.forEach(function (q) { times(q[0], function () { o.push(Tm('k10', q[1] / 60), Tm('float', q[1] / 60)); }); });
          if (i < p.sets - 1) o.push(Jg(p.jog * 60));
        });
        o.push(En(p.cd)); return o;
      } },
    hmpdest: { g: 'lrot', name: 'HMP destroyer', blurb: 'The half-marathon predictor: 2 × 5 km (or 3 × 3.2 km) at half-marathon pace with easy jogs between.',
      d: { n: 2, rep: 5, rest: 1, cd: 4 }, ui: [['n', 'Reps', 2, 4, 1, 'x'], ['rep', 'Rep length', 2, 6, 0.2, 'km'], ['rest', 'Easy jog', 0.5, 2, 0.5, 'km'], ['cd', 'Cool-down', 0, 6, 0.5, 'km']],
      build: function (p) { return [Fl()].concat(times(p.n, function (i, o) { o.push(Zn('hmp', p.rep)); if (i < p.n - 1) o.push(En(p.rest)); }), [En(p.cd)]); } },
    hmpfinish: { g: 'lrot', name: 'Fast-finish sub-threshold grind', blurb: 'Lots of easy running, then a continuous half-marathon-pace block when glycogen is low.',
      d: { blk: 5, cd: 2 }, ui: [['blk', 'HMP block', 3, 8, 0.5, 'km'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) { return [Fl(), Zn('hmp', p.blk), En(p.cd)]; } },
    hillthr: { g: 'lrot', name: 'Hill-to-threshold', blurb: 'Short steep hill reps at 5K effort, then straight into a flat threshold block on tired legs. On a treadmill the reps use incline.',
      d: { n: 7, sec: 45, jog: 75, incl: 8, thr: 4, cd: 3 }, ui: [['n', 'Hill reps', 4, 10, 1, 'x'], ['sec', 'Rep length', 30, 90, 5, 's'], ['jog', 'Jog down', 45, 120, 15, 's'], ['incl', 'Hill incline', 2, 15, 0.5, 'pcti'], ['thr', 'Threshold block', 2, 6, 0.5, 'km'], ['cd', 'Cool-down', 0, 5, 0.5, 'km']],
      build: function (p) {
        return [Fl()].concat(times(p.n, function (i, o) { o.push(Tm('k5', p.sec / 60, { role: 'hill', incline: p.incl })); if (i < p.n - 1) o.push(Jg(p.jog)); }), [Jg(180), Zn('lt', p.thr), En(p.cd)]);
      } },
    lydiard: { g: 'lrot', name: 'Lydiard hill circuit', blurb: 'Easy start, a long block of hill surges for strength, then steady flat running to flush the legs out.',
      d: { mins: 28, incl: 5, st: 11, cd: 2 }, ui: [['mins', 'Hill circuit', 15, 40, 1, 'min'], ['incl', 'Hill incline', 2, 12, 0.5, 'pcti'], ['st', 'Steady flat', 5, 15, 1, 'km'], ['cd', 'Cool-down', 0, 4, 0.5, 'km']],
      build: function (p) { return [Fl(), Tm('lt', p.mins, { role: 'hill', incline: p.incl }), Zn('steady', p.st), En(p.cd)]; } }
  };
  const LR_IDS = Object.keys(LR);
  LR_IDS.forEach(function (id) {
    STRATEGIES.push({ id: id, group: LR[id].g, mp: true, name: LR[id].name, blurb: LR[id].blurb });
  });
  const LR_UI = {};
  LR_IDS.forEach(function (id) { LR_UI[id] = LR[id].ui; });

  function lrLayout(id, p, cfg, totalM) {
    const mp = cfg.mp > 0 ? cfg.mp : 330, zo = Object.assign({}, ZONE_DEFAULTS, cfg.zoneOff || {});
    const tot = totalM / 1000, notes = [];
    const paceOf = function (s) {
      if (s.pct) return mp * 100 / s.pct;
      const o = s.off != null ? s.off : (s.z === 'easy' ? 0 : (zo[s.z] || 0));
      return mp + o + (s.add || 0);
    };
    const ctx = { tot: tot, mp: mp, zo: zo, pace: function (z, o) { return paceOf(Object.assign({ z: z }, o || {})); } };
    const steps = LR[id].build(p, ctx).filter(function (s) { return s && s.fill !== 0 && s.km !== 0 && s.min !== 0; });
    let base = cfg.T / tot, dist = [], scaled = 1;
    for (let it = 0; it < 30; it++) {
      dist = steps.map(function (s) { return s.fill != null ? null : (s.km != null ? s.km : s.min * 60 / (s.z === 'easy' ? base : paceOf(s))); });
      let fixedSum = 0, fillW = 0;
      steps.forEach(function (s, i) { if (s.fill != null) fillW += s.fill; else fixedSum += dist[i]; });
      scaled = 1;
      if (fillW > 0) {
        let room = tot - fixedSum;
        if (room < 0.04 * tot) { scaled = 0.96 * tot / fixedSum; room = 0.04 * tot; }
        steps.forEach(function (s, i) { dist[i] = s.fill != null ? room * s.fill / fillW : dist[i] * scaled; });
      } else {
        scaled = fixedSum > 0 ? tot / fixedSum : 1;
        dist = dist.map(function (d) { return d * scaled; });
      }
      let fixedTime = 0, easyD = 0;
      steps.forEach(function (s, i) { if (s.z === 'easy') easyD += dist[i]; else fixedTime += dist[i] * paceOf(s); });
      const nb = easyD > 1e-6 ? (cfg.T - fixedTime) / easyD : base;
      if (!(nb > 0)) break;
      const done = Math.abs(nb - base) < 0.005;
      base = nb;
      if (done) break;
    }
    if (Math.abs(scaled - 1) > 0.005) notes.push('This structure is longer than your run, so every step was scaled to ' + Math.round(scaled * 100) + '% to fit.');
    const zones = []; let cum = 0;
    steps.forEach(function (s, i) {
      const a = cum * 1000; cum += dist[i];
      const b = i === steps.length - 1 ? totalM : cum * 1000;
      zones.push([a, b, s.role || s.z, s.z === 'easy' ? undefined : paceOf(s), s.incline]);
    });
    return { zones: zones, notes: notes };
  }

  /*
   cfg: { km, T (target s), treadmill, round, paceStep (s), speedStep (km/h), group (km, 0 = each split),
          comp, splitM (m), sp (per-strategy params), firstSlow (s/km, first km), kick (s/km, last km) }
  */
  function plan(id, cfg) {
    const p = params(id, cfg.sp);
    const mp = cfg.mp > 0 ? cfg.mp : 330;
    const totalM = Math.round(cfg.km * 1000);
    const win0 = Math.min(1000, totalM / 3);
    const lr = LR[id] ? lrLayout(id, p, cfg, totalM) : null;
    const segs = segmentsFor(id, totalM, cfg.splitM, p, [cfg.firstSlow ? win0 : 0, cfg.kick ? totalM - win0 : 0], lr && lr.zones);
    const m = multipliers(id, segs, totalM, p);
    segs.forEach(function (s) {
      if (s.zonePace) s.fixedPace = s.zonePace;
      else if (s.walk) s.fixedPace = p.wp;
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
        s.fx = !!s.fixedPace;
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
    if (MP_IDS.indexOf(id) >= 0 || LR[id]) {
      const q = function (x) { return fmtT(x) + ' /km'; };
      if (num <= 0 || base < mp - 0.5) w.push('To hit your goal, the easy parts would need ' + q(base) + ', faster than your marathon pace (' + q(mp) + '). Raise the goal time, shorten the marathon-pace part, or slow your marathon pace.');
      else if (base > mp * 1.6) w.push('The easy parts would be very slow (' + q(base) + ') next to your marathon pace (' + q(mp) + '). Check the goal time and marathon pace.');
    }
    res.warn = w;
    res.notes = lr ? lr.notes.slice() : (MP_IDS.indexOf(id) >= 0 ? zonesFor(id, totalM, p).notes : []);
    if (lr) { const off = Math.round(base - mp); res.notes.push('Easy parts run at ' + fmtT(base) + ' /km (MP' + (off >= 0 ? '+' : '\u2212') + Math.abs(off) + ' s/km).'); }
    if ((id === 'interval' && segs.length < Math.max(0, p.wu) + Math.max(0, p.cd) + 2) || (id === 'ladder' && segs.length < Math.max(0, p.wu) + Math.max(0, p.cd) + 3)) {
      res.notes.push('Too few splits for the warm-up and cool-down you set, so easy and hard splits simply alternate. Use a shorter split length.');
    }
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
      if (last && last.label === label && !!last.walk === !!s.walk && last.role === s.role && last.incline === s.incline) { last.endM = s.endM; last.endT = s.cum; }
      else out.push({ label: label, walk: s.walk, role: s.role, incline: s.incline, startM: s.startM, endM: s.endM, startT: s.startT, endT: s.cum });
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
      const msg = 'Interval ' + (i + 1) + (x.walk ? ' walk' : '') + (ZONE_TAG[x.role] ? ' ' + ZONE_TAG[x.role] : '') + ' (' + fmtKm(x.startM) + '-' + fmtKm(x.endM) + ' km)';
      return { dur: dur, speed: speed, msg: msg, incline: x.incline != null ? x.incline : incline };
    }).filter(function (r) { return r.dur > 0; });
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rows device="treadmill">\n';
    rows.forEach(function (r) {
      xml += '    <row duration="' + hms(r.dur) + '" speed="' + r.speed + '" inclination="' + r.incline + '" forcespeed="1" looptimehr="10">\n' +
        '        <textevent timeoffset="0" message="' + esc(r.msg) + '"/>\n    </row>\n';
    });
    xml += '</rows>\n';
    return { xml: xml, rows: rows, total: rows.reduce(function (a, r) { return a + r.dur; }, 0) };
  }

  const api = { qzWorkout: qzWorkout,
    STRATEGIES: STRATEGIES, MP_IDS: MP_IDS, LR_IDS: LR_IDS, LR_UI: LR_UI, ZONE_DEFAULTS: ZONE_DEFAULTS, ZONE_LABELS: ZONE_LABELS, ZONE_TAG: ZONE_TAG,
    isMpLike: function (id) { return MP_IDS.indexOf(id) >= 0 || !!LR[id]; }, PARAM_DEFAULTS: PARAM_DEFAULTS, params: params, plan: plan, timeAt: timeAt,
    checkpoints: checkpoints, windows: windows, fmtT: fmtT, fmtSigned: fmtSigned, fmtKm: fmtKm, runs: runs, buildSegments: buildSegments
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SplitEngine = api;
})(typeof self !== 'undefined' ? self : this);
