# OCR Testing & Benchmark

## Project Overview

Benchmark external OCR models on images and PDF pages. Select regions, inspect predictions and tracing, confirm Ground Truth (GT), evaluate field-level errors, and export confirmed image/text pairs for training. No OCR models run locally.

## Current Architecture

```text
Browser
  → Vercel — Next.js frontend
    → Railway — FastAPI backend
      ├─ Neon PostgreSQL: metadata, runs, GT, metrics
      ├─ application storage: original images/PDFs on persistent storage
      └─ Model Gateway: OCR and optional Auto ROI inference
```

The browser selects source coordinates. FastAPI validates them, creates deterministic lossless PNG inputs and SHA-256, normalizes vendor responses, and persists results. Database credentials and Gateway keys remain backend-only.

## Tech Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, react-konva/Konva, Lucide.
- Backend: FastAPI, SQLAlchemy 2, psycopg 3, Alembic, Pydantic Settings, HTTPX, Pillow, OpenCV headless, pypdfium2.
- Database/deployment: PostgreSQL (Neon in production), Vercel, Railway, Docker Compose.
- Tests: pytest, Ruff, TypeScript, ESLint, Playwright. Lockfiles pin dependencies; Docker uses Python 3.12 and Node 24.

## Main Application Flow

The workflow has four route-backed pages:

1. **Upload Document** (`/`): upload image/PDF, preview, select PDF page, then Next.
2. **Global Layout** (`/workflow/{id}/layout`): one Auto Layout click displays all returned usable boxes as editable drafts. Manual boxes coexist. Confirm ROI persists canonical order and locks the layout.
3. **Select Pipelines / Run OCR** (`/workflow/{id}/pipelines`): read-only layout, pipeline selection, one Run OCR action. Successful results survive other pipeline failures.
4. **Ground Truth & Evaluation** (`/workflow/{id}/ground-truth`): Whole/Sub editors and results together. One Calculate evaluates every populated selected scope, irrespective of the visible tab. Cards separate Extracted Text, Metrics and collapsed Error Analysis.

Whole/Sub drafts survive toggles. Both evaluations persist when both contain GT; empty GT is not evaluated. Calculate stays on page 4. The old `/workflow/{id}/evaluation` route redirects there. History restores saved results; legacy records keep their compatibility viewer. Editing a layout after OCR creates a new case and preserves old runs.

Upload and layout preparation never run OCR. A layout becomes immutable once OCR starts. Stable Global Field UUIDs map all pipeline predictions to the same regions. Historical cases remain available in the legacy viewer.

## OCR Pipelines

Six adapters are registered. Selection/dashboard rows follow configuration. Disabled pipelines are not silently enabled.

### Mint

App canonical ROI crop → `POST /api/v1/ocr-results?engine=custom`. The external pipeline performs `PP-OCRv5_server_det` → text-region crops → `th_PP-OCRv5_mobile_rec`. The app does not recreate that pipeline.

### Hutch Crop

App canonical ROI crop → `POST /api/v1/ocr-results?engine=paddle`. Integrated Paddle uses `PP-OCRv6_medium_det` + `th_PP-OCRv5_mobile_rec`.

Both Hutch adapters explicitly send `text_det_unclip_ratio=1.7`, `text_det_thresh=0.25`, `text_det_box_thresh=0.6` independent of upstream defaults.

### Hutch Full

Same Paddle endpoint and thresholds as Hutch Crop. Every new run receives the same prebuilt canonical ROI PNG (`crop_stage=app_crop`) as the other adapters, for both Auto and Manual regions. Global Layout executes this per field. Stored historical full-image/manual-inside-adapter records keep their original inputs and tracing; they are not rewritten.

### Benchmark

Canonical ROI → DET → perspective crops in detection order → REC:

```http
POST /api/v1/text-detection-batches?version=6
POST /api/v1/text-recognition-batches?version=5
```

Neither request sends `model` or `engine`. Multipart uses repeated **images** fields. Recognition batches contain up to eight ordered line crops. See [contract](docs/benchmark-pipeline.md).

### Thai FT v2

Same ordered perspective-crop orchestration, fixed fine-tuned V6 routing:

```http
POST /api/v1/text-detection-batches?version=6&model=thai_ft_v2
POST /api/v1/text-recognition-batches?version=6&model=thai_ft_v2
```

