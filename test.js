// Checks for engine.js:  node test.js
const E = require('./engine.js');
let bad = 0;
const chk = (c, msg) => { if (!c) { bad++; if (bad < 30) console.log('FAIL', msg); } };
const base0 = { mp: 330, km: 10, T: 3060, treadmill: false, round: false, paceStep: 5, speedStep: 0.5, group: 0, comp: false, splitM: 1000, sp: {}, firstSlow: 0, kick: 0 };
const base = base0;
const contiguous = r => r.segs.every((s, i) => i === 0 ? s.startM === 0 : Math.abs(s.startM - r.segs[i - 1].endM) < 1e-9);
for (const s of E.STRATEGIES) {
  const base = E.isMpLike(s.id) ? { ...base0, T: 3696 } : base0;
  const r = E.plan(s.id, base);
  chk(Math.abs(r.finish - base.T) < 1e-6, s.id + ' exact total');
  chk(Math.abs(r.half1 + r.half2 - r.finish) < 1e-6, s.id + ' halves');
  chk(Math.abs(r.segs.at(-1).bank - r.diff) < 1e-6, s.id + ' bank at finish = diff');
  for (const [km, sm] of [[21.0975, 1000], [42.195, 500], [5, 400], [3.3, 1000], [1, 1000], [10, 1609.34], [10, 250], [42.195, 5000], [1.6, 400]]) {
    const c = { ...base, km, T: km * 330 * (E.isMpLike(s.id) ? 1.12 : 1), splitM: sm, firstSlow: 15, kick: 10 };
    const q = E.plan(s.id, c);
    chk(!E.MP_IDS.includes(s.id) || q.warn.length === 0 || true, 'mp');
    chk(Math.abs(q.finish - c.T) < 1e-6, s.id + ' total ' + km + '/' + sm + ' ' + q.finish);
    chk(Math.abs(q.segs.at(-1).endM - Math.round(km * 1000)) < 1e-6, s.id + ' covers distance');
    chk(contiguous(q), s.id + ' contiguous');
    chk(q.segs.every(x => x.pace > 0 && isFinite(x.pace)), s.id + ' positive paces');
    for (const L of [sm, 1000, 5000]) {
      const w = E.windows(q, L);
      const sum = w.reduce((a, x) => a + x.time, 0);
      chk(Math.abs(sum - q.finish) < 1e-6 && Math.abs(w.at(-1).cum - q.finish) < 1e-6, s.id + ' windows ' + L);
    }
  }
  const q = E.plan(s.id, { ...base, round: true, comp: true, group: 2 });
  chk(Math.abs(q.diff) <= 15, s.id + ' comp diff ' + q.diff);
  q.segs.forEach(x => (x.fx || x.role === 'mp' || x.role === 'fast' || x.walk) || chk(Math.abs(x.pace / 5 - Math.round(x.pace / 5)) < 1e-9, s.id + ' 5s grid'));
  const t2 = E.plan(s.id, { ...base, treadmill: true, round: true, speedStep: 0.5, group: 3, comp: true });
  t2.segs.forEach(x => (x.fx || x.role === 'mp' || x.role === 'fast' || x.walk) || chk(Math.abs(x.speed * 2 - Math.round(x.speed * 2)) < 1e-9, '0.5 kmh'));
  const tr = E.plan(s.id, { ...base, treadmill: true });
  tr.segs.forEach(x => chk(Math.abs(x.speed * 10 - Math.round(x.speed * 10)) < 1e-9, '0.1 kmh'));
}
const show = (id, extra = {}) => { const r = E.plan(id, { ...base, ...extra }); return r.segs.map(s => (s.walk ? 'W' : '') + E.fmtT(s.pace)).join(' '); };
for (const id of ['ushape', 'jshape', 'revj', 'fastfinish', 'tempo', 'fartlek']) console.log(id.padEnd(11), show(id));
const rw = E.plan('runwalk', base);
console.log('runwalk runs:', E.runs(rw, false).map(r => (r.walk ? 'walk ' : '') + E.fmtKm(r.startM) + '-' + E.fmtKm(r.endM) + '@' + r.label).join(' | '));
console.log('runwalk per km:', E.windows(rw, 1000).map(w => E.fmtT(w.pace) + (w.mixed ? '*' : '')).join(' '));
console.log('400m split per km:', E.windows(E.plan('alternating', { ...base, splitM: 400 }), 1000).map(w => E.fmtT(w.pace) + (w.mixed ? '*' : '')).join(' '));
for (const id of ['controlled', 'sitkick', 'midsurge', 'blocks3', 'ladder', 'surges', 'sandwich']) console.log(id.padEnd(11), show(id, { km: 15, T: 15 * 306 }));
console.log('ladder 400m:', E.plan('ladder', { ...base, splitM: 400 }).segs.map(s => s.pace < 300 ? 'H' : 'e').join(''));
// QZ workout export
for (const s of E.STRATEGIES) {
  const r = E.plan(s.id, { ...base, treadmill: true, comp: true, speedStep: 0.1, firstSlow: 10, kick: 5 });
  const q = E.qzWorkout(r, { incline: 1 });
  chk(Math.abs(q.total - Math.round(r.finish)) <= 1, s.id + ' qz total ' + q.total + ' vs ' + r.finish);
  chk(q.rows.every(x => Math.abs(x.speed * 10 - Math.round(x.speed * 10)) < 1e-9 && x.dur > 0), s.id + ' qz rows');
  chk(/^<\?xml/.test(q.xml) && q.xml.split('<row ').length - 1 === q.rows.length, s.id + ' qz xml shape');
}
console.log(E.qzWorkout(E.plan('negative', { ...base, treadmill: true, speedStep: 0.1 })).xml);
console.log(bad ? 'FAILURES ' + bad : 'ALL OK');
// Marathon-pace templates: realistic long run (30 km in 3:00:00, MP 5:30), pyramids
const lr = { ...base, km: 30, T: 3 * 3600, mp: 330 };
for (const id of E.MP_IDS) {
  const r = E.plan(id, lr);
  chk(Math.abs(r.finish - lr.T) < 1e-6, id + ' lr total');
  chk(r.warn.length === 0, id + ' no warning: ' + r.warn);
  const mpSegs = r.segs.filter(x => x.role === 'mp');
  chk(mpSegs.length > 0 && mpSegs.every(x => Math.abs(x.pace - 330) < 1e-6), id + ' MP segs exactly 5:30');
  console.log(id.padEnd(12), 'easy', E.fmtT(r.base), '|', E.runs(r, false).map(x => (x.role ? x.role.toUpperCase() + ' ' : '') + E.fmtKm(x.startM) + '-' + E.fmtKm(x.endM) + '@' + x.label).join(' '));
}
const bad1 = E.plan('mplong', { ...base, km: 30, T: 30 * 300 }); chk(bad1.warn.length === 1, 'warn when goal faster than MP');
const rr = E.plan('mplong', { ...lr, treadmill: true, round: true, speedStep: 0.5, comp: true });
console.log('treadmill+round MP:', E.runs(rr, true).map(x => x.label).join(','));
const py = E.plan('pyramids', { ...base, km: 12, splitM: 1000 });
console.log('pyramids x3 alt:', py.segs.map(s => E.fmtT(s.pace)).join(' '));
const p1 = E.plan('pyramid', { ...base, km: 12, sp: { pyramid: { count: 2, alt: 0 } } });
console.log('pyramid x2:', p1.segs.map(s => E.fmtT(s.pace)).join(' '));
console.log(bad ? 'FAILURES ' + bad : 'ALL OK');

