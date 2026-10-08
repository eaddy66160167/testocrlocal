# Four-page Global Layout validation

Validated locally on 2026-09-27. Existing uncommitted domain work is preserved;
this session merges GT/results, adds instant Auto boxes and data-driven Calculate.
No production migration, commit, push or deployment.

## Automated checks

- Full backend including local PostgreSQL: **157 passed**, 0 failed/skipped.
  Previous 153 plus four data-presence combinations. Tests retain canonical UUID,
  crop fairness, field-only invalidation, historical compatibility and Dataset checks.
- Ruff, TypeScript, ESLint and Next production build: passed.
- Complete Playwright: **36/36 passed** after updating the intentional four-page UX.
  Eight Global cases plus 28 compatibility/console cases. No test was removed.
- Local Alembic current: `0008_global_layout_evaluation`; check: no drift.
- No new schema change, 0009, environment variable or authentication change.
- Git diff whitespace check passed. Private secret-value scan: zero matches.
  `.env` and `.runtime` are ignored/untracked; documentation relative links resolve.

The initial new smart-calculation assertion expected one deletion element; the
backend correctly emits six character-level deletions for the six-character suffix.
The corrected assertion verifies all six markers, not just the first. A first
backend attempt encountered stopped local PostgreSQL; after startup the full suite
passed. Ruff's only finding was import ordering, now fixed. Existing dependency
warnings concern Starlette/httpx and an AnyIO deprecated alias.

## Acceptance covered

- Upload/image/PDF page isolation and source preview.
- Auto Layout immediately renders all boxes, without secondary activation controls.
- Auto/manual coexist; select, move, resize, delete, bulk delete and confirmation.
- Backend geometric order, stable UUIDs, locked layouts and clone-on-edit after OCR.
- Read-only pipeline page and one Run OCR action; direct transition to page 4.
- Whole-only while Sub editor is visible; Sub-only; both in one request; empty GT
  disabled in UI/rejected by backend. Both persisted scopes survive toggles/refresh.
- Draft GT survives toggles. Blank fields remain unevaluated. Editing one field
  invalidates only its snapshots; Whole predictions use stored canonical order.
- Three-block cards, semantic collapsed Error Analysis, backend substitution,
  insertion and deletion markers. Old `/evaluation` route redirects to page 4.
- History restores evaluated cases; no-run drafts excluded; legacy viewer retained.
- Field-only Dataset eligibility and original-source crops, not OCR-derived labels.
- Responsive 390/768/1440 widths, no horizontal overflow and compact reference.

## Real integration

See [current release gate](global-layout-release-gate.md). Real Auto Layout and
Mint/Benchmark/Thai FT v2 succeeded using a synthetic document, local PostgreSQL
and real authenticated Gateway requests. Both GT scopes, persistence, backend
alignment and Dataset ZIP were verified from these real predictions.

## Limits

- Reading order is a geometry/row heuristic, not semantic table/column parsing.
- Unsaved draft boxes/GT are local page state; save before leaving/reloading.
- At most 50 confirmed Global Fields per case (existing API limit).
- Whole evaluation needs complete successful predictions; independently successful
  fields remain evaluable. Failed upstream pipelines are never replaced with mocks.
- Global error snapshots are inline; legacy Error Analytics uses historical events.
- Missing source files require restoration or re-upload, never replacement images.
- Hutch/Paddle is externally unavailable; it is not a gate blocker for this redesign.

Ignored evidence: `frontend/test-results/global-*.png`, `.runtime/four-real.json`,
`.runtime/four-layout.png`, `.runtime/four-real-{390,768,1440}.png` and Dataset ZIP.

## Exact changed/new file inventory

### Backend application / migration

- `backend/alembic/versions/0008_global_layout_evaluation.py`
- `backend/app/api/routes/benchmark.py`
- `backend/app/api/routes/dataset.py`
- `backend/app/api/routes/test_cases.py`
- `backend/app/db/models.py`
- `backend/app/pipelines/hutch_full.py`
- `backend/app/repositories/benchmark_repository.py`
- `backend/app/repositories/dataset_repository.py`
- `backend/app/schemas/contracts.py`
- `backend/app/services/dataset_service.py`
- `backend/app/services/error_analysis_service.py`
- `backend/app/services/field_service.py`
- `backend/app/services/global_layout_service.py`
- `backend/app/services/global_order.py`
- `backend/app/services/matrix_service.py`
- `backend/app/services/pipeline_manager.py`
- `backend/app/services/serializers.py`
- `backend/app/services/test_case_service.py`

### Frontend application

- `frontend/app/dataset/page.tsx`
- `frontend/app/history/page.tsx`
- `frontend/components/AppShell.tsx`
- `frontend/components/DocumentViewer.tsx`
- `frontend/components/GlobalFieldEvaluation.tsx`
- `frontend/components/GlobalWorkspace.tsx`
- `frontend/components/LegacyTestingWorkspace.tsx`
- `frontend/components/TestingWorkspace.tsx`
- `frontend/components/WorkflowUpload.tsx`
- `frontend/components/WorkflowSteps.tsx`
- `frontend/components/WorkflowPage.tsx`
- `frontend/components/GlobalGroundTruthForm.tsx`
- `frontend/app/workflow/[id]/layout/page.tsx`
- `frontend/app/workflow/[id]/pipelines/page.tsx`
- `frontend/app/workflow/[id]/ground-truth/page.tsx`
- `frontend/app/workflow/[id]/evaluation/page.tsx`
- `frontend/lib/api.ts`
- `frontend/lib/global-order.ts`
- `frontend/types/index.ts`

### Tests

- `backend/tests/test_batch_logs_delete.py`
- `backend/tests/test_benchmark_pipeline.py`
- `backend/tests/test_fields_roi.py`
- `backend/tests/test_gateway_and_fairness.py`
- `backend/tests/test_global_layout.py`
- `backend/tests/test_pdf.py`
- `backend/tests/test_real_boundaries.py`
- `backend/tests/test_thai_ft_v2.py`
- `backend/tests/upstream_fixture.py`
- `frontend/tests/batch-logs-delete.spec.ts`
- `frontend/tests/batch-review.spec.ts`
- `frontend/tests/benchmark.spec.ts`
- `frontend/tests/fields-roi.spec.ts`
- `frontend/tests/global-layout.spec.ts`
- `frontend/tests/legacy-workspace.ts`
- `frontend/tests/pdf.spec.ts`
- `frontend/tests/thai-ft-v2.spec.ts`
- `frontend/tests/workflow.spec.ts`

### Documentation

- `README.md`
- `docs/api.md`
- `docs/architecture.md`
- `docs/deployment.md`
- `docs/error-analysis-dataset.md`
- `docs/fields-roi-dataset.md`
- `docs/flow.md`
- `docs/global-layout-release-gate.md`
- `docs/global-layout-validation.md`
- `docs/global-layout.md`
- `docs/model-gateway.md`
- `docs/thai-ft-v2.md`
- `docs/validation.md`
