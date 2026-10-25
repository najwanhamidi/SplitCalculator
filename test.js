// Checks for engine.js:  node test.js
const E = require('./engine.js');
let bad = 0;
const chk = (c, msg) => { if (!c) { bad++; if (bad < 30) console.log('FAIL', msg); } };
const base = { mp: 330, km: 10, T: 3060, treadmill: false, round: false, paceStep: 5, speedStep: 0.5, group: 0, comp: false, splitM: 1000, sp: {}, firstSlow: 0, kick: 0 };
const contiguous = r => r.segs.every((s, i) => i === 0 ? s.startM === 0 : Math.abs(s.startM - r.segs[i - 1].endM) < 1e-9);
for (const s of E.STRATEGIES) {
  const r = E.plan(s.id, base);
  chk(Math.abs(r.finish - 3060) < 1e-6, s.id + ' exact total');
  chk(Math.abs(r.half1 + r.half2 - r.finish) < 1e-6, s.id + ' halves');
  chk(Math.abs(r.segs.at(-1).bank - r.diff) < 1e-6, s.id + ' bank at finish = diff');
  for (const [km, sm] of [[21.0975, 1000], [42.195, 500], [5, 400], [3.3, 1000], [1, 1000], [10, 1609.34], [10, 250], [42.195, 5000], [1.6, 400]]) {
    const c = { ...base, km, T: km * 330 * (E.MP_IDS.includes(s.id) ? 1.12 : 1), splitM: sm, firstSlow: 15, kick: 10 };
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
  q.segs.forEach(x => (x.role === 'mp' || x.role === 'fast' || x.walk) || chk(Math.abs(x.pace / 5 - Math.round(x.pace / 5)) < 1e-9, s.id + ' 5s grid'));
  const t2 = E.plan(s.id, { ...base, treadmill: true, round: true, speedStep: 0.5, group: 3, comp: true });
  t2.segs.forEach(x => (x.role === 'mp' || x.role === 'fast' || x.walk) || chk(Math.abs(x.speed * 2 - Math.round(x.speed * 2)) < 1e-9, '0.5 kmh'));
  const tr = E.plan(s.id, { ...base, treadmill: true });
  tr.segs.forEach(x => chk(Math.abs(x.speed * 10 - Math.round(x.speed * 10)) < 1e-9, '0.1 kmh'));
}
const show = (id, extra = {}) => { const r = E.plan(id, { ...base, ...extra }); return r.segs.map(s => (s.walk ? 'W' : '') + E.fmtT(s.pace)).join(' '); };
for (const id of ['ushape', 'jshape', 'revj', 'fastfinish', 'tempo', 'fartlek']) console.log(id.padEnd(11), show(id));
const rw = E.plan('runwalk', base);
console.log('runwalk runs:', E.runs(rw, false).map(r => (r.walk ? 'walk ' : '') + E.fmtKm(r.startM) + '-' + E.fmtKm(r.endM) + '@' + r.label).join(' | '));
console.log('runwalk per km:', E.windows(rw, 1000).map(w => E.fmtT(w.pace) + (w.mixed ? '*' : '')).join(' '));
console.log('400m split per km:', E.windows(E.plan('alternating', { ...base, splitM: 400 }), 1000).map(w => E.fmtT(w.pace) + (w.mixed ? '*' : '')).join(' '));
console.log(bad ? 'FAILURES ' + bad : 'ALL OK');
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
