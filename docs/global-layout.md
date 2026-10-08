# Global Layout and canonical evaluation

This is the four-page workflow included in this release. It supersedes the 0007
single-ROI/pipeline-owned GT workflow; legacy records remain readable.

## Four-page UI

| Page | Route | Responsibility |
|---|---|---|
| Upload | `/` | Source upload/preview and PDF page selection |
| Global Layout | `/workflow/{id}/layout` | Instant Auto boxes, manual add/move/resize/delete, draft save, Confirm ROI |
| Pipelines | `/workflow/{id}/pipelines` | Locked preview, selectable pipelines, one Run OCR action |
| Ground Truth & Evaluation | `/workflow/{id}/ground-truth` | Whole/Sub GT editors, one Calculate, results and error disclosures |

The old `/workflow/{id}/evaluation` redirects to page 4; there is no duplicate
implementation. Auto Layout immediately adds every usable returned box as a draft;
there is no separate region activation list. Existing manual boxes remain. Geometry
is authoritative at confirmation. Bulk selection is for deletion, not activation.

`GlobalWorkspace` reuses `DocumentViewer`, `GlobalGroundTruthForm` and
`GlobalFieldEvaluation`. Page 4 shows a compact reference beside the editor on
desktop, stacked on mobile. Cards have Extracted Text, prominent Metrics, and
semantic Error Analysis disclosures (closed by default). Backend alignment supplies
red error spans and explicit missing-text markers; there is no frontend diff engine.

Whole/Sub toggles switch editor and result context without calculating. Unsaved GT
survives toggles. One Calculate uses backend data presence: Whole only, selected
populated Sub-fields only, or both. Neither populated yields 422. Both snapshots
persist independently; results update on the same page. Empty/unselected fields are
not fabricated as evaluated. Unsaved drafts require saving before leaving/reloading.

Stage gates prevent OCR before confirmed layout. Before OCR explicit unlock is
supported; after OCR editing creates a new case while historical runs stay intact.
History excludes upload/layout-only drafts and reopens saved results on page 4.
Legacy records remain readable. Partial pipeline failures retain successful results
and show a compact service-unavailable message.

## Identity and order

`GlobalField` is document layout, not an evaluation mode. It has a stable UUID,
source-pixel ROI, Auto/Manual source and canonical `field_index`.

Backend `global_order.reading_order` sorts seeds by top, left, bottom, right,
then UUID. A box joins the earliest row whose fixed first box overlaps vertically
by at least 50% of the shorter height. Otherwise it starts a new row. Rows remain
top-to-bottom; boxes within each row sort left-to-right with geometry/UUID ties.
Row membership does not expand transitively. This tolerates slight Y differences
without treating a document as a semantic table or newspaper column layout.

Every layout save recomputes consecutive indices; IDs remain unchanged. The UI
previews this rule, but accepts the server's saved order. A run locks the layout
before inference starts, including failed attempts. Historical order is never
recomputed during reads/evaluation. Start a new test case to change a used layout.

## Execution

Each ordered Global Field produces one deterministic lossless PNG from stored
original/page pixels. Mint, Hutch Crop, Hutch Full, Benchmark and Thai FT v2 receive
the same bytes, dimensions, ROI and hash. Hutch Full uses `app_crop`, regardless
of Auto/Manual source. Fields execute sequentially to bound memory; pipelines
within a field run concurrently with independent failures.

Each PipelineRun contains an OCRField linked explicitly to each GlobalField UUID.
Vendor polygons remain diagnostics, not Global Field identities. The app preserves
raw upstream responses and existing DET/REC perspective crop/request order.
Within a Global Field, normalized text boxes use top/left order when geometry is
available, otherwise upstream text lines. This does not change the layout order.

Routes/model parameters remain unchanged: Mint `engine=custom`, Hutch `engine=paddle`
with thresholds 1.7/0.25/0.6, Benchmark DET version 6 / REC version 5 without model
or engine, Thai FT v2 DET and REC version 6 with `model=thai_ft_v2`.

## Exactly two evaluation modes

