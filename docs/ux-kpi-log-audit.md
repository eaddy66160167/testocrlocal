# Stage A — UX, KPI and Log audit

Audit only. No KPI, UI, PipelineConfig, production data or production schema changes. Stage B/P0/P1/P2 have **not** started. Evidence captured 5 October 2026 UTC (local session crossed into 6 October, Asia/Bangkok). Numbers describe that snapshot, not live counters.

## Baseline and boundaries

- Local `main` was `7e8f8d2c8d6a56e37c1791c5a11f8b4618934846`; fetched and fast-forwarded two commits to `5b584c8430b7fe4dc329c9d8e16d1ff6b2b2a7c8`, equal to `origin/main`. Known baseline `35444eeddee4268062c5e725ebeb68092a526ce0` is an ancestor. Pull was required. No clone/reset/stash/revert.
- No modified tracked source before sync. Two pre-existing untracked text artifacts (`bject {`, `tance Win32_Process` followed by U+F07C) contain pager help/old diff output; preserved, not staged.
- SOURCE = LOCAL DB: existing development PostgreSQL container was started; explicit loopback DATABASE_URL supplied only to migration commands. `alembic upgrade head`, `current`, `check` passed; exact revision `0010_dynamic_pipelines (head)`; no new upgrade operations. Private `.env` points remote and was **not** used for this local migration.
- SOURCE = PRODUCTION DB READ-ONLY: revision also `0010_dynamic_pipelines`. SELECT-only session enforced with `default_transaction_read_only=on`; repeatable-read snapshot. No app startup/seed/migration invoked against production. A collector initially used a Neon-pooler-unsupported startup timeout; removed only that helper option, retaining read-only enforcement.
- SOURCE = PRODUCTION API: GET `/api/health` returned `ok`. Only GET requests used. No OCR, export POST, configuration mutation, record correction, deployment, commit or push.
- Local/remote source diff empty after sync; `git diff --check` passed. No 0011. Audit output is this document; scripts/evidence/screenshots stay ignored under `.runtime/`.
- Evidence: `.runtime/kpi-audit.json` (aggregates, IDs, timestamps; no OCR/GT dumps), `.runtime/kpi-audit.py` (collector), `.runtime/audit-before/manifest.json` and screenshot files. DB and API observations are separately labeled below; they are not an atomic cross-service snapshot.

## A. Tab table

Five-second ratings are reviewer judgments from the captured production UI and current source, not usability-study measurements.

| Tab | Responsibility / user question | Primary data | Overlap/confusion | 5-second status | Recommended fix (not implemented) |
|---|---|---|---|---|---|
| History — ประวัติการทดสอบ | ฉันเคยทดสอบอะไรไปแล้ว? Open/manage outcomes | TestCase + latest run snapshots, status, filenames, dates | Repeats comparison cells, but should remain a record browser; current config-driven cells hide retired runs | PARTIAL | Retain record management; show historical snapshots/archived identity, concise latest status and explicit creation-date scope |
| Comparison — เปรียบเทียบ Pipeline | Pipeline ไหนดีที่สุดโดยรวม? | Per-pipeline matrix plus paged case rows | Mixes page count with global matrix KPIs; misleading lowest-mean label; retired results absent | FAIL | One backend scope for four KPIs, individual minimum provenance, successful n≥5 timing, keep mean CER in matrix |
| Analysis — วิเคราะห์ตามประเภทข้อมูล | Pipeline ไหนดีที่สุดสำหรับงาน/ประเภทใด? | Category memberships + repeated matrix rows | Subtitle says document types while query uses content categories; duplicates comparison; 1 case alongside 0/0 hides history | FAIL | วิเคราะห์ประสิทธิภาพ; default business-document-type view, secondary content-category view; show insufficient groups without ranking |
| Dataset — Dataset Builder | ข้อมูลอะไรพร้อมนำไป train? | Confirmed source crops/labels and availability/exclusion | “พร้อมส่งออก” total includes missing-source samples; technical TSV help crowds task | PARTIAL | Distinguish eligible from available/exportable; concise preparation/exclusion workflow; retain safety warnings |
| System Logs — บันทึกการทำงาน | ระบบเกิดอะไรขึ้น? | AppLog chronological events | Raw event/UUID columns obscure human sequence; no document name/duration/context links | FAIL | Human event summary, severity icon+text+color, expandable diagnostics, existence-aware links |
| Pipeline Settings — ตั้งค่า Pipeline | ฉันกำหนด Pipeline และโมเดลที่จะทดสอบอย่างไร? | Current dynamic configs/model catalog | Gateway setup/status mixed with task controls; duplicate display names cannot identify distinct historical identities | PARTIAL | Configuration only; advanced diagnostics/catalog details secondary; never recreate retired active configs |

