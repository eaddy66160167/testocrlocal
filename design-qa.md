# OCR Pipeline Comparison — design QA

Date: 2026-10-07

## Target and evidence

- Target: the user-supplied `ChatGPT Image Oct 7, 2026, 10_53_15 AM.jpg`.
- Implementation: existing `/matrix`, rendered by Next.js in local Edge/Playwright.
- Captures: `.runtime/comparison-redesign/dashboard-{1440,1024,768,390}.png`.
- Combined reference/implementation inspection: `.runtime/comparison-redesign/reference-comparison.png`.
- Full-resolution mobile inspection: `.runtime/comparison-redesign/mobile-top.png`.
- Screenshots use explicitly synthetic **test fixtures**, not production records. The application itself has no demo registry or hardcoded benchmark values.
- The reference is a desktop content panel. The implementation retains the existing app shell; the combined image removes the shell and normalizes content widths for comparison. There is no supplied mobile reference, so mobile was checked against the written requirements.

## Findings, fixes and final inspection

1. **P1, empty state:** null detail and null selection could enter the detail comparison path. Fixed with explicit non-null guards. Empty/no-winner tests pass.
2. **P1, identity:** ranking rows could show saved analytics names while the hero showed current configuration names. Display-only reconciliation now uses `/api/pipelines` throughout, without changing engine membership, scores or verdicts.
3. **P2, result density:** reusing the full per-line explanation in every result card added excessive repeated text. Result cards now render existing backend spans directly; the full existing per-line renderer remains in the Per-line view.
4. **P2, view tabs:** compact view tabs wrapped into unnecessarily small labels. Increased their minimum width and padding; final desktop/mobile captures show readable controls.
5. Added source-API thumbnails and explicit selected-pipeline column labels to disagreement examples. Missing images show an unavailable state rather than replacement imagery.

Final captures were inspected after these fixes. No unresolved P0/P1/P2 visual or interaction finding remains within the requested scope.

## Fidelity surfaces

- **Typography:** existing Thai/system font stack retained; navy headings, large hero values, smaller secondary explanations. Dynamic names wrap in cards/table; full configured names remain available in native selectors and result headings.
- **Spacing/layout:** full-width hero with evidence on the right, approximately 72/28 ranking/type grid, four result columns, approximately 62/38 bottom grid, collapsed advanced details. At 390px, hero metrics use 2×2, ranking rows become cards, and result columns stack.
- **Colors/tokens:** cool app background, white surfaces, light slate borders, restrained blue actions, amber recommendation, green evidence/equal spans, red substitution, rose insertion and amber deletion. Styles are scoped to Comparison.
- **Images:** production image URLs and canonical crop URLs, including PDF page numbers. No stock/reference document images are inserted into application data. Fixtures route synthetic source images only inside tests.
- **Copy/content:** names/configurations from Pipeline Settings; recommendations and paired evidence from the unchanged backend; latency is explicitly **average**, never a fabricated median/P95. Reliability is successful/attempted. CER can exceed 100%.

Expected departures from the illustrative reference: existing navigation/view tabs are retained; names, values, pipeline/type counts and document contents follow actual APIs. No made-up Fast/Stable badge thresholds or unverified winner labels were introduced.

## Validation

- Frontend typecheck, ESLint and production build: pass.
- Relevant Playwright suites after upstream integration: **51 passed** (Comparison dashboard, analytics/scope, dynamic/Official Settings, global comparison, GT sync, preview/selection, error lines, and History/Dataset bulk workflows).
- Final viewport capture checks: **4 passed**, at 1440/1024/768/390px; no horizontal page overflow.
- Backend focused regression suites: **84 passed, 1 skipped** (PostgreSQL unavailable); backend code unchanged relative to the integration base.
- Full backend suite: **217 passed, 51 failed, 5 skipped**. An isolated `origin/main` checkout reproduced exactly the same 51 failing test names. These include legacy built-in pipeline/log persistence expectations; they were not removed or weakened to hide upstream baseline failures.
- Ruff: **11 existing import-order errors** in unchanged backend files. No backend cleanup was mixed into this frontend integration.
- Private credential scan and `git diff --check`: pass; `.env` ignored/untracked.

