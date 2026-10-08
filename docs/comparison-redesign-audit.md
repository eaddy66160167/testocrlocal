# Comparison redesign audit

SOURCE = PRODUCTION API / PRODUCTION DB READ-ONLY

Alembic verified: `0010_dynamic_pipelines`. No production mutation.

Latest eligible N=269; Matrix M=269; difference=0. Scope: 114 TestCases / 96 distinct Documents.

Active means enabled executable PipelineConfig; archived/disabled identities are descriptive only.

| Active Pipeline | ID |
|---|---|
| Hutch fine tune Ver1 (DETv6 - Recv5) | `dynamic_7397ed3244144d81a451c69f5134ee4c` |
| Hutch fine tune Ver2 (DETv6 - Recv5) | `dynamic_b4eeb9a192434f978b46886d1db7d1c4` |
| พี่วิช fine tune Ver1 (DETv6 - Recv6) | `dynamic_7ee31b79cccf4d68990b7b8784ae3db2` |
| พี่วิช fine tune Ver2 (DETv6 - Recv6) | `dynamic_7d04e84d44ee4a60bd719cdb44d9ef91` |

| Pair | Cases | Documents | dCER pp | 95% CI pp | W/T/L | Verdict |
|---|---:|---:|---:|---|---|---|
| Hutch fine tune Ver1 (DETv6 - Recv5) / พี่วิช fine tune Ver2 (DETv6 - Recv6) | 5 | 5 | 111.02775649289185 | [-0.5531826663902137, 311.1156685808039] | 2/1/2 | inconclusive |
| Hutch fine tune Ver1 (DETv6 - Recv5) / พี่วิช fine tune Ver1 (DETv6 - Recv6) | 5 | 5 | 108.10500410172274 | [-1.18129614438064, 308.1521739130435] | 2/1/2 | inconclusive |
| Hutch fine tune Ver1 (DETv6 - Recv5) / Hutch fine tune Ver2 (DETv6 - Recv5) | 5 | 5 | -20.50304248663557 | [-60.6337161607875, 0.670631665299426] | 2/0/3 | inconclusive |
| พี่วิช fine tune Ver2 (DETv6 - Recv6) / พี่วิช fine tune Ver1 (DETv6 - Recv6) | 6 | 6 | -11.959436516450447 | [-31.081432248705603, -0.07052934760071745] | 3/1/2 | clear |
| พี่วิช fine tune Ver2 (DETv6 - Recv6) / Hutch fine tune Ver2 (DETv6 - Recv5) | 5 | 5 | -131.53079897952742 | [-371.7493847415914, 1.177532475727718] | 2/0/3 | inconclusive |
| พี่วิช fine tune Ver1 (DETv6 - Recv6) / Hutch fine tune Ver2 (DETv6 - Recv5) | 5 | 5 | -128.6080465883583 | [-368.9130434782609, 1.8923635839140354] | 2/0/3 | inconclusive |

Ranking scores: [('พี่วิช fine tune Ver2 (DETv6 - Recv6)', 1), ('Hutch fine tune Ver1 (DETv6 - Recv5)', 0), ('Hutch fine tune Ver2 (DETv6 - Recv5)', 0), ('พี่วิช fine tune Ver1 (DETv6 - Recv6)', -1)].
Current recommendation: None: score/clear-win/no-loss rules do not all pass.
Featured pair: Hutch fine tune Ver1 (DETv6 - Recv5) / พี่วิช fine tune Ver2 (DETv6 - Recv6).
Readiness X/Y/D=5/114/5; reasons={'missing_gt': 59, 'not_run': 50, 'failed': 0, 'other': 0}.
All-active common cohort: 5 cases / 5 Documents.

| Business type | Documents | Archived |
|---|---:|---|
| ไม่ระบุประเภท | 96 | False |

By-type sum 96 == all Documents 96.
No current recommendation is based on archived identities. Document-level unweighted means, tie boundary 0.05 pp, minimum 5 Documents, 2000 fixed-seed bootstrap resamples.