No V5 fallback. Selection metadata is `version=v6`, `variant=thai_ft_v2`. Some responses retain `results[*].model=th_PP-OCRv5_mobile_rec`; the model owner confirmed stale upstream metadata. Preserve it as received; never use it for routing. See [Thai FT v2](docs/thai-ft-v2.md).

### Hutch fine tune v2

Recognition only: canonical Global Field PNG → `POST /api/v1/text-recognition-batches?version=5&model=thai_ft_v2`.
Each request sends one crop through the existing multipart `images` batch field. There is no DET stage or extra crop. This differs from Thai FT v2, which retains DET V6 + REC V6 with `model=thai_ft_v2`.
The common Global Field UUID, crop hash, shared GT, evaluation and History flow apply unchanged. Raw upstream model metadata remains diagnostic only. Unknown readiness permits a real request; actual errors remain isolated per pipeline. Uses existing Gateway credentials and seed configuration, with no new migration or environment variable.

## Auto ROI & Manual ROI

Auto Layout calls `/api/v1/document-layouts` and immediately displays all returned usable boxes as editable drafts. Users can add, move, resize or delete Auto/Manual boxes without losing the others. The main preview contains only Global Layout boxes. Suggestions are page/session-local; saved selected fields survive reload.

Coordinates refer to original image/selected PDF raster pixels. Zoom/pan affects only rendering. Backend ordering groups boxes with at least 50% vertical overlap relative to the shorter height against a fixed row anchor, then sorts rows top-to-bottom and boxes left-to-right. UUIDs are stable; `field_index` is recomputed before OCR, then locked. All six adapters receive identical canonical PNG bytes/hash/dimensions per Global Field.

## Ground Truth

Two persisted modes share the same Global Layout:

- **Whole Field:** one GT for the complete page. Backend joins predictions by stored Global Field order with newline separators, then applies existing normalization and alignment. Raw responses remain unchanged.
- **Sub-fields (default):** one shared GT per Global Field, compared independently with all selected pipelines. Select one or more fields; unselected/empty fields have no evaluation. There are no nested line/sub-field entities.

Save Draft invalidates stale evaluation in that scope only. **Calculate** uses backend data presence to evaluate Whole GT, populated selected Sub-fields, or both in one action, independent of the visible tab. It confirms GT and persists metrics/error spans; empty GT cannot be evaluated. Reopening never recomputes results. Mode changes retain both evaluations and select which summary feeds current metrics. See [Global Layout and evaluation](docs/global-layout.md).

## Metrics

- CER = character edit distance / normalized GT characters.
- WER = token edit distance / normalized GT whitespace tokens.
- Exact Match = normalized prediction equals normalized GT.
- Field aggregate CER/WER = **total edit counts / total GT units**, not averages of percentages. Aggregate Exact Match requires all included confirmed fields to match.
- The underlying legacy metric function retains its empty-string semantics. Global evaluation rejects blank GT and displays no valid metrics until Calculate.

Normalization: Unicode NFC, normalized newlines, trimming, repeated-whitespace collapse. Spelling/Thai/punctuation are preserved. CER is often more useful for Thai than whitespace WER. Confidence is upstream data (null if absent); local time and Gateway time are separate.

## Error Analysis

Global Results & Comparison renders backend alignment: substitutions/insertions red, deletions as explicit missing markers. Whole Field errors use canonical assembled text; Sub-fields errors use that field's prediction. `/analytics/errors` and the legacy recompute API remain available for historical whole-GT events; they do not recompute Global Layout evaluations.

## Dataset Builder

`/dataset` exports **confirmed Global Fields with their own confirmed Sub-fields GT** and available source. Whole Field GT never becomes inferred field labels. Existing eligible legacy ROI/whole-GT samples remain exportable:

```text
dataset/
  images/
    000001.png
  label.txt
```

`label.txt` is UTF-8 escaped TSV: `images/000001.png<TAB>confirmed raw GT<LF>`. Backslash/tab/CR/newline use reversible escapes; Thai and spaces remain intact. Decode the four escapes in one pass after splitting on the actual tab.

Images are lossless crops from stored originals/rendered PDF pages using final source ROI, never screenshots. OCR predictions, CER/WER/confidence/latency and pipeline names are not labels. Cases sort by UUID and global samples by stored field order; export paths are generated safely. Limits: 200 cases / 512 MiB encoded images per ZIP.

