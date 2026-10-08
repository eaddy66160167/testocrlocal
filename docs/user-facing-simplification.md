# User-facing simplification acceptance

Starting baseline: `eb5df80ff37077edd125a5b647112848da88764a`.

History shows records and business document types. Comparison retains overall
KPIs and latest case/Pipeline comparisons. Analysis groups only by business
document type, retaining its five-distinct-evaluated-case ranking threshold.
Dataset retains confirmed-GT/source-crop eligibility, unavailable-source states
and ZIP format. Category controls/columns and manual Document UUID controls are
removed from these pages. Legacy `category`/`document` URL parameters are ignored
before API requests and removed from the URL.

History/Comparison/Analysis share only `document_type_id`, `pipeline`,
`date_from`, and `date_to`. Dataset remains independently filtered by business
type. System Logs is absent from normal navigation and History/Comparison
links; `/logs`, its API and AppLog storage remain. This adds no access control.

Backend category data, document identifiers, logs, metrics, Dataset export,
OCR execution and all protected workflows are unchanged. No migration,
environment variable or deployment configuration change is required.

## Local evidence

- 35 current backend analytics/history/KPI/dynamic-pipeline/batch/GT regression
  tests passed, including PostgreSQL migration preservation.
- Three additional Dataset export/escaping/eligibility/source/PDF tests passed.
- 31 affected navigation/analytics/console/dynamic/Global/GT Playwright tests
  passed. Analytics assertions reran successfully after adding a valid preview
  image fixture. A separate real-local Dataset stale-source recovery and ZIP
  download browser test passed.
- Typecheck, ESLint, production build and scoped Ruff passed.
- Local PostgreSQL Alembic upgrade/check passed at `0010_dynamic_pipelines`;
  no schema drift, no `0011`.
- Desktop four-page and mobile Comparison/Analysis screenshots reviewed using
  synthetic fixtures; no screenshot or local helper is included in the commit.
- Secret scan, ignored/untracked `.env`, protected-file comparison and diff
  whitespace check passed.

This is scoped validation, not a claim that the entire historical test suite
passes. Additional legacy tests in `test_error_analysis_dataset.py` and
`test_global_layout.py` still assume seeded static pipeline IDs and fail with
`Pipeline not found` in the existing dynamic-config baseline. A broader Ruff
invocation found two existing import-order issues in protected
`test_global_batch.py`. These files and backend behavior are not changed by
this frontend-only task. Older static-pipeline browser suites also require a
separate fixture modernization; their Document UUID expectations are obsolete.

Production acceptance is checked after auto-deployment using GET/SELECT only:
no upload, OCR, GT edits, configuration edits or database mutation.