## Operational scope

- No push, deployment, production migration, live OCR request or production-data mutation was performed.
- Side-by-side/disagreement examples are explicitly scoped to the current history page, with navigation to the next page. Full-scope action links remain available separately. Field comparisons require the same confirmed global field; unrelated detected fields are never paired by array position.
- Historical whole-document results without stored spans remain readable, with no invented alignment. They display saved metrics and plain OCR text.
- Native backend integration was not rerun against PostgreSQL in this UI task; Docker Desktop was unavailable. Browser acceptance used mocked API contracts and the existing pytest test harness.

## Safe upstream integration

- Base: `a4272660645534de8cecfb7e6946870db7f9ebdc`, fetched from `origin/main`.
- Backup: `backup/ocr-comparison-before-sync`, preserving `1526ede` and safety commit `bf9afcd`.
- Integration: `feature/ocr-comparison-redesign-sync`; both redesign commits cherry-picked without textual conflicts.
- Official Paddle display was adapted to current `det_version`, `rec_version`, weights and `paddle_model_defaults`. Settings and Comparison share one read-only display utility; upstream form/routing behavior remains intact.
- Removed the redesign's old inferred Official DET V6 / REC V5 defaults. No configuration is parsed from a display name.
- Backend, shared types, preview/order helpers, migrations, environment and deployment files are identical to upstream. DET/REC pairs are not sorted independently in Comparison.
- A fresh detail response that invalidates confirmed GT now overrides stale history eligibility. A regression test prevents showing outdated paired labels.
- Examples remain view models of canonical API records; no frontend alignment engine or new payload persistence was added.
- No hardcoded reference metrics or production demo records were found. Test fixtures remain explicitly synthetic.

Review status: **SAFE TO REVIEW** with the disclosed upstream test/lint debt. Not declared safe to merge. PostgreSQL-native E2E remains unverified because the Docker daemon is unavailable. Non-blocking framework warnings include test-client deprecations and Next Image aspect-ratio warnings in fixture captures.

## Final metric-scope polish

The layout, CSS, model configuration, ordering, API contracts and decision engine were retained. No attempt was made to make unrelated statistical scopes numerically equal.

| Surface | Visible metric | Exact scope and API source |
| --- | --- | --- |
| Recommendation Hero | Paired CER | `/api/analytics/comparison`: `overall.featured_pair.mean_cer_a/b` for the displayed leader; only records with eligible evaluations for both members of the featured pair. Average case CER within each source Document, then average Documents. PDF pages share one Document. |
| Hero paired explanation | Paired CER A/B, A − B pp | The same featured pair's means and `mean_dcer_pp`, with both current configuration names and matched Document count. |
| All Pipelines | Overall CER | Comparison `overall.cells[].cer`: each pipeline's own eligible records in the filters, averaged within source Document then across Documents. These documents need not match the featured pair. Ranking still comes from the paired engine. |
| Best by Document Type | Type paired CER | `by_type[].decision.featured_pair.mean_cer_a/b` for that type's recommended pipeline only. No recommendation means no inferred winner/CER. The API's virtual `all` group refers to all types. |
| By-type expanded table | Type overall CER | `by_type[].decision.cells[].cer`: descriptive Document mean for each pipeline within the group, not the winner's paired cohort. |
| Compare Results | This field CER / This document CER | Detail/history records via `comparisonExamples`: `OCRField.evaluation.cer` for the same confirmed global field; otherwise `document_evaluation.cer`, with historical `run.metrics.cer` fallback. Applies to this selected example, not the aggregate pipeline. A PDF whole-document example is the saved test on the selected page, not an aggregate across the PDF. |
| Disagreement Examples | Example CER; absolute difference pp | Those same example-local A/B CER values from the current History page. Hover context distinguishes field/document. The full-scope action list remains separate and can involve another pair; its spread comes from `actions.largest_spread[].spread` across active eligible pipeline results on a saved test. |
| Error Analysis | Character diff / error character counts | Current example's Pipeline B `FieldComparison.spans`; counts are code points of substitution/insertion text or deletion missing text, not counts of grouped spans. No new alignment algorithm. |
| Advanced paired tables | Paired CER A/B | Each pair's own means; historical pairs remain separate from active recommendation. |
| Advanced scatter | CER with common/own context | `scatter.points[].cer`: common eligible records across all active pipelines if backend common-document threshold is met, otherwise each pipeline's own records; inactive pipelines always use own records. Existing context/legend retained. |
| Saved-test table / advanced selected-run metrics | Saved test CER / WER / Exact Match | `run.metrics` according to that test's evaluation mode; this can aggregate several confirmed Fields. It is explicitly separate from the selected Field example. |