Missing originals show unavailable and cannot be selected. Export rejects the whole request with clear 409 information if a source is unavailable; no fake image or dropped label. Restore originals or re-upload and confirm new samples. See [details](docs/fields-roi-dataset.md).

## Multi-page PDF

Original PDFs are stored; pages rasterize on demand at saved DPI. Global Layout, suggestions and GT drafts are separate per page. The legacy viewer retains batch processing: Batch selection creates a new full-page case per page, processes pages sequentially and commits before the next. Pipelines within a page run concurrently. NDJSON streams progress. Disconnection is not a resumable background job: inspect History/Logs before retrying.

## Database

PostgreSQL stores metadata/results, not image Base64. Entities: `documents`, `test_cases` (page/ROI/source/whole GT), `pipeline_runs` (prediction/geometry/input/Gateway tracing), `metrics`, `ocr_fields`, `ocr_error_events`, `categories`, `test_case_categories`, `pipeline_configs`, `app_logs`.

Retain migrations **0001–0007**. Head `0007_fields_roi_source` adds `test_cases.roi_source` with historical default `none` and `ocr_fields`. Seed adds missing configs/categories without overwriting settings. See [architecture](docs/architecture.md).

## API Overview

OpenAPI: `/docs`, `/openapi.json`. App routes use `/api`:

| Area | Major routes |
|---|---|
| Health | `GET /health`, `/upload-config`, `/integrations/model-gateway/status` |
| Documents | `POST /documents`; metadata/image/page/crop reads; `POST /documents/{id}/auto-rois`, `/run-pages` |
| Cases | `POST/GET /test-cases`; `GET/PUT/DELETE /test-cases/{id}`; ROI/categories/GT updates; run/results |
| Global Layout | `GET/PUT /test-cases/{id}/global-fields`; field `PUT /ground-truth`; case `PUT /ground-truth`, `PUT /evaluation-mode`, `POST /evaluate` |
| Legacy Fields | `GET /test-cases/{id}/runs/{run_id}/fields`; field `POST /check`, `PUT /ground-truth` |
| Analysis | `GET /history`, `/matrix`, `/categories`, `/analytics/categories`, `/analytics/errors`; case `POST /errors/recompute` |
| Dataset | `GET /dataset/samples`, `POST /dataset/export` |
| Operations | `GET /logs`, `GET /pipelines`, per-pipeline `GET/PUT`, `POST /test-connection` |

See [API reference](docs/api.md) for full paths/payloads.

## Environment Variables

Copy [.env.example](.env.example) to private root `.env` only if absent. Backend also reads `backend/.env`; process environment wins. Never copy backend environment into frontend.

| Scope | Names / purpose |
|---|---|
| Backend secrets | `DATABASE_URL`: PostgreSQL/Neon; `MODEL_GATEWAY_API_KEY`: shared Bearer credential |
| Gateway | `MODEL_GATEWAY_BASE_URL`, `MODEL_GATEWAY_TIMEOUT_SECONDS`, `MODEL_GATEWAY_MAX_RESPONSE_MB`: destination/time/response limit |
| Storage/upload | `STORAGE_MODE`, `STORAGE_PATH`, `MAX_UPLOAD_MB`, `MAX_IMAGE_PIXELS`, `MAX_IMAGE_DIMENSION`, `PDF_RENDER_DPI`, `MAX_PDF_PAGES` |
| Backend CORS | `CORS_ORIGINS`: comma-separated browser origins |
| Existing compatibility | `MINT_OCR_ENDPOINT`, `HUTCH_CROP_ENDPOINT`, `HUTCH_FULL_ENDPOINT`: initial defaults; `MINT_OCR_ENGINE`, `HUTCH_CROP_ENGINE`: accepted legacy settings (routing remains fixed) |
| Public frontend | `NEXT_PUBLIC_API_BASE_URL`: browser-accessible API URL embedded at build |
| Tests only | `TEST_DATABASE_URL`: disposable local PostgreSQL database ending in `_test` |

All six share Gateway URL/key; no per-pipeline credentials/new Thai FT v2 variables. Prefer ordinary token keys unquoted without spaces around `=`; quotes are optional. Keep example key empty. Absent credentials cause a clear failure, never silent mock OCR.

## Local Development

