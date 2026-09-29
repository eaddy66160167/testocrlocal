# User guide

## Upload and document type

Select a type before uploading an image/PDF. Use the compact add action for a custom name and Manage Types to archive a custom type after confirmation. System defaults are protected. Archived types remain readable on historical documents. Untyped records show an unspecified type. The type follows the document through all four pages; it is not selected again on later pages.

## Global Layout

For PDFs choose the intended page. Use Auto Layout or add manual boxes. Move/resize boxes within source bounds, remove unwanted boxes, then confirm. All selected pipelines use the same stored Global Field identities and backend crops. After OCR, create a new case if you need a different layout.

## Pipelines

Select one or more enabled pipelines and run OCR. Controls lock while running. Hutch fine tune v2 recognizes each field directly; Thai FT v2 is a separate detection-plus-recognition pipeline. Failures remain visible without discarding successful predictions.

## Ground Truth and metrics

Sub-fields share one correct text across pipelines. Whole Field evaluates the ordered document prediction. Enter either or both and calculate. Inspect CER (character errors), WER (whitespace-token errors), Exact Match, confidence, and the expandable substitution/insertion/deletion analysis. A lower CER/WER is better. Confidence is an upstream prediction score, not proof of correctness. Changing GT requires recalculation.

## History

Reopen saved results, layout and evaluation. One selected successful pipeline plus completed evaluation is sufficient for success. A selected pipeline failure gives partial/error status according to the actual results, not the number of available models.

## Dataset Builder

Recently evaluated/updated eligible samples appear first. Filter by document type or existing filters, choose available confirmed samples and export ZIP. Images come from original source crops; labels come only from confirmed GT. Removing a sample requires confirmation and excludes it from future exports. It does not delete its document, OCR, metrics or GT. Missing source files must be restored or re-uploaded; the app never fabricates replacements.

## System Logs

Search parts of filenames, pipeline names (for example `hutch` or `fine`), event/action text and Thai/English words. Searches ignore case; multiple words must each match. Use level/pipeline/date filters to narrow results. Logs do not store raw OCR/GT or uploaded content.
