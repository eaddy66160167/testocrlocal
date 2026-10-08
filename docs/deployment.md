# Isolated Local-First deployment

This guide applies ONLY to `eaddy66160167/testocrlocal`, Railway project `823dd798-f058-4e2b-b368-14e81c35a9cc`, and Neon `ocrtest2`. Do not deploy or migrate `jackchayapon/ocrtest`. The inherited legacy deployment guide has been replaced because it pointed at production and the legacy migration lineage.

## Verified diagnosis (2026-10-08)

The test Railway URL currently serves the legacy API contract: health describes database and upload storage, OpenAPI lists `/api/documents` but no `/api/ocr/prepare`, and GET prepare returns 404. GET pipelines succeeds with the intended origin; OPTIONS requesting `if-none-match` returns 400 and does not list that header. POST upload preflight returns 200, which does not prove the upload route exists.

The checked-in Dockerfile starts `app.main:app`. The repaired image starts the Local-First factory. Cloud service startup overrides/image SHA have not been inspected because authenticated Railway access is unavailable. A prior reported `mode: local-first` response does not establish the current deployed version.

## Railway settings to review and apply

- Repository: `eaddy66160167/testocrlocal`; use a reviewed repair commit after gates pass and approval for promotion is available.
- Service root: `/backend`; Dockerfile: `Dockerfile`, context: `backend`.
- Config file: `/backend/railway.toml` (paths inside it are relative to the service root).
- Pre-deploy: `python -m alembic -c alembic-shared.ini upgrade head`.
- Startup: `sh -c 'exec python -m uvicorn app.local_first.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000} --no-access-log'`.
- Remove any old `app.main:app` startup override. Health path: `/api/health`.
- Single worker initially. Additional processes maintain independent caches and observe other instances' updates on their next TTL expiry; configuration changes and revision updates commit atomically.
- No uploaded-document volume is needed. Do not copy legacy storage or production variables.

Secure environment names (values entered only in Railway):

| Name | Setting |
|---|---|
| `LOCAL_DATABASE_URL` | Fresh verified Neon **ocrtest2** PostgreSQL connection; never the old quota-exceeded database |
| `LOCAL_MODEL_GATEWAY_BASE_URL` | Testing Gateway URL |
| `LOCAL_MODEL_GATEWAY_API_KEY` | Independent testing credential |
| `LOCAL_CORS_ORIGINS` | `https://testocrlocal.vercel.app` plus explicitly reviewed preview origins if needed |
| `LOCAL_PIPELINE_MUTATIONS_PUBLIC` | `true`, intentionally required by the user |
| `LOCAL_ADMIN_TOKEN` | Optional random credential for operational metrics only; normal Pipeline CRUD does not use it |
| `LOCAL_CACHE_TTL_SECONDS` | `60` |
| `LOCAL_POOL_SIZE`, `LOCAL_POOL_OVERFLOW` | `2`, `1` |
| `LOCAL_OCR_CONCURRENCY` | `2` default; controlled load test uses `10` explicitly |
| `LOCAL_REQUESTS_PER_MINUTE` | `60` default; size for actual testing workload within configured maximum `1000` |
| `LOCAL_TRANSFER_WARNING_MB` | `250,400,500` |

Resource settings also use `LOCAL_`: `MAX_UPLOAD_MB`, `MAX_IMAGE_PIXELS`, `MAX_IMAGE_DIMENSION`, `MAX_PDF_PAGES`, `PDF_RENDER_DPI`, `MODEL_GATEWAY_TIMEOUT_SECONDS`, `MODEL_GATEWAY_MAX_RESPONSE_MB`.

Legacy unprefixed variables in the workspace `.env` are deliberately ignored. Do not simply copy their values into LOCAL variables: database and Gateway credentials must first be verified as independent testing resources.

Run only `alembic-shared.ini`, never `alembic.ini`. Fresh migration creates `ocr_models`, `pipeline_configs`, `config_revision`, and `alembic_version_shared`. No personal benchmark schema. A pre-existing incompatible schema intentionally causes migration failure; do not drop or stamp around this error. Stop release and inspect the test database. SQLite fresh and repeated upgrades are automated; PostgreSQL provisioning still needs a verified test connection.

## Vercel

Project/team: `eaddy/testocrlocal`. Root: `frontend`; Next.js; install `npm ci`; build `npm run build`; default Next output. Set `NEXT_PUBLIC_API_BASE_URL=https://testocrlocal-production.up.railway.app` with **no `/api` suffix** in each intended environment, then rebuild. It is embedded at build time. Do not put any database/Gateway secrets into Vercel public variables.

Current Vercel connector inspection returns **403 forbidden for team eaddy**. No authenticated CLI is installed. Project settings or deployed build variables have not been verified or changed.

## Gates and smoke tests

Focused local tests: `python -m pytest tests/test_local_first.py tests/test_local_cors.py tests/test_local_calculations.py tests/test_local_load.py tests/test_local_migrations.py -q` from backend. Frontend: `npm run test:local`, `npm run typecheck`, `npm run lint`, `npm run build`.

For synthetic browser E2E: start `python -m uvicorn tests.local_e2e_server:app --host 127.0.0.1 --port 8100 --no-access-log` from backend with test dependencies installed; start frontend with `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8100` and `npm run dev -- --port 3100`; set `E2E_BASE_URL=http://127.0.0.1:3100`, run `npx playwright test tests/local-first.spec.ts`. The fixture never calls real Gateway services and uses disposable SQLite. Do not deploy it.

After a staged deploy:

1. GET health must show `mode: local-first`, `api_contract: local-first-v2`, intended deployment revision and public mutations enabled.
2. Inspect OpenAPI for **all six** `/api/ocr/{prepare,execute,crop,auto-rois,calculate,analyze}` routes. GET prepare must return 405.
3. OPTIONS pipelines with origin `https://testocrlocal.vercel.app`, method GET, request header `if-none-match` must return 200 and allow that header, without redirect. Test POST with `content-type` too.
4. GET pipelines then GET with returned ETag must return 304. Test public create/edit/delete using a uniquely named synthetic Pipeline and delete only the newly created record.
5. POST prepare with synthetic image and two-page PDF; check image headers, PNG bytes, selected-page dimensions and absence of personal tables.
6. Real browser: upload/preview, auto/manual ROI, multi-pipeline OCR, GT/metrics, refresh, History/Matrix/Dataset ZIP, backup/restore, clean profile isolation, shared configuration.
7. Run only a small approved real Gateway smoke; do not use real paid OCR for the load test.
8. Read protected `/api/admin/metrics` securely and compare with Neon usage dashboard. Record authoritative transfer separately from application estimates.

Public Pipeline access means any visitor can alter or delete shared definitions. Validation, rate and size limits reduce abuse but do not restrict ownership. Gateway secrets stay server-side.

## Rollback

Keep the last verified **Local-First-compatible** frontend/backend release IDs. Roll both back together if contracts differ; never roll the frontend onto a legacy persistence backend. Preserve IndexedDB/site origin and existing configuration schema; do not downgrade/drop the shared database or clear browser storage. If there is no previously verified compatible release, stop promotion and keep the staged repair under review. No production cutover is authorized.
