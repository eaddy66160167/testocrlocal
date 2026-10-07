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