All six have a title and subtitle. History/Comparison/Analysis/Logs have explicit empty/error/loading states; Dataset has availability/empty states; Settings has add controls. Missing **semantic** states: retired results, shared scope/date definition, insufficient sample threshold, and available-versus-eligible Dataset total. No blank-page title needs to be invented.

History vs Comparison: saved TestCase outcome/manage/open versus canonical overall comparison. Comparison vs Analysis: overall population versus segmented suitability. History vs Logs: current outcome/snapshot versus sequence of events, including references whose case was deleted. Do not merge these pages merely because CER/time appears in both.

## B. KPI table

Implementation sources: [matrix page](../frontend/app/matrix/page.tsx), [MatrixService](../backend/app/services/matrix_service.py), [BenchmarkRepository](../backend/app/repositories/benchmark_repository.py), [metrics model](../backend/app/db/models.py).

| Card (exact current label) | Formula | Source | Scope | Sample size | Problem | Recommended fix |
|---|---|---|---|---|---|---|
| ชุดทดสอบในหน้าตารางนี้ | `cases.length`; `getHistory(limit=21,offset).slice(0,20)` | `/history`, cases having any run | Current loaded page after server filters, **before** local search/Only GT | ≤20; note counts `ground_truth_raw !== null` | Label honestly says page, but differs from other KPI scope; field-only GT omitted from note | Unique TestCases in shared scope; pagination separate |
| ผลที่ประเมินความแม่นยำแล้ว | `sum(matrix.evaluated_runs)` | Count `Metric.text_kind=final` on latest eligible successful runs for current configs | All server-filtered cases; no pagination | Count of final metric rows, not unique cases or validated confirmed GT | Config loss and no explicit confirmed/non-empty GT check | Count eligible latest evaluated results, unique evaluated cases and coverage |
| CER ต่ำที่สุด ↓ | sort non-null matrix `cer` ascending, take first | `MIN(MEAN(final Metric.cer) per current config)`; null CER omitted from means | Same matrix server scope | Winning pipeline mean's n is not on card | Not minimum individual result; no date/file/source link; one sample may win | D2 individual minimum, latest evaluation tie-break, snapshot name/retired state, provenance |
| Pipeline ที่เร็วที่สุด ↓ | min `avg_time_ms` where `successful_runs > 0`; UI `Math.round(ms)` | Arithmetic mean stored successful latest run `processing_time_ms` | Same matrix server scope | Successful n, but not shown | No ≥5 threshold; summed concurrent field time is not page wall-clock | Seconds per TestCase under documented timing, n and ≥5; no winner below threshold |

Shared current eligibility: `not archived`; old `hutch_full` excluded unless `crop_stage` is `full_image`, `global_fields` or `app_crop`; choose max `(created_at,id)` per case/pipeline. A latest failure replaces an older success. Config must be returned by `configs()` (`dynamic_mode IS NOT NULL`). Enabled=false is **not** excluded from aggregation. Final metrics are counted even when CER null; mean ignores nulls. Matrix does not check GT confirmation/completeness/non-empty normalization itself.

### Three-second test and BEFORE → proposed AFTER

| Card | What? | Whose/scope/period? | Samples? | Direction/comparator? | Verdict |
|---|---|---|---|---|---|
| Page cases | Page size stated | Page clear; period field's meaning absent | Cases counted, no total | Count, no better/worse | PARTIAL |
| Evaluated | “Results” vague vs TestCases | API-filter note, retired exclusion invisible | It is a sample count but denominator/coverage absent | Count, no quality conclusion | PARTIAL |
| Lowest CER | Labeled individual-like, actually min mean | Pipeline shown, no period/source | Missing | Down arrow helps, invalid comparison interpretation | FAIL |
| Fastest | Lowest stored mean ms | Pipeline shown, no period/input-size context | Missing and unrestricted | Down arrow helps; no n threshold | FAIL |

SOURCE = PRODUCTION API/UI; scope unfiltered/all dates; date filters would use TestCase.created_at; filters none. BEFORE: **20** page cases (GT note **9**), **7** evaluated results, **3.1%** “CER ต่ำที่สุด”, **19387 ms** fastest. These four numbers do not describe one population.

SOURCE = PRODUCTION DB READ-ONLY for case counts below; proposed display only, not implemented. Proposed AFTER format: `102 ชุดทดสอบ · ทุกช่วงเวลา · วันที่สร้างชุดทดสอบ` and separate `แสดง 20 จาก 85 รายการที่มีการรัน` if the table intentionally retains runs-only scope. Choose one explicit denominator, do not silently equate 85 History cases with 102 cases including drafts. Results: `eligible results · จาก unique evaluated cases · Coverage ...`. Coverage definition = unique cases with ≥1 confirmed, normalized-nonempty, complete latest evaluated result / unique cases in the agreed scope. Never divide by pipeline-result count. Lowest: `0% · Hutch fine tune v2 · เก็บถาวร · 3.jpg · ประเมิน 29 ก.ย. 2026 · ดูผลต้นทาง`; fastest current-only under ≥5: `ข้อมูลยังไม่พอเปรียบเทียบ · สูงสุด 2/5 ครั้ง`. Scope, sample size and date basis must accompany each card.

