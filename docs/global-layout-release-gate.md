# Four-page redesign: real-service release gate

Session: 2026-09-27. **Real acceptance passed locally. Production NOT modified.**
This supersedes the earlier five-page gate that selected only unavailable Hutch
services. The current requirement explicitly excludes Hutch availability as a blocker.

## Environment and scope

Local FastAPI/Next.js, local PostgreSQL `ocr_benchmark` at revision 0008, storage
`.runtime/real-flow-uploads`. Real private Gateway credentials stay server-side.
A generated 1200 x 700 non-sensitive document was uploaded through the browser.
No mock transport, synthetic prediction, production database access or deployment.

## Results

| Check | Result |
|---|---|
| Real Auto Layout | HTTP 200; 4 returned boxes immediately visible |
| Redundant activation controls | Absent; one Auto Layout click |
| Editing | Auto box moved/resized; Manual box added without removing Auto boxes |
| Confirm | 5 canonical fields persisted with stable UUIDs/order |
| Mint | All 5 fields succeeded through `engine=custom` |
| Benchmark | All 5 fields succeeded, DET V6 / REC V5, no model or engine override |
| Thai FT v2 | All 5 fields succeeded, DET/REC V6 + `model=thai_ft_v2` |
| Cross-pipeline mapping | Same ordered Global Field UUIDs and input hash per field |
| Hutch Crop / Full | BLOCKED - EXTERNAL PADDLE SERVICE; not retried in this session |
| Whole-only | Whole snapshots persisted; no per-field evaluation or Dataset labels |
| Sub-only | Only two populated fields evaluated; Whole snapshots cleared after GT clear |
| Whole + Sub | One Calculate request persists both scopes; no page navigation |
| Results | Extracted Text / Metrics / collapsed Error Analysis for every pipeline |
| Backend alignment | Every visible error marker matches stored span kind/count |
| Refresh and History | Confirmed GT and evaluations restored on combined page 4 |
| Responsive | 390/768/1440 widths without horizontal overflow |
| Dataset | 2 confirmed field samples exported; ZIP CRC valid |
| Source crop integrity | Both exported PNG byte streams equal canonical crops of original |
| Labels | Exact confirmed raw GT, UTF-8 Thai and reversible newline escaping |

The Manual field deliberately overlaps the amount line; Whole text consequently
includes that amount twice. This proves joining follows confirmed layout order and
does not heuristically remove duplicate content. OCR imperfections remain visible
in the stored real predictions and metric/error displays.

The live helper's first attempt stopped on an incorrect success-message locator
after real OCR and Whole evaluation had succeeded. The locator was corrected and
A/B/C resumed using the same stored predictions, without repeating inference.

## Evidence and release state

Ignored `.runtime/four-real.json` contains response/evaluation evidence;
`.runtime/four-dataset.zip` contains only synthetic crops and confirmed test GT.
Screenshots are ignored and contain no credentials. The final Dataset verification
checks ZIP entries, CRC, exact crop PNG bytes and label equality, not just HTTP 200.

No 0009 or new environment variable. `.env`, runtime helpers, uploads and ZIPs stay
ignored. All changes remain local/uncommitted for user review. Deployment requires
a separate authorization and the existing 0008 production migration pre-flight.
