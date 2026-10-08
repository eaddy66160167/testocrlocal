import type {FieldComparison} from "@/types";
type Span = FieldComparison["spans"][number];

/** Project the saved normalized alignment onto original GT lines; never re-diff OCR. */
export function errorAnalysisLines(evaluation: FieldComparison, groundTruth: string) {
 const raw=groundTruth.normalize("NFC").replace(/\r\n?/g,"\n");
 const lines=raw.split("\n").map(gt=>({gt,spans:[] as Span[]}));
 const normalized:string[]=[],owners:number[]=[];
 let line=0,pendingSpace=false,spaceLine=0;
 for(const char of Array.from(raw)){
  if(/\s/u.test(char)){
   if(normalized.length&&!pendingSpace){pendingSpace=true;spaceLine=line;}
   if(char==="\n")line++;
   continue;
  }
  if(pendingSpace){normalized.push(" ");owners.push(spaceLine);pendingSpace=false;}
  normalized.push(char);owners.push(line);
 }
 if(normalized.join("")!==evaluation.normalized_ground_truth)return null;
 let cursor=0;
 for(const span of evaluation.spans){
  const units=span.kind==="deletion"?Array.from(span.missing??""):Array.from(span.text);
  const missing=Array.from(span.missing??"");
  for(let i=0;i<units.length;i++){
   const owner=owners[cursor]??owners[owners.length-1]??0;
   // A matching separator between GT lines is represented by the row boundary.
   const separator=span.kind==="equal"&&units[i]===" "&&owners[cursor+1]!==undefined&&owners[cursor+1]!==owner;
   if(!separator)lines[owner].spans.push({kind:span.kind,text:span.kind==="deletion"?"":units[i],missing:span.kind==="deletion"?units[i]:missing[i]});
   if(span.kind!=="insertion")cursor++;
  }
 }
 return lines;
}