## C. Filter table

“Shared component” below is **not shared state**. History/Comparison/Analysis instantiate independent React `useState`; sidebar/navigation links do not propagate a shared analytics URL. No current business-type analytics parameter exists in BenchmarkFilters.

| Page | Filter | Exact UI label | Server/client | Page-local/shared | URL persistence | Backend field / date semantic |
|---|---|---|---|---|---|---|
| History/Comparison/Analysis | category | ประเภทข้อมูล | Server | Shared DatasetFilters component; independent state | History reads initial `category`; no write-back; other two no restore | TestCase.categories → Category.code |
| History/Comparison/Analysis | pipeline | Pipeline | Server | Shared component, independent state | Not restored/written | Cases having **any** PipelineRun.pipeline_id; matrix limits displayed config; case filter itself does not require successful/latest/nonarchived |
| History/Comparison/Analysis | date_from | ตั้งแต่วันที่ | Server | Shared component, independent state | Not persisted | TestCase.created_at ≥ UTC start of date |
| History/Comparison/Analysis | date_to | ถึงวันที่ | Server | Shared component, independent state | Not persisted | TestCase.created_at < UTC start of following date (inclusive calendar day) |
| History | document | กำลังกรองเอกสาร (UUID note; no input) | Server | Local page state | Initial `document` query only | TestCase.document_id |
| Comparison | document | Document ID | Server | Local page state | No restore/write-back | TestCase.document_id |
| Analysis | document | No control | API supports it; UI absent | N/A | Not restored | TestCase.document_id if API called directly |
| History | filename search | ค้นหาในรายการหน้านี้ | Client substring, locale lowercase | Current loaded 20 rows | No | Document.filename in loaded results |
| History | status | สถานะในหน้านี้ | Client | Current loaded 20 rows | No | Serialized history_status / caseState fallback |
| Comparison | filename search | ค้นหาเอกสารในหน้านี้ | Client lowercase substring | Current loaded 20 rows | No | filename; affects table only, **no KPI** |
| Comparison | onlyGT | เฉพาะชุดที่มี Ground Truth ในหน้านี้ | Client | Current page | No | `ground_truth_raw !== null`; does not test confirmed/nonempty/sub-fields; **no KPI** |
| Analysis | showUntested | แสดงประเภทที่ยังไม่ทดสอบ | Client | Local category table | No | Shows rows with category.test_cases=0; does not change top cards |
| Dataset | business type | ประเภทเอกสาร | Server | Independent | No | Query `document_type` UUID → Document.document_type_id |
| Dataset | category | ประเภทข้อมูล | Server | Independent | No | Category.code membership |
| Dataset | document | Document ID | Server | Independent | No | TestCase.document_id |
| Logs | q | ค้นหา | Server | Independent | No | AND words, each OR escaped icontains across Document.filename, config.name, pipeline ID, event, message, level, request ID |
| Logs | level | ระดับ | Server | Independent | No | AppLog.level exact |
| Logs | pipeline | Pipeline | Server | Independent | No | AppLog.pipeline_id exact; picker current configs only |
| Logs | event_type | No dedicated control now | Server/API only | Independent | No | AppLog.event_type exact; q also searches event substrings |
| Logs | request_id | Request ID | Server | Independent | No | AppLog.request_id substring, **not** gateway_request_id |
| Logs | date_from/date_to | ตั้งแต่ / ถึง | Server | Independent | No | datetime-local → browser ISO UTC; AppLog.created_at ≥ / ≤ timestamps, not TestCase date |
| Logs | test_case_id | No input, incoming link scope | Server | Independent | Reads query each load; clear does not clear incoming ID | AppLog.test_case_id |
| Pipeline Settings | configuration fields | ชื่อที่แสดง / ประเภท / Version / Weight | Forms, not analytics filters | Independent | No analytics URL | PipelineConfig/OCRModel; audit did not submit |

**ช่วงวันที่ currently filters TestCase creation date.** It does not filter run/evaluation date. No explicit “ช่วงวันที่ = วันที่สร้างชุดทดสอบ” explanation accompanies current shared controls. Changing date semantics in Stage B would move old cases recently rerun/re-evaluated into different scopes and change counts/means; do not do so silently. Card evaluation date is a separate semantic.

### Exact document-type naming

