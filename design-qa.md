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
- Relevant Playwright suites: **29 passed** (Comparison dashboard, analytics/scope regressions, adjacent History/Dataset bulk workflows).
- Final viewport capture checks: **4 passed**, at 1440/1024/768/390px; no horizontal page overflow.
- Backend comparison/analytics regression suites: **35 passed**; backend code unchanged.
- Private credential scan and `git diff --check`: pass; `.env` ignored/untracked.

## Operational scope

- No push, deployment, production migration, live OCR request or production-data mutation was performed.
- Side-by-side/disagreement examples are explicitly scoped to the current history page, with navigation to the next page. Full-scope action links remain available separately. Field comparisons require the same confirmed global field; unrelated detected fields are never paired by array position.
- Historical whole-document results without stored spans remain readable, with no invented alignment. They display saved metrics and plain OCR text.
- Native backend integration was not rerun against PostgreSQL in this UI task; Docker Desktop was unavailable. Browser acceptance used mocked API contracts and the existing pytest test harness.

final result: passed
