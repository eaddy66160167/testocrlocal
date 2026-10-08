import type { Document, TestCase, TestCaseInput, PipelineRun, GlobalField, PipelineConfig, ROI } from "../../types";
import { localDB, digest, storageError, type LocalCase } from "./schema";
import { saveDocument, documentBlob } from "./documents";
import { deleteTestCases } from "./test-cases";
import { saveResults } from "./results";
import { configuration } from "../pipeline-cache";
type Gateway = <T>(path: string, init?: RequestInit) => Promise<T>;
const stamp = () => new Date().toISOString();
let workerReady: Promise<void> | undefined;
async function ready() {
  await localDB().open();
  if (!workerReady) workerReady = (async () => {
    if (!("serviceWorker" in navigator)) throw new Error("เบราว์เซอร์นี้ไม่รองรับการแสดงไฟล์ในเครื่อง");
    await navigator.serviceWorker.register("/local-storage-worker.js"); await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {once:true}));
  })();
  return workerReady;
}
async function prepare(file: Blob, page: number, base: string) {
  const form = new FormData(); form.set("file", file, "source"); form.set("page_number", String(page));
  const response = await fetch(`${base}/api/ocr/prepare`, {method:"POST",body:form});
  if (!response.ok) { const error = await response.json(); throw new Error(error.detail ?? "เปิดไฟล์ไม่สำเร็จ"); }
  return {blob:await response.blob(),width:Number(response.headers.get("X-Image-Width")),height:Number(response.headers.get("X-Image-Height")),count:Number(response.headers.get("X-Page-Count"))};
}
export async function documentPage(id: string, page = 1, base: string): Promise<Document> {
  await ready(); const db = localDB(), doc = await db.documents.get(id); if (!doc) throw new Error("ไม่พบเอกสารในเบราว์เซอร์นี้");
  if (!Number.isInteger(page) || page < 1 || page > doc.page_count) throw new Error("ไม่พบหน้าที่เลือก");
  const key = `${id}:${page}`; let asset = await db.assets.get(key);
  if (!asset) {
    const rendered = await prepare(await documentBlob(id), page, base);
    asset = {id:key,document_id:id,page_number:page,blob:rendered.blob,sha256:await digest(await rendered.blob.arrayBuffer())};
    try { await db.assets.put(asset); } catch(e) { storageError(e); }
  }
  const bitmap = await createImageBitmap(asset.blob);
  try {
    return {...doc,width:bitmap.width,height:bitmap.height,page_number:doc.document_type === "pdf" ? page : null,image_url:`/local-assets/${id}/${page}`};
  } finally { bitmap.close(); }
}
export async function readCase(id: string, base: string, preview = true): Promise<TestCase> {
  const db = localDB(), value = await db.testCases.get(id); if (!value) throw new Error("ไม่พบชุดทดสอบในเบราว์เซอร์นี้");
  const doc = await db.documents.get(value.document_id); if (!doc) throw new Error("ไม่พบเอกสาร");
  const document = preview ? await documentPage(doc.id, value.page_number ?? 1, base) : {...doc,page_number:value.page_number,image_url:`/local-assets/${doc.id}/${value.page_number ?? 1}`};
  return {...value, document, runs:await db.results.where("test_case_id").equals(id).sortBy("created_at")};
}
async function persistCase(c: TestCase) {
  const {document: _document, runs, ...metadata} = c; void _document;
  const db = localDB();
  await db.transaction("rw",db.testCases,db.results,async()=>{
    await db.testCases.put(metadata); for (const run of runs) {const prior=await db.results.get(run.id);await db.results.put({...run,test_case_id:c.id,pipeline_revision:prior?.pipeline_revision ?? 0});}
  }); return c;
}
async function calculation(id:string, operation:string, value:unknown, base:string, gateway:Gateway) {
  return persistCase(await gateway<TestCase>("/ocr/calculate",{method:"POST",body:JSON.stringify({case:await readCase(id,base,false),operation,value})}));
}
export async function localRequest<T>(path:string, init:RequestInit|undefined, base:string, gateway:Gateway):Promise<T> {
  await ready(); const db=localDB(), url=new URL(path,"https://local.invalid"), parts=url.pathname.split("/").filter(Boolean), [root,id,action,child,subaction]=parts;
  const method=init?.method??"GET", body=typeof init?.body==="string"?JSON.parse(init.body):{}, q=url.searchParams;
  const result=await (async():Promise<unknown>=>{
    if(root==="logs")return {enabled:false,total:0,items:[]};
    if(root==="categories") {
      if(!await db.categories.count())await db.categories.bulkPut(["thai_text","thai_digit","arabic_digit","english_text","mixed_language","sentence","handwriting","strikethrough","stamp","table_text","low_quality","blur","skew","small_text"].map(code=>({id:code,code,display_name:code.replaceAll("_"," ")})));
      return db.categories.toArray();
    }
    if(root==="document-types") {
      if(method==="GET")return db.documentTypes.toArray();
      if(method==="DELETE"){const type=await db.documentTypes.get(id);if(!type)throw new Error("ไม่พบประเภทเอกสาร");await db.documentTypes.update(id,{active:false});return {...type,active:false};}
      const name=String(body.name).trim();if(!name||name.length>100)throw new Error("กรุณากรอกชื่อประเภทเอกสาร");
      const existing=await db.documentTypes.filter(t=>t.name.normalize("NFC").toLowerCase()===name.normalize("NFC").toLowerCase()).first();if(existing)throw new Error("ชื่อประเภทเอกสารซ้ำ");
      const type={id:crypto.randomUUID(),name,active:true,system:false};await db.documentTypes.put(type);return type;
    }
    if(root==="documents") {
      if(method==="POST"&&!id){const form=init?.body as FormData,file=form.get("file") as File;const rendered=await prepare(file,1,base),doc={id:crypto.randomUUID(),filename:file.name.replace(/[\\/]/g,"_").slice(0,255),mime_type:file.type,document_type:file.type==="application/pdf"?"pdf" as const:"image" as const,width:rendered.width,height:rendered.height,page_count:rendered.count,page_number:file.type==="application/pdf"?1:null,pdf_render_dpi:200,storage_key:"local",created_at:stamp(),sha256:await digest(await file.arrayBuffer()),document_type_id:String(form.get("document_type_id")??"")||null};
        await saveDocument(doc,file);await db.assets.put({id:`${doc.id}:1`,document_id:doc.id,page_number:1,blob:rendered.blob,sha256:await digest(await rendered.blob.arrayBuffer())});return documentPage(doc.id,1,base);}
      if(action==="type"){const type=body.document_type_id?await db.documentTypes.get(body.document_type_id):null;if(body.document_type_id&&!type?.active)throw new Error("ไม่พบประเภทเอกสารที่ใช้งานอยู่");await db.documents.update(id,{document_type_id:type?.id??null,document_type_name:type?.name??null});}
      if(action==="auto-rois")return gateway("/ocr/auto-rois",{method:"POST",body:await sourceForm(id,body.page_number??1,body)});
      return documentPage(id,Number(q.get("page_number")??1),base);
    }
    if(root==="test-cases") {
      if(id==="bulk-delete")return deleteTestCases(body.test_case_ids);
      if(!id&&method==="POST") {const input=body as TestCaseInput,doc=await documentPage(input.document_id,input.page_number??1,base);const time=stamp();const c:LocalCase={id:crypto.randomUUID(),document_id:doc.id,page_number:doc.page_number,workflow:input.workflow??"legacy",evaluation_mode:"per_field",global_fields:[],roi:input.roi,roi_source:input.roi_source??"none",ground_truth_raw:input.ground_truth_raw,ground_truth_normalized:input.ground_truth_raw?.normalize("NFC").replace(/\s+/g," ").trim()??null,status:"draft",created_at:time,updated_at:time,categories:(await db.categories.toArray()).filter(c=>input.category_codes.includes(c.code))};await db.testCases.put(c);return readCase(c.id,base);}
      if(method==="DELETE"){await deleteTestCases([id]);return undefined;}
      if(action==="errors"&&child==="recompute") {const c=await calculation(id,"recompute",{},base,gateway);return {test_case_id:id,recomputed_runs:c.runs.length};}
      if(action==="run") {
        const c=await readCase(id,base),configs=await configuration<PipelineConfig[]>("/pipelines",base),entry=await db.config.get(`${base}/pipelines`);
        if(c.workflow==="global"&&(!c.layout_confirmed_at||!c.global_fields?.length))throw new Error("กรุณายืนยัน Layout ก่อนรัน OCR");
        if(body.pipelines.some((pid:string)=>!configs.some(p=>p.pipeline_id===pid&&p.enabled)))throw new Error("Pipeline ไม่พร้อมใช้งาน");
        const options={pipelines:body.pipelines,pipeline_revision:entry?.revision,roi:c.workflow==="global"?null:c.roi,roi_source:c.roi_source,fields:c.workflow==="global"?c.global_fields?.map(({id,field_index,roi,source})=>({id,field_index,roi,source})):[]};
        const response=await gateway<{revision:number;runs:PipelineRun[]}>("/ocr/execute",{method:"POST",body:await sourceForm(c.document_id,c.page_number??1,options)});
        await saveResults(response.runs.map(r=>({...r,test_case_id:id,pipeline_revision:response.revision})));
        await db.testCases.update(id,{status:"tested",layout_locked_at:c.workflow==="global"?stamp():null,updated_at:stamp()});return {test_case_id:id,runs:response.runs};
      }
      if(action==="ground-truth")return calculation(id,"document-gt",body,base,gateway);
      if(action==="evaluation-mode")return calculation(id,"mode",body,base,gateway);
      if(action==="evaluate")return calculation(id,"evaluate",body,base,gateway);
      if(action==="global-fields"&&child)return calculation(id,"field-gt",{field_id:child,...body},base,gateway);
      if(action==="global-fields") {
        const c=await readCase(id,base);if(c.runs.length||c.layout_locked_at)throw new Error("Layout ถูกล็อกหลังรัน OCR กรุณาสร้างชุดทดสอบใหม่");
        const fields=body.fields as GlobalField[];if(new Set(fields.map(f=>f.id)).size!==fields.length)throw new Error("Field ID ซ้ำ");
        for(const f of fields){const r=f.roi;if(!(0<=r.x1&&r.x1<r.x2&&r.x2<=c.document.width&&0<=r.y1&&r.y1<r.y2&&r.y2<=c.document.height))throw new Error("ROI อยู่นอกภาพ");}
        await db.testCases.update(id,{global_fields:fields.map(f=>({...f,ground_truth_raw:null,confirmed_at:null})),layout_confirmed_at:body.confirmed?stamp():null,updated_at:stamp()});return readCase(id,base);
      }
      if(action==="runs"&&subaction==="fields") {
        const field=parts[5],operation=parts[6];
        if(operation==="check")return gateway("/ocr/calculate",{method:"POST",body:JSON.stringify({operation:"check",case:await readCase(id,base,false),value:{run_id:child,field_id:field,...body}})});
        const c=await calculation(id,"legacy-field-gt",{run_id:child,field_id:field,...body},base,gateway);return c.runs.find(r=>r.id===child)?.fields?.find(f=>f.id===field);
      }
      if(method==="PUT") {const c=await readCase(id,base);if(c.runs.length&&"roi"in body&&JSON.stringify(body.roi)!==JSON.stringify(c.roi))throw new Error("กรุณาสร้างชุดทดสอบใหม่เพื่อเปลี่ยน ROI");await db.testCases.update(id,{...body,categories:body.category_codes?(await db.categories.toArray()).filter(c=>body.category_codes.includes(c.code)):c.categories,updated_at:stamp()});}
      return readCase(id,base);
    }
    if(root==="history") {
      return filteredCases(q,{history:true,offset:Math.max(0,Number(q.get("offset")??0)),limit:Math.min(200,Math.max(1,Number(q.get("limit")??50)))});
    }
    if(root==="matrix"||root==="analytics") {
      const cases=await filteredCases(q);const configs=await configuration<PipelineConfig[]>("/pipelines",base);
      const allowed=["category","pipeline","document","document_type_id","date_from","date_to"];
      return gateway("/ocr/analyze",{method:"POST",body:JSON.stringify({operation:root==="matrix"?"matrix":id,cases,configs,document_types:await db.documentTypes.toArray(),filters:Object.fromEntries([...q].filter(([k])=>allowed.includes(k))),include_archived:q.get("include_archived")==="1",error_filters:Object.fromEntries([...q].filter(([k])=>["pipeline","category","error_type","error_level","text_kind","test_case_id","document"].includes(k))),limit:Number(q.get("limit")??50),offset:Number(q.get("offset")??0)})});
    }
    if(root==="dataset")return datasetRequest(parts,method,body,q,base);
    throw new Error(`Local operation is not supported: ${url.pathname}`);
  })(); return result as T;
}
async function sourceForm(id:string,page:number,options:unknown) {const form=new FormData();form.set("file",await documentBlob(id),"source");form.set("page_number",String(page));form.set("options",JSON.stringify(options));return form;}
async function filteredCases(q:URLSearchParams, options:{history?:boolean;offset?:number;limit?:number;metadataOnly?:boolean}={}) {
  let matched=0;
  const db=localDB(), cases=await db.testCases.orderBy("created_at").reverse().toArray(), output:TestCase[]=[];
  for(const c of cases){if(q.get("document")&&c.document_id!==q.get("document"))continue;if(q.get("category")&&!c.categories.some(t=>t.code===q.get("category")))continue;if(q.get("date_from")&&c.created_at.slice(0,10)<q.get("date_from")!)continue;if(q.get("date_to")&&c.created_at.slice(0,10)>q.get("date_to")!)continue;const doc=await db.documents.get(c.document_id);if(!doc||q.get("document_type_id")&&doc.document_type_id!==q.get("document_type_id"))continue;if(options.history&&!await db.results.where("test_case_id").equals(c.id).count())continue;if(q.get("pipeline")&&!await db.results.where("[test_case_id+pipeline_id]").equals([c.id,q.get("pipeline")!]).count())continue;if(matched++<(options.offset??0))continue;const runs=options.metadataOnly?[]:await db.results.where("test_case_id").equals(c.id).sortBy("created_at");output.push({...c,document:{...doc,image_url:`/local-assets/${doc.id}/${c.page_number??1}`},runs});if(options.limit&&output.length>=options.limit)break;}return output;
}
async function datasetRequest(parts:string[],method:string,body:Record<string,unknown>,q:URLSearchParams,base:string) {
  const db=localDB(), cases=await filteredCases(q,{metadataOnly:true}), excluded=new Set((await db.datasets.filter(d=>d.excluded).toArray()).map(d=>d.id));
  type Sample = {id:string;test_case_id:string;global_field_id:string|null;field_index:number|null;document_id:string;filename:string;page_number:number|null;roi:ROI|null;ground_truth_raw:string;updated_at:string;source_sha256:string|null;categories:string[];document_type_id?:string|null;document_type_name?:string|null;source_available:boolean};
  const samples=cases.flatMap<Sample>(c=>c.workflow==="global"?(c.global_fields??[]).filter(f=>f.confirmed_at&&f.ground_truth_raw?.trim()).map(f=>({id:f.id,test_case_id:c.id,global_field_id:f.id,field_index:f.field_index,document_id:c.document_id,filename:c.document.filename,page_number:c.page_number,roi:f.roi,ground_truth_raw:f.ground_truth_raw!,updated_at:c.updated_at,source_sha256:c.document.sha256??null,categories:c.categories.map(t=>t.code),document_type_id:c.document.document_type_id,document_type_name:c.document.document_type_name,source_available:true})):c.status==="confirmed"&&c.ground_truth_raw?.trim()?[{id:c.id,test_case_id:c.id,global_field_id:null,field_index:null,document_id:c.document_id,filename:c.document.filename,page_number:c.page_number,roi:c.roi,ground_truth_raw:c.ground_truth_raw,updated_at:c.updated_at,source_sha256:c.document.sha256??null,categories:c.categories.map(t=>t.code),document_type_id:c.document.document_type_id,document_type_name:c.document.document_type_name,source_available:true}]:[]).filter(s=>!excluded.has(s.id));
  if(method==="DELETE"||parts[2]==="bulk-exclude") {
    const ids=method==="DELETE"?[parts[2]]:[...(body.test_case_ids as string[]??[]),...(body.global_field_ids as string[]??[])];let changed=0,missing=0,already=0;
    await db.transaction("rw",db.datasets,async()=>{for(const id of new Set(ids)){if(excluded.has(id)){already++;continue;}const s=samples.find(s=>s.id===id);if(!s){missing++;continue;}await db.datasets.put({id,test_case_id:s.test_case_id,global_field_id:s.global_field_id,excluded:true,updated_at:stamp()});changed++;}});
    return {excluded:method==="DELETE"?true:changed,requested:new Set(ids).size,already_excluded:already,not_found:missing};
  }
  if(parts[1]==="export") {
    const ids=[...(body.test_case_ids as string[]??[]),...(body.global_field_ids as string[]??[])], selected=samples.filter(s=>ids.includes(s.id));if(!selected.length||selected.length!==new Set(ids).size)throw new Error("กรุณาเลือกตัวอย่างที่ยืนยัน GT แล้ว");
    const {zipSync,strToU8}=await import("fflate"), files:Record<string,Uint8Array>={};let labels="",bytes=0;
    for(const [i,s]of selected.entries()){await documentPage(s.document_id,s.page_number??1,base);const form=await sourceForm(s.document_id,s.page_number??1,{roi:s.roi});const response=await fetch(`${base}/api/ocr/crop`,{method:"POST",body:form});if(!response.ok)throw new Error("ส่งออก crop ไม่สำเร็จ");const crop=new Uint8Array(await response.arrayBuffer());bytes+=crop.length;if(bytes>512*1024*1024)throw new Error("Dataset เกิน 512 MB");const name=`images/${String(i+1).padStart(6,"0")}.png`;files[`dataset/${name}`]=crop;labels+=`${name}\t${s.ground_truth_raw.replace(/\\/g,"\\\\").replace(/\t/g,"\\t").replace(/\r/g,"\\r").replace(/\n/g,"\\n")}\n`;}
    files["dataset/label.txt"]=strToU8(labels);return new Blob([zipSync(files).buffer as ArrayBuffer],{type:"application/zip"});
  }
  const offset=Math.max(0,Number(q.get("offset")??0)),limit=Math.min(200,Math.max(1,Number(q.get("limit")??50)));return {total:samples.length,items:samples.slice(offset,offset+limit)};
}
