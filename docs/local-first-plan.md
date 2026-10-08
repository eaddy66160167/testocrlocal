# Local-first implementation plan

## Baseline evidence (2026-10-08)
Production reference HEAD: f9765f6c3b01bca1341c1d273155ca5cd70aa488.
Testing HEAD before import: 14b286fa2153cfed30ea030693395f50ec9b55dc.
Testing contained only a one-line README, with no deployment settings or independent application changes.
The workspace root is a source export without Git. Work is isolated in testocrlocal on feature/local-first.
An unrelated-history merge preserves both histories; its sole README conflict uses the application README.
No production credentials or existing .env are imported. Production remains untouched.

Dependencies: Next.js 16, React 19, TypeScript 5.9, FastAPI, SQLAlchemy 2, Alembic, psycopg, Pillow and PDFium. Frontend uses its lockfile; backend bounded requirements require recording actual resolved versions.

## Evidence-based execution order
1. Build imported frontend; run backend tests using isolated SQLite fixtures. Commit baseline with actual outcomes.
2. Add typed IndexedDB stores separating Blobs from metadata, cases, runs, datasets and categories. Verify CRUD, schema upgrades, atomic backup restore and checksums.
3. Add a separate local-first ASGI entrypoint and Alembic lineage storing shared configuration only; reuse canonical cropping and OCR adapters. Never deploy the legacy entrypoint against new Neon.
4. Add atomic revision, TTL server cache, conditional responses and administrator authorization. Release DB sessions before upstream OCR calls.
5. Replace every frontend personal-data API with local access, preserving global layout, PDF workflows, metrics, comparison and datasets. Foundation modules alone do not prove feature parity.
6. Measure queries, bytes and latency with synthetic workloads; distinguish application estimates from Neon billing.
7. Deploy to independent testing services after regression/security gates, then verify Railway, Vercel and Neon billing evidence.

## Release gates
Legacy tests/builds are a baseline, not local-first acceptance. No incomplete phase is represented as finished. No production cutover/merge. Inspect target cloud settings and credentials before deployment; do not use the quota-exceeded database.
