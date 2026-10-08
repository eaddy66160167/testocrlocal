# Database network transfer audit

## Scope and evidence
Source inspection of imported production f9765f6, 2026-10-08. Historical 6.37 GB transfer / 45.58 MB storage are user-reported. No authoritative historical query logs or Neon dashboard were available. The traffic source is not proven.

## Confirmed source findings
- db/models.py: documents contains storage keys and SHA, not binary columns. storage_service.py writes uploads to local files. Do not blame stored image binaries for Neon transfer.
- TestCase relationships use selectin loading for document, categories, runs and global fields. PipelineRun loads fields and metrics. Reading cases hydrates a multi-query graph; not a literal SELECT * in source, but ORM selects mapped columns unless deferred.
- repositories/benchmark_repository.py cases() defers raw_response/boxes and field diagnostics only for analytics=True. History includes those columns and its serializer returns all unarchived runs and fields, increasing row/response bytes.
- services/matrix_service.py matrix, summary and group functions call cases(filters, analytics=True) without limits. Python aggregation scans matching case/run graphs; dashboard size scales with historical workload.
- services/test_case_service.py writes predictions/GT/metrics and reads case/config on each run. GlobalLayoutService also persists field-level predictions. Ordinary execution depends on PostgreSQL.
- services/dynamic_pipeline_service.py and pipeline routes use DB sessions for every configuration read. There is no shared version/TTL cache.
- main.py lifespan performs migrate and seed on each process startup; not on every API request. database.py has pre-ping and no explicit production pool/overflow sizes.
- frontend/lib/api.ts uses fetch cache=no-store. Matrix page registers a focus listener and refreshes when focus returns. History requests 21 rows; dataset requests 50. Pagination already exists for those endpoints.
- ModelGatewayClient source has no automatic retry loop. No constant polling was found in the inspected frontend routes/components. React development duplicate effects are a possibility, not a measured production cause.
- Existing lean provenance reduces raw responses and disables DB log persistence; the legacy schema alone is not proof that runtime events are written.

## Suspected causes, not proven
Repeated navigation/focus reads, unbounded analytics, select-in graph hydration, worker startup/connection churn and stale deployment versions may contribute. Attribution requires actual request/query counts and billing-period measurements. Storage volume cannot establish transfer origin.

## Remediation and measurement gates
Separate binary assets from local metadata. Persist runs/GT/datasets only in IndexedDB. Expose a new gateway entrypoint that cannot register legacy document/history routes. Maintain only shared configuration in a separate Alembic lineage. Bound pools, release sessions before upstream calls, use revision+TTL caching and conditional requests. Instrument aggregate query counts/cache hits without SQL values or document logs. Compare 100 synthetic runs and repeated navigation before claiming improvement. Monthly 500 MB is a target, not a measured guarantee.

## Runtime evidence
Baseline SQLite test suite and frontend build ran; see local-first-baseline.md. Historical PostgreSQL wire bytes, connection churn, deployed request frequency and Neon billing were not measured. Runtime test evidence added in later phases must distinguish application counters from authoritative billing.
