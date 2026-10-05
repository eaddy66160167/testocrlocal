"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Copy, Info, AlertTriangle, CircleX } from "lucide-react";
import { getLogs, getAnalyticsPipelines, type AppLog } from "@/lib/api";
import type { AnalyticsPipeline } from "@/types";
import { PageHeader, FilterBar, LoadingState, EmptyState } from "@/components/ConsoleUI";

const levels = {INFO: {label:"ข้อมูล", tone:"neutral", Icon:Info}, WARNING:{label:"คำเตือน",tone:"warning",Icon:AlertTriangle}, ERROR:{label:"ผิดพลาด",tone:"error",Icon:CircleX}};
const outcomes: Record<string,string> = {error:"ไม่สำเร็จ", started:"เริ่มดำเนินการ", success:"สำเร็จ", recorded:"บันทึกแล้ว"};
export default function LogsPage() {
  const [pipelines, setPipelines] = useState<AnalyticsPipeline[]>([]);
  const [filters, setFilters] = useState<Record<string,string>>({});
  const [offset,setOffset] = useState(0), [revision,setRevision] = useState(0);
  const [items,setItems] = useState<AppLog[]>([]), [total,setTotal] = useState(0);
  const [loading,setLoading] = useState(true), [error,setError] = useState(""), [copied,setCopied] = useState("");
  const [caseId,setCaseId] = useState<string | null>(null);
  const invalid = !!(filters.date_from && filters.date_to && filters.date_from > filters.date_to);
  useEffect(()=>{
    let active = true;
    async function load() {
      setLoading(true); setError("");
      if(invalid) {setLoading(false);return;}
      const q = new URLSearchParams({limit:"25",offset:String(offset)});
      const id = new URLSearchParams(window.location.search).get("test_case_id");
      setCaseId(id);
      if(id) q.set("test_case_id",id);
      for(const [key,value] of Object.entries(filters)) if(value) q.set(key,key.startsWith("date_") ? new Date(value).toISOString() : value);
      try {
        const [data,options] = await Promise.all([getLogs(q), getAnalyticsPipelines()]);
        if(active) {setItems(data.items);setTotal(data.total);setPipelines(options);}
      } catch {if(active) setError("ไม่สามารถโหลดบันทึกระบบได้ กรุณาตรวจการเชื่อมต่อ Backend");}
      finally {if(active) setLoading(false);}
    }
    void load(); return ()=>{active=false;};
  },[filters,offset,revision,invalid]);
  function filter(key:string,value:string) {setOffset(0);setFilters(old=>({...old,[key]:value}));}
  function clear() {
    setFilters({});setOffset(0);setCaseId(null);
    window.history.replaceState(null,"","/logs");setRevision(n=>n+1);
  }
  async function copy(value:string) {
    try {await navigator.clipboard.writeText(value);setCopied("คัดลอกรหัสอ้างอิงแล้ว");}
    catch {setCopied("คัดลอกไม่ได้ กรุณาเลือกข้อความแล้วคัดลอกด้วยตนเอง");}
  }
  return <div className="page-stack">
    <PageHeader title="บันทึกระบบ" description="ดูเหตุการณ์ระบบและข้อผิดพลาด เพื่อค้นหาสาเหตุและเปิดชุดทดสอบที่เกี่ยวข้อง"
      actions={<button className="button secondary" disabled={loading} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/>รีเฟรช</button>}/>
    <FilterBar count={Object.values(filters).filter(Boolean).length + Number(!!caseId)} onClear={clear}>
      <label className="field">ระดับเหตุการณ์<select aria-label="ระดับเหตุการณ์" className="select" value={filters.level||""} onChange={e=>filter("level",e.target.value)}>
        <option value="">ทุกระดับ</option>{Object.entries(levels).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}
      </select></label>
      <label className="field">Pipeline<select aria-label="Pipeline" className="select" value={filters.pipeline||""} onChange={e=>filter("pipeline",e.target.value)}>
        <option value="">ทุก Pipeline</option>{pipelines.map(p=><option key={p.pipeline_id} value={p.pipeline_id}>{p.pipeline_name}{p.retired?" · เก็บถาวร":""}</option>)}
      </select></label>
      <label className="field">ค้นหาบันทึกทั้งหมด<input className="input" placeholder="บางส่วนของชื่อเอกสาร, Pipeline, เหตุการณ์" value={filters.q||""} onChange={e=>filter("q",e.target.value)}/></label>
      <label className="field">Request ID<input className="input" value={filters.request_id||""} onChange={e=>filter("request_id",e.target.value)}/></label>
      <label className="field">เวลาเกิดเหตุการณ์ · ตั้งแต่<input type="datetime-local" className="input" value={filters.date_from||""} onChange={e=>filter("date_from",e.target.value)}/></label>
      <label className="field">เวลาเกิดเหตุการณ์ · ถึง<input type="datetime-local" className="input" value={filters.date_to||""} onChange={e=>filter("date_to",e.target.value)}/></label>
    </FilterBar>
    {caseId && <p className="notice-banner">กำลังแสดงเหตุการณ์ของชุดทดสอบที่เลือก · ตัวกรองนี้แยกจากประวัติ/เปรียบเทียบ/วิเคราะห์</p>}
    {invalid && <p className="error-banner" role="alert">เวลาสิ้นสุดต้องไม่อยู่ก่อนเวลาเริ่มต้น</p>}
    {error && <p className="error-banner" role="alert">{error}<button className="button small" onClick={()=>setRevision(n=>n+1)}>ลองใหม่</button></p>}
    {copied && <p role="status" className="notice-banner">{copied}</p>}
    <section className="panel">
      {loading ? <LoadingState label="กำลังโหลดบันทึก…"/> : !error && !invalid && (items.length ?
        <div className="table-wrap" tabIndex={0} role="region" aria-label="บันทึกระบบ เลื่อนแนวนอนเพื่อดูเพิ่มเติม">
          <table className="data-table min-w-[850px]"><caption className="sr-only">เหตุการณ์ระบบ เรียงจากล่าสุด</caption>
            <thead><tr>{["เวลา","ระดับ","เหตุการณ์ / ผลลัพธ์","เอกสาร / Pipeline","เวลาใช้","รายละเอียด"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead>
            <tbody>{items.map(row=>{
              const severity = levels[row.level as keyof typeof levels] || levels.INFO;
              const Icon = severity.Icon;
              return <tr key={row.id}>
                <td><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</time></td>
                <td><span className={`badge ${severity.tone}`}><Icon size={14} aria-hidden="true"/>{severity.label}</span></td>
                <td><span className="row-title">{row.message}</span><span className="row-meta">{outcomes[row.outcome]||"บันทึกแล้ว"}</span></td>
                <td>{row.document_name||"ไม่ระบุเอกสาร"}{row.page_number != null && <span className="row-meta">หน้า {row.page_number}</span>}
                  {row.pipeline_id && <span className="row-meta">{row.pipeline_name || "Pipeline เดิม (ไม่มีชื่อย้อนหลัง)"}</span>}
                  {row.test_case_id && (row.test_case_exists ? <div className="row-actions"><Link className="button small" href={`/test/${row.test_case_id}`}>เปิดชุดทดสอบ</Link><Link className="button small" href={`/history?document=${row.document_id||""}`}>ดูประวัติ</Link></div> : <span className="row-meta">ไม่พบรายการ (ถูกลบแล้ว)</span>)}
                </td>
                <td>{row.metadata.duration_ms == null ? "—" : `${(row.metadata.duration_ms/1000).toFixed(1)} วินาที`}</td>
                <td><details><summary>รายละเอียดทางเทคนิค</summary><dl className="text-xs break-all">
                  {Object.entries({event_type:row.event_type,pipeline_id:row.pipeline_id,test_case_id:row.test_case_id,document_id:row.document_id,request_id:row.request_id,gateway_request_id:row.gateway_request_id,error_code:row.metadata.error_code,count:row.metadata.count}).filter(([,v])=>v!=null).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}{(key==="request_id"||key==="gateway_request_id") && <button className="button small ghost" aria-label={`คัดลอก ${key}`} onClick={()=>void copy(String(value))}><Copy size={13}/></button>}</dd></div>)}
                </dl></details></td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <EmptyState title={Object.values(filters).some(Boolean)||caseId ? "ไม่มีบันทึกตามตัวกรองนี้" : "ยังไม่มีบันทึกระบบ"} description="ลองล้างตัวกรองหรือขยายช่วงเวลา เหตุการณ์ระบบจะแสดงที่นี่เมื่อมีการใช้งาน"/>) }
    </section>
    <div className="table-footer"><span>{total ? offset+1:0}–{Math.min(offset+25,total)} / {total} รายการ</span><div>
      <button className="button secondary" disabled={!offset||loading} onClick={()=>setOffset(n=>Math.max(0,n-25))}>ก่อนหน้า</button>
      <button className="button secondary" disabled={offset+25>=total||loading} onClick={()=>setOffset(n=>n+25)}>ถัดไป</button>
    </div></div>
    <p className="filter-note">บันทึกสถานะและรหัสอ้างอิงเพื่อวิเคราะห์ปัญหา · ไม่แสดงข้อความ OCR, Ground Truth, ภาพ หรือข้อมูลลับ · ไม่มีข้อมูลผู้ใช้เนื่องจากระบบไม่มีบัญชีผู้ใช้</p>
  </div>;
}