**Whole Field** stores one GT in the case's existing raw/normalized GT columns.
`canonical_document_text` maps predictions by UUID and joins them using `\n` in
stored field order. It never uses arrival order or frontend joining. Explicit
Calculate stores each successful complete run's prediction, GT snapshot, order,
metrics, aligned spans, error events and timestamp in `document_evaluation`.
Incomplete/failed pipelines cannot get misleading document metrics.

**Sub-fields** stores one GT on each GlobalField. Users select one or more fields;
Calculate compares each with every successful latest pipeline prediction for that
UUID. OCRField evaluations hold GT snapshots/errors/timestamps. Fields without GT
remain unevaluated. Aggregates use total edits / total GT units, not mean rates.

Saving GT alone never calculates. Changing document GT clears only document
evaluations; changing Field 02 clears only Field 02 evaluations, preserving Field 01
and document results. Saving the display mode preserves both scopes and switches the
published metrics summary; browser-only toggles need no calculation request. Empty normalized GT is rejected for explicit evaluation.
Reruns produce new unevaluated predictions. Reads never recompute.

All metrics/alignment reuse the existing backend NFC/whitespace normalization and
edit-distance functions. UI displays red substitution/insertion and a missing
marker for deletion. WER remains whitespace-based, with its known Thai limitation.

## API (prefix `/api/test-cases/{id}`)

- `GET /global-fields`: complete case with saved canonical layout/evaluations.
- `PUT /global-fields`: `{fields:[{id,field_index,roi,source}],confirmed}`. Client
  indices are preview hints; server determines the final order. Maximum 50 fields.
- `PUT /global-fields/{field_id}/ground-truth`: `{ground_truth_raw}` (draft only).
- `PUT /ground-truth`: `{ground_truth_raw}` saves document GT, no implicit evaluation
  for a Global Layout case, even if the legacy `confirmed` flag is supplied.
- `PUT /evaluation-mode`: `{mode:"whole_document"|"per_field"}`.
- `POST /evaluate`: `{mode:"auto",global_field_ids:[...]}` is the combined Calculate
  request (auto is the default). Backend evaluates populated selected fields and/or
  document GT in one transaction. Explicit `whole_document` / `per_field` requests
  remain compatible. These are two stored scopes, not a third evaluation mode.
- Existing `POST /run`: `{pipelines:[...]}`, requires confirmed nonempty layout.

Legacy per-PipelineRun GT/recompute endpoints cannot mutate global evaluations.

## Persistence, History and Dataset

0008 adds only `global_fields`, case workflow/layout/mode/document-confirmation
columns, OCRField nullable mapping/status/diagnostics and PipelineRun nullable
document-evaluation JSON. The incorrect unfinished `global_subfields` design was
removed before deployment. Migrations 0001–0007 and their data remain unchanged.

History includes only cases with runs, restoring stored fields/order, both GT
scopes and evaluation snapshots. Upload/layout-only drafts are excluded.

Dataset eligibility requires confirmed layout + that field's confirmed nonempty
Sub-fields GT + available source. Whole Field GT alone creates no field labels;
there is no heuristic splitting. Existing legacy ROI samples remain supported.
Export request accepts `global_field_ids` and/or legacy `test_case_ids` (200 total).
Ordering is case UUID then canonical field index. ZIP layout:

```text
dataset/
  images/000001.png
  label.txt
```

Labels are UTF-8 `images/000001.png<TAB>confirmed raw field GT<LF>`, with existing
reversible backslash/tab/CR/newline escaping. Images come from the original through
ImageService/StorageService, not screenshots. No image binary/Base64 is stored in
PostgreSQL. Missing sources are unavailable and reject export with 409; restore or
re-upload old missing files. Never substitute OCR predictions or metrics as labels.

## Limits

Instant Auto boxes and other unsaved drafts are session-local. Saved fields persist. Geometry ordering is a documented visual-row heuristic, not semantic
document understanding. Global error snapshots are inline; legacy Error Analytics
continues to summarize its historical event table. No new environment variables,
production migration, commit, push or deployment are part of this task.
