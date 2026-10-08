# Local-First repair verification — 2026-10-08

## Scope and baseline

Testing repository only: `eaddy66160167/testocrlocal`. Repair branch: `fix/local-first-e2e-network-hardening`, based on fetched `origin/main` `e037df6`. Production reference remains untouched. Existing uncommitted local-data settings work was preserved and verified in this branch.

## Confirmed causes and fixes

| Issue | Evidence | Repair |
|---|---|---|
| Prepare 404 | Live health has legacy database/storage contract; live OpenAPI contains personal persistence endpoints but no `/api/ocr/prepare`; GET prepare = 404 | Testing Dockerfile now starts `app.local_first.main:create_app --factory`; health publishes contract/revision; shared migration files included |
| Conditional GET preflight | Live OPTIONS pipelines asking for `if-none-match` = 400; allowed headers omit it | Local-First CORS explicitly allows If-None-Match, Content-Type and Authorization |
| Error CORS gaps | Limits middleware wrapped inner CORS, and unhandled exceptions pass through outer ServerErrorMiddleware | Entire application now wrapped with CORS, including error and rate-limit responses |
| Shared migration initialization | Running Alembic failed reading INI because of UTF-8 BOM | Removed BOM; automated fresh and repeat upgrade test passes |
| Partial API compatibility | Frontend toggle called PUT `/pipelines/{id}` without backend route; Error Analytics/recompute unsupported | Added validated toggle/read route, transient shared error aggregation and recompute |
| Cache mutation race | In-flight old response could repopulate client cache after mutation | Generation tracking discards outdated writes and reloads current configuration |
| Heavy local History/Dataset reads | History hydrated every run before slicing; Dataset hydrated runs unnecessarily | Filter/page History before hydration; Dataset uses metadata plus indexed pipeline existence checks |

Cloud startup overrides, active Docker image SHA, Vercel root/settings and deployed bundle environment have **not** been authenticated and inspected. The checked-in legacy entrypoint matches the observed live contract, but it alone cannot establish the cloud configuration. No cloud changes or Neon migrations have been performed.

## Actual verification

- Focused backend: **22 passed**, one Starlette deprecation warning.
- Full backend after load fixture correction: **239 passed, 51 failed, 5 skipped** in 45.13 seconds; retained output in `backend-full-test-results.txt`. These 51 failing tests were also reported in the imported baseline. Numerous assertions target removed fixed Pipeline IDs/adapters and legacy persistence/logging; they still need deliberate migration/triage and cannot be dismissed as verified parity.
- Frontend local unit tests: **5 passed** (Blobs, reopen/isolation, schema upgrade, checksummed backup/conflicts, repeated runs/deletion, cache dedup/304/invalidation).
- TypeScript, ESLint, Next.js 16.4.0 production build: passed.
- Playwright Edge, two actual browser scenarios: **2 passed** in 21.2 seconds. Scenario one covers image upload, three automatic + one manual ROI, two pipelines, GT/evaluation/refresh, History, 100 History navigations with **0 SQL queries**, Matrix, Dataset ZIP download, backup/restore, clean context isolation and shared Pipeline definitions. Scenario two covers two-page PDF upload, page selection/render and refresh persistence.
- Synthetic Gateway fixtures only; browser E2E does not establish real model/deployed behavior. Existing legacy browser suite remains separate and unported.
- Shared schema initialization and second upgrade passed on disposable SQLite. No PostgreSQL integration or real Neon connection tested.
- Compatible dependency fixes applied: runtime npm audit **0 vulnerabilities**; **5 high development dependency findings** remain in lint's braces dependency chain. No forced downgrade was applied.

## Measured network behavior

`local-first-load-results.json` records 100 synthetic OCR runs at each concurrency 1, 5 and 10, **300 total**, with 0 errors, 0 SQL queries and 0 new database connections during each warmed workload. Load fixture explicitly allows 10 OCR requests concurrently; default deployment capacity is 2 and can reject excess requests with 429. Measurements use in-process TestClient + SQLite + mocked HTTP Gateway, not deployed HTTP latency or Neon traffic.

100 cached Pipeline reads also use 0 SQL queries. An expired unchanged server cache performs 1 revision SELECT. A second independent cache refresh observes the mutation and matching revision. PostgreSQL locking/multi-process deployment is not integration-tested.

Added query duration, actual API Content-Length byte totals, bounded endpoint counters, per-operation SQL attribution (avoids counting concurrent mutations as OCR SQL), cache counters, and lower-bound serialized configuration estimates. Protected metrics report configurable 250/400/500 MB projected thresholds. Projection uses observed uptime and a 30-day linear extrapolation, so short samples are noisy. Estimates exclude pool pre-ping, protocol/TLS, mutations and other DB overhead; no automatic configuration write is dropped. Authoritative transfer and the <=500 MB monthly target remain unverified until Neon usage can be inspected.

Browser configuration TTL and backend TTL are each 60 seconds; cross-instance changes can take approximately 120 seconds to appear in a previously cached browser. Same-instance mutations invalidate the server and initiating browser cache immediately. No background polling added.

## Access and release status

- Vercel connector: **403 forbidden** for team `eaddy`; no authenticated local Vercel CLI available.
- No Railway connector/CLI credentials available; service/project settings and logs not inspected.
- Workspace `.env` contains legacy unprefixed names only. Values were not printed, copied or assumed to identify `ocrtest2`. Local-First requires explicit `LOCAL_DATABASE_URL` and independent testing Gateway variables.
- No test production promotion, production repository modification, database cutover or merge performed.
- Deployment guide now targets only the testing resources and documents exact settings, pre-deploy migration, smoke checks and rollback.

## Remaining acceptance work

Resolve/port the 51 legacy test failures and remaining original browser tests, strengthen nested snapshot and backup runtime schema validation, expand timeout/failure/quota/large-PDF regressions, verify pipeline updates under concurrent PostgreSQL workers, and measure real Neon usage. Inspect authenticated Railway/Vercel settings and a verified `ocrtest2` connection before staged test deployment. Run the full workflow against deployed test URLs and limited real Gateway smoke before approval for promotion. Full acceptance is **not complete**.
