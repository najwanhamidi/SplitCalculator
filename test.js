// Checks for engine.js:  node test.js
const E = require('./engine.js');
let bad = 0;
const chk = (c, msg) => { if (!c) { bad++; if (bad < 30) console.log('FAIL', msg); } };
const base = { km: 10, T: 3060, treadmill: false, round: false, paceStep: 5, speedStep: 0.5, group: 0, comp: false, splitM: 1000, sp: {}, firstSlow: 0, kick: 0 };
const contiguous = r => r.segs.every((s, i) => i === 0 ? s.startM === 0 : Math.abs(s.startM - r.segs[i - 1].endM) < 1e-9);
for (const s of E.STRATEGIES) {
  const r = E.plan(s.id, base);
  chk(Math.abs(r.finish - 3060) < 1e-6, s.id + ' exact total');
  chk(Math.abs(r.half1 + r.half2 - r.finish) < 1e-6, s.id + ' halves');
  chk(Math.abs(r.segs.at(-1).bank - r.diff) < 1e-6, s.id + ' bank at finish = diff');
  for (const [km, sm] of [[21.0975, 1000], [42.195, 500], [5, 400], [3.3, 1000], [1, 1000], [10, 1609.34], [10, 250], [42.195, 5000], [1.6, 400]]) {
    const c = { ...base, km, T: km * 330, splitM: sm, firstSlow: 15, kick: 10 };
    const q = E.plan(s.id, c);
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
  q.segs.forEach(x => chk(Math.abs(x.pace / 5 - Math.round(x.pace / 5)) < 1e-9, s.id + ' 5s grid'));
  const t2 = E.plan(s.id, { ...base, treadmill: true, round: true, speedStep: 0.5, group: 3, comp: true });
  t2.segs.forEach(x => chk(Math.abs(x.speed * 2 - Math.round(x.speed * 2)) < 1e-9, '0.5 kmh'));
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
