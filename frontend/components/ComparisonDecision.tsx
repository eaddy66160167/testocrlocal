"use client";
import Link from "next/link";
import {useState} from "react";
import type {Comparison,Decision,Identity,Pair} from "@/types/comparison";
import {percent} from "@/components/MatrixTable";

const number=(n:number|null|undefined)=>n==null?"—":n.toLocaleString("th-TH",{maximumFractionDigits:2});
export function nameOf(id:string|null,identities:Identity[]){return identities.find(p=>p.pipeline_id===id)?.pipeline_name||id||"—";}
export function verdict(p:Pair,identities:Identity[]){return p.verdict==="insufficient"?"ข้อมูลยังไม่พอ":p.verdict==="inconclusive"?"สูสี ยังสรุปไม่ได้":`${nameOf(p.winner,identities)} ดีกว่าชัดเจน`;}
export function PairDetail({decision,identities}:{decision:Decision;identities:Identity[]}){
 return <details className="panel panel-body"><summary className="cursor-pointer font-semibold">รายละเอียดการเทียบเป็นคู่</summary><p className="filter-note">เทียบเฉพาะชุดที่ทั้งคู่มี GT ยืนยันและผลประเมินสุดท้าย · PDF หลายหน้านับเป็นเอกสารเดียว · ช่วง 95% จากการสุ่มเอกสารซ้ำ 2,000 ครั้ง ไม่ใช่การรับรองว่าชนะเสมอ</p>
 <PairTable pairs={decision.pairs} identities={identities}/>
 {decision.historical_pairs.length>0&&<><h3>ข้อมูลคู่ในอดีต (เก็บถาวร) — ไม่ใช้แนะนำตอนนี้</h3><PairTable pairs={decision.historical_pairs} identities={identities}/></>}
 </details>;
}
function PairTable({pairs,identities}:{pairs:Pair[];identities:Identity[]}){
 return <div className="table-wrap" tabIndex={0}><table className="data-table" aria-label="หลักฐานการเทียบคู่"><thead><tr>{["คู่ Pipeline","เอกสาร / ชุด","CER A / B","ส่วนต่าง A − B (pp)","ช่วง 95% (pp)","A ชนะ / เสมอ / B ชนะ","ข้อสรุป"].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{pairs.map(p=><tr key={`${p.a}:${p.b}`}><td>{nameOf(p.a,identities)} ↔ {nameOf(p.b,identities)}{(!identities.find(i=>i.pipeline_id===p.a)?.active||!identities.find(i=>i.pipeline_id===p.b)?.active)&&<span className="badge neutral">เก็บถาวร</span>}</td><td>{p.documents} / {p.test_cases}</td><td>{percent(p.mean_cer_a)} / {percent(p.mean_cer_b)}</td><td>{number(p.mean_dcer_pp)}</td><td>{p.ci95_pp?p.ci95_pp.map(number).join(" ถึง "):"—"}</td><td>{p.wins} / {p.ties} / {p.losses}</td><td>{verdict(p,identities)}</td></tr>)}</tbody></table>{!pairs.length&&<p className="filter-note">ต้องมี Pipeline ที่ใช้งานอยู่อย่างน้อยสองตัวเพื่อเทียบเป็นคู่</p>}</div>;
}
function nextActions(data:Comparison){
 const r=data.overall.readiness, actions:string[]=[];
 const missingGT=r.valid_pair?r.reasons.missing_gt:data.actions.missing_gt;
 if(missingGT)actions.push(`ยืนยัน Ground Truth อีก ${missingGT} ชุด`);
 if(r.reasons.not_run)actions.push(`รันคู่หลักให้ครบอีก ${r.reasons.not_run} ชุด`);
 if(r.reasons.failed)actions.push(`ตรวจผลรันไม่สำเร็จ ${r.reasons.failed} ชุด`);
 if(!r.valid_pair){for(const a of data.actions.missing_runs.filter(a=>a.count))actions.push(`รัน ${a.pipeline_name} เพิ่มใน ${a.count} ชุด`);for(const a of data.actions.failed_runs.filter(a=>a.count))actions.push(`ตรวจผลรันไม่สำเร็จของ ${a.pipeline_name} ${a.count} ชุด`);}
 const p=data.overall.featured_pair;
 if(p && p.documents<data.minimum_documents)actions.push(`เพิ่มเอกสารที่ทั้งคู่มีผลยืนยันอีก ${data.minimum_documents-p.documents} เอกสาร`);
 for(const t of data.actions.short_types)actions.push(`${t.name}: เพิ่มเอกสารที่ประเมินแล้วอีก ${t.needed} เอกสาร และรันให้ครบคู่`);
 if(data.actions.largest_spread.length)actions.push(`ตรวจชุดที่ผลต่างกันมาก ${data.actions.largest_spread.length} ชุด`);
 if(data.actions.hardest.length)actions.push(`ตรวจชุดที่ยังอ่านได้ยาก ${data.actions.hardest.length} ชุด`);
 return actions;
}
function ManualPair({data}:{data:Comparison}){
 const d=data.overall, pairs=[...d.pairs,...d.historical_pairs];
 const [chosen,setChosen]=useState<[string,string]|null>(null);
 const a=chosen?.[0]??d.featured_pair?.a??data.pipelines[0]?.pipeline_id??"";
 const b=chosen?.[1]??d.featured_pair?.b??data.pipelines.find(i=>i.pipeline_id!==a)?.pipeline_id??"";
 const pair=pairs.find(p=>(p.a===a&&p.b===b)||(p.a===b&&p.b===a));
 const historical=pair&&d.historical_pairs.includes(pair);
 return <section className="panel panel-body" aria-label="เปรียบเทียบสอง Pipeline โดยตรง"><h2 className="text-lg font-semibold">เปรียบเทียบสอง Pipeline โดยตรง</h2>
 <div className="flex flex-wrap gap-3 items-end my-3"><label className="field min-w-0 flex-1">Pipeline A<select className="input" value={a} onChange={e=>setChosen([e.target.value,b])}><option value="">เลือก Pipeline</option>{data.pipelines.map(i=><option key={i.pipeline_id} value={i.pipeline_id}>{i.pipeline_name}{i.active?"":" (เก็บถาวร)"}</option>)}</select></label><span>VS</span><label className="field min-w-0 flex-1">Pipeline B<select className="input" value={b} onChange={e=>setChosen([a,e.target.value])}><option value="">เลือก Pipeline</option>{data.pipelines.map(i=><option key={i.pipeline_id} value={i.pipeline_id}>{i.pipeline_name}{i.active?"":" (เก็บถาวร)"}</option>)}</select></label></div>
 {historical&&<p className="badge neutral">ข้อมูลในอดีต — ไม่ใช้แนะนำตอนนี้</p>}
 <p className="font-semibold">{a===b?"เลือก Pipeline คนละตัว":pair?verdict(pair,data.pipelines):"ยังไม่มีข้อมูลคู่นี้สำหรับเปรียบเทียบ"}</p>
 {pair&&<><p>เทียบตรงกัน {pair.documents} เอกสาร · {pair.test_cases} ชุดทดสอบ</p><details className="mt-3"><summary className="cursor-pointer">ดูหลักฐานเชิงสถิติ</summary><PairTable pairs={[pair]} identities={data.pipelines}/></details></>}
 <p className="filter-note">การเลือกคู่นี้ใช้ตรวจผลเท่านั้น ไม่เปลี่ยนคำแนะนำของระบบ</p></section>;
}
export function DecisionOverview({data}:{data:Comparison}){
 const d=data.overall,r=d.readiness,p=d.featured_pair,leader=d.ranking[0];
 const leaderCer=p&&leader?(p.a===leader.pipeline_id?p.mean_cer_a:p.b===leader.pipeline_id?p.mean_cer_b:null):null;
 const empty=data.latest_results===0, actions=nextActions(data), next=empty?"เริ่มทดสอบ OCR และยืนยัน Ground Truth":actions[0]??"ตรวจผลรายชุดทดสอบ และเพิ่มเอกสารที่เทียบตรงกัน";
 return <>
 <section className="panel panel-body" aria-label="คำแนะนำปัจจุบัน" data-testid="comparison-hero"><h2 className="text-2xl font-semibold">{empty?"ยังไม่มีข้อมูลสำหรับเปรียบเทียบ":d.recommendation?"แนะนำตอนนี้":"ยังตัดสินผู้ชนะไม่ได้"}</h2>
 {empty?<p className="mt-3">เริ่มจากทดสอบ OCR และยืนยัน Ground Truth แล้วผลเปรียบเทียบจะปรากฏที่นี่</p>:<><p className="text-xl font-semibold mt-3">{d.recommendation?nameOf(d.recommendation,data.pipelines):leader?`${leader.pipeline_name} นำเชิงตัวเลข`:"ยังไม่มีคู่ที่มีข้อมูลพร้อมเทียบ"}</p><p>{d.recommendation?"ชนะตัวเลือกอันดับถัดไปอย่างชัดเจน":"หลักฐานยังไม่ชัดพอที่จะประกาศผู้ชนะ"}</p><p>เทียบตรงกัน {p?.documents??0} เอกสาร</p>{!r.valid_pair&&r.reason&&<p className="filter-note">{r.reason}</p>}</>}
 </section>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="comparison-simple-cards">
 <section className="panel panel-body"><h3 className="font-semibold">ใครนำด้านความแม่นยำ?</h3><p className="mt-2">{empty||!leader?"ยังไม่มีผลที่ยืนยัน":leader.pipeline_name}</p>{leaderCer!==null&&<p>CER {percent(leaderCer)} · ยิ่งต่ำยิ่งดี</p>}</section>
 <section className="panel panel-body"><h3 className="font-semibold">มีข้อมูลเทียบตรงกันเท่าไร?</h3><p className="mt-2">{p?.documents??0} เอกสาร · {p?.test_cases??0} ชุดทดสอบ</p><p className="filter-note">เอกสารที่ทั้งคู่มี Ground Truth และผลที่ใช้เทียบได้</p></section>
 <section className="panel panel-body"><h3 className="font-semibold">ควรทำอะไรต่อ?</h3><p className="mt-2">{next}</p>{empty&&<Link className="text-link" href="/">เริ่มทดสอบ OCR</Link>}</section>
 </div>
 {!empty&&<><section className="panel panel-body"><h2 className="text-lg font-semibold">ขั้นตอนถัดไป</h2><ul className="list-disc pl-5 mt-3">{actions.slice(0,3).map(a=><li key={a}>{a}</li>)}</ul><details className="mt-3"><summary className="cursor-pointer">ดูทั้งหมด</summary><ul className="list-disc pl-5">{actions.slice(3).map(a=><li key={a}>{a}</li>)}</ul>{[...data.actions.largest_spread,...data.actions.hardest].map((c,i)=><p key={`${c.test_case_id}-${i}`}><Link className="text-link" href={c.href}>{c.filename}</Link></p>)}</details></section><ManualPair data={data}/></>}
 {!empty&&<details className="panel panel-body"><summary className="cursor-pointer font-semibold">รายละเอียดเพิ่มเติม</summary><details className="my-3"><summary className="cursor-pointer">หลักฐานเชิงสถิติ</summary><p>พร้อมเทียบ {r.x} จาก {r.y} ชุด · {r.documents} เอกสาร</p><p>รอ GT {r.reasons.missing_gt} · ยังไม่รัน {r.reasons.not_run} · รันไม่สำเร็จ {r.reasons.failed} · ไม่เข้าเกณฑ์อื่น {r.reasons.other}</p><PairDetail decision={d} identities={data.pipelines}/></details><details className="my-3"><summary className="cursor-pointer">ความแม่นยำ × เวลา</summary><Scatter decision={d}/></details><details><summary className="cursor-pointer">เปรียบเทียบทุก Pipeline</summary><PairTable pairs={[...d.pairs,...d.historical_pairs]} identities={data.pipelines}/></details></details>}
 </>;
}
export function Scatter({decision}:{decision:Decision}){
 const s=decision.scatter, points=s.points.filter(p=>p.cer!==null&&p.time_seconds!==null);
 const maxX=Math.max(1,...points.map(p=>p.time_seconds!))*1.15,maxY=Math.max(.01,...points.map(p=>p.cer!))*1.15;
 const x=(n:number)=>70+n/maxX*580,y=(n:number)=>285-n/maxY*220;
 const frontier=points.filter(p=>p.active&&p.pareto).sort((a,b)=>a.time_seconds!-b.time_seconds!);
 return <section className="panel panel-body"><h2 className="text-lg font-semibold">ความแม่นยำ × เวลา</h2><p className="filter-note">CER และเวลายิ่งต่ำยิ่งดี · มุมซ้ายล่างดีกว่า · จุดทึบต้องมี ≥5 เอกสารที่ประเมินและ ≥5 ผลรันที่มีเวลา</p>{!s.pareto_valid&&<p className="notice-banner">{s.cohort_mode==="own"?"ชุดเอกสารไม่ตรงกัน เทียบกันตรง ๆ ไม่ได้":"เวลาของบาง Pipeline ไม่ครบ จึงยังไม่แสดงแนว Pareto"}</p>}
 <svg role="img" aria-label="กราฟ CER เฉลี่ยกับเวลาเฉลี่ยต่อชุดทดสอบ" viewBox="0 0 720 350" className="w-full"><line x1="70" y1="285" x2="650" y2="285" stroke="currentColor"/><line x1="70" y1="65" x2="70" y2="285" stroke="currentColor"/>{[0,.5,1].map(t=><g key={t}><text x={x(maxX*t)} y="307" textAnchor="middle" fontSize="12">{number(maxX*t)}</text><text x="60" y={y(maxY*t)} textAnchor="end" fontSize="12">{percent(maxY*t)}</text></g>)}<text x="350" y="338" textAnchor="middle" fontSize="14">เวลาเฉลี่ยต่อชุดทดสอบ (วินาที)</text><text x="70" y="35" fontSize="14">CER เฉลี่ย</text>
 {s.pareto_valid&&frontier.length>0&&<polyline data-testid="pareto-frontier" points={frontier.map(p=>`${x(p.time_seconds!)},${y(p.cer!)}`).join(" ")} fill="none" stroke="#0d9488" strokeWidth="2"/>}
 {points.map((p,i)=><circle key={p.pipeline_id} cx={x(p.time_seconds!)} cy={y(p.cer!)} r="7" tabIndex={0} aria-label={`${p.pipeline_name}: CER ${percent(p.cer)}, ${number(p.time_seconds)} วินาที, ${p.documents} เอกสาร, ${p.timed_runs} runs, ${p.cohort_mode}, ${p.active?"ใช้งานอยู่":"เก็บถาวร"}`} fill={p.filled?`hsl(${i*65},60%,40%)`:"white"} stroke={`hsl(${i*65},60%,40%)`} strokeWidth="2" strokeDasharray={!p.active?"3 2":undefined}><title>{p.pipeline_name} · CER {percent(p.cer)} · {number(p.time_seconds)} วินาที · n={p.documents} เอกสาร · {p.timed_runs} runs · {p.cohort_mode} · {p.active?"ใช้งานอยู่":"เก็บถาวร"}</title></circle>)}</svg>
 <ul className="filter-note">{s.points.map(p=><li key={p.pipeline_id}>{p.pipeline_name}{!p.active?" · เก็บถาวร":""} · CER {percent(p.cer)} · {number(p.time_seconds)} วินาที · n={p.documents} เอกสาร / {p.timed_runs} runs · {p.cohort_mode==="common"?"เอกสารร่วมกัน":"เอกสารของ Pipeline นี้"}{p.pareto&&s.pareto_valid?" · แนว Pareto":""}</li>)}</ul><p className="filter-note">เอกสารร่วมกันของ active ทั้งหมด: {s.common_documents} เอกสาร / {s.common_test_cases} ชุด · เวลาของ Global workflow เป็นผลรวมเวลา Field ไม่ใช่เวลารอทั้งหน้า</p></section>;
}
function ByTypeTable({data}:{data:Comparison}){
 return <section className="panel panel-body"><h2 className="text-lg font-semibold">ควรใช้ Pipeline ไหนกับเอกสารประเภทนี้?</h2><div className="table-wrap" tabIndex={0}><table className="data-table" style={{minWidth:700}} aria-label="เปรียบเทียบตามประเภทเอกสาร"><thead><tr><th>ประเภทเอกสาร</th>{data.pipelines.map(p=><th key={p.pipeline_id}>{p.pipeline_name}{!p.active&&<span className="badge neutral">เก็บถาวร</span>}</th>)}</tr></thead><tbody>{data.by_type.map(g=><tr key={g.code}><td style={{minWidth:260}}><strong>{g.name}</strong>{g.archived&&<span className="badge neutral">เก็บถาวร</span>}<p>{g.documents} เอกสารในขอบเขต</p><p className="font-semibold">{g.decision.recommendation?`แนะนำ: ${nameOf(g.decision.recommendation,data.pipelines)}`:g.decision.featured_pair&&g.decision.featured_pair.documents>=data.minimum_documents?"ยังไม่มีผู้ชนะชัดเจน":`ยังไม่พอจัดอันดับ · มี ${g.decision.featured_pair?.documents??0} จาก ${data.minimum_documents} เอกสารที่ต้องมี`}</p>{new Set(g.decision.cells.map(c=>c.documents)).size>1&&<p className="filter-note">n ต่างกัน — ดูเทียบทีละคู่</p>}<PairDetail decision={g.decision} identities={data.pipelines}/></td>{g.decision.cells.map(c=><td key={c.pipeline_id} style={{backgroundColor:c.cer===null?undefined:`rgba(13,148,136,${Math.min(.2,c.cer*.2)})`}}>{percent(c.cer)}<span className="row-meta">n={c.documents} เอกสาร</span></td>)}</tr>)}</tbody></table></div><p className="filter-note">ตัวเลขในแต่ละช่องคำนวณจากเอกสารที่ Pipeline นั้นมีผล ส่วนคำแนะนำคำนวณจากเอกสารชุดเดียวกันแบบเทียบเป็นคู่</p></section>;
}

export function ByType({data}:{data:Comparison}){
 return <><div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="คำแนะนำตามประเภทเอกสาร">{data.by_type.map(g=>{
 const d=g.decision,p=d.featured_pair,leader=d.ranking[0];
 return <section className="panel panel-body" key={g.code}><h2 className="text-lg font-semibold">{g.name}</h2>{g.archived&&<span className="badge neutral">เก็บถาวร</span>}<p className="font-semibold mt-2">{d.recommendation?`แนะนำตอนนี้: ${nameOf(d.recommendation,data.pipelines)}`:p&&p.documents>=data.minimum_documents?"ยังตัดสินผู้ชนะไม่ได้":"ข้อมูลยังไม่เพียงพอ"}</p>{!d.recommendation&&leader&&<p>{leader.pipeline_name} นำเชิงตัวเลข</p>}<p>เทียบตรงกัน {p?.documents??0} เอกสาร · {p?.test_cases??0} ชุดทดสอบ</p><p className="filter-note">ทั้งหมดในขอบเขต {g.documents} เอกสาร</p><p>ขั้นตอนต่อไป: {d.readiness.reasons.missing_gt?`ยืนยัน GT อีก ${d.readiness.reasons.missing_gt} ชุด`:d.readiness.reasons.not_run?`รันคู่หลักอีก ${d.readiness.reasons.not_run} ชุด`:d.readiness.reasons.failed?`ตรวจผลรันไม่สำเร็จ ${d.readiness.reasons.failed} ชุด`:p&&p.documents<data.minimum_documents?`เพิ่มเอกสารที่เทียบตรงกันอีก ${data.minimum_documents-p.documents} เอกสาร`:"ตรวจผลรายชุดและเพิ่มเอกสารที่ยืนยัน"}</p></section>;
 })}</div><details className="panel panel-body"><summary className="cursor-pointer font-semibold">ดูตารางทุก Pipeline</summary><ByTypeTable data={data}/></details></>;
}