- DB `documents.document_type` String(10): technical `image`/`pdf`; frontend `Document.document_type: "image" | "pdf"`. Preserved.
- DB `documents.document_type_id` nullable FK; ORM relationship `Document.business_type`; table `document_types` (`name`, `normalized_name`, `active`, `system`). Business meaning.
- POST documents multipart `document_type_id`; PUT document/type Pydantic `DocumentTypeUpdate.document_type_id: UUID | None`; serialized fields `document_type_id`, `document_type_name`; frontend same.
- Dataset query `document_type: UUID | None` means business reference, **not** image/pdf. This is a contextual naming collision with the serialized media field, not an observed overwrite.
- `BenchmarkFilters`/frontend `QueryFilters`: category, pipeline, date_from, date_to, document; no business-type field. Stage A does not invent a new analytics parameter. Naming must be approved before Stage B extends it.

## D. Actual numeric consistency evidence

### All-data scope

Data source: **PRODUCTION DB READ-ONLY**.

Scope: latest eligible case/pipeline results, including retired identities.

Date semantic: TestCase.created_at (all dates here).

Filters: none; all dates; date filters use TestCase.created_at.

| Count | Value |
|---|---:|
| unique_test_cases | 102 |
| history_cases | 85 |
| latest_results | 226 |
| visible_matrix_results | 20 |
| evaluated_results | 115 |
| visible_evaluated_results | 7 |
| confirmed_nonempty_evaluated_results | 92 |
| unique_evaluated_cases | 52 |

CER values are ratios, not percentages. Timing is milliseconds. ?Evaluated? is stored-final-metric existence; see confirmation caveat below.

| Pipeline / identity | Retired | Tests | Success | Failed | Evaluated | Min CER | Mean CER | Max CER | Mean processing ms | Mean Gateway ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Thai FT v2 (`thai_ft_v2`) | True | 56 | 52 | 4 | 37 | 0.000000 | 4.143766 | 81.052632 | 61818.250000 | 5951.835000 |
| Mint Custom (`mint`) | True | 31 | 25 | 6 | 16 | 0.000000 | 5.740320 | 84.333333 | 14900.720000 | 6991.764800 |
| Hutch Crop (`hutch_crop`) | True | 35 | 21 | 14 | 15 | 0.004926 | 0.162531 | 1.691626 | 20943.047619 | 8244.355714 |
| Hutch Full (`hutch_full`) | True | 32 | 19 | 13 | 15 | 0.004926 | 1.088449 | 7.000000 | 23557.947368 | 8684.256316 |
| Benchmark (`benchmark`) | True | 35 | 31 | 4 | 16 | 0.000000 | 5.599747 | 82.708333 | 42707.548387 | 7342.666452 |
| Hutch fine tune v2 (`hutch_fine_tune_v2`) | True | 17 | 12 | 5 | 9 | 0.000000 | 9.083531 | 80.083333 | 10422.916667 | 1697.723333 |
| Hutch fine tune Ver1 (DETv6 - Recv5) (`dynamic_7397ed3244144d81a451c69f5134ee4c`) | False | 5 | 2 | 3 | 2 | 0.042453 | 0.054560 | 0.066667 | 19386.500000 | 1996.000000 |
| Hutch fine tune Ver2 (DETv6 - Recv5) (`dynamic_b4eeb9a192434f978b46886d1db7d1c4`) | False | 4 | 1 | 3 | 1 | 0.030660 | 0.030660 | 0.030660 | 34602.000000 | 3290.640000 |
| พี่วิช fine tune Ver1 (DETv6 - Recv6) (`dynamic_7ee31b79cccf4d68990b7b8784ae3db2`) | False | 5 | 2 | 3 | 2 | 0.044811 | 4.343834 | 8.642857 | 35010.500000 | 4925.050000 |
| พี่วิช fine tune Ver1 (DETv6 - Recv6) (`dynamic_7d04e84d44ee4a60bd719cdb44d9ef91`) | False | 6 | 2 | 4 | 2 | 0.051887 | 4.061658 | 8.071429 | 34549.500000 | 4792.040000 |
### Representative filtered scope

Data source: **PRODUCTION DB READ-ONLY**.

Scope: latest eligible case/pipeline results, including retired identities.

Date semantic: TestCase.created_at (all dates here).

Filters: category=thai_text.

| Count | Value |
|---|---:|
| unique_test_cases | 1 |
| history_cases | 1 |
| latest_results | 2 |
| visible_matrix_results | 0 |
| evaluated_results | 2 |
| visible_evaluated_results | 0 |
| confirmed_nonempty_evaluated_results | 2 |
| unique_evaluated_cases | 1 |

CER values are ratios, not percentages. Timing is milliseconds. ?Evaluated? is stored-final-metric existence; see confirmation caveat below.

| Pipeline / identity | Retired | Tests | Success | Failed | Evaluated | Min CER | Mean CER | Max CER | Mean processing ms | Mean Gateway ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hutch Crop (`hutch_crop`) | True | 1 | 1 | 0 | 1 | 0.041667 | 0.041667 | 0.041667 | 5753.000000 | 3617.830000 |
| Hutch Full (`hutch_full`) | True | 1 | 1 | 0 | 1 | 7.000000 | 7.000000 | 7.000000 | 8318.000000 | 3001.160000 |

