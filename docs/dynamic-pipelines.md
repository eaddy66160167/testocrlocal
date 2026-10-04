# Dynamic pipelines

Open **Settings → Pipelines → เพิ่ม Pipeline**. Name the pipeline, choose Custom or Official, then select a version and weight separately for **Text Detection** and **Text Recognition**. The UI saves DET → REC pipelines without a workflow-mode dropdown. Editing an older integrated/REC-only pipeline converts it to the selected DET → REC stages only when saved; matching integrated model selections are prefilled when present in the registry.

Saved cards show the engine source and both model names/weights. The green **พร้อมใช้งาน · Gateway** badge appears only after an explicit successful Gateway check; a failed recheck clears it. This confirms Gateway connectivity, not successful model inference. Saving configuration clears the connection state.

The backend continues to support these execution types for existing configurations and API clients:

- **Integrated OCR:** Custom calls `/api/v1/ocr-results` with `engine=custom`, shared `version=5|6`, independent `det_model` and `rec_model` values (`baseline`, `thai_ft_v1`, `thai_ft_v2`). The shared version follows the provided Gateway contract. Official uses `engine=paddle` and the existing Paddle detection parameters.
- **Separate DET → REC:** choose a version and registered weight for each stage. Detection runs on the same canonical field crop used by other pipelines. Ordered detected quadrilaterals are rectified and passed to recognition in batches.
- **REC only:** send the canonical field crop directly to the selected recognition model.

The model registry stores name, source, version, weight, and single/batch API paths. Runtime inference uses the **batch path**, repeated multipart `images`, and the existing Gateway batch response contracts. Single paths are retained for reference; arbitrary single-response contracts are not inferred. Query parameters in the batch path are authoritative; the app never guesses a weight from the display name. Version/weight metadata must agree with the paths. Official baseline paths omit `model`; Custom paths include it.

Registry path edits apply to the next run of every referring pipeline. Existing run payloads retain a snapshot of the selected models/configuration. A referenced model cannot change its source or DET/REC kind. Pipelines may be renamed, reconfigured, or disabled. Existing built-in pipelines retain their adapters and settings.

All calls use the server's `MODEL_GATEWAY_BASE_URL` and `MODEL_GATEWAY_API_KEY`. Gateway health checks do not prove that every model combination is deployed; run inference to verify a selection. Initial catalog entries describe the supplied versions/weights, not live availability.

## Persistence and rollout

Migration `0010_dynamic_pipelines` adds `ocr_models` and nullable configuration columns, preserving existing pipelines and OCR results. Normal backend startup runs the migration and idempotent seed. The database must be reachable and the database role must have migration permissions. No model weights are uploaded or trained here: the Gateway must already host the selected weights.

API: `GET/POST /api/pipelines/models`, `PUT /api/pipelines/models/{id}`, `POST /api/pipelines`, and `PUT /api/pipelines/{id}/definition`. Existing pipeline listing/get and benchmark run APIs include the new pipelines.

Validation covers real request construction using mocked Gateway responses, model edits and historical snapshots, invalid source/stage combinations, path validation, built-in regression tests, and migration upgrade/downgrade preservation. Browser tests in `frontend/tests/dynamic-pipelines.spec.ts` mock the backend and exercise creation, edits, model registration, and independent stage selection at desktop/tablet widths. Live Neon and model inference are separate deployment checks.
