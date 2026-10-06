"use client";
import { useEffect, useState } from "react";
import { getDocumentTypes } from "@/lib/api";
import type { AnalyticsPipeline, DocumentType, QueryFilters } from "@/types";

export default function AnalyticsFilters({value, pipelines, onChange}: {
  value: QueryFilters; pipelines: AnalyticsPipeline[];
  onChange: (key: keyof QueryFilters, value: string) => void;
}) {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    getDocumentTypes().then(data => {if(active) setTypes(data);}).catch(() => {if(active) setError(true);});
    return () => {active = false;};
  }, []);
  return <>
    <span className="filter-note">ช่วงวันที่สร้างชุดทดสอบใช้วันตาม UTC</span>
    <label className="field">ประเภทเอกสาร (ธุรกิจ)
      <select aria-label="ประเภทเอกสาร (ธุรกิจ)" className="select" value={value.document_type_id || ""} onChange={e=>onChange("document_type_id",e.target.value)}>
        <option value="">ทุกประเภทเอกสาร</option>
        {types.map(t=><option key={t.id} value={t.id}>{t.name}{!t.active ? " · เก็บถาวร" : ""}</option>)}
        {value.document_type_id && !types.some(t=>t.id===value.document_type_id) && <option value={value.document_type_id}>ประเภทที่เลือก (เก็บถาวร)</option>}
      </select>{error && <span className="text-xs text-red-700">โหลดประเภทเอกสารไม่สำเร็จ</span>}
    </label>
    <label className="field">Pipeline
      <select aria-label="Pipeline" className="select" value={value.pipeline || ""} onChange={e=>onChange("pipeline",e.target.value)}>
        <option value="">ทุก Pipeline</option>{pipelines.map(p=><option key={p.pipeline_id} value={p.pipeline_id}>{p.pipeline_name}{p.retired ? " · เก็บถาวร" : ""}</option>)}
      </select>
    </label>
    <label className="field">วันที่สร้างชุดทดสอบ · จากวันที่
      <input className="input" type="date" value={value.date_from||""} onChange={e=>onChange("date_from",e.target.value)} />
    </label>
    <label className="field">วันที่สร้างชุดทดสอบ · ถึงวันที่
      <input className="input" type="date" min={value.date_from} value={value.date_to||""} onChange={e=>onChange("date_to",e.target.value)} />
    </label>
  </>;
}
