"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect,useRef,useState} from "react";
import {LoaderCircle} from "lucide-react";
import * as api from "@/lib/api";
import type {EvaluationMode,GlobalField,PipelineConfig,ROI,TestCase} from "@/types";
import {PageHeader} from "./ConsoleUI";
import {pipelineLabel,userError} from "@/lib/i18n/th";
import {previewFieldOrder} from "@/lib/global-order";
import WorkflowSteps,{stageTitles,stages,workflowUrl,type WorkflowStage} from "./WorkflowSteps";
import GlobalGroundTruthForm from "./GlobalGroundTruthForm";
import GlobalFieldEvaluation from "./GlobalFieldEvaluation";
const DocumentViewer=dynamic(()=>import("./DocumentViewer"),{ssr:false});
const fieldName=(f:GlobalField)=>`Field ${String(f.field_index).padStart(2,"0")}`;

export default function GlobalWorkspace({initialCase,stage}:{initialCase:TestCase;stage:WorkflowStage}){
 const router=useRouter(),[saved,setSaved]=useState(initialCase),[fields,setFields]=useState(initialCase.global_fields??[]);
 const [activeId,setActiveId]=useState<string|null>((stage==="ground-truth"?fields.find(f=>f.confirmed_at)?.id:undefined)??fields[0]?.id??null),[selection,setSelection]=useState<string[]>([]);
 const [drawing,setDrawing]=useState(false);
 const [configs,setConfigs]=useState<PipelineConfig[]>([]),[pipelineIds,setPipelineIds]=useState<string[]>([]);
 const [mode,setMode]=useState<EvaluationMode>(saved.evaluation_mode??"per_field"),[documentGT,setDocumentGT]=useState(saved.ground_truth_raw??"");
 const [evaluateIds,setEvaluateIds]=useState(fields.some(f=>f.confirmed_at)?fields.filter(f=>f.confirmed_at).map(f=>f.id):fields.map(f=>f.id));
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(false);
 const actionPending=useRef(false);
 const doc=saved.document,active=fields.find(f=>f.id===activeId)??null,locked=!!saved.layout_confirmed_at,hasRuns=!!saved.runs.length;
 const latestRuns=configs.flatMap(p=>{const r=[...saved.runs].reverse().find(r=>r.pipeline_id===p.pipeline_id);return r?[r]:[];});
 useEffect(()=>{let alive=true;api.getPipelines().then(p=>{if(alive){setConfigs(p);setPipelineIds(initialCase.runs.length?[...new Set(initialCase.runs.map(r=>r.pipeline_id))]:p.filter(c=>c.enabled).map(c=>c.pipeline_id));}}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[initialCase]);
 async function act(fn:()=>Promise<void>){if(actionPending.current)return;actionPending.current=true;setBusy(true);setError("");setNotice(false);try{await fn();}catch(e){setError(userError(e instanceof Error?e.message:"ดำเนินการไม่สำเร็จ"));}finally{actionPending.current=false;setBusy(false);}}
 function adopt(c:TestCase){setSaved(c);setFields(c.global_fields??[]);}
 function add(roi:ROI,source:"auto"|"manual"){
  if(locked||busy)return;const f:GlobalField={id:crypto.randomUUID(),field_index:fields.length+1,roi,source,ground_truth_raw:null,confirmed_at:null};setFields(old=>previewFieldOrder([...old,f]));setActiveId(f.id);
 }
 function edit(roi:ROI|null){if(locked||!active)return;setFields(old=>previewFieldOrder(roi?old.map(f=>f.id===active.id?{...f,roi}:f):old.filter(f=>f.id!==active.id)));if(!roi)setActiveId(null);}
 async function saveGT(calculate:boolean){await act(async()=>{
  let c=saved;for(const f of fields)if(f.ground_truth_raw!==saved.global_fields?.find(s=>s.id===f.id)?.ground_truth_raw)c=await api.saveGlobalGT(c.id,f);
  if(documentGT!==(saved.ground_truth_raw??""))c=await api.saveGroundTruth(c.id,documentGT,false);
  if(c.evaluation_mode!==mode)c=await api.setEvaluationMode(c.id,mode);adopt(c);
  if(calculate){adopt(await api.evaluateGlobal(c.id,"auto",evaluateIds));setNotice(true);}
 });}
 const allowed=stage==="layout"||stage==="pipelines"&&locked||(stage==="ground-truth")&&hasRuns;
 return <div className="page-stack" data-testid={`workflow-${stage}`}>
 <PageHeader title={stageTitles[stages.indexOf(stage)]} description={`${doc.filename} · ${doc.document_type_name||"ไม่ระบุประเภท"} · หน้า ${doc.page_number??1}`} actions={<Link href="/history" className="button secondary">ประวัติ</Link>}/>
 <WorkflowSteps stage={stage} saved={saved} uploadUrl={`/?document=${doc.id}${doc.document_type==="pdf"?`&page=${doc.page_number??1}`:""}`} busy={busy}/>
 {error&&<div className="error-banner" role="alert">{error}</div>}{busy&&<p role="status" className="notice-banner">กำลังดำเนินการ…</p>}
 {!allowed?<section className="panel panel-body"><p>กรุณาทำขั้นตอนก่อนหน้าให้เสร็จก่อน</p><Link className="button primary" href={workflowUrl(saved.id,locked?"pipelines":"layout")}>กลับไปขั้นตอนก่อนหน้า</Link></section>:<>
 <div className={`grid gap-5 ${stage==="ground-truth"?"xl:grid-cols-[minmax(300px,0.65fr)_minmax(0,1.35fr)]":stage==="layout"?"xl:grid-cols-[minmax(0,1fr)_280px]":"xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)]"}`}>
 <section className="min-w-0 xl:sticky xl:top-4 xl:self-start">
 <DocumentViewer compactReference={stage==="ground-truth"} imageUrl={api.assetUrl(doc.image_url)} width={doc.width} height={doc.height} roi={active?.roi??null} onRoiChange={edit} onManualRoi={r=>add(r,"manual")} globalFields={fields} selectedGlobalFieldId={activeId} onSelectGlobalField={setActiveId} boxes={[]} selectedBoxId={null} onSelectBox={()=>{}} regionMode={drawing} onRegionModeChange={setDrawing} allowRoi={stage==="layout"&&!locked&&!busy}/>
 <div className="panel panel-body mt-3 flex flex-wrap gap-2" aria-label="Global Fields">{fields.map(f=><button key={f.id} data-testid="global-field-nav" className={`button ${f.id===activeId?"primary":"secondary"}`} aria-pressed={f.id===activeId} onClick={()=>setActiveId(f.id)}>{fieldName(f)}{f.confirmed_at?" ✓":""}</button>)}</div>
 </section><section className="min-w-0 space-y-4">
 {stage==="layout"&&<div className="panel panel-body space-y-4"><h2>จัดการ Global Fields</h2>
 {locked?<><p>ยืนยัน Layout แล้ว — กรอบถูกล็อก</p><button className="button secondary" disabled={busy} onClick={()=>void act(async()=>{
  if(hasRuns||saved.layout_locked_at){const c=await api.createTestCase({workflow:"global",document_id:doc.id,page_number:doc.page_number,roi:null,ground_truth_raw:null,category_codes:saved.categories.map(c=>c.code)});await api.saveGlobalLayout(c.id,fields.map(f=>({...f,id:crypto.randomUUID()})),false);router.push(workflowUrl(c.id,"layout"));}
  else adopt(await api.saveGlobalLayout(saved.id,fields,false));
 })}>{hasRuns?"สร้างชุดทดสอบใหม่เพื่อแก้ Layout":"กลับไปแก้ไข Layout"}</button><Link href={workflowUrl(saved.id,"pipelines")} className="button primary">ถัดไป: เลือก Pipelines</Link></>:<>
 <div className="flex flex-wrap gap-2"><button className="button secondary" disabled={busy} onClick={()=>void act(async()=>{const regions=(await api.getAutoROIs(doc.id,"text-line",doc.page_number)).regions;setFields(old=>previewFieldOrder([...old,...regions.filter(r=>!old.some(f=>JSON.stringify(f.roi)===JSON.stringify(r.roi))).map(r=>({id:crypto.randomUUID(),field_index:0,roi:r.roi,source:"auto" as const,ground_truth_raw:null,confirmed_at:null}))]));})}>Auto Layout</button><button className="button secondary" disabled={busy} onClick={()=>setDrawing(true)}>เพิ่มกรอบ Manual</button><button className="button secondary" disabled={busy||!active} onClick={()=>edit(null)}>ลบ Field ที่เลือก</button></div>
 {!!fields.length&&<div className="space-y-2" aria-label="เลือกหลาย Fields">{fields.map(f=><label key={f.id} className="flex gap-2"><input type="checkbox" aria-label={`เลือก ${fieldName(f)}`} checked={selection.includes(f.id)} onChange={e=>setSelection(old=>e.target.checked?[...old,f.id]:old.filter(id=>id!==f.id))}/>{fieldName(f)}</label>)}<button className="button secondary" disabled={!selection.length||busy} onClick={()=>{setFields(old=>previewFieldOrder(old.filter(f=>!selection.includes(f.id))));setSelection([]);setActiveId(null);}}>ลบ Fields ที่เลือก ({selection.length})</button></div>}
 <div className="flex flex-wrap gap-2"><button className="button secondary" disabled={busy} onClick={()=>void act(async()=>adopt(await api.saveGlobalLayout(saved.id,fields,false)))}>บันทึก Layout ฉบับร่าง</button><button className="button primary" disabled={busy||!fields.length} onClick={()=>void act(async()=>{await api.saveGlobalLayout(saved.id,fields,true);router.push(workflowUrl(saved.id,"pipelines"));})}>ยืนยัน ROI</button></div>
 </> }</div>}
 {stage==="pipelines"&&<section className="panel panel-body space-y-4"><h2>เลือก Pipelines</h2><p>ทุก Pipeline จะใช้ Global Field ชุดเดียวกัน</p><div data-testid="pipeline-options" aria-busy={busy} className={`space-y-3 transition-opacity ${busy?"opacity-50":"opacity-100"}`}>{configs.map(p=><label key={p.pipeline_id} className="flex gap-2"><input type="checkbox" aria-label={`เลือก ${pipelineLabel(p.pipeline_id,p.name)}`} disabled={busy||!p.enabled} checked={pipelineIds.includes(p.pipeline_id)} onChange={e=>setPipelineIds(old=>e.target.checked?[...old,p.pipeline_id]:old.filter(id=>id!==p.pipeline_id))}/>{pipelineLabel(p.pipeline_id,p.name)}{!p.enabled&&" (ปิดอยู่)"}</label>)}</div><button aria-busy={busy} className="button primary" disabled={busy||!pipelineIds.length} onClick={()=>void act(async()=>{await api.runPipelines(saved.id,pipelineIds);router.push(workflowUrl(saved.id,"ground-truth"));})}>{busy?<><LoaderCircle aria-hidden="true" data-testid="ocr-spinner" className="h-4 w-4 animate-spin"/>กำลังรัน OCR...</>:"Run OCR"}</button></section>}
 {stage==="ground-truth"&&<GlobalGroundTruthForm mode={mode} fields={fields} selected={evaluateIds} documentGT={documentGT} busy={busy} onMode={setMode} onSelect={setEvaluateIds} onDocument={setDocumentGT} onField={f=>setFields(old=>old.map(s=>s.id===f.id?f:s))} onSave={calculate=>void saveGT(calculate)} success={notice}/>}
 {stage==="ground-truth"&&<GlobalFieldEvaluation fields={fields} active={active} saved={saved} runs={latestRuns} mode={mode} documentGT={documentGT}/>}
 </section></div></>}
 </div>;
}