Prerequisites: Python 3.12, Node 24/npm, PostgreSQL or Docker Desktop Linux engine. PowerShell from repository root:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
py -3.12 -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-lock.txt
cd frontend
npm.cmd ci
npx.cmd playwright install chromium
cd ..
docker compose up -d postgres
```

Empty `DATABASE_URL` selects local Compose PostgreSQL. For Neon use a private connection with TLS options. Confirm target before migration; startup also upgrades to head.

```powershell
cd backend
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m alembic check
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Second terminal:

```powershell
cd frontend
npm.cmd run dev
```

Open `http://localhost:3000`. For another API URL put only the public variable in `frontend/.env.local`, then restart/rebuild. After setup, `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/dev.ps1` starts both services and reports PIDs/log locations.

## Testing

```powershell
cd backend
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m ruff check app tests alembic
cd ../frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
cd ..
```

PostgreSQL tests require `TEST_DATABASE_URL`. Create a dedicated local DB once; never use production:

```powershell
docker compose exec postgres createdb -U ocr ocr_release_test
$env:TEST_DATABASE_URL='postgresql+psycopg://ocr:ocr_local_dev@127.0.0.1:5432/ocr_release_test'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1 -Browser
# Browser suite alone:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/e2e.ps1
```

E2E uses backend 8100 / production Next build 3100 and test-only Gateway HTTP fixtures. This is not live OCR verification. Tests are excluded from production images. Rebuild with the intended API URL before reusing the E2E build outside tests. See [validation](docs/validation.md).

## Deployment

Vercel hosts Next.js; Railway hosts FastAPI with persistent uploads; Neon provides PostgreSQL. Standalone output stays enabled locally/Docker and disabled on Vercel. Suggested roots are `frontend` / `backend`; inspect actual branch/root/watch/auto-deploy settings in authenticated platform configuration.

```powershell
docker compose config --quiet
docker compose up --build -d --wait
curl.exe -f http://localhost:8000/api/health
```

Before an auto-deploying push, verify backup/PITR, apply additive production migration and verify data/revision. Then push normally and verify deployed SHAs/health. No reset/drop/truncate/force push. See [deployment runbook](docs/deployment.md).

## Production URLs

- Frontend: https://ocrtest-sandy.vercel.app
- Backend health: https://ocrtest-production-095b.up.railway.app/api/health

Addresses identify existing services, not proof of a new deployment.

## Known Limitations

- Gateway readiness may not expose individual DET/REC variant readiness.
- Thai FT v2 result-level model name can be stale upstream metadata.
- WER uses whitespace; CER counts Unicode code points.
- Missing historical originals require restore/re-upload.
- Auto suggestions/manual drafts persist per page/session, not reload.
- Field summaries are separate from whole-GT analytics and Dataset eligibility.
- Existing Matrix/category/error aggregation excludes Hutch Full stages other than `full_image`, including current `manual_roi`. Results/field evaluation remain visible in Test Detail. Correcting this legacy rule needs focused historical-data regression tests.
- Batch locks are process-local: use one worker/instance until distributed coordination exists. PDF/large runs require sufficient memory.
- No application login, automatic orphan-file cleanup or log-retention worker. Use a trusted-access boundary and persistent storage.

## Project Structure

```text
backend/
  app/{api,core,db,integrations,pipelines,repositories,schemas,services}/
  alembic/versions/        # migrations 0001–0007
  tests/fixtures/
frontend/
  app/                    # workspace/history/test/matrix/analytics/dataset/logs/settings
  components/ lib/ types/
  tests/ public/
docs/
scripts/                  # dev.ps1, check.ps1, e2e.ps1, sample generator
docker-compose.yml
.env.example
```

## Detailed Documentation

- [Architecture](docs/architecture.md) · [Flow](docs/flow.md) · [API](docs/api.md)
- [Gateway](docs/model-gateway.md) · [Benchmark](docs/benchmark-pipeline.md) · [Thai FT v2](docs/thai-ft-v2.md)
- [Field GT / ROI / Dataset](docs/fields-roi-dataset.md) · [Error Analysis / export](docs/error-analysis-dataset.md)
- [PDF batch / logs](docs/batch-activity.md) · [Deployment](docs/deployment.md)
- [Validation history](docs/validation.md) · [Release audit/backlog](docs/release-audit.md)
