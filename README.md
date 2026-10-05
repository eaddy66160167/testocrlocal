# OCR Testing & Benchmark Platform

Compare OCR predictions against shared Ground Truth, inspect recognition errors, and export confirmed source crops for training. Existing records remain readable through the legacy viewer.

## Stack and production architecture

Browser -> Vercel (Next.js, React, TypeScript, Tailwind, react-konva) -> Railway (FastAPI, SQLAlchemy, psycopg, Alembic) -> Neon PostgreSQL / persistent application storage / Model Gateway.

Only the backend talks to the Gateway and database. Originals and PDFs belong in storage, not PostgreSQL. No local OCR models are hosted here.

## Four-page workflow

1. **Upload Document**: choose an optional document type, upload an image/PDF, select a page.
2. **Global Layout**: obtain Auto Layout suggestions or draw/edit manual regions; confirm the layout.
3. **Select Pipelines / Run OCR**: select any enabled pipelines and run once. Individual failures preserve successful results.
4. **Ground Truth & Evaluation**: enter Whole Field and/or shared Sub-field GT, calculate, inspect CER/WER/Exact Match and error alignment.

Global Fields have stable UUIDs and original-source coordinates. The backend creates one canonical lossless PNG per field. Every selected pipeline receives that same application crop. Layout is locked after OCR; create a new case to change it. PDF pages retain separate cases and layouts.

## Dynamic pipelines and historical results

Current executable pipelines are configured through the OCR model registry and Dynamic Pipeline Settings (integrated, DET → REC, or REC-only). Migration `0010_dynamic_pipelines` introduced this registry. Names below describe historical adapters/contracts, not six automatically active configurations. Historical PipelineRun snapshots remain analyzable after a configuration is removed, with the label **เก็บถาวร**; analytics never recreate executable configs.

| Pipeline | Gateway contract |
| --- | --- |
| Mint | `POST /api/v1/ocr-results?engine=custom` |
| Hutch Crop | `POST /api/v1/ocr-results?engine=paddle` |
| Hutch Full | Same Paddle route, using the common application field crop |
| Benchmark | DET `/api/v1/text-detection-batches?version=6`, then REC `/api/v1/text-recognition-batches?version=5`; no model/engine query |
| Thai FT v2 | DET `version=6&model=thai_ft_v2`, then REC `version=6&model=thai_ft_v2` on the batch routes |
| Hutch fine tune v2 | REC only: `/api/v1/text-recognition-batches?version=5&model=thai_ft_v2`; no DET |

Both Hutch Paddle adapters explicitly send unclip ratio **1.7**, detection threshold **0.25**, box threshold **0.6**. Benchmark/Thai FT v2 preserve detection order through perspective crops and recognition. Batch uploads use repeated multipart `images`; the recognition-only adapter sends one canonical field crop. Preserve raw upstream metadata, including known stale result-level model names; never use it to route requests.

## Ground Truth, History and Dataset

Sub-field GT is shared across pipelines by Global Field UUID. Whole Field predictions follow canonical field order. Calculation persists metrics/alignment; editing GT invalidates affected evaluation. Normalization uses NFC and conservative whitespace normalization. WER uses whitespace tokens; CER is generally more informative for Thai. Aggregate field metrics use total edit counts divided by total GT units.

History success is based on pipelines actually run and completed evaluation, including a single pipeline. Partial failures remain visible.

Dataset Builder lists recently evaluated/updated eligible samples first. Labels are **original canonical crop + confirmed GT**, never OCR predictions or metrics. Missing originals are unavailable and cannot be exported. Removing a sample durably excludes it from listing/export while preserving source, History, GT and results.

```text
dataset/
  images/000001.png
  label.txt
```

`label.txt` is UTF-8 TSV: image path, tab, confirmed GT, newline. Backslash/tab/CR/LF in GT are escaped reversibly. Export ordering and generated filenames remain deterministic; browsing order is independent of ZIP ordering.

Document Types include protected defaults and custom types. Names are trimmed, normalized and case-insensitively unique. Removing a custom type archives it for future selection; historical documents retain its name. Untyped old records remain valid. The existing image/PDF `document_type` field is unchanged; business types use a separate reference.

System Logs search supports partial, case-insensitive Thai/English words across filename, pipeline, event, message and status. Multiple words are combined with AND; exact operational filters remain available through the API.

