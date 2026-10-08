import type {OCRField,ViewerBox} from "@/types";

// diagnostics.boxes are normalized to full-page coordinates by the adapter.
// Never offset them again or substitute the Global ROI for missing DET output.
export function resultPreviewBoxes(fields:OCRField[],pipelineId:string):ViewerBox[]{
 return fields.flatMap(field=>{
  const boxes=field.diagnostics?.boxes;
  if(!Array.isArray(boxes))return [];
  return boxes.flatMap((raw,index)=>{
   if(!raw||typeof raw!=="object")return [];
   const b=raw as Record<string,unknown>,bbox=b.bbox;
   if(!Array.isArray(bbox)||bbox.length!==4||!bbox.every(n=>typeof n==="number"&&Number.isFinite(n))||bbox[2]<=bbox[0]||bbox[3]<=bbox[1])return [];
   const polygon=Array.isArray(b.polygon)&&b.polygon.length>=3&&b.polygon.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==="number"&&Number.isFinite(n)))?b.polygon as [number,number][]:null;
   return [{id:`${field.id}:${index}`,bbox:bbox as [number,number,number,number],polygon,text:typeof b.text==="string"?b.text:"",confidence:typeof b.confidence==="number"&&Number.isFinite(b.confidence)?b.confidence:null,color:"#6366f1",pipelineId}];
  });
 });
}
