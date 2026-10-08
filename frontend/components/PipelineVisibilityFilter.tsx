"use client";
import {useEffect,useRef,useState} from "react";
import {Filter} from "lucide-react";
import {pipelineLabel} from "@/lib/i18n/th";
import type {PipelineRun} from "@/types";

export default function PipelineVisibilityFilter({runs,hidden,onApply}:{runs:PipelineRun[];hidden:string[];onApply:(ids:string[])=>void}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState<string[]>([]);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;function outside(e:PointerEvent){if(!root.current?.contains(e.target as Node))setOpen(false);}document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);},[open]);
 function close(){setOpen(false);trigger.current?.focus();}
 return <div ref={root} className="relative" onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();close();}}}>
  <button ref={trigger} type="button" className={`button secondary ${hidden.length?"text-sky-700":""}`} aria-label="กรอง Pipeline" title="กรอง Pipeline" aria-expanded={open} aria-controls="pipeline-filter-options" onClick={()=>{setDraft([...hidden]);setOpen(v=>!v);}}><Filter size={18}/><span className="sr-only">กรอง Pipeline</span></button>
  {open&&<div id="pipeline-filter-options" className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl" role="group" aria-label="เลือก Pipeline ที่แสดง"><p className="mb-3 text-sm font-semibold">เลือก Pipeline ที่แสดง</p><div className="max-h-64 space-y-3 overflow-auto">{runs.map(run=><label key={run.pipeline_id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!draft.includes(run.pipeline_id)} onChange={e=>setDraft(old=>e.target.checked?old.filter(id=>id!==run.pipeline_id):[...old,run.pipeline_id])} aria-label={`แสดง ${pipelineLabel(run.pipeline_id,run.pipeline_name)}`}/>{pipelineLabel(run.pipeline_id,run.pipeline_name)}</label>)}</div><div className="my-3 flex gap-3 text-xs"><button type="button" className="text-sky-700 underline" onClick={()=>setDraft([])}>แสดงทั้งหมด</button><button type="button" className="text-sky-700 underline" onClick={()=>setDraft(runs.map(r=>r.pipeline_id))}>ซ่อนทั้งหมด</button></div><div className="flex justify-end gap-2 border-t pt-3"><button type="button" className="button secondary" onClick={close}>ยกเลิก</button><button type="button" className="button primary" onClick={()=>{onApply(draft);close();}}>ยืนยันตัวกรอง</button></div></div>}
 </div>;
}
