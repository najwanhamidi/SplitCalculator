const E=require('./engine.js');
let bad=0;
function chk(c,msg){ if(!c){bad++;console.log('FAIL',msg);} }
const base={km:10,T:3060,treadmill:false,round:false,paceStep:5,speedStep:0.5,group:0,comp:false,variation:2,splitM:1000,hard:2,easy:1};
for(const s of E.STRATEGIES){
  const r=E.plan(s.id,base); chk(Math.abs(r.finish-3060)<1e-6,s.id+' exact total '+r.finish);
  chk(r.segs.length===10,'10 segs');
  // other distances / split lengths
  for(const [km,sm] of [[21.0975,1000],[42.195,500],[5,400],[3.3,1000],[1,1000]]){
    const c={...base,km,T:km*330,splitM:sm}; const q=E.plan(s.id,c); chk(Math.abs(q.finish-c.T)<1e-6,s.id+' total '+km);
  }
  // rounding w/ comp: error bounded
  const c={...base,round:true,comp:true,group:2}; const q=E.plan(s.id,c); chk(Math.abs(q.diff)<=5*2,s.id+' comp diff '+q.diff);
  q.segs.forEach(x=>chk(Math.abs(x.pace/5-Math.round(x.pace/5))<1e-9,'5s grid '+x.pace));
  // treadmill
  const t={...base,treadmill:true}; const tr=E.plan(s.id,t);
  tr.segs.forEach(x=>chk(Math.abs(x.speed*10-Math.round(x.speed*10))<1e-9,'0.1 kmh '+x.speed));
  const t2={...base,treadmill:true,round:true,speedStep:0.5,group:3,comp:true}; const t2r=E.plan(s.id,t2);
  t2r.segs.forEach(x=>chk(Math.abs(x.speed*2-Math.round(x.speed*2))<1e-9,'0.5 kmh '+x.speed));
  console.log(s.id.padEnd(12),E.fmtT(r.finish),'| 5s+2km:',E.fmtT(q.finish),E.runs(q,false).map(r=>E.fmtKm(r.startM)+'-'+E.fmtKm(r.endM)+'@'+r.label).join(' '),'| TM:',E.runs(t2r,true).map(r=>r.label).join(','));
}
// even pace, rounded to 5s without comp: single pace
const ev=E.plan('even',{...base,round:true});
console.log('even 5s',E.runs(ev,false),E.fmtT(ev.finish));
console.log(bad?'FAILURES '+bad:'ALL OK');
