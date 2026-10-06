# Stage B analytics and UX validation

This is the pre-release acceptance record for the approved Stage B scope. The
original starting commit was `5b584c8430b7fe4dc329c9d8e16d1ff6b2b2a7c8`.
The user approved resuming on `c3bbbe34df12ba678fc3e4418d5f2945dc813603`;
its batch-response splitting and GT behavior are retained. Production deployment
verification is a separate post-push step, not implied by this local record.

## Numeric evidence

Production was queried in a read-only, repeatable-read transaction on
2026-10-05 22:08 UTC. Alembic revision: `0010_dynamic_pipelines`.
No records were created, edited, evaluated, deleted, or migrated.

| Measure | Result |
|---|---:|
| Stage A historical baseline, latest eligible case/pipeline pairs | 226 |
| Current independently counted raw eligible pairs N | 270 |
| Stage B Matrix sum M / summary latest results | 270 |
| N − M | 0 |
| Unique TestCases, including drafts | 115 |
| TestCases with stored runs | 99 |
| Eligible evaluated Pipeline Results | 108 |
| Unique evaluated TestCases | 56 |
| Coverage, 56 / 115 | 48.7% |

The baseline is not a hardcoded target. Production grew from 102 to 115 cases
and from 253 to 305 stored runs; the latest eligible pair count grew by 44.
Stored runs, latest pairs, and evaluated results are different measures.
Per-pipeline assertions verified min CER ≤ mean CER ≤ max CER and that evaluated
counts sum to 108. Private detailed evidence remains in `.runtime/`.

Lowest final run-level CER is **0.0%**, from historical **Hutch fine tune v2**
(`hutch_fine_tune_v2`, archived identity), image `3.jpg`, no PDF page.
TestCase: `88a3630d-c338-4f91-9060-86be48dc31dd`.
PipelineRun: `ae46c051-8027-4521-94ef-c9281909c3cd`.
Evaluation timestamp: `2026-09-29T09:39:57.807707+00:00`.
There are **six other tied results**. The source link is
`/test/88a3630d-c338-4f91-9060-86be48dc31dd`.
Eligibility uses confirmed normalized nonempty GT and the existing final Metric;
it never selects an individual minimum Field CER or a minimum pipeline mean.

Fastest qualifying pipeline is historical **Hutch fine tune v2**:
**10.4 seconds per case**, mean `processing_time_ms=10422.9167`,
**12 successful measured latest runs**, threshold **≥5**. Global parent timing
is the existing sum of Field durations, not wall-clock page latency. No OCR
execution or timing instrumentation was changed.

## Requirement coverage before deployment

| Request | Problem found | Implementation / fix | Evidence | Status |
|---|---|---|---|---|
| Tab purpose and overlap | Analysis resembled a second Matrix; Logs exposed technical rows | Business-type Analysis with content dimension; five explicit titles/subtitles; Dataset training purpose | Desktop five-page and 390px Comparison/Analysis visual review | PASS |
| Numeric consistency | Config-only aggregation dropped historical identities; page count looked global | Latest eligible case/pipeline pairs including failures; server summary; distinct case counts, coverage, min/mean/max | Production N=270, M=270, difference=0; backend analytics tests | PASS |
| Lowest CER provenance | Lowest pipeline mean could be mistaken for an individual run | Final eligible Metric, newest evaluation tie-break, real run/case/file/date/source link, archived label | Source provenance above; empty/whitespace/one-character/subset GT and fallback tests | PASS |
| Fastest fairness | A single success could win | Mean existing processing time; ≥5 measured successful latest runs; seconds and n; explicit insufficient state | Production n=12 winner; backend threshold tests; desktop/mobile cards | PASS |
| Logs: what and why | IDs and event codes dominated rows | Human message, outcome, document/pipeline name, severity icon/color/text, seconds; technical details expandable | Logs API tests and synthetic screenshot; no write-path/logging changes | PASS |
| Logs: use | Historical names and deleted-case links were weak | Partial token search, independent filters, Test/History links, deleted-reference fallback | Search/deletion backend tests and Playwright; 90-day recommendation and future alert/export uses documented only | PASS |
| Shared versus local filters | Scope was lost on navigation and business type was absent | URL scope for document_type_id/category/pipeline/date_from/date_to; TestCase.created_at UTC labels; local controls explicitly local | Playwright navigation across all three pages; backend business/date/tag scope tests | PASS |
| Historical continuity | Removed configs hid legitimate runs | PipelineRun snapshot identities and consistent เก็บถาวร labels; no fake executable config | Raw pair equality, retired options and History/Comparison/Analysis assertions | PASS |

## Validation and regression guard

- Backend: **35 affected/regression tests passed**, including analytics, Logs,
  dynamic pipelines, upstream batch splitting, GT evaluation and PostgreSQL
  additive migration preservation/drift validation.
- Ruff on changed backend source/tests: passed.
- Frontend typecheck, ESLint and production build: passed; Docker standalone
  output retained. No Vercel/Railway config or environment changes.
- Playwright: **26/26 passed**, covering console routes/errors/empty states,
  six new Stage B assertions, dynamic settings, Global comparison/selection and
  GT synchronization. Console fixtures now use unique dynamic pipeline names
  and explicitly select their result tab; assertions were not weakened.
- Local PostgreSQL upgrade to `0010_dynamic_pipelines` and `alembic check`:
  passed, no schema drift. No `0011` migration.
- OCR Test, Pipeline Settings, GlobalWorkspace, DocumentViewer, OCR adapters,
  model registry, GT synchronization, metric calculation/normalization,
  Dataset label/export logic and authentication remain unchanged.
- React review: derived values remain derived, async effects ignore obsolete
  responses, stable URL snapshots use `useSyncExternalStore`, private keys
  remain server-only, and business/archived identities are not executable configs.

Five-second review: History opens saved work, Comparison compares accuracy/time,
Analysis examines document/content groups, Dataset builds training pairs,
Logs explains operational events. **PASS for all five desktop pages**, and
**PASS for Comparison/Analysis at 390px**. Tables scroll within their containers;
the page has no horizontal overflow. This is an engineering visual review,
not a claim of participant-based usability research.

BEFORE evidence: `.runtime/audit-before/` (private Production captures).
AFTER local evidence: `.runtime/audit-after/local-{history,comparison,analysis,dataset,logs}-1440.png`
and `local-{comparison,analysis}-390.png` (synthetic data).
Screenshots and runtime helpers are ignored and excluded from Git.

Known limits: legacy records may lack explicit evaluation timestamps (Metric
creation then labeled run-time fallback is used); missing original files still
require restoration; there is no actor identity; 90-day retention is a
recommendation, not an implemented deletion job. Group ranking intentionally
stays unavailable below five eligible evaluated cases per pipeline.
