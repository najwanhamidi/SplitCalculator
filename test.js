// Checks for engine.js:  node test.js
const E = require('./engine.js');
let bad = 0;
const chk = (c, msg) => { if (!c) { bad++; console.log('FAIL', msg); } };
const base = { km: 10, T: 3060, treadmill: false, round: false, paceStep: 5, speedStep: 0.5, group: 0, comp: false, splitM: 1000, sp: {}, firstSlow: 0, kick: 0 };
for (const s of E.STRATEGIES) {
  const r = E.plan(s.id, base);
  chk(Math.abs(r.finish - 3060) < 1e-6, s.id + ' exact total');
  chk(Math.abs(r.half1 + r.half2 - r.finish) < 1e-6, s.id + ' halves');
  chk(Math.abs(r.segs.at(-1).bank - r.diff) < 1e-6, s.id + ' bank at finish = diff');
  for (const [km, sm] of [[21.0975, 1000], [42.195, 500], [5, 400], [3.3, 1000], [1, 1000], [10, 1609.34], [10, 250], [42.195, 5000]]) {
    const c = { ...base, km, T: km * 330, splitM: sm, firstSlow: 15, kick: 10 };
    const q = E.plan(s.id, c);
    chk(Math.abs(q.finish - c.T) < 1e-6, s.id + ' total ' + km + '/' + sm);
    chk(Math.abs(q.segs.at(-1).endM - Math.round(km * 1000)) < 1e-6, 'covers distance');
    chk(q.segs.every(x => x.pace > 0), 'positive paces');
  }
  const c = { ...base, round: true, comp: true, group: 2 };
  const q = E.plan(s.id, c);
  chk(Math.abs(q.diff) <= 10, s.id + ' comp diff ' + q.diff);
  q.segs.forEach(x => chk(Math.abs(x.pace / 5 - Math.round(x.pace / 5)) < 1e-9, '5s grid'));
  const t2 = E.plan(s.id, { ...base, treadmill: true, round: true, speedStep: 0.5, group: 3, comp: true });
  t2.segs.forEach(x => chk(Math.abs(x.speed * 2 - Math.round(x.speed * 2)) < 1e-9, '0.5 kmh'));
  const tr = E.plan(s.id, { ...base, treadmill: true });
  tr.segs.forEach(x => chk(Math.abs(x.speed * 10 - Math.round(x.speed * 10)) < 1e-9, '0.1 kmh'));
}
// grouping by distance windows with 400 m splits: blocks should break at km marks
const g = E.plan('progressive', { ...base, splitM: 400, round: true, group: 2 });
console.log('400m/2km runs:', E.runs(g, false).map(r => E.fmtKm(r.startM) + '-' + E.fmtKm(r.endM) + '@' + r.label).join(' '));
// params
const n = E.plan('negative', { ...base, sp: { negative: { at: 70, v: 3 } } });
console.log('neg 70%:', E.runs(n, false).map(r => E.fmtKm(r.startM) + '-' + E.fmtKm(r.endM) + '@' + r.label).join(' '));
const iv = E.plan('interval', { ...base, sp: { interval: { wu: 2, cd: 1, hard: 1, easy: 1 } } });
console.log('interval:', iv.segs.map(s => E.fmtT(s.pace)).join(' '));
const st = E.plan('even', { ...base, firstSlow: 20, kick: 15 });
console.log('even+start/kick:', st.segs.map(s => E.fmtT(s.pace)).join(' '));
console.log('checkpoints marathon:', E.checkpoints(E.plan('even', { ...base, km: 42.195, T: 4 * 3600 })).map(c => c.label + ' ' + E.fmtT(c.t)).join(', '));
console.log(bad ? 'FAILURES ' + bad : 'ALL OK');
