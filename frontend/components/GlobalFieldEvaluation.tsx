"use client";
import type {EvaluationMode, GlobalField, PipelineRun, TestCase} from "@/types";
import {pipelineLabel} from "@/lib/i18n/th";
const pct=(n:number|null|undefined)=>n==null?"—":`${(n*100).toFixed(2)}%`;
type Props={fields:GlobalField[];active:GlobalField|null;saved:TestCase;runs:PipelineRun[];mode:EvaluationMode;documentGT:string};
export default function GlobalFieldEvaluation({active,saved,runs,mode,documentGT}:Props){
 const whole=mode==="whole_document";
 const dirty=whole?documentGT!==(saved.ground_truth_raw??""):active?.ground_truth_raw!==saved.global_fields?.find(f=>f.id===active?.id)?.ground_truth_raw;
 return <section aria-label="Evaluation Results" className="space-y-3">
 <h2>ผลประเมินและเปรียบเทียบ</h2>
 <p data-testid="confirmed-global-gt" className="whitespace-pre-wrap break-words">GT: {whole?documentGT:active?.ground_truth_raw??"—"}</p>
 <div className="grid gap-4 md:grid-cols-2" aria-label="เปรียบเทียบทุก Pipeline">{runs.map(run=>{
 const field=run.fields?.find(f=>f.global_field_id===active?.id);
 const evaluation=dirty?null:whole?run.document_evaluation:field?.evaluation;
 const failed=whole?run.status==="error":field?.status==="error";
 return <article key={run.id} data-testid={`global-result-${run.pipeline_id}`} className="panel min-w-0 overflow-hidden">
 <h3 className="p-4 border-b font-semibold">{pipelineLabel(run.pipeline_id,run.pipeline_name)}</h3>
 {failed&&<p role="alert" className="px-4 pt-3 text-amber-800">บริการ OCR ยังไม่พร้อมใช้งาน</p>}
 <section className="p-4 space-y-2" aria-label="Extracted Text"><h4 className="text-sm font-semibold">Extracted Text</h4><p data-testid="global-prediction" className="whitespace-pre-wrap break-words leading-relaxed">{(whole?run.final_text:field?.ocr_text)||"(ไม่พบข้อความ)"}</p></section>
 <section className="p-4 border-t bg-slate-50" aria-label="Metrics" data-testid={evaluation?"global-evaluation":"not-evaluated"}>
 <dl className="grid grid-cols-2 gap-3">{[["Confidence",pct(whole?run.confidence:field?.confidence)],["CER",pct(evaluation?.cer)],["WER",pct(evaluation?.wer)],["Exact Match",evaluation?(evaluation.exact_match?"✓ Yes":"✕ No"):"—"]].map(([label,value])=><div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
 {!evaluation&&<p className="text-sm mt-2">ยังไม่ประเมิน</p>}
 </section>
 <details key={`${mode}:${active?.id}`} className="p-4 border-t" data-testid="error-analysis"><summary className="cursor-pointer font-medium">Error Analysis</summary>
 {!evaluation?<p className="mt-3">ยืนยันเพื่อคำนวณก่อนดูจุดที่ผิดพลาด</p>:evaluation.exact_match?<p className="mt-3 text-emerald-700">ไม่พบข้อผิดพลาด</p>:<p className="mt-3 whitespace-pre-wrap break-words" aria-label="ผลเปรียบเทียบ OCR">{evaluation.spans.map((s,i)=>s.kind==="equal"?<span key={i}>{s.text}</span>:<span key={i} className="text-red-700 underline decoration-2" data-testid="field-error" data-error-type={s.kind} aria-label={`${s.kind}: ${s.missing??s.text}`}>{s.kind==="deletion"?`⟦ขาด: ${s.missing}⟧`:s.text}</span>)}</p>}
 </details></article>;
 })}</div></section>;
}
