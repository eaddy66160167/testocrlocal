import type {FieldComparison} from "@/types";

type Span = FieldComparison["spans"][number];
export const alignmentKinds = ["equal", "substitution", "insertion", "deletion"] as const;
export const alignmentStates = {
  equal: {label:"Correct", meaning:"ตรงกับ Ground Truth", symbol:"✓"},
  substitution: {label:"Substitution (ผิด)", meaning:"OCR อ่านเป็นตัวอื่น", symbol:"✕"},
  insertion: {label:"Insertion (อ่านเกิน)", meaning:"OCR มีตัวอักษรที่ Ground Truth ไม่มี", symbol:"+"},
  deletion: {label:"Deletion (อ่านขาด)", meaning:"Ground Truth มีข้อความ แต่ OCR ไม่ได้อ่าน", symbol:"−"},
};
export const alignmentUnavailable = "ไม่สามารถสร้างรายละเอียด alignment สำหรับผลนี้ได้";
export function alignmentCounts(spans:Span[]) {
  const counts={equal:0,substitution:0,insertion:0,deletion:0};
  for(const span of spans)counts[span.kind]+=Array.from(span.kind==="deletion"?span.missing??"":span.text).length;
  return counts;
}
// Join adjacent canonical spans for display only; never re-align or normalize their content.
export function AlignmentSpans({spans,side="ocr"}:{spans:Span[];side?:"gt"|"ocr"}) {
  const grouped:Span[]=[];
  for(const s of spans){const last=grouped.at(-1);if(last?.kind===s.kind){last.text+=s.text;last.missing=(last.missing??"")+(s.missing??"");}else grouped.push({...s});}
  return <>{grouped.map((s,i)=>{
    const state=alignmentStates[s.kind];
    const detail=s.kind==="substitution"?`Ground Truth: ${s.missing??"—"} → OCR: ${s.text}`:s.kind==="insertion"?`${side==="gt"?"ไม่มีตัวอักษรใน Ground Truth — ":""}OCR อ่านเกิน: ${s.text}`:s.kind==="deletion"?`OCR อ่านขาด: ${s.missing??""}`:state.meaning;
    const content=side==="gt"?(s.kind==="insertion"?"∅":s.kind==="equal"?s.text:s.missing??""):(s.kind==="deletion"?`⟦ขาด: ${s.missing??""}⟧`:s.text);
    return <span key={i} className={`comparison-span ${s.kind}${side==="gt"&&s.kind==="insertion"?" alignment-gap":""}`} data-alignment-kind={s.kind} data-error-type={s.kind} data-testid={side==="ocr"&&s.kind!=="equal"?"field-error":undefined} title={`${state.label} · ${state.meaning} · ${detail}`} aria-label={`${state.label} · ${state.meaning} · ${detail}`}>{content}</span>;
  })}</>;
}
export function AlignmentRows({spans}:{spans:Span[]}) {
  return <div className="canonical-alignment">{(["gt","ocr"] as const).map(side=><div key={side} className="alignment-row" data-alignment-side={side}><strong>{side==="gt"?"GT":"OCR"}</strong><p><AlignmentSpans spans={spans} side={side}/></p></div>)}</div>;
}
export function AlignmentSummary({spans}:{spans:Span[]}) {
  const counts=alignmentCounts(spans);
  return <dl className="alignment-summary" aria-label="จำนวนตัวอักษรตาม alignment">{alignmentKinds.map(kind=><div key={kind} data-count-kind={kind} className={counts[kind]===0?"alignment-zero":undefined}><dt className={`comparison-span ${kind}`} title={alignmentStates[kind].meaning}>{alignmentStates[kind].symbol} {alignmentStates[kind].label}</dt><dd>{counts[kind]}</dd></div>)}</dl>;
}
export function AlignmentLegend(){return <div className="comparison-legend">{alignmentKinds.map(kind=><span key={kind} className={`comparison-span ${kind}`} title={alignmentStates[kind].meaning}>{alignmentStates[kind].symbol} {alignmentStates[kind].label}</span>)}</div>;}
