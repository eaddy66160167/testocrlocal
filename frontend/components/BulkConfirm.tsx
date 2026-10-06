"use client";
import {useEffect,useRef,useState} from "react";

export default function BulkConfirm({count,kind,onConfirm}:{count:number;kind:"history"|"dataset";onConfirm:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),pending=useRef(false);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 function close(){if(pending.current)return;setOpen(false);trigger.current?.focus();}
 async function confirm(){if(pending.current)return;pending.current=true;setBusy(true);setError("");try{await onConfirm();setOpen(false);trigger.current?.focus();}catch{setError("ดำเนินการไม่สำเร็จ กรุณาลองใหม่");}finally{pending.current=false;setBusy(false);}}
 const history=kind==="history";
 return <><button ref={trigger} className={`button ${history?"text-red-700 secondary":"secondary"}`} disabled={!count||busy} onClick={()=>{setError("");setOpen(true);}}>{history?`ลบ ${count} รายการ`:`นำออกจาก Dataset (${count})`}</button>
 <dialog ref={dialog} role="alertdialog" aria-labelledby={`bulk-${kind}`} aria-describedby={`bulk-${kind}-description`} className="rounded-xl p-5 w-[min(28rem,calc(100%-2rem))] backdrop:bg-black/40" onCancel={e=>{e.preventDefault();close();}}>
 <h2 id={`bulk-${kind}`} className="font-semibold">{history?`ลบประวัติ ${count} รายการ?`:`นำ ${count} ตัวอย่างออกจาก Dataset Builder?`}</h2>
 <p id={`bulk-${kind}-description`} className="my-4">{history?"ผล OCR, Metrics และ Ground Truth ของชุดทดสอบที่เลือกจะถูกลบ เอกสารต้นฉบับและชุดทดสอบหน้าอื่นของเอกสารเดียวกันยังคงอยู่":"ตัวอย่างเหล่านี้จะไม่แสดงและจะไม่ถูกส่งออกใน Dataset เอกสาร ประวัติ ผล OCR และ Ground Truth ยังคงอยู่"}</p>
 {error&&<p role="alert" className="error-banner">{error}</p>}<div className="flex flex-wrap gap-2"><button className="button secondary" autoFocus disabled={busy} onClick={close}>ยกเลิก</button><button className={`button ${history?"bg-red-700 text-white":"primary"}`} disabled={busy} onClick={()=>void confirm()}>{busy?"กำลังดำเนินการ…":history?`ยืนยันลบ ${count} รายการ`:`ยืนยันนำออก ${count} รายการ`}</button></div></dialog></>;
}