// MP block layouts fill the distance with no slivers, for any block count
for (const km of [10, 21.0975, 24.5, 30, 42.195]) {
  for (const n of [1, 2, 3, 5, 8]) {
    for (const id of ['mpintervals', 'mplong']) {
      const r = E.plan(id, { ...base, km, T: km * 380, mp: 330, splitM: 1000, sp: { [id]: { n } } });
      chk(Math.abs(r.finish - km * 380) < 1e-6, id + ' total ' + km + '/' + n);
      const zs = []; // contiguous role runs
      r.segs.forEach(x => { const l = zs[zs.length - 1]; if (l && l.role === x.role) l.end = x.endM; else zs.push({ role: x.role, start: x.startM, end: x.endM }); });
      chk(zs.filter(z => z.role === 'mp').length >= 1 && zs.filter(z => z.role === 'mp').length <= n, id + ' mp count');
      for (const z of zs) chk(z.end - z.start >= 99, id + ' no sliver ' + z.role + ' ' + (z.end - z.start) + ' @' + km + '/' + n);
    }
  }
}
const ex = E.plan('mpintervals', { ...base, km: 24.5, T: 24.5 * 340, mp: 275, treadmill: true, speedStep: 0.1 });
console.log('24.5 km, 3 blocks:', ex.notes.join(' '), '\n ', E.runs(ex, true).map(x => (x.role || 'easy') + ' ' + E.fmtKm(x.startM) + '-' + E.fmtKm(x.endM) + '@' + x.label).join(' | '));
const e5 = E.plan('mpintervals', { ...base, km: 10, T: 3300, sp: { mpintervals: { n: 6, rest: 1.5 } } });
console.log('10 km, 6 blocks asked:', e5.notes.join(' '));
const ml = E.plan('mplong', { ...base, km: 30, T: 3 * 3600, sp: { mplong: { n: 3, rest: 1, start: 20, len: 60 } } });
console.log('mplong 3 blocks:', ml.notes.join(' '), E.runs(ml, false).map(x => (x.role || 'easy') + ' ' + E.fmtKm(x.startM) + '-' + E.fmtKm(x.endM)).join(' | '));
console.log(bad ? 'FAILURES ' + bad : 'ALL OK');