Interpretation: `evaluated` below follows **current Matrix metric-existence semantics**, before D2 confirmation/nonempty checks. Under the collector's existing Global aggregate / confirmed legacy rules, 92 results from 52 cases qualify (52/102 = 50.98% if all cases is the denominator; 52/85 = 61.18% if runs-only). These are **not a new implemented KPI**. Completeness-policy ambiguity is recorded in M; do not promote provisional counts into product without resolving it. No arbitrary minimum GT length was used.

The production API matrix values match DB reconstruction for current configs. For every non-null CER row, min ≤ mean ≤ max holds. CER is a ratio and can exceed 1 when insertions exceed GT length; do not clamp these values or infer corruption from >100% alone. Sum of per-pipeline tests is not unique TestCases.

SOURCE = PRODUCTION API; scope one date `2026-10-05`, filters date_from=date_to; date semantic UTC TestCase.created_at. GET History returned 7 cases; all had creation dates within that UTC day. This supports the source-level date predicate; it does not validate an evaluation-date filter (none exists).

## E. Lowest CER provenance

SOURCE = PRODUCTION DB READ-ONLY; scope all dates/all historical identities; filters none; latest Matrix-eligible run per case/pipeline, successful final metric, confirmed normalized-nonempty GT under existing rules.

| Provenance | Value |
|---|---|
| cer | 0.0 |
| pipeline_id | hutch_fine_tune_v2 |
| pipeline_name | Hutch fine tune v2 |
| retired | True |
| run_id | ae46c051-8027-4521-94ef-c9281909c3cd |
| case_id | 88a3630d-c338-4f91-9060-86be48dc31dd |
| filename | 3.jpg |
| page | None |
| case_created_at | 2026-09-29T09:31:33.746647+00:00 |
| run_created_at | 2026-09-29T09:31:59.666488+00:00 |
| metric_created_at | 2026-09-29T09:33:04.472046+00:00 |
| evaluation_at | 2026-09-29T09:39:57.807707+00:00 |
| date_source | evaluation.evaluated_at |
| gt | {"mode": "per_field", "confirmed": true, "normalized_empty": false, "complete_under_existing_aggregate": true, "confirmed_fields": 2, "total_fields": 2, "all_fields_complete": true} |
| url | https://ocrtest-sandy.vercel.app/test/88a3630d-c338-4f91-9060-86be48dc31dd |

The winner's two fields are both confirmed and nonempty and cover its entire layout; it passes both existing subset aggregation and full-layout completeness. Seven eligible candidates tie at zero; newest persisted evaluation timestamp selects this result. GT text is intentionally omitted. No minimum character threshold introduced.

SOURCE = PRODUCTION API; scope current config matrix, all dates, no filters. Current card uses min pipeline **mean** = `0.030660377358490566` (3.1% displayed), Hutch fine tune Ver2 (DETv6 - Recv5), n=1. It happens to equal that one individual result, but its formula is still min(mean), and excludes the retired zero-CER result. Current card has no date/provenance capability.

Evaluation timestamps: Global whole JSON has `document_evaluation.evaluated_at`; Global field JSON has `evaluation.evaluated_at` plus field.confirmed_at. For a combined field aggregate, latest contributing persisted evaluated_at is the audit tie-break, not TestCase.created_at. Metric.created_at is creation time: updates reuse Metric and do not advance it. Thus it may predate later recalculation; legacy “last evaluation date” cannot always be reconstructed. Use explicit evaluation time where authoritative, otherwise label metric creation honestly or use documented run-date fallback when genuinely absent. Never silently substitute case creation date.

## F. Fastest Pipeline provenance

SOURCE = PRODUCTION API + separately matched PRODUCTION DB READ-ONLY; all dates, no filters; case-created date semantics if filtered.

- Current winner: **Hutch fine tune Ver1 (DETv6 - Recv5)**, `dynamic_7397ed3244144d81a451c69f5134ee4c`.
- Mean processing **19386.5 ms = 19.3865 s / TestCase**; **2 successful**, 5 latest tests, 3 failures, 2 evaluated; mean 8 fields per successful case. Gateway mean **1996 ms** is separate.
- Does **not** meet ≥5 successful threshold. No current config reaches 5 (maximum 2). Present code allows a one-success pipeline to win.
- If historical identities are included under locked D5, `hutch_fine_tune_v2` is the threshold-qualified fastest: **10422.9167 ms**, n=12 successful of 17 tests, 9 metric-bearing; mean 6.1667 fields; gateway mean 1697.7233 ms. Historical input-size/model/config populations differ; do not imply equal workload.