History, Comparison and Analysis share only four URL filters: `document_type_id` (business type), `pipeline`, `date_from`, and `date_to`. Date ranges filter **TestCase creation date**, not evaluation date. Dataset and Logs have independent scope. Page-local filename/status controls are explicitly labeled. Obsolete `category` and `document` URL parameters are removed from these user pages and Dataset, so they cannot silently restrict visible results. Category metadata and document identifiers remain supported internally by the backend.

Comparison uses a backend summary across the entire filter scope: unique cases, evaluated latest run-level results, coverage of unique evaluated cases, individual lowest final CER with provenance/ties, and fastest mean processing time with at least five measured successful latest runs. Global workflow processing time is the sum of Field durations, not page wall-clock. Analysis groups exclusively by business document type. Ranking requires five distinct eligible evaluated cases per Pipeline/group. Confirmed non-empty Sub-field subsets remain eligible under the existing evaluation rules.

System Logs remain available directly at `/logs` for troubleshooting, with their API and storage intact, but are absent from normal navigation and History/Comparison links. This is navigation simplification, not access control; no authentication or roles have been added. Logs show human messages, severity, document/Pipeline and outcome first; IDs are expandable technical details. Links to deleted cases are replaced with an explicit unavailable indication. Operational retention of **90 days** is recommended; no automatic deletion job is implemented. Potential future uses include error counts, latency/failure alerts, top causes, KPI provenance checks and incident export.

## Local development (Windows PowerShell)

Prerequisites: Python 3.12, Node.js 24, PostgreSQL (or Docker Desktop Linux engine).
Copy `.env.example` to private `.env` only if absent. Configure a local PostgreSQL database for development; do not reuse production credentials for tests.

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-lock.txt
cd frontend
npm.cmd ci
cd ../backend
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

In another terminal:

```powershell
cd frontend
npm.cmd run dev
```

Or, after setup, run `scripts/dev.ps1`. Docker: `docker compose up --build -d --wait`.

## Environment names

Backend only: `DATABASE_URL`, `MODEL_GATEWAY_BASE_URL`, `MODEL_GATEWAY_API_KEY`, `MODEL_GATEWAY_TIMEOUT_SECONDS`, `MODEL_GATEWAY_MAX_RESPONSE_MB`, `CORS_ORIGINS`, `STORAGE_MODE`, `STORAGE_PATH`, `MAX_UPLOAD_MB`, `MAX_IMAGE_PIXELS`, `MAX_IMAGE_DIMENSION`, `PDF_RENDER_DPI`, `MAX_PDF_PAGES`.

Public frontend: `NEXT_PUBLIC_API_BASE_URL` (embedded during build).
Tests only: `TEST_DATABASE_URL` (isolated local PostgreSQL database ending in `_test`).
See [.env.example](.env.example) for safe defaults. No new environment variable is required for document types, dataset exclusion or Hutch fine tune v2. Never commit secrets or send backend secrets to Next.js.

## Validation

```powershell
cd backend
.venv/Scripts/python.exe -m pytest -q tests/test_document_dataset_management.py
.venv/Scripts/python.exe -m ruff check app tests alembic
.venv/Scripts/python.exe -m alembic check
cd ../frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e -- tests/release-b.spec.ts
```

Playwright needs the test backend/frontend running with local PostgreSQL. `scripts/e2e.ps1` starts isolated mock-Gateway servers and runs the full suite; use that when a full regression is required. Production never silently falls back to mocks.

## Deployment

Normal push to `main` triggers the existing Railway/Vercel integrations. Apply and verify required additive database migrations before new backend code serves traffic. Current head is `0010_dynamic_pipelines`. This analytics/UI change requires no new migration or environment variable. Next standalone output is used locally/Docker and disabled on Vercel. Preserve the persistent uploads volume.

Frontend: https://ocrtest-sandy.vercel.app

Backend health: https://ocrtest-production-095b.up.railway.app/api/health

## Guides

- [User guide](docs/user-guide.md)
- [System overview](docs/system-overview.md)
- [Deployment and migration](docs/deployment.md)
- [Global layout and evaluation](docs/global-layout.md)
- [Benchmark contract](docs/benchmark-pipeline.md)
- [Thai FT v2 contract](docs/thai-ft-v2.md)
- [Stage A analytics audit](docs/ux-kpi-log-audit.md)
- [Stage B acceptance and regression evidence](docs/stage-b-validation.md)
- [User-facing simplification acceptance](docs/user-facing-simplification.md)

Gateway readiness may not describe individual variants; unknown readiness does not prevent a normal request. Missing historical files require restoration or re-upload. Auto Layout drafts are page/session-local until saved. The app has no user-authentication layer; deployment access belongs to the operator's network/platform controls.