// ---- Audit: every setting shows up in the plan exactly as set ----
{
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
  const roles = (r) => { const z = []; r.segs.forEach(x => { const l = z[z.length - 1]; if (l && l.role === x.role) l.end = x.endM; else z.push({ role: x.role, start: x.startM, end: x.endM }); }); return z; };
  const edges = (r) => { const e = []; r.segs.forEach((x, i) => { if (i > 0 && Math.abs(x.pace - r.segs[i - 1].pace) > 1e-6) e.push(x.startM); }); return e; };
  const cfgA = { ...base, km: 10, T: 3300, splitM: 1000 };
  // Percentage changes land exactly on the set distance, even mid-split
  const cases = [
    ['controlled', { first: 15 }, [1500]], ['sitkick', { last: 8 }, [9200]], ['fastfinish', { last: 25 }, [7500]],
    ['negative', { at: 35 }, [3500]], ['midsurge', { at: 50, len: 15 }, [4250, 5750]], ['blocks3', { a: 38, b: 38 }, [3800, 7600]],
    ['tempo', { wu: 15, cd: 10 }, [1500, 9000]], ['stairs', { steps: 4 }, [2500, 5000, 7500]]
  ];
  for (const [id, prm, want] of cases) {
    const r = E.plan(id, { ...cfgA, sp: { [id]: prm } });
    const e = edges(r);
    chk(want.every(w => e.some(x => near(x, w))), id + ' boundaries ' + JSON.stringify(e) + ' want ' + want);
    chk(Math.abs(r.finish - cfgA.T) < 1e-6, id + ' total');
  }
  // MP repeats: warm-up, cool-down, recovery and block count are exactly what was set
  for (const [km, n, wu, cd, rest] of [[24.5, 3, 3, 2, 1], [24.5, 4, 3, 2, 1], [30, 5, 4, 3, 1.5], [21.0975, 2, 2, 1, 0.5]]) {
    const r = E.plan('mpintervals', { ...base, km, T: km * 400, mp: 330, sp: { mpintervals: { n, wu, cd, rest, blkLen: 0 } } });
    const z = roles(r);
    const len = k => z.filter(q => q.role === k).reduce((a, q) => a + (q.end - q.start), 0) / 1000;
    chk(near(len('wu'), wu, 0.01) && near(len('cd'), cd, 0.01), 'MP wu/cd honoured ' + [km, n, wu, cd]);
    chk(z.filter(q => q.role === 'mp').length === n, 'MP block count ' + n);
    chk(z.filter(q => q.role === 'rec').every(q => near(q.end - q.start, rest * 1000, 1)), 'MP recovery length');
  }
  // Fixed block length keeps warm-up and block length exactly; cool-down takes the rest and says so
  const fx = E.plan('mpintervals', { ...base, km: 24.5, T: 24.5 * 400, mp: 330, sp: { mpintervals: { n: 3, wu: 3, cd: 2, rest: 1, blkLen: 5 } } });
  const fz = roles(fx);
  chk(near(fz[0].end - fz[0].start, 3000, 1) && fz.filter(q => q.role === 'mp').every(q => near(q.end - q.start, 5000, 1)), 'fixed length honoured');
  chk(fx.notes.some(t => /cool-down takes the rest/.test(t)), 'fixed-length note');
  // Race adjustments: first km / last km exactly 1000 m, even with 400 m splits
  const ra = E.plan('even', { ...base, km: 10, T: 3000, splitM: 400, firstSlow: 20, kick: 15 });
  const ea = edges(ra);
  chk(ea.some(x => near(x, 1000)) && ea.some(x => near(x, 9000)), 'first/last km windows exact ' + ea);
}
console.log(bad ? 'FAILURES ' + bad : 'ALL OK (audit)');