Per-type verdicts, action counts and endpoint performance will be reconciled using the implemented engine before release. No source filenames, OCR text, GT or credentials are included here.

## Implemented engine reconciliation

SOURCE = PRODUCTION DB READ-ONLY

Independent pre-code audit and implemented pair cohorts/verdicts/winners/readiness agree. Archived display does not change ranking, featured pair, readiness or recommendation. Repeated pairs/CI deterministic.

Computation measured: [(False, 1853), (True, 1275), (False, 1216)] ms (includes secure production DB preload). No database access inside bootstrap. No dependency changes.

By-type eligible Documents: [('ไม่ระบุประเภท', 53)]. Unassigned row retained. Referenced archived-type Documents: 0.

Recommended-not-lowest descriptive mean rows: 0. No per-type current winner in this audit.
Real actions: missing GT 59; missing runs counts [2, 7, 6, 5]; failed counts [13, 9, 9, 10]; short types []. TestCase links/filenames retained in private runtime evidence only.

## Release validation and coverage

SOURCE = LOCAL SYNTHETIC TESTS / PRODUCTION DB READ-ONLY

Backend: 59 relevant tests passed, including PostgreSQL persistence, dynamic pipelines, batch/GT, dataset management, analytics scope and 24 decision tests. Ruff on changed backend files passed. TypeScript, ESLint and production build passed. Local Alembic upgrade/check passed at `0010_dynamic_pipelines`; no migration or dependency/environment change.

Desktop and 390px UX: first review found mobile filters displaced the answer; one fix pass collapsed unused filters and clarified next action/type-column width. Second review passed: recommendation/no-winner, uncertainty, next step and by-type entry are readable. Horizontal evidence tables scroll within their container. OCR Test, Pipeline Settings and global viewer source remain unchanged.

| Requirement | Problem | Fix | Evidence | Status |
|---|---|---|---|---|
| Merge Comparison/Analysis | Separate destinations | `/matrix` overall/by-type, legacy redirect, one nav | Playwright desktop/mobile/redirect scope | PASS |
| Matched evidence | Unequal cohorts mislead | Latest eligible intersection, document mean differences | Independent production audit + pair unit tests | PASS |
| PDF unit | Pages inflate certainty | Resample distinct Documents, 2000 fixed-seed draws | PDF replication and deterministic tests | PASS |
| Decision threshold | Forced winner | 5-document minimum, CI zero rule, unique score/no loss/runner win | Boundary and recommendation tests | PASS |
| Archive invariance | Historical results affect current decision | Active-only ranking/readiness/recommendation | Include-archive invariants + production reconciliation | PASS |
| Readiness | Coverage reasons overlap | GT/not-run/failed/other precedence | Sum and exclusivity tests | PASS |
| Scatter | False Pareto on unequal input | Common all-active cohort >=5; otherwise warning/no frontier | Scatter fixtures and production cohort | PASS |
| Type matrix | Cells imply winner | Descriptive CER+n, separate paired verdict; all/unassigned/archived types | ORM/API fixtures and group totals | PASS |
| Actions | Generic advice | Real missing GT/runs/failures/short types/spread/hard cases | Tests and read-only production counts | PASS |
| Existing eligibility | Analytics continuity | Reuse MatrixService eligibility/evaluation | N=M=269, difference=0 | PASS |
| Protected flows | Accidental regression | No OCR/settings/viewer/batch/GT/dataset edits | Protected-file gate + regression suites | PASS |
| Safety | Release mutates production data | GET/SELECT only; no migration/env/dependency | Read-only schema gate; secret scan | PASS |

Historical test suites with legacy fixed pipeline IDs are not represented as current configuration tests. No meaningful tests were deleted. Production endpoint/deployment verification follows this local gate; this document records pre-release evidence, not deployment success.
Playwright: 32/32 relevant decision, navigation, mobile, dynamic settings, global OCR/GT/viewer regression tests passed after updating the filter-opening assertion. No meaningful regression assertions removed. Final diff check and literal private-secret scan passed; `.env` and runtime evidence remain ignored/untracked.
