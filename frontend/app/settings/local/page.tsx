"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ConsoleUI";
import { localDB, storageError } from "@/lib/local-db/schema";
import { exportBackup, restoreBackup } from "@/lib/local-db/backup";
import { deleteDocuments, storageUsage } from "@/lib/local-db/documents";
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
export default function LocalDataSettings() {
  const [usage, setUsage] = useState<Awaited<ReturnType<typeof storageUsage>> | null>(null);
  const [documents, setDocuments] = useState<{id:string;filename:string}[]>([]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [conflict, setConflict] = useState<"reject" | "replace">("reject"), [confirmed, setConfirmed] = useState(false);
  async function refresh() { const [estimate, records] = await Promise.all([storageUsage(), localDB().documents.toArray()]); setUsage(estimate); setDocuments(records); }
  useEffect(() => { let active=true; Promise.all([storageUsage(), localDB().documents.toArray()]).then(([u,d])=>{if(active){setUsage(u);setDocuments(d);}}).catch(()=>{if(active)setMessage("อ่านพื้นที่จัดเก็บไม่ได้");}); return()=>{active=false;}; }, []);
  async function action(fn:()=>Promise<void>) {setBusy(true);setMessage("");try{await fn();await refresh();}catch(e){try{storageError(e);}catch(error){setMessage(error instanceof Error?error.message:"ดำเนินการไม่สำเร็จ");}}finally{setBusy(false);}}
  async function backup() {
    const blob = await exportBackup(), url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href=url; anchor.download=`ocr-local-${new Date().toISOString().slice(0,10)}.ocrbackup`; anchor.click();
    // Keep the URL alive until the download has started, then release it.
    window.setTimeout(()=>URL.revokeObjectURL(url),1000); setMessage("ส่งออกข้อมูลสำรองแล้ว กรุณาเก็บไฟล์ไว้ในที่ปลอดภัย");
  }
  return <div className="page-stack"><PageHeader title="ข้อมูลในเบราว์เซอร์" description="สำรอง กู้คืน และจัดการพื้นที่จัดเก็บข้อมูลทดสอบ"/>
    <section className="panel panel-body space-y-4">
      <p>เอกสาร ผล OCR และ Ground Truth อยู่ในเบราว์เซอร์และโปรไฟล์นี้เท่านั้น ไม่ได้ซิงก์ข้ามเครื่อง การล้างข้อมูลเว็บไซต์หรือพื้นที่เต็มอาจทำให้ข้อมูลสูญหาย กรุณาสำรองข้อมูลเป็นระยะ</p>
      {usage&&<p>ใช้พื้นที่ {mb(usage.usage)} MB / {usage.quota?`${mb(usage.quota)} MB`:"ไม่ทราบโควตา"} · {usage.persisted?"ได้รับสิทธิ์เก็บข้อมูลถาวรจากเบราว์เซอร์":"ยังไม่ได้รับสิทธิ์ป้องกันการล้างอัตโนมัติ"}</p>}
      {usage?.lowSpace&&<p className="error-banner" role="alert">พื้นที่เหลือน้อยกว่า 20% กรุณาสำรองข้อมูลก่อนลบรายการที่ไม่ใช้</p>}
      <div className="flex flex-wrap gap-3"><button className="button primary" disabled={busy} onClick={()=>void action(backup)}>ส่งออกข้อมูลสำรอง</button><button className="button secondary" disabled={busy} onClick={()=>void action(async()=>{const granted=await navigator.storage?.persist();setMessage(granted?"เบราว์เซอร์อนุญาตให้เก็บข้อมูลแล้ว แต่ยังควรสำรองข้อมูล":"เบราว์เซอร์ยังไม่อนุญาต กรุณาสำรองข้อมูลเป็นระยะ");})}>ขอสิทธิ์ป้องกันการล้างอัตโนมัติ</button></div>
    </section>
    <section className="panel panel-body space-y-4"><h2>กู้คืนข้อมูลสำรอง</h2>
      <label className="block">ไฟล์ข้อมูลสำรอง <input type="file" accept=".ocrbackup" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);setConfirmed(false);}}/></label>
      <label className="block">เมื่อข้อมูลซ้ำ <select className="select" disabled={busy} value={conflict} onChange={e=>{setConflict(e.target.value as "reject"|"replace");setConfirmed(false);}}><option value="reject">หยุดการกู้คืนเมื่อ ID ซ้ำ</option><option value="replace">แทนที่ข้อมูลทดสอบทั้งหมดด้วยไฟล์สำรอง</option></select></label>
      {conflict==="replace"&&<label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>ฉันสำรองข้อมูลปัจจุบันแล้ว และยืนยันให้แทนที่ข้อมูลทั้งหมด</label>}
      <p className="text-sm">ระบบตรวจ checksum และความสัมพันธ์ข้อมูลก่อนเขียน และกู้คืนใน transaction เดียว การแทนที่ไม่รวมรหัสผู้ดูแลหรือ API Key</p>
      <button className="button primary" disabled={busy||!file||(conflict==="replace"&&!confirmed)} onClick={()=>void action(async()=>{const result=await restoreBackup(file!,conflict);setMessage(`กู้คืนเอกสาร ${result.documents} รายการ และผล OCR ${result.results} รายการแล้ว`);})}>กู้คืนข้อมูล</button>
    </section>
    <section className="panel panel-body space-y-3"><h2>เอกสารที่เก็บไว้ ({documents.length})</h2><p className="text-sm">การลบเอกสารจะลบชุดทดสอบ ผล OCR และ Dataset ที่เป็นของเอกสารนั้นด้วย</p>
      {documents.map(d=><div key={d.id} className="flex justify-between gap-4"><span>{d.filename}</span><button className="button secondary" disabled={busy} onClick={()=>{if(window.confirm(`ลบ ${d.filename} และข้อมูลทดสอบทั้งหมดของเอกสารนี้?`))void action(async()=>{await deleteDocuments([d.id]);setMessage("ลบเอกสารแล้ว");});}}>ลบเอกสาร</button></div>)}
    </section>
    {message&&<p role="status" className="notice-banner">{message}</p>}{busy&&<p role="status">กำลังดำเนินการ…</p>}
  </div>;
}