Hero and All Pipelines intentionally do **not** share a cohort: the featured pair and each pipeline's eligible document set differ, especially with three or more pipelines or incomplete coverage. Scope labels explain that difference without changing the backend.

Speed remains arithmetic average from `/api/matrix` `avg_time_ms`: latest eligible successful results per saved test with timing, within the filters, including results without confirmed GT. Reliability uses the same API's `successful_runs / tests` over latest eligible results in the filters; it is not all retry attempts and not restricted to the paired cohort. Tested Documents in the Hero is `featured_pair.documents`; ranking counts are `cells[].documents`. Test-case counts remain “ชุดทดสอบ”, not relabeled as regions.

Evidence presentation is deterministic: no valid nonempty featured pair → Insufficient; fewer than `minimum_documents` or verdict `insufficient` → Limited; minimum met, verdict `clear`, matching pair winner and overall recommendation → Strong; other sufficient paired evidence → Moderate. These states describe the comparison evidence, not upstream Model Confidence. A focusable info icon exposes this distinction and current/required Document counts remain visible.

Model details still use the read-only `pipelineModelDisplay` helper and current `/api/pipelines` configuration. Official/custom routing and Settings semantics were untouched. Character errors retain canonical spans, distinct styling, titles and accessible text.

Validation for this pass: typecheck, ESLint and production build passed; 57 relevant Playwright tests passed, including six new scope/evidence cases; focused backend comparison/analytics: 35 passed (two pre-existing dependency deprecations). Responsive screenshots at 1440/1024/768/390px retain the existing composition and have no horizontal page overflow. Full backend and Ruff were not rerun: the established unrelated baseline remains documented above. No commit, push, deployment or production change was performed in this polish pass.

## Final delivery validation

- Fresh fetch confirmed upstream base remains `a4272660645534de8cecfb7e6946870db7f9ebdc`.
- Integration branch: `feature/ocr-comparison-redesign-sync`.
- Backup branch remains untouched at `bf9afcd4a174f13df0543ddd359c7e67c0a2c7cf`: `backup/ocr-comparison-before-sync`.
- Final validated implementation HEAD: `501e0e6d3f29e33b66a0f7448631c0c4e65d5fd1`. This evidence is recorded in a documentation-only follow-up commit; its delivery HEAD is recorded in the PR and can be resolved with `git rev-parse HEAD` (a commit cannot embed its own SHA).

Commands rerun for final delivery on 2026-10-07:

```powershell
cd frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:E2E_BASE_URL='http://127.0.0.1:3017'
# Local dev server: npm.cmd run dev -- --port 3017
npm.cmd run test:e2e -- tests/comparison-dashboard.spec.ts tests/analytics-stage-b.spec.ts tests/dynamic-pipelines.spec.ts tests/global-comparison.spec.ts tests/ground-truth-sync.spec.ts tests/error-analysis-lines.spec.ts tests/global-selection.spec.ts tests/lean-bulk.spec.ts
cd ../backend
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp ../.runtime/final-comparison-pytest tests/test_comparison_decision.py tests/test_analytics_scope.py
```

Results: typecheck **PASS**, ESLint **PASS**, production build **PASS**, relevant Playwright **57/57 PASS**, focused backend **35 PASS** with two dependency deprecations. Full backend/Ruff were not rerun; the independently reproduced upstream baseline above remains disclosed, not claimed fixed. Docker service is stopped and its Linux engine pipe is absent; PostgreSQL-native E2E was **NOT RUN**.

