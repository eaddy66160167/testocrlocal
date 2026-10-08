# System overview

## Components

Next.js presents the four-page workflow, source previews and canvas transforms. FastAPI validates inputs, creates canonical crops, calls the shared Model Gateway, persists results and computes evaluation. Neon PostgreSQL stores entities and JSON diagnostics. StorageService stores source images/PDFs; crops remain in memory. Browser-generated screenshots are never benchmark/dataset inputs.

## Data and identities

Documents retain their image/PDF format and optional `document_type_id`. `document_types` stores display/normalized names and active/system flags. Archiving does not remove references. Old documents remain valid with a null type.

A Global Field belongs to a test case and has a stable UUID, source ROI and confirmed shared GT. Each PipelineRun contains predictions associated with those UUIDs. Whole Field text follows canonical field order. Field metrics use total edits/GT units; normalization and alignment remain backend-owned.

## Pipelines

Six registry adapters share Gateway URL/key and canonical crop preparation. Mint uses custom OCR; Hutch Crop/Full use Paddle; Benchmark uses DET6/REC5 without model; Thai FT v2 uses DET6/REC6 with model=thai_ft_v2; Hutch fine tune v2 uses only REC5 with model=thai_ft_v2. Both recognition batch adapters reuse the verified parser, preserving order and raw upstream metadata. Individual request errors are isolated.

## Dataset

Eligibility requires confirmed GT and valid ROI/layout. Dataset labels never derive from OCR predictions or metrics. `dataset_excluded_at` on GlobalField/legacy TestCase is a durable opt-out; export checks it too. Listing sorts latest confirmed/update time first. ZIP naming/label escaping remain deterministic and independent of browsing order. Source availability is checked again at export.

## API additions

- GET/POST `/api/document-types`; DELETE `/api/document-types/{id}` archives custom types.
- POST `/api/documents` accepts optional multipart `document_type_id`; PUT `/api/documents/{id}/type` changes the current selection without re-uploading.
- GET `/api/dataset/samples` accepts optional `document_type` filter.
- DELETE `/api/dataset/items/{id}?kind=field|case` excludes a sample only.
- GET `/api/logs?q=...` searches joined document/pipeline names and log fields with escaped case-insensitive substrings; pagination/counting happen after filtering.
- Test case serialization includes `history_status`, derived from actual selected runs and evaluation.

## Compatibility

Migration `0009_document_types_dataset` is additive. It adds one table, a nullable document FK and two nullable exclusion timestamps. It does not rewrite historical OCR, GT, images, pipelines or migration history. SQLite remains only an isolated-test option; production uses PostgreSQL.
