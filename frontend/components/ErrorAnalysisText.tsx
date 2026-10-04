import type {FieldComparison} from "@/types";
import {errorAnalysisLines} from "@/lib/error-analysis-lines";

function Spans({spans}:{spans:FieldComparison["spans"]}){
 return <>{spans.map((s,i)=>s.kind==="equal"?<span key={i}>{s.text}</span>:<span key={i} className="text-red-700 underline decoration-2" data-testid="field-error" data-error-type={s.kind} title={s.kind==="substitution"?`GT: ${s.missing??""}`:undefined}>{s.kind==="deletion"?`⟦ขาด: ${s.missing}⟧`:s.text}</span>)}</>;
}
export default function ErrorAnalysisText({evaluation,groundTruth}:{evaluation:FieldComparison;groundTruth:string}){
 const lines=errorAnalysisLines(evaluation,groundTruth);
 if(!lines)return <p className="mt-3 whitespace-pre-wrap break-words"><Spans spans={evaluation.spans}/></p>;
 return <div className="mt-3 space-y-2" aria-label="ผลเปรียบเทียบ OCR ตามบรรทัด GT"><p className="text-xs text-slate-500">เรียงตามบรรทัด Ground Truth · สีแดงคือข้อความผิดหรือเกิน · ⟦ขาด⟧ คือข้อความที่อ่านไม่ครบ</p>{lines.map((line,i)=><div key={i} data-testid="error-analysis-line" className="rounded-lg border border-slate-200 p-3"><p className="mb-1 text-xs text-slate-500">บรรทัด {i+1}</p><p className="whitespace-pre-wrap break-words text-sky-900">GT: {line.gt||"(บรรทัดว่าง)"}</p><p className="mt-1 whitespace-pre-wrap break-words">OCR: <Spans spans={line.spans}/>{!line.spans.length&&<span className="text-slate-400">—</span>}</p></div>)}</div>;
}
