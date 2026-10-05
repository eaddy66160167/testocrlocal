"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import * as api from "@/lib/api";
import type { Category, DocumentType } from "@/types";
import { categoryLabel, userError } from "@/lib/i18n/th";
import { PageHeader, EmptyState, LoadingState } from "@/components/ConsoleUI";

export default function DatasetPage() {
  const [data, setData] = useState<{
    total: number;
    items: api.DatasetSample[];
  }>({ total: 0, items: [] });
  const [categories, setCategories] = useState<Category[]>([]);
  const [types,setTypes]=useState<DocumentType[]>([]),[documentType,setDocumentType]=useState("");
  const [removing,setRemoving]=useState<api.DatasetSample|null>(null),[removeBusy,setRemoveBusy]=useState(false);
  const removeDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(removing)removeDialog.current?.showModal();else removeDialog.current?.close();},[removing]);
  const [category, setCategory] = useState(""),
    [documentId, setDocumentId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true),
    [exporting, setExporting] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: "50",
        });
        if (category) params.set("category", category);
        if (documentId) params.set("document", documentId);
        if (documentType) params.set("document_type",documentType);
        const [samples, tags, kinds] = await Promise.all([
          api.getDatasetSamples(params),
          api.getCategories(),
          api.getDocumentTypes(),
        ]);
        if (active) {
          setData(samples);
          setCategories(tags);
          setTypes(kinds);
        }
      } catch (e) {
        if (active)
          setError(
            userError(
              e instanceof Error ? e.message : "โหลด Dataset ไม่สำเร็จ",
            ),
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [category, documentId, documentType, offset, revision]);
  async function remove(){if(!removing)return;setRemoveBusy(true);try{await api.excludeDatasetSample(removing.id,removing.global_field_id?"field":"case");setSelected(old=>old.filter(id=>id!==removing.id&&id!==`field:${removing.id}`));setRemoving(null);setRevision(v=>v+1);}catch(e){setError(userError(e instanceof Error?e.message:"ลบไม่สำเร็จ"));}finally{setRemoveBusy(false);}}
  async function download() {
    setExporting(true);
    setError("");
    setNotice("");
    try {
      const blob = await api.exportDataset(selected);
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "dataset.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`ส่งออก ${selected.length} ตัวอย่างแล้ว`);
    } catch (e) {
      setError(userError(e instanceof Error ? e.message : "ส่งออกไม่สำเร็จ"));
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeader
        title="Dataset Builder"
        description="เตรียมข้อมูลสำหรับ train จากภาพต้นฉบับและ Ground Truth ที่ยืนยันแล้ว · เรียงล่าสุดก่อน"
        actions={
          <button
            className="button primary"
            disabled={loading || exporting || !selected.length}
            onClick={() => void download()}
          >
            {exporting ? "กำลังส่งออก…" : `ส่งออก ZIP (${selected.length})`}
          </button>
        }
      />
      <section className="panel panel-body">
        <div className="flex flex-wrap items-end gap-3">
          <label>ประเภทเอกสาร<select className="select" value={documentType} onChange={e=>{setDocumentType(e.target.value);setOffset(0);setSelected([]);}}><option value="">ทั้งหมด</option>{types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>
            ประเภทข้อมูล
            <select
              className="select"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setOffset(0);
                setSelected([]);
              }}
            >
              <option value="">ทั้งหมด</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Document ID
            <input
              className="input"
              value={documentId}
              onChange={(e) => {
                setDocumentId(e.target.value);
                setOffset(0);
                setSelected([]);
              }}
            />
          </label>
          <button
            className="button secondary"
            disabled={loading || exporting}
            onClick={() => {
              setRevision((n) => n + 1);
              setSelected([]);
            }}
          >
            รีเฟรช
          </button>
          <button
            className="button secondary"
            disabled={exporting || !selected.length}
            onClick={() => setSelected([])}
          >
            ล้างการเลือก
          </button>
        </div>
        <p className="filter-note">
          เลือกได้สูงสุด 200 ตัวอย่างต่อครั้ง (รวมทุกหน้า) · ต้องมี ROI
          ที่บันทึกและ Ground Truth ที่ยืนยันแล้ว
        </p>
        <p className="filter-note">
          ZIP: dataset/images/000001.png และ dataset/label.txt · UTF-8 TSV ·
          tab, newline และ backslash ใน label ใช้ escape \t, \n, \r, \\
          โดยรักษาข้อความเดิม
        </p>
      </section>
      {notice && (
        <div className="notice-banner" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <LoadingState label="กำลังโหลดตัวอย่าง…" />
      ) : (
        (data.items.length ? (
          <section className="panel">
            <div className="panel-header">
              <h2>{data.total} ตัวอย่างที่ยืนยัน GT · ส่งออกได้เมื่อมีไฟล์ต้นฉบับ</h2>
              <button
                className="button small"
                disabled={exporting}
                onClick={() =>
                  setSelected((old) =>
                    Array.from(
                      new Set([...old, ...data.items.filter(s => s.source_available !== false).map((s) => s.global_field_id ? `field:${s.id}` : s.id)]),
                    ).slice(0, 200),
                  )
                }
              >
                เลือกหน้านี้
              </button>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>เลือก</th>
                    <th>ภาพ ROI</th>
                    <th>ต้นฉบับ</th>
                    <th>Confirmed Ground Truth</th>
                    <th>ประเภท</th>
                    <th><span className="sr-only">จัดการ</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((sample) => (
                    <tr key={sample.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`เลือก ${sample.id}`}
                          checked={selected.includes(sample.global_field_id ? `field:${sample.id}` : sample.id)}
                          disabled={
                            exporting || sample.source_available === false ||
                            (!selected.includes(sample.global_field_id ? `field:${sample.id}` : sample.id) &&
                              selected.length >= 200)
                          }
                          onChange={(e) =>
                            setSelected((old) =>
                              e.target.checked
                                ? [...old, sample.global_field_id ? `field:${sample.id}` : sample.id]
                                : old.filter((id) => id !== (sample.global_field_id ? `field:${sample.id}` : sample.id)),
                            )
                          }
                        />
                      </td>
                      <td>
                        {sample.source_available === false ? <span className="text-red-700">ไฟล์ต้นฉบับไม่อยู่ใน storage · ต้องคืนไฟล์หรืออัปโหลดใหม่</span> : <Image
                          src={api.cropUrl(
                            sample.document_id,
                            sample.roi,
                            sample.page_number,
                          )}
                          alt={`ROI ${sample.filename}${sample.field_index ? ` · Field ${String(sample.field_index).padStart(2,"0")}` : ""}`}
                          width={120}
                          height={70}
                          unoptimized
                          style={{ objectFit: "contain", maxHeight: 70 }}
                        />}
                      </td>
                      <td>
                        <Link className="mini-link" href={`/test/${sample.test_case_id ?? sample.id}`}>
                          {sample.filename}{sample.field_index ? ` · Field ${String(sample.field_index).padStart(2,"0")}` : ""}
                        </Link>
                        <p className="muted text-xs">{sample.document_type_name||"ไม่ระบุประเภท"}</p>
                        <p className="muted">
                          {sample.page_number
                            ? `หน้า ${sample.page_number} · `
                            : ""}
                          {sample.roi.x2 - sample.roi.x1} ×{" "}
                          {sample.roi.y2 - sample.roi.y1} px
                        </p>
                      </td>
                      <td>
                        <div className="max-w-sm whitespace-pre-wrap break-words">
                          {sample.ground_truth_raw ||
                            "(ข้อความว่างที่ยืนยันแล้ว)"}
                        </div>
                      </td>
                      <td>
                        {sample.categories
                          .map((c) =>
                            categoryLabel({ code: c, display_name: c }),
                          )
                          .join(", ") || "—"}
                      </td>
                      <td><button className="button small secondary" disabled={exporting} onClick={()=>setRemoving(sample)}>ลบออกจาก Dataset</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-body flex items-center gap-3">
              <button
                className="button secondary"
                disabled={!offset || exporting}
                onClick={() => setOffset((n) => n - 50)}
              >
                ก่อนหน้า
              </button>
              <span>
                {offset + 1}–{offset + data.items.length}
              </span>
              <button
                className="button secondary"
                disabled={offset + 50 >= data.total || exporting}
                onClick={() => setOffset((n) => n + 50)}
              >
                ถัดไป
              </button>
            </div>
          </section>
        ) : error ? null : (
          <EmptyState
            title="ยังไม่มีตัวอย่างที่พร้อมส่งออก"
            description="บันทึก ROI และยืนยัน Ground Truth ในชุดทดสอบก่อน ตัวอย่างจะแสดงที่นี่"
          />
        ))
      )}
      <dialog ref={removeDialog} role="alertdialog" aria-labelledby="remove-dataset-title" className="rounded-xl p-5 w-[min(28rem,calc(100%-2rem))] backdrop:bg-black/30" onCancel={e=>{if(removeBusy)e.preventDefault();else setRemoving(null);}}><h2 id="remove-dataset-title">นำรายการนี้ออกจาก Dataset Builder หรือไม่?</h2><p className="muted mt-2">เอกสาร ประวัติ และ Ground Truth ยังคงอยู่</p>{error&&<p role="alert">{error}</p>}<div className="flex gap-2 mt-4"><button className="button secondary" autoFocus disabled={removeBusy} onClick={()=>setRemoving(null)}>ยกเลิก</button><button className="button" disabled={removeBusy} onClick={()=>void remove()}>ยืนยันนำออก</button></div></dialog>
    </div>
  );
}
