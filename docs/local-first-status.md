# Local-first testing branch status — 2026-10-08

This feature branch is an incremental implementation, not a release or a completed migration.

## Commits and verification
- 114b9db: import application and both repository histories; audit and baseline plan.
- a8d6989: Dexie stores, separate Blob assets, upgrades, atomic binary backup/restore.
- 87447fb: configuration-only schema, separate gateway factory, protected revisioned mutations and cache, stateless legacy/global OCR.
- Current increment: route frontend personal-data access to IndexedDB; local preview worker, PDF page preparation, conditional pipeline cache, dataset ZIP support and transient calculation/analysis services.

Current checks actually run: frontend production build passed; four local database tests passed; six isolated backend tests passed; TypeScript passed; git diff --check passed. These tests do not cover every new calculation or UI adapter path.
Imported backend full-suite baseline: 217 passed, 51 failed, 5 skipped. Failures remain tracked and untriaged in part; no full regression success is claimed.

## Required before deployment or acceptance
- Browser E2E with real synthetic fixtures: image/PDF, Auto ROI/manual crop, multiple pipelines, global/field GT, History/Matrix, dataset export and backup restore in two profiles.
- Complete and verify local error analytics/recompute, pipeline enable/disable updates, PDF batch event parity and schema validation of snapshot calculations.
- Avoid hydrating all runs when paginating History; current adapter filters metadata without Blobs but still loads result JSON before slicing.
- Finish user-visible backup/restore controls, storage usage/isolation notice and administrator session-token entry.
- Test cache invalidation across workers and concurrent mutations against PostgreSQL. Current invalidation has bounded TTL staleness across processes.
- Measure representative concurrent workload and monthly transfer estimates, including warning emission. Current counters are not Neon billing measurements.
- Review npm audit findings; installation reported nine vulnerabilities.
- Verify fresh Neon database identity and isolated Railway service before migration. Local gateway deliberately requires LOCAL_DATABASE_URL and does not read production dotenv files.
- Shared schema migration command: from backend, python -m alembic -c alembic-shared.ini upgrade head. Never use legacy alembic.ini for the new configuration-only database.
- Gateway startup command: uvicorn app.local_first.main:create_app --factory --host 0.0.0.0 --port $PORT. Existing Dockerfile still points to the legacy application; deployment settings must be changed deliberately after review.
- No Vercel/Railway deployment, production cutover or merge has occurred.

## Access observations
Git push dry-run to eaddy66160167/testocrlocal succeeded using local Git authentication. GitHub connector identity jackchayapon returned 403 for collaborator-permission lookup. Vercel connector returned 403 for team eaddy. No Vercel or Railway CLI was found. Browser automation failed to initialize due to the sandbox helper; no cloud browser settings were changed.
Provided Railway project: 823dd798-f058-4e2b-b368-14e81c35a9cc.
Provided Vercel project: eaddy/testocrlocal; historical deployment ID J1f6oBsh3eCH8u4csTTYypUPZ56d. A URL is not proof of a successful deployment of this branch.

Production reference remains untouched. Do not merge this branch as a verified release.