Timing proof: [GlobalLayoutService.run](../backend/app/services/global_layout_service.py) sets parent.processing_time_ms to **sum(field.diagnostics.processing_time_ms or 0)**. SOURCE = PRODUCTION DB READ-ONLY: all **160/160** stored global-fields parents match this sum. Fields run concurrently in groups of up to eight, so sum is **not elapsed page wall-clock time** and may count overlapping waits. Adapters use perf_counter around their work; this includes app-side processing/HTTP wait. Parent gateway_duration_ms separately sums available upstream field durations, null if none. [BatchGateway](../backend/app/integrations/batch_gateway.py) apportions summed combined-request upstream duration equally among caller entries; that allocation is not individually measured inference duration. Preserve this distinction in labels/docs; no timing behavior changed.

## G. Historical pipeline continuity report

SOURCE = PRODUCTION DB READ-ONLY; all stored runs, no filters: **253 stored**, **0 archived**, **233** belong to identities absent from current config list. These are historical rows, not all latest eligible observations. Deduplicating latest eligible leaves **226**, of which **206** are omitted from visible Matrix; visible count **20**. Final metric counts: **115 historical-inclusive vs 7 visible**. This is a visibility defect, not evidence that rows were deleted.

- `seed_database` deletes PipelineConfig where ORM execution_mode is null (physical DB `dynamic_mode`). It does not delete runs.
- `BenchmarkRepository.configs()/config()` only accept non-null execution_mode; enable flag does not determine retired history.
- PipelineRun stores independent pipeline_id and pipeline_name snapshots (no config FK). Snapshot name survives.
- History API serializes stored runs, but History **table** renders `pipelines.map(current configs)`, hiding retired result cells; row itself and status can survive. Picker cannot choose retired IDs, though direct API pipeline filter can.
- Comparison table also uses current configs; MatrixService loops configs; category Analysis reuses MatrixService. All omit retired identities.
- Saved Global test view constructs latest runs from `saved.runs`, so reading saved predictions is not inherently dependent on live config; rerunning requires a current config. Legacy detail retains saved results. Do not equate missing History cells with erased data.
- Recommendation only: derive historical reporting identities from actual runs/snapshots, label `เก็บถาวร`, preserve distinct pipeline IDs even when display names collide. Do not create fake active configs or mutate historical run snapshots.

## H. GT normalization definition

Read actual [metrics_service.py](../backend/app/services/metrics_service.py): `normalize_text(text)` performs `unicodedata.normalize("NFC", text)`, replaces CRLF and lone CR with LF, collapses Python regex `\s+` to a single ASCII space, then `.strip()`.

- NFC, **not NFKC**. No transliteration, spelling correction, Thai mark removal, punctuation deletion, digit conversion or case folding.
- LF/newline/tab and other Python Unicode whitespace become ordinary spaces; line structure is not retained in the normalized metric string. Repeated spaces collapse and outer whitespace is removed.
- Thai characters/combining marks are preserved subject only to standard NFC canonical composition. CER uses Python Unicode code points, not grapheme clusters.
- Punctuation remains; WER uses `text.split()` after normalization, hence whitespace tokens rather than Thai linguistic segmentation.
- Normalized GT is empty exactly when this function returns `""`; empty/whitespace-only inputs qualify as empty. A non-whitespace zero-width character is not automatically removed by this function. A single valid character/digit is not excluded.
- CER = unit-cost Levenshtein / normalized GT code-point count; WER = token edit distance / GT token count. Empty reference + nonempty prediction gives null rate; both empty gives 0. Exact Match compares normalized strings. D2 must exclude normalized-empty GT even when an existing both-empty metric equals zero.
- Global field_summary aggregates edit totals / GT unit totals, not average field percentages. It includes confirmed fields with evaluation snapshots and currently accepts a nonempty subset. Whole mode requires successful predictions for all Global Fields. UI's current `require_complete_gt=true` adds complete Whole/Sub synchronization; the API default remains false. These differing paths are documented, not silently unified.
- Legacy `_set_ground_truth` computes metrics even before confirmed=true; final Metric existence alone is not confirmation. This explains why current Matrix count and D2-confirmed population differ.

## I. Analysis page diagnosis

SOURCE = PRODUCTION API; all dates, no filters; date semantic TestCase.created_at. Observed **14 / 1 / 0 / 1** means: `data.length` categories returned; count categories with test_cases>0; count categories with any current-config evaluated_runs>0; sum category.test_cases (memberships, not unique cases). The hide-untested checkbox affects table only, not these cards.

SOURCE = PRODUCTION DB READ-ONLY; filter category=thai_text, all dates. Case `c6b069d9-4315-466f-879d-355b19fd6309`, `sample-document.png`, has two latest eligible successful metric-bearing results:

- Hutch Crop run `e678a770-2c61-4a1f-9ea6-7188298fbad9`, CER 0.0416666667.
- Hutch Full run `de2abe1f-051e-4cf7-8e3d-2502bedf2703`, CER 7.0.

Both configs are retired. Therefore **B (retired visibility)** explains zero shown results for this observed case; **A (semantic UX design)** adds confusion because category membership and current-config result counts are different populations. **C (genuinely no eligible/evaluated results)** is false for this case. Untested current dynamic configs genuinely have no results in this category, but that does not justify presenting the historical category as unevaluated. Combined diagnosis **D = A+B**, not a guessed missing-GT explanation.

Stage B recommendation only: title `วิเคราะห์ประสิทธิภาพ`; subtitle `ดูว่า Pipeline ใดเหมาะกับเอกสารหรือข้อมูลแต่ละประเภท`; default `ตามประเภทเอกสาร`, secondary `ตามประเภทข้อมูล`. Business type and content category must remain separate. Show unique analyzed cases/denominator, eligible result count/distinct pipeline count, groups with enough data, selected group's best mean CER with n. Ranking requires ≥5 unique eligible cases in a group; raw counts can remain visible without winner/rank. Distinguish unique TestCase from source Document: PDF pages/multiple cases must not be silently deduplicated as one document. Exact denominator needs the approval recorded in M.

## J. Log specification

Current source: [AppLog model](../backend/app/db/models.py), [LogService](../backend/app/services/log_service.py), [GET logs](../backend/app/api/routes/activity.py), [Logs UI](../frontend/app/logs/page.tsx). Events are allowlisted human messages. Metadata currently only safe error_code, count and run processing duration; identifiers reject configured secrets and use an ASCII allowlist. No authenticated actor exists; do not invent actor/user.

| Field | Required / optional | Why | Current → recommended display | Privacy/security |
|---|---|---|---|---|
| created_at / timestamp | Required | Event ordering/incident timeline | Localized time → retain zone/context | No private payload |
| level | Required | Severity/triage | Text+color → add icon and readable Thai label | Do not infer severity from private text |
| event_type | Required | Stable audit classification | Raw main column → expandable technical detail | Allowlist |
| message | Required | Human action summary | Currently late column → primary row | Template only; no OCR/GT |
| outcome/status | Required where applicable | Started/succeeded/failed distinction | Encoded in event_type → derive readable state, no schema needed | Avoid raw exception text |
| pipeline_id / name | Required for pipeline events; nullable otherwise | Correlate config/run | Raw ID → display name + retained ID in details | Use safe server join/snapshot fallback; never merge same-name IDs |
| test_case_id | Required for case events; nullable otherwise | Outcome provenance/link | Returned but not linked → validated Test/History link | Check existence; no blind broken URL |
| document_id / filename | Required for document events | Find affected source | ID returned; filename join only used in search → name + details ID | Filenames may identify people; authorized UI only, no content |
| page_number | Required when applicable | PDF context | Page or dash → retain | No fabricated page when null |
| duration_ms | Required for timed completion when measured | Latency root cause | metadata duration mostly hidden → seconds with timing definition | Do not confuse parent summed work with wall time/Gateway time |
| error_code | Required for known failures | Cause grouping | metadata text → concise code/details | Allowlist, never raw credentials/upstream body |
| request_id | Optional | App request correlation | Main column/copy → details | Validate before storage |
| gateway_request_id | Optional | Upstream trace | Secondary text → details | Never Authorization/header dump |
| model/version | Optional when verified | Explain model/runtime differences | Not guaranteed in AppLog → existing run trace link first | Preserve stale raw metadata caveat; no arbitrary duplication |
| count | Optional | Batch size/affected units | metadata hidden → show when useful | Aggregate only |
| technical metadata | Optional, allowlisted | Root cause/anomaly audit | Expandable | No arbitrary payload, OCR/GT, API key, DB URL, image bytes |

History is an outcome/snapshot; Logs are event sequence. History already links to `/logs?test_case_id=...`; Logs has no reverse link. SOURCE = PRODUCTION DB READ-ONLY; all logs, no filters: **788 log rows reference deleted/missing cases**. Add existence-aware rendering `ไม่พบรายการ (ถูกลบแล้ว)` rather than blindly linking. Log references deliberately have no cascading FK. Deleted/retired config names cannot be recovered from AppLog alone; prefer a surviving run snapshot when unambiguous, otherwise show ID/archived state honestly.

Retain partial server search; current joined search can find active display names and filenames, but retired display names absent from configs are not searched via run snapshots. Required Stage B enrichment must not mutate logs or add unneeded persistence.

Retention **recommendation only**: 90 days operational logs, with documented incident/export needs and separate historical-result retention. No deletion/job created. Follow-on uses: Errors today KPI; failure-rate/latency alerts; frequent cause analysis; KPI provenance cross-checks; incident report/export. Those are not implemented in Stage A.