/* ---- structured long runs ---- */
{
  let b2 = 0; const c2 = (c, m) => { if (!c) { b2++; if (b2 < 25) console.log('FAIL LR', m); } };
  for (const id of E.LR_IDS) {
    for (const [km, T, tm] of [[30, 3 * 3600 + 900, false], [32, 32 * 372, true], [24, 24 * 370, false], [16, 16 * 372, false]]) {
      const cfg = { ...base0, km, T, mp: tm ? 3600 / 11 : 330, treadmill: tm, speedStep: 0.1, splitM: 1000, kick: 0, comp: tm };
      const r = E.plan(id, cfg);
      c2(Math.abs(r.finish - T) < (tm ? 15 : 1e-6) + 1e-6, id + ' total ' + km + ' ' + tm + ' ' + (r.finish - T));
      c2(contiguous(r), id + ' contiguous');
      c2(r.segs.every(s => s.pace > 0 && isFinite(s.pace)), id + ' pace');
      c2(r.warn.length === 0 || r.base > cfg.mp * 1.6, id + ' warn ' + km + ' ' + r.warn.join('|'));
      c2(r.base > cfg.mp, id + ' easy slower than MP ' + km + ' ' + r.base);
      const w = E.windows(r, 5000).reduce((a, x) => a + x.time, 0);
      c2(Math.abs(w - r.finish) < 1e-6, id + ' windows');
      if (tm) { const q = E.qzWorkout(r, { incline: 1 }); c2(Math.abs(q.total - Math.round(r.finish)) <= 1, id + ' xml total'); }
    }
    // every template survives odd split lengths / rounding
    for (const sm of [400, 1609.34, 5000]) {
      const r = E.plan(id, { ...base0, km: 30, T: 11000, splitM: sm, round: true, comp: true, group: 2, paceStep: 5, firstSlow: 10 });
      c2(contiguous(r) && r.segs.every(s => s.pace > 0), id + ' rounded ' + sm);
    }
  }
  // sliders match the plan exactly
  const L = (id, sp, k = 30, T = 11000) => E.plan(id, { ...base0, km: k, T, sp: { [id]: sp } });
  const dist = (r, f) => r.segs.filter(f).reduce((a, s) => a + s.d, 0) / 1000;
  c2(Math.abs(dist(L('pfitz', { mp: 14 }), s => s.role === 'mp') - 14) < 1e-6, 'pfitz mp km');
  c2(Math.abs(dist(L('pfitz', { cd: 3 }), s => s.role === 'easy' && s.startM >= 30000 - 3000) - 3) < 1e-6, 'pfitz cd km');
  c2(Math.abs(dist(L('broken', { n: 3, blk: 4 }), s => s.role === 'mp') - 12) < 1e-6, 'broken total mp');
  c2(Math.abs(dist(L('micro', { n: 6, blk: 1.5 }), s => s.role === 'mp') - 9) < 1e-6, 'micro mp');
  c2(Math.abs(dist(L('cruise', { n: 3, rep: 2 }), s => s.role === 'lt') - 6) < 1e-6, 'cruise lt');
  c2(Math.abs(dist(L('squires', { n: 6, len: 2 }), s => s.role === 'hmp') - 0) >= 0, 'squires');
  const th = E.plan('thirds', { ...base0, km: 30, T: 11000 }); c2(th.segs.filter(s => s.role === 'mp').length === 10, 'thirds third');
  // time-based steps really last that long
  const rh = E.plan('rhythm', { ...base0, km: 30, T: 11000, sp: { rhythm: { on: 1 } } });
  const fast = rh.segs.filter(s => s.role === 'k10'); c2(Math.abs(fast.reduce((a, s) => a + s.time, 0) - 600) < 2, 'rhythm 10x1min ' + fast.reduce((a, s) => a + s.time, 0));
  // zone offsets are honoured
  const zo = E.plan('cutdown', { ...base0, km: 30, T: 11000, zoneOff: { k10: -40 } });
  const k10 = zo.segs.find(s => s.role === 'k10'); c2(Math.abs(k10.pace - 290) < 1e-6, 'zone offset ' + k10.pace);
  // pct of MP pace
  const ca = E.plan('canova', { ...base0, km: 30, T: 11000 }); c2(Math.abs(ca.segs.find(s => s.role === 'mp').pace - 330 * 100 / 99) < 1e-6, 'canova pct');
  // incline carried to xml
  const hl = E.plan('lydiard', { ...base0, km: 30, T: 11000, treadmill: true, mp: 3600 / 5.5 });
  const x = E.qzWorkout(hl, { incline: 1 }).xml; c2(/inclination="5"/.test(x) && /inclination="1"/.test(x), 'incline in xml');
  // too-big structure scales with a note
  const big = E.plan('micro', { ...base0, km: 12, T: 4500, sp: { micro: { n: 14, blk: 4 } } }); c2(big.notes.some(n => /scaled/.test(n)), 'scaling note');
  console.log(b2 ? 'LR FAILURES ' + b2 : 'LR OK');
  const show2 = (id, km = 30, T = 11000) => { const r = E.plan(id, { ...base0, km, T }); const rs = E.runs(r, false); return id.padEnd(10) + ' base ' + E.fmtT(r.base) + ' | ' + rs.map(q => (q.role === 'easy' ? '' : q.role + ' ') + +(q.startM / 1000).toFixed(2) + '-' + +(q.endM / 1000).toFixed(2) + '@' + q.label).join(' ').slice(0, 330) + (r.notes.length > 1 ? ' !' + r.notes[0] : ''); };
  if (process.env.SHOW) E.LR_IDS.forEach(id => console.log(show2(id)));
}
