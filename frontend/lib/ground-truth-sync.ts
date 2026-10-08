import type {GlobalField} from "@/types";

export const orderedGTFields=(fields:GlobalField[])=>[...fields].sort((a,b)=>a.field_index-b.field_index);
export const gtLines=(text:string)=>text.replace(/\r\n?/g,"\n").split("\n");
export const joinFieldGT=(fields:GlobalField[])=>orderedGTFields(fields).map(f=>f.ground_truth_raw??"").join("\n");
export const fieldLineCounts=(fields:GlobalField[])=>orderedGTFields(fields).map(f=>gtLines(f.ground_truth_raw??"").length);

// Boundaries follow the confirmed ROI reading order. The last ROI owns the remainder,
// so a single full-page ROI always retains every line, including blank lines.
export function splitDocumentGT(text:string,fields:GlobalField[],counts:number[]){
 const lines=gtLines(text);let offset=0;
 return orderedGTFields(fields).map((f,i,all)=>{
  const count=i===all.length-1?Math.max(0,lines.length-offset):Math.max(1,Math.floor(counts[i]||1));
  const value=lines.slice(offset,offset+count).join("\n");offset+=count;
  return {...f,ground_truth_raw:value};
 });
}
export function completeGT(fields:GlobalField[],documentGT:string){
 return fields.length>0&&fields.every(f=>!!f.ground_truth_raw?.trim())&&joinFieldGT(fields)===gtLines(documentGT).join("\n");
}