## K. Example human-readable Log rows

Illustrative templates, **not production evidence**; synthetic filenames/counts/durations:

1. อัปโหลดเอกสารแล้ว · sample_01.png
2. เลือกหน้า PDF · sample.pdf · หน้า 2
3. ค้นหา ROI สำเร็จ · sample_01.png · 8 กรอบ
4. เริ่ม OCR · Example Pipeline · sample_01.png · หน้า 1
5. OCR สำเร็จ · Example Pipeline · sample_01.png · 1.8 วินาที (เวลารวม Field)
6. OCR ไม่สำเร็จ · Example Pipeline · sample_02.png · หน้า 1 · ดูรายละเอียดข้อผิดพลาด
7. แก้ไข Ground Truth แล้ว · sample_01.png · ไม่แสดงข้อความ GT
8. ลบประวัติการทดสอบแล้ว · ไม่พบรายการ (ถูกลบแล้ว) · เก็บเอกสารต้นฉบับไว้

Expand event type, pipeline/case/document IDs, safe request IDs, error code and metadata only when needed.

## L. BEFORE screenshot paths

SOURCE = PRODUCTION UI / API, direct public production frontend, read-only browser with all mutating HTTP methods blocked. Desktop 1440×1050; mobile 390×1050; full-page capture. Evidence contains real UI data and remains ignored/local, not committed.

- `.runtime/audit-before/history-1440.png`
- `.runtime/audit-before/comparison-1440.png`
- `.runtime/audit-before/analysis-1440.png`
- `.runtime/audit-before/dataset-1440.png`
- `.runtime/audit-before/logs-1440.png`
- `.runtime/audit-before/pipeline-settings-1440.png`
- `.runtime/audit-before/comparison-390.png`
- `.runtime/audit-before/analysis-390.png`

Manifest: `.runtime/audit-before/manifest.json`. No AFTER screenshots: implementation has not been authorized. Mobile preserves stacked controls and horizontally scrollable tables; density remains a usability issue, not proof of missing data.

## M. Unresolved discrepancies / blockers

**Stage B blocked pending explicit approval.** No product fix has been made.

1. Confirmed P0 data visibility: missing configs hide 206 latest eligible historical results from matrix and History result cells. Cause/counts proven; no production correction authorized or performed.
2. Confirmed KPI scope mismatch: page-size count vs matrix population; current minimum is minimum mean; current fastest has only two successful observations. Exact current numbers are explained above.
3. **Completeness ambiguity requiring one grouped decision before implementation:** UI enforces full Whole/Sub synchronization (`require_complete_gt=true`); API default and historical aggregate accept confirmed nonempty subsets. This flag is not persisted as evaluation provenance. Preserve historically valid subset evaluations or retrospectively require full layout for analytics? Do not assume either. Current lowest winner passes both, but eligible counts/coverage may differ.
4. **Scope denominator decision:** 102 TestCases including drafts versus 85 with any run. Locked coverage formula must use one agreed scope across numerator, denominator and cards. Recommendation: 102 in the unfiltered all-case scope; identify runs-only History table pagination separately. For segmented thresholds recommend unique TestCase (page/case), label ชุดทดสอบ; source Document deduplication would answer a different question.
5. **Naming collision before Stage B:** dataset query `document_type` is business UUID while document payload `document_type` means image/pdf. No overwrite found. Analytics currently has no business-type filter. Agree a separate safe analytics name aligned with existing `document_type_id`; Stage A introduced no new API parameter.
6. **Historical timestamps:** Metric.created_at is initial evaluation creation, not guaranteed most recent recalculation. Global JSON timestamps available; legacy final-update date may be NOT AVAILABLE. Do not fabricate evaluation dates or alter records. Tie-break for field aggregate in this audit uses newest contributing evaluated_at; approve this explicit interpretation before implementing.
7. **Dataset wording:** observed “พร้อมส่งออก” counts eligibility, while captured rows report missing originals and cannot export. This is a label/source-availability mismatch, not permission to recreate missing images. Full missing-source count was NOT MEASURED; no export or filesystem repair performed.
8. Duplicate current pipeline display names identify distinct IDs; no assumption they are the same pipeline/model. Preserve identities and provenance.
9. Production is not frozen; DB snapshot and later API/screenshots may differ if other users act. Current API/DB matrix matched at capture. Source commit equality for running production was not independently attested via platform dashboard; observed UI/API behavior matches inspected code. No deployment performed.
10. Local ignored runtime artifacts retained. Only new audit document is intended source-tree output; two old untracked pager/diff artifacts remain. No application source modified, no 0011, no full test rerun required for this audit-only output.

**A–M completeness check completed.** Each deliverable exists; limits and unavailable information are explicitly recorded. Stop here; no P0/P1/P2 or Stage B changes until user approval.
