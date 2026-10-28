// Live regression check for the plane resolver: compares /plane-resolve (without the feed reg) against airports whose feed lists the registration (BHX/GLA/BRS via AeroDataBox).
// Before ccba902+1 (28 Oct 2026, 86 flights): Confirmed/Likely 8 right, 7 wrong. After: 7 right, 0 wrong; 2 wrong guesses now shown as "Possible".
// Run: node scripts/plane-accuracy.mjs (server on :8787). Exit code 1 if any Confirmed/Likely is wrong.
const B="http://localhost:8787/api";const j=u=>fetch(B+u).then(r=>r.json());
(async()=>{const rows=[];for(const a of ["BHX","GLA","BRS"])for(const dir of ["dep","arr"]){try{(await j(`/board/${a}?dir=${dir}`)).flights.forEach(f=>f.aircraft?.reg&&rows.push(f))}catch{}}
const seen=new Set();const S={};for(const f of rows){if(seen.has(f.number))continue;seen.add(f.number);
const q=new URLSearchParams({number:f.number,o:f.origin?.iata||"",d:f.destination?.iata||"",status:f.status||"",dep:f.dep?.scheduled||"",arr:f.arr?.scheduled||"",depActual:f.dep?.actual||"",arrActual:f.arr?.actual||"",date:f.date});
let r;try{r=await j("/plane-resolve?"+q)}catch(e){r={}}const ok=!r.reg?"none":r.reg.replace(/-/g,"")===f.aircraft.reg.replace(/-/g,"")?"right":"WRONG";const k=(r.confidence||"-")+":"+ok;S[k]=(S[k]||0)+1;
if(ok==="WRONG")console.log("WRONG",f.number,f.origin?.iata,f.destination?.iata,f.status,"feed",f.aircraft.reg,"got",r.reg,r.confidence,r.how,r.reason?.slice(0,140))}
console.log(JSON.stringify(S),"n",seen.size);if(Object.keys(S).some(k=>/^(confirmed|likely):WRONG/.test(k)))process.exitCode=1})()