Final review: responsive checks at 1440/1024/768/390px pass, mobile composition retained without horizontal overflow. `git diff --check` and the private-value secret scan pass; `.env` is ignored/untracked. No reference/mockup values were found in production Comparison components/helpers. CSS additions are Comparison-scoped. Backend, types, API contracts, ordering helpers, migrations and deployment/environment configuration remain identical to upstream. Official Paddle changes are limited to extracting the current read-only display helper; Settings form/routing is unchanged.

Files in the complete feature diff (none removed):

- Added: `design-qa.md`, `ComparisonDashboard.tsx`, `ComparisonFilters.tsx`, `comparison-examples.ts`, `comparison-identity.ts`, `pipeline-model-label.ts`, `comparison-dashboard.spec.ts`.
- Adapted: `frontend/app/matrix/page.tsx`, `frontend/app/globals.css`, `ComparisonDecision.tsx`, `DynamicPipelineSettings.tsx`, `analytics-stage-b.spec.ts`.
- Final polish touched only QA, Matrix metric copy, the two Comparison components and dashboard regression tests. No temporary captures/helpers, `.env`, build output or dependencies are included.

Delivery scope: normal push of the feature branch and PR to `main` only. No main push, merge, deployment, production mutation or backup removal is authorized by this delivery. Review status: **SAFE TO REVIEW**.

## Comparison UX cleanup — 2026-10-07

This is a separate pass based on merged `origin/main` (`1f2b645`), on `feature/comparison-ux-cleanup`. The supplied 1448×1086 inline reference applies **only** to Accuracy × Speed. Its surrounding filters, sidebar, Hero and tables were deliberately not copied. Chart data, names, pipeline count and Pareto membership remain supplied by the application APIs.

History retains its date/filter semantics with simpler labels and a plain `/matrix` link. Comparison requests default active-pipeline scope with no date, document-type, pipeline or search filters. Old scope parameters are removed from its URL; only the view tabs change display. UI rendering omits `unassigned`; backend groups and comparison decisions remain intact. Verbose pairwise tables and their unused legacy overview were removed after checking references; manual A/B selection and compact paired evidence remain.

The chart adapts the reference's axes, subtle grid, numbered colored markers, adjacent legend, blue dashed backend Pareto frontier and bottom-left explanation. Colors follow pipeline identity rather than response ordering. Keyboard focus and hover expose name, CER, average time and evaluated document count. Missing CER/time stays in the legend but produces no invented point. Original page composition, typography and icons are retained; no raster asset is needed for this data visualization.

Visual comparison used the user's inline chart reference and fresh local captures at 1440, 1024, 768 and 390px in ignored `.runtime/comparison-ux/chart-*.png`. Desktop keeps plot/legend side by side; narrower screens stack the legend. Mobile tick labels were enlarged and the X-axis caption uses readable HTML text. Long configured names wrap; page-level overflow checks pass. Font, spacing, color, copy and icon review found no remaining P0/P1 mismatch. Differences from the reference are intentional: actual API values/count, current component location, no surrounding reference-page redesign. The source is inline rather than a local image file, so no fabricated combined comparison artifact is claimed.

Both view tabs share saved-test CER highlighting. Only latest successful results with finite nonnegative CER participate; zero is valid and ties within `1e-10` all receive text plus green accent. Failed/missing runs do not participate. Type-table highlighting uses descriptive Type overall CER; a backend recommendation badge is separate. Neither observed minimum creates a statistical winner.

Validation: typecheck, ESLint and production build **PASS**; relevant Playwright **70/70 PASS** (History, Comparison, dynamic pipelines, Global comparison/selection, GT sync, error lines and bulk History/Dataset); focused backend comparison/analytics **35 PASS**, with two existing dependency deprecations. Full backend and Ruff were not rerun, as requested; unrelated upstream failures are not claimed fixed. Browser tests use deterministic intercepted API fixtures, not a live PostgreSQL end-to-end stack.

Backend, API contracts/types, OCR ordering, batch splitting, evaluation, storage, migrations, secrets and deployment configuration are unchanged. No production deployment or merge is part of this pass.
