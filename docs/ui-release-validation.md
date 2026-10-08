# UI polish release validation ? 2026-09-27

This release includes the already-reviewed four-page Global Field implementation
and existing migration 0008. This final polish adds no backend/schema changes.

- Page 3: immediate spinner and running label, disabled Run/checkboxes, dimmed
  selection area. A synchronous ref guard prevents duplicate actions. Error paths
  restore controls; success continues to the existing combined page 4.
- Page 4: bordered Whole GT card and individual Sub-field cards, padded textareas,
  visible focus rings. GT state and the single Calculate action are unchanged.
- Typecheck, ESLint and production build passed.
- Complete Playwright: **38/38 passed** (36 retained + 2 UI acceptance tests).
- Responsive 390/768/1440px checks passed without horizontal overflow.
- Backend evidence remains **157 passed**, Ruff passed. Hash comparison of all
  backend application/migration Python files against this session's baseline is
  identical; backend regression evidence remains valid.
- No migration 0009 or new environment variable.
- Production Neon pre-flight: connected, revision **0008_global_layout_evaluation**,
  no model/schema drift. No production migration is necessary or executed.
- Database backup/PITR dashboard access was unavailable; no backup is claimed.
  This release does not perform schema work.
- Existing remote main before release: `3f560931011e9c0b9b17b56e234fd35ee95b411a`.
  GitHub records successful Vercel and Railway production deployments for that SHA.
  Use normal main push and verify both new commit statuses; do not duplicate deploys.

The final production smoke and deployed SHA are reported after the normal push.
Runtime evidence, uploads, private environment files and generated ZIPs are excluded.
See [Global Layout](global-layout.md), [real gate](global-layout-release-gate.md) and
[full validation](global-layout-validation.md) for the approved domain behavior.
