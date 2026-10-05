"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { getAnalysisGroups, getAnalyticsSummary, getAnalyticsPipelines } from "@/lib/api";
import { useAnalyticsFilters, analyticsHref } from "@/lib/analytics-scope";
import { userError } from "@/lib/i18n/th";
import type { AnalyticsGroup, AnalyticsPipeline, AnalyticsSummary } from "@/types";
import AnalyticsFilters from "@/components/AnalyticsFilters";
import { percent } from "@/components/MatrixTable";
import { PageHeader, FilterBar, LoadingState, EmptyState, Stat } from "@/components/ConsoleUI";

export default function CategoryAnalyticsPage() {
  const [filters, setFilters] = useAnalyticsFilters();
  const [data, setData] = useState<AnalyticsGroup[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [pipelines, setPipelines] = useState<AnalyticsPipeline[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [showUntested, setShowUntested] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const invalid = !!(filters.date_from && filters.date_to && filters.date_from > filters.date_to);
  useEffect(() => {
    let active = true;
    if (invalid) return;
    Promise.all([getAnalysisGroups("document-types", filters), getAnalyticsSummary(filters), getAnalyticsPipelines()])
      .then(([groups, scope, p]) => {if(active) {setData(groups); setSummary(scope); setPipelines(p); setError("");}})
      .catch(e => {if(active) setError(userError(e.message));})
      .finally(()=>{if(active) setLoading(false);});
    return () => {active = false;};
  }, [filters, invalid, revision]);
  const visible = data.filter(g=>showUntested || g.test_cases > 0);
  const selected = visible.find(g=>g.code === selectedCode) ?? visible[0];
  const historyScope = selected && selected.code !== "unassigned" ? {...filters, document_type_id:selected.code} : filters;
  return <div className="page-stack">
    <PageHeader title="วิเคราะห์ประสิทธิภาพ" description="ดูว่า Pipeline ใดเหมาะกับเอกสารแต่ละประเภท"
      actions={<button className="button secondary" disabled={loading} onClick={()=>{setLoading(true);setRevision(n=>n+1);}}><RefreshCw size={16}/>รีเฟรช</button>} />
    <FilterBar count={Object.values(filters).filter(Boolean).length + Number(showUntested)} onClear={()=>{setFilters({});setShowUntested(false);}}>
      <AnalyticsFilters value={filters} pipelines={pipelines} onChange={(key,value)=>{setLoading(true);setFilters(old=>({...old,[key]:value||undefined}));}} />
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={showUntested} onChange={e=>setShowUntested(e.target.checked)}/>แสดงประเภทที่ยังไม่ทดสอบ</label>
    </FilterBar>
    <p className="filter-note">วิเคราะห์ตามประเภทเอกสารทางธุรกิจ · วันที่กรองคือวันที่สร้างชุดทดสอบ · ตัวกรองร่วมกับประวัติและเปรียบเทียบ</p>
    {invalid && <p className="error-banner" role="alert">วันที่สิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น</p>}
    {error && <div className="error-banner" role="alert">โหลดข้อมูลวิเคราะห์ไม่ได้: {error}<button className="button small" onClick={()=>{setLoading(true);setRevision(n=>n+1);}}>ลองใหม่</button></div>}
    {loading && !invalid ? <LoadingState label="กำลังโหลดข้อมูลวิเคราะห์…"/> : !invalid && !error && <>
      {summary && <div className="stat-grid">
        <Stat label="เอกสารที่วิเคราะห์ได้" value={`${summary.evaluated_cases} / ${summary.test_cases}`} note="จำนวนชุดทดสอบไม่ซ้ำที่มี GT ยืนยันในขอบเขตนี้"/>
        <Stat label="ผล Pipeline ที่มี GT" value={summary.evaluated_results} note={`${summary.evaluated_pipelines} Pipelines · รวมผลเก็บถาวร`}/>
        <Stat label="ประเภทที่มีข้อมูลพอเปรียบเทียบ" value={data.filter(g=>g.best_pipeline).length} note="แต่ละ Pipeline ต้องมี ≥5 ชุดทดสอบที่ประเมินได้ในประเภทนั้น"/>
        <Stat label="Pipeline ดีที่สุดในประเภทที่เลือก" value={selected?.best_pipeline?.pipeline_name || "ยังมีข้อมูลไม่พอสำหรับเปรียบเทียบ"}
          note={selected?.best_pipeline ? `${selected.display_name} · CER ${percent(selected.best_pipeline.cer)} · n=${selected.best_pipeline.evaluated_runs}${selected.best_pipeline.retired ? " · เก็บถาวร" : ""}` : "ต้องมีอย่างน้อย 5 ชุดทดสอบต่อ Pipeline เพื่อจัดอันดับ"}/>
      </div>}
      {selected ? <section className="panel">
        <div className="panel-header"><h2>ประสิทธิภาพแยกตามประเภท</h2>
          <label className="field">ประเภทที่แสดงในตาราง<select aria-label="ประเภทที่แสดงในตาราง" className="select" value={selected.code} onChange={e=>setSelectedCode(e.target.value)}>
            {visible.map(g=><option key={g.code} value={g.code}>{g.display_name} · {g.evaluated_cases}/{g.test_cases} ชุด</option>)}
          </select></label>
        </div>
        {!selected.best_pipeline && <p className="notice-banner">ประเภท “{selected.display_name}” มี {selected.evaluated_cases} ชุดที่ประเมินได้ · ต้องมี ≥5 ชุดต่อ Pipeline เพื่อจัดอันดับ · ยังมีข้อมูลไม่พอสำหรับเปรียบเทียบ</p>}
        <div className="table-wrap" tabIndex={0} role="region" aria-label="ประสิทธิภาพรายประเภท เลื่อนแนวนอนเพื่อดูเพิ่มเติม">
          <table className="data-table min-w-[650px]"><thead><tr><th>Pipeline</th><th>CER เฉลี่ย ↓</th><th>เวลาเฉลี่ย ↓</th><th>n ที่มี GT</th><th>ผลสำเร็จ</th></tr></thead>
            <tbody>{selected.pipelines.filter(p=>p.tests>0).map(p=><tr key={p.pipeline_id}>
              <td>{p.pipeline_name}{p.retired && <span className="badge neutral">เก็บถาวร</span>}</td>
              <td>{percent(p.cer)}</td><td>{p.avg_time_ms == null ? "—" : `${(p.avg_time_ms / 1000).toFixed(1)} วินาที`}</td>
              <td>{p.evaluated_runs}{p.evaluated_runs < 5 && <span className="row-meta">ยังไม่จัดอันดับ</span>}</td><td>{p.successful_runs}/{p.tests}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {selected.code !== "unassigned" && <div className="panel-header"><Link className="button secondary" href={analyticsHref("/history",historyScope)}>ดูประวัติของประเภทนี้</Link></div>}
      </section> : <section className="panel"><EmptyState title="ยังไม่มีชุดทดสอบในประเภทที่เลือก" description="ลองเปลี่ยนตัวกรอง หรือระบุประเภทเอกสารให้ชุดทดสอบ"/></section>}
      <p className="filter-note">ค่า CER ใช้ผลรันสุดท้ายที่ GT ยืนยัน · แต่ละชุดนับครั้งเดียวต่อ Pipeline · Global workflow ใช้ผลรวมเวลา Field</p>
    </>}
  </div>;
}
