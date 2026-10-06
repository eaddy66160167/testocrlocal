"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { getAnalyticsPipelines, getAnalyticsSummary, getHistory, getComparison } from "@/lib/api";
import { useAnalyticsFilters, useComparisonDisplay } from "@/lib/analytics-scope";
import AnalyticsFilters from "@/components/AnalyticsFilters";
import {DecisionOverview, ByType} from "@/components/ComparisonDecision";
import type {Comparison} from "@/types/comparison";
import { pipelineLabel, userError } from "@/lib/i18n/th";
import type {
  AnalyticsPipeline,
  AnalyticsSummary,
  TestCase,
} from "@/types";
import { percent } from "@/components/MatrixTable";
import {
  PageHeader,
  FilterBar,
  LoadingState,
  EmptyState,
} from "@/components/ConsoleUI";
export default function MatrixPage() {
  const [cases, setCases] = useState<TestCase[]>([]),
    [pipelines, setPipelines] = useState<AnalyticsPipeline[]>([]),
    [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [filters, setFilters] = useAnalyticsFilters();
  const display = useComparisonDisplay();
  const [decision, setDecision] = useState<Comparison|null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [offset, setOffset] = useState(0),
    [hasNext, setHasNext] = useState(false),
    [search, setSearch] = useState(""),
    [onlyGT, setOnlyGT] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const invalid = !!(
    filters.date_from &&
    filters.date_to &&
    filters.date_from > filters.date_to
  );
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      if (invalid) {
        setLoading(false);
        return;
      }
      await Promise.all([
        getHistory({ ...filters, limit: 21, offset }),
        getAnalyticsPipelines(),
        getAnalyticsSummary(filters),
        getComparison(filters, display.includeArchived),
      ])
        .then(([h, p, s, d]) => {
          if (active) {
            setCases(h.slice(0, 20));
            setHasNext(h.length > 20);
            setPipelines(p);
            setSummary(s);
            setDecision(d);
          }
        })
        .catch((e) => {
          if (active) setError(userError(e.message));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    void load();
    return () => {
      active = false;
    };
  }, [filters, offset, revision, invalid, display.includeArchived]);
  const visible = cases.filter(
    (c) =>
      (!onlyGT || c.ground_truth_raw !== null) &&
      (!search ||
        c.document.filename.toLowerCase().includes(search.toLowerCase())),
  );
  const selected = (decision?.pipelines ?? []).filter(
    (p) => !filters.pipeline || p.pipeline_id === filters.pipeline,
  );
  return (
    <div className="page-stack">
      <PageHeader
        title="เปรียบเทียบ Pipeline"
        description="เลือก Pipeline ที่ควรใช้ จากผลบนเอกสารชุดเดียวกัน"
        actions={
          <button
            className="button secondary"
            disabled={loading}
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={16} />
            รีเฟรช
          </button>
        }
      />
      <div role="tablist" aria-label="มุมมองการเปรียบเทียบ" className="flex gap-2"><button role="tab" aria-selected={display.view === "overall"} className={`button ${display.view === "overall" ? "primary" : "secondary"}`} onClick={()=>display.update("view","overall")}>สรุปผล</button><button role="tab" aria-selected={display.view === "by-type"} className={`button ${display.view === "by-type" ? "primary" : "secondary"}`} onClick={()=>display.update("view","by-type")}>ตามประเภทเอกสาร</button></div>
      <label className="flex gap-2 items-center"><input type="checkbox" checked={!display.includeArchived} onChange={e=>display.update("include_archived",e.target.checked ? "" : "1")}/>เฉพาะ Pipeline ที่ใช้งานอยู่</label>
      <button className="button secondary self-start" aria-expanded={showFilters || Object.values(filters).some(Boolean)} onClick={()=>setShowFilters(v=>!v)}>ตัวกรองเอกสารและวันที่</button>
      <div hidden={!showFilters && !Object.values(filters).some(Boolean)}><FilterBar
        count={
          Object.values(filters).filter(Boolean).length +
          Number(!!search) +
          Number(onlyGT)
        }
        onClear={() => {
          setFilters({});
          setSearch("");
          setOnlyGT(false);
          setOffset(0);
        }}
      >
        <AnalyticsFilters
          value={filters}
          pipelines={pipelines}
          onChange={(k, v) => {
            setFilters((old) => ({ ...old, [k]: v || undefined }));
            setOffset(0);
          }}
        />
        <label className="field">
          ค้นหาเอกสารในหน้านี้
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ชื่อเอกสาร"
          />
        </label>
      </FilterBar></div>
      {invalid && (
        <p className="error-banner" role="alert">
          วันที่สิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น
        </p>
      )}
      {error && (
        <div className="error-banner" role="alert">
          ไม่สามารถโหลดผลเปรียบเทียบได้: {error}{" "}
          <button
            className="button small"
            onClick={() => setRevision((n) => n + 1)}
          >
            ลองใหม่
          </button>
        </div>
      )}
      {loading ? (
        <LoadingState label="กำลังโหลดผลเปรียบเทียบ…" />
      ) : (
        !invalid &&
        !error && (
          <>
            {decision && (display.view === "overall" ? <DecisionOverview data={decision}/> : <ByType data={decision}/>)}
            <details className="panel panel-body"><summary className="cursor-pointer font-semibold">ผลรายชุดทดสอบ</summary>
            <p className="filter-note">คำแนะนำใช้เอกสารชุดเดียวกันแบบเทียบเป็นคู่ · ตารางด้านล่างเป็นผลรายชุดทดสอบ · ค้นหาและ GT มีผลเฉพาะหน้านี้</p>
            {cases.length ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>เปรียบเทียบรายชุดทดสอบ</h2>
                    <p className="filter-note">
                      ผลล่าสุดต่อ Pipeline · ช่องที่ไม่มี Ground Truth แสดง —
                    </p>
                  </div>
                  <label className="flex gap-2 text-sm items-center">
                    <input
                      type="checkbox"
                      checked={onlyGT}
                      onChange={(e) => setOnlyGT(e.target.checked)}
                    />
                    เฉพาะชุดที่มี Ground Truth ในหน้านี้
                  </label>
                </div>
                {visible.length ? (
                  <div
                    className="table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label="ตารางข้อมูล เลื่อนแนวนอนเพื่อดูคอลัมน์เพิ่มเติม"
                  >
                    <table
                      className="data-table"
                      style={{ minWidth: 900 }}
                      aria-label="เปรียบเทียบรายชุดทดสอบ"
                    >
                      <thead>
                        <tr>
                          <th scope="col">เอกสาร / หน้า</th>
                          {selected.map((p) => (
                            <th scope="col" key={p.pipeline_id}>
                              {pipelineLabel(p.pipeline_id, p.pipeline_name)}{p.retired && <span className="badge neutral">เก็บถาวร</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <Link
                                className="row-title"
                                href={`/test/${c.id}`}
                              >
                                {c.document.filename}
                              </Link>
                              <span className="row-meta">
                                หน้า {c.page_number ?? 1} ·{" "}
                                {c.ground_truth_raw === null
                                  ? "รอ Ground Truth"
                                  : "มี Ground Truth"}
                              </span>
                            </td>
                            {selected.map((p) => {
                              const r = [...c.runs]
                                .reverse()
                                .find((r) => r.pipeline_id === p.pipeline_id);
                              return (
                                <td key={p.pipeline_id}>
                                  {!r ? (
                                    <span className="muted">ยังไม่ทดสอบ</span>
                                  ) : r.status === "error" ? (
                                    <span className="badge error">ประมวลผลไม่สำเร็จ</span>
                                  ) : (
                                    <>
                                      <strong>
                                        CER {percent(r.metrics?.cer)}
                                      </strong>
                                      <span className="row-meta">
                                        WER {percent(r.metrics?.wer)} · Exact{" "}
                                        {r.metrics
                                          ? r.metrics.exact_match
                                            ? "ใช่"
                                            : "ไม่ใช่"
                                          : "—"}
                                      </span>
                                      <span className="row-meta">
                                        {r.processing_time_ms ?? "—"} ms ·
                                        Confidence {percent(r.confidence)}
                                      </span>
                                    </>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="ไม่มีชุดทดสอบตามตัวกรองในหน้านี้"
                    description="ลองล้างการค้นหา หรือเปลี่ยนหน้าตาราง"
                  />
                )}
                <div className="table-footer">
                  <span>
                    หน้า {offset / 20 + 1} · แสดง {visible.length} รายการในหน้านี้ จาก {summary?.history_cases ?? "—"} ชุดที่เคยรัน
                  </span>
                  <div>
                    <button
                      className="button secondary"
                      disabled={!offset}
                      onClick={() => setOffset((n) => Math.max(0, n - 20))}
                    >
                      ก่อนหน้า
                    </button>
                    <button
                      className="button secondary"
                      disabled={!hasNext}
                      onClick={() => setOffset((n) => n + 20)}
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="panel">
                <EmptyState
                  title="ยังไม่มีผลสำหรับเปรียบเทียบ"
                  description="รัน OCR และบันทึก Ground Truth เพื่อเริ่มเปรียบเทียบความแม่นยำ"
                  action={
                    <Link className="button primary" href="/">
                      เริ่มทดสอบ OCR
                    </Link>
                  }
                />
              </section>
            )}
            <p className="filter-note">
              CER / WER / เวลา: ต่ำดีกว่า · Exact Match / Confidence: สูงดีกว่า
              · เปรียบเทียบจำนวนตัวอย่างเสมอ โดยเฉพาะเมื่อ Pipeline
              มีผลสำเร็จไม่เท่ากัน
            </p>
            </details>
          </>
        )
      )}
    </div>
  );
}
