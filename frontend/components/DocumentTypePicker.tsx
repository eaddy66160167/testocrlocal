"use client";
import {useEffect,useRef,useState} from "react";
import {Plus, Settings2, Trash2} from "lucide-react";
import * as api from "@/lib/api";
import type {DocumentType} from "@/types";
import {userError} from "@/lib/i18n/th";

export default function DocumentTypePicker({value,onChange,onArchive,disabled}:{value:string;onChange:(id:string)=>void;onArchive:()=>void;disabled?:boolean}){
 const [types,setTypes]=useState<DocumentType[]>([]),[mode,setMode]=useState<"create"|"manage">("create");
 const [name,setName]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[remove,setRemove]=useState<DocumentType|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const [isOpen,setIsOpen]=useState(false);
 const close=()=>{dialog.current?.close();setIsOpen(false);};
 useEffect(()=>{let active=true;api.getDocumentTypes().then(v=>{if(active)setTypes(v);}).catch(e=>{if(active)setError(userError(e.message));});return()=>{active=false;};},[]);
 const open=(next:typeof mode)=>{setMode(next);setError("");setRemove(null);setIsOpen(true);dialog.current?.showModal();};
 async function create(){setBusy(true);setError("");try{const type=await api.createDocumentType(name.trim());setTypes(old=>[...old,type]);onChange(type.id);setName("");close();}catch(e){setError(userError(e instanceof Error?e.message:"เพิ่มประเภทไม่สำเร็จ"));}finally{setBusy(false);}}
 async function archive(){if(!remove)return;setBusy(true);setError("");try{await api.archiveDocumentType(remove.id);setTypes(old=>old.filter(t=>t.id!==remove.id));if(value===remove.id)onArchive();setRemove(null);}catch(e){setError(userError(e instanceof Error?e.message:"ลบไม่สำเร็จ"));}finally{setBusy(false);}}
 return <div className="space-y-2">
 <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 max-w-sm">ประเภทเอกสาร<select aria-label="ประเภทเอกสาร" className="select w-full" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">ไม่ระบุประเภท</option>{types.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
 <button type="button" className="button small secondary" disabled={disabled} onClick={()=>open("create")}><Plus size={14}/>เพิ่มประเภทเอกสาร</button><button type="button" className="button small secondary" disabled={disabled} onClick={()=>open("manage")}><Settings2 size={14}/>จัดการประเภท</button></div>
 {error&&!isOpen&&<p role="alert" className="text-red-700">{error}</p>}
 <dialog ref={dialog} aria-labelledby="document-type-title" className="rounded-xl p-5 w-[min(28rem,calc(100%-2rem))] backdrop:bg-black/30" onCancel={e=>{if(busy)e.preventDefault();else setIsOpen(false);}}>
 <h2 id="document-type-title" className="font-semibold mb-4">{mode==="create"?"เพิ่มประเภทเอกสาร":"จัดการประเภท"}</h2>
 {error&&<p role="alert" className="text-red-700 mb-2">{error}</p>}
 {mode==="create"?<form onSubmit={e=>{e.preventDefault();void create();}}><label>ชื่อประเภทเอกสาร<input autoFocus className="input w-full" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label><div className="flex justify-end gap-2 mt-4"><button type="button" className="button secondary" disabled={busy} onClick={close}>ยกเลิก</button><button className="button primary" disabled={busy||!name.trim()}>เพิ่มประเภท</button></div></form>:<>
 {remove?<div><p>ลบประเภท “{remove.name}” ออกจากตัวเลือกหรือไม่? ประวัติเดิมยังคงอยู่</p><div className="flex gap-2 mt-3"><button className="button secondary" disabled={busy} onClick={()=>setRemove(null)}>ยกเลิก</button><button className="button" disabled={busy} onClick={()=>void archive()}>ยืนยันลบประเภท</button></div></div>:<ul className="max-h-72 overflow-auto space-y-2">{types.map(t=><li className="flex items-center justify-between gap-2" key={t.id}><span className="break-words min-w-0">{t.name}</span>{t.system?<span className="muted text-xs">ระบบ</span>:<button className="button small secondary" aria-label={`ลบ ${t.name}`} onClick={()=>setRemove(t)}><Trash2 size={14}/></button>}</li>)}</ul>}
 <button className="button secondary mt-4" disabled={busy} onClick={close}>ปิด</button></>}
 </dialog></div>;
}
