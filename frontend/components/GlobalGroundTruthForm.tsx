import type {EvaluationMode,GlobalField} from "@/types";
export default function GlobalGroundTruthForm({mode,fields,selected,documentGT,busy,success,onMode,onSelect,onDocument,onField,onSave}:{mode:EvaluationMode;fields:GlobalField[];selected:string[];documentGT:string;busy:boolean;success:boolean;onMode:(m:EvaluationMode)=>void;onSelect:(ids:string[])=>void;onDocument:(text:string)=>void;onField:(f:GlobalField)=>void;onSave:(calculate:boolean)=>void}){
 const card="block rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-3 transition-shadow focus-within:border-sky-600 focus-within:ring-2 focus-within:ring-sky-600/25";
 const input="textarea w-full rounded-lg border border-slate-300 bg-white p-3 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30";
 const whole=mode==="whole_document";
 const ready=!!documentGT.trim()||selected.some(id=>fields.find(f=>f.id===id)?.ground_truth_raw?.trim());
 return <section className="panel panel-body space-y-5">
 <div className="flex gap-2" aria-label="Evaluation mode">{(["whole_document","per_field"] as const).map(m=><button key={m} disabled={busy} aria-pressed={m===mode} className={`button ${mode===m?"primary":"secondary"}`} onClick={()=>onMode(m)}>{m==="whole_document"?"Whole Field":"Sub-fields"}</button>)}</div>
 {whole?<><p>Ground Truth ทั้งเอกสาร ตามลำดับ {fields.map(f=>`Field ${String(f.field_index).padStart(2,"0")}`).join(" → ")}</p><label className={card} data-testid="whole-gt-card">Ground Truth ทั้งเอกสาร<textarea className={input} rows={10} aria-label="Ground Truth ทั้งเอกสาร" disabled={busy} value={documentGT} onChange={e=>onDocument(e.target.value)}/></label></>:<>
 <p>เลือก Field ที่ต้องการประเมิน — GT หนึ่งชุดใช้ร่วมกันทุก Pipeline</p>
 <div className="flex flex-wrap gap-3" aria-label="Fields to evaluate">{fields.map(f=><label key={f.id}><input type="checkbox" disabled={busy} aria-label={`ประเมิน Field ${String(f.field_index).padStart(2,"0")}`} checked={selected.includes(f.id)} onChange={e=>onSelect(e.target.checked?[...selected,f.id]:selected.filter(id=>id!==f.id))}/> Field {String(f.field_index).padStart(2,"0")}</label>)}</div>
 {fields.filter(f=>selected.includes(f.id)).map(f=><label key={f.id} className={card} data-testid="field-gt-input">Field {String(f.field_index).padStart(2,"0")}<textarea className={input} rows={3} aria-label={`Ground Truth Field ${String(f.field_index).padStart(2,"0")}`} disabled={busy} value={f.ground_truth_raw??""} onChange={e=>onField({...f,ground_truth_raw:e.target.value})}/></label>)}
 </>}
 <p data-testid="calculation-hint">คำนวณทุกส่วนที่มี GT ทั้ง Whole Field และ Sub-fields ที่เลือก</p>
 {!ready&&<p>กรุณากรอก Ground Truth อย่างน้อย 1 รายการ</p>}
 {success&&<p role="status" className="text-emerald-700">คำนวณแล้ว — ผลประเมินอยู่ด้านล่าง</p>}
 <div className="flex flex-wrap gap-2"><button className="button secondary" disabled={busy} onClick={()=>onSave(false)}>บันทึก GT ฉบับร่าง</button><button className="button primary" disabled={busy||!ready} onClick={()=>onSave(true)}>ยืนยันเพื่อคำนวณ</button></div>
 </section>;
}
