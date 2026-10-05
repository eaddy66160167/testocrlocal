import Link from "next/link";
import { Stat } from "@/components/ConsoleUI";
import { percent } from "@/components/MatrixTable";
import type { AnalyticsSummary } from "@/types";

export default function AnalyticsKpis({summary}: {summary: AnalyticsSummary}) {
  const lowest = summary.lowest_cer, fastest = summary.fastest;
  return <div className="stat-grid" aria-label="KPI ตามขอบเขตตัวกรองร่วม">
    <Stat label="ชุดทดสอบในขอบเขตนี้" value={summary.test_cases} note={`${summary.latest_results} ผล Pipeline ล่าสุด · รวมชุดที่ยังไม่รัน`} />
    <Stat label="ผล Pipeline ที่ประเมินแล้ว" value={summary.evaluated_results}
      note={`จาก ${summary.evaluated_cases} ชุดทดสอบ · Coverage ${percent(summary.coverage)}`} />
    <div className="stat-card">
      <span>CER ต่ำที่สุด ↓</span><strong>{percent(lowest?.cer)}</strong>
      {lowest ? <>
        <p>{lowest.pipeline_name}{lowest.retired ? " · เก็บถาวร" : ""}</p>
        <p>{lowest.filename}{lowest.page_number ? ` · หน้า ${lowest.page_number}` : ""}</p>
        <p>{lowest.date_source === "run" ? "วันที่รัน (ไม่มีวันที่ประเมิน)" : "วันที่ประเมิน"}: {new Date(lowest.evaluated_at).toLocaleString("th-TH", {timeZone:"Asia/Bangkok"})}</p>
        <p>{summary.evaluated_results} ผลที่ประเมินในขอบเขตนี้{summary.lowest_cer_ties > 0 ? ` · มีผล CER เท่ากันอีก ${summary.lowest_cer_ties} ผล` : ""}</p>
        <Link className="button small" href={lowest.href}>ดูผลต้นทาง</Link>
      </> : <p>ต้องมีผลสำเร็จและ GT ยืนยันที่ไม่ว่าง</p>}
      <p>CER ระดับผลรันของ 1 ชุดทดสอบ × 1 Pipeline</p>
    </div>
    <Stat label="Pipeline ที่เร็วที่สุด ↓" value={fastest ? `${(fastest.avg_time_ms! / 1000).toFixed(1)} วินาที / ชุดทดสอบ` : "ข้อมูลยังไม่พอเปรียบเทียบ"}
      note={fastest ? `${fastest.pipeline_name}${fastest.retired ? " · เก็บถาวร" : ""} · ${fastest.timed_runs} runs สำเร็จ · เกณฑ์ ≥${summary.minimum_samples}` : `${summary.fastest_progress}/${summary.minimum_samples} ครั้ง · ต้องมีผลสำเร็จที่วัดเวลาได้อย่างน้อย ${summary.minimum_samples}`} />
  </div>;
}
