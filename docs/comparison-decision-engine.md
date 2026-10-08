# Comparison Decision Engine

เอกสารนี้อธิบาย implementation ของ `/matrix` และ `GET /api/analytics/comparison` สำหรับผู้พัฒนา ส่วนคู่มือใช้งานหลักอยู่ใน [README](../README.md)

## Source และ eligibility

`MatrixService.decision()` โหลด TestCases/runs/fields/metrics ตาม BenchmarkFilters ผ่าน BenchmarkRepository แล้ว reuse `latest()` และ `evaluation()` เดิม ไม่สร้าง eligibility อีกชุด

- Latest eligible: หนึ่ง run ต่อ TestCase × Pipeline โดย created_at/ID; run archived ไม่ใช้ และตัด Hutch Full legacy input ที่ไม่ตรงกติกาเดิม
- ต้อง run success และมี final Metric CER
- Legacy: case confirmed และ GT ไม่ว่างหลัง normalization
- Global whole_document: GT ยืนยัน, document evaluation และผลสำเร็จครบ Global layout
- Global per_field: confirmed OCRField evaluations ที่เข้าเกณฑ์ subset เดิมและ GT ไม่ว่าง

ไม่เลือกผลดีที่สุดจากหลาย runs และไม่ใช้ GT draft ผลที่มี CER แต่ไม่ผ่าน evaluation eligibility ไม่เข้าสถิติ

## Pair cohort และสูตร

ให้ `C_AB` เป็น intersection ของ TestCases ที่ทั้ง A และ B มี latest eligible evaluated result และ `C_d` เป็นสมาชิกใน Document d ภายใน intersection นั้น

```text
CER_A,d = mean(CER_A,c for c in C_d)
CER_B,d = mean(CER_B,c for c in C_d)
dCER_d(pp) = 100 × (CER_A,d − CER_B,d)
headline dCER(pp) = mean(dCER_d for distinct Documents)
```

ไม่ถ่วงด้วยจำนวนหน้า จำนวน Field หรือความยาว GT Document เดียวมีหลาย cases ยังเป็น statistical sample เดียว ขนาด cohort แสดงทั้ง cases และ Documents; headline CER A/B ใช้ document means ของ paired cohort เดียวกัน

`PAIR_TIE_PP=0.05`: `abs(dCER_d)<0.05` เสมอ, `dCER_d<=−0.05` A ชนะ, `dCER_d>=0.05` B ชนะ ผล W/T/L รวมเท่าจำนวน Documents ของคู่

`MIN_PAIR_DOCS=5`: น้อยกว่านั้น verdict insufficient, CI/winner เป็น null

## Bootstrap และ verdict

สร้าง compact array ของ dCER ตาม sorted Document IDs ใช้ `Random(20261006)` สุ่มแบบคืนตัวอย่างจำนวน Documents เท่าขนาดเดิม 2,000 ครั้ง คำนวณ mean ของแต่ละ draw แล้วหา percentile 2.5/97.5 ด้วย linear interpolation (`position=(N−1)q`)

- CI upper < 0: A winner
- CI lower > 0: B winner
- อื่น ๆ รวมการแตะศูนย์: inconclusive

สุ่ม Documents ไม่สุ่ม PDF pages/Fields ไม่เรียก DB ใน loop ค่าเดิมและ cohort เดิมได้ CI เดิม Threshold tie ใช้สำหรับ W/T/L; clear verdict ใช้ CI ไม่ใช้เปอร์เซ็นต์การชนะเป็นเกณฑ์เสริม

## Ranking และ recommendation

Active = PipelineConfig ที่ enabled ใน scope ปัจจุบัน คู่ active เท่านั้นให้คะแนน clear win +1 / clear loss −1 / insufficient/inconclusive 0

เรียง score มากก่อน จากนั้น mean dCER ของคู่ที่มีอย่างน้อย 5 Documents (แปลง sign ให้สัมพันธ์กับ Pipeline นั้น) ต่ำก่อน ตามด้วยชื่อ/ID เพื่อความคงที่

Featured pair = อันดับหนึ่งและสอง หากมี active อย่างน้อยสองตัว Recommendation ต้องครบ:

1. อันดับหนึ่ง score สูงกว่าทุกตัวอย่างเคร่งครัด
2. ไม่มี clear loss แก่ active คู่ใด
3. Featured pair เป็น clear win ของอันดับหนึ่ง

Numerical leader ไม่เท่ากับ recommendation Archived/disabled identities แสดงย้อนหลังได้เมื่อ `include_archived=1` แต่ไม่เพิ่มคู่ current/ranking/featured/readiness/recommendation การเปิดย้อนหลังจึงไม่เปลี่ยนคำตอบปัจจุบัน

## Readiness และ actions

Readiness ใช้คู่ featured: X cases ที่ทั้งคู่มี points / Y scoped cases / D distinct Documents ของ X ส่วนที่เหลือเข้าหนึ่งเหตุผลตาม precedence:

GT ไม่ยืนยัน → ไม่มี run ของคู่ → latest eligible run ไม่ success → มี run แต่ evaluation ไม่เข้าเกณฑ์อื่น ผลรวม reasons = Y−X ถ้าไม่มีคู่ แสดง reason แทนตัวเลข readiness ที่ทำให้เข้าใจผิด

Actions แยกจากเหตุผล readiness: จำนวน case ขาด GT, Pipeline ที่ยังไม่รันเมื่อ active อื่นเคยรัน, latest failed runs, ประเภทที่ evaluated Documents ยังไม่ถึง 5 พร้อมจำนวนที่ต้องเพิ่ม, top 5 case spread และ hardest best CER ลิงก์เป็น `/test/{id}` จริง การเติม Document ให้ถึง 5 อย่างเดียวไม่รับรองว่า paired cohort จะครบ

## Scatter และประเภทเอกสาร

Scatter ใช้ common intersection ของ **ทุก active Pipeline** เมื่อมีอย่างน้อยสอง active และ common cohort >=5 Documents มิฉะนั้นใช้ own cohorts พร้อม warning และไม่มี Pareto Frontier คำนวณจาก CER ต่ำ/เวลาเฉลี่ยต่ำบน common cohort เท่านั้น ถ้าขาด timing ของ active ใดไม่แสดง frontier

ค่า CER = unweighted document means; เวลา = mean processing_time_ms ของ evaluated runs ที่มีค่า/1000 จุดทึบต้อง evaluated Documents>=5 และ timed runs>=5 Archived points ไม่อยู่ frontier

By-type cell เป็น own-cohort descriptive CER+n ไม่ใช้ minimum cell CER เป็น recommendation แต่เรียก paired engine เดียวกันในแต่ละประเภท แถว `all` reuse overall ทั้ง object แถวประเภท mutually exclusive รวม Documents เท่ากับ overall เก็บ referenced archived types และ null type (`unassigned`/ไม่ระบุประเภท) ไม่ทิ้ง

## Endpoint contract

```text
GET /api/analytics/comparison
  ?document_type_id=…&pipeline=…&date_from=…&date_to=…
  &include_archived=0|1
```

Dates filter TestCase.created_at ตาม repository เดิม `view=overall|by-type` เป็น UI state ไม่ใช่ API filter ไม่ใช้ category/document UUID เป็น normal-user comparison scope

| Field | ความหมาย |
|---|---|
| `scope`, `include_archived`, `pipelines` | effective scope/identities ที่แสดง |
| `overall.recommendation`, `ranking`, `featured_pair` | current active-only decision |
| `overall.pairs`, `historical_pairs` | current pair evidence / retrospective pairs แยกกัน |
| `overall.readiness` | X/Y/D + mutually exclusive reasons + valid_pair/reason |
| `overall.scatter` | points, own/common mode, common sizes, pareto_valid |
| `overall.cells` | descriptive CER/Documents/time/timed runs |
| `by_type` | all row และประเภทที่มีข้อมูลใน scope พร้อม decision |
| `actions` | counts และ existing-case links |
| `latest_results` | continuity count ก่อน evaluation filtering |
| `minimum_documents`, `tie_pp`, `bootstrap_samples`, `statistical_unit` | constants/หน่วยที่ client ต้องสื่อสาร |
| `computation_ms` | เวลา server ประมวลผลรวม preload |

Pair มี `a,b,documents,test_cases,mean_cer_a,mean_cer_b,mean_dcer_pp,ci95_pp,wins,ties,losses,winner,verdict` ไม่มี upstream OCR payload เพิ่มเพื่อใช้ decision

## Performance และ validation

Preload ORM relationships ครั้งเดียว สร้าง arrays/maps ใน memory แล้ว bootstrap ไม่มี query ต่อ draw ไม่มี Redis/background/materialized cache ประสิทธิภาพขึ้นกับจำนวนคู่ ประเภทและ Documents จึงต้องวัดกับขนาดข้อมูลจริง; เป้าหมายประมาณ 3 วินาทีบน Production-size data ไม่ใช่ SLA สำหรับทุกขนาด

Tests ตรวจ intersection, document weighting/PDF replication, tie/CI boundaries, deterministic bootstrap, recommendation conditions, archive invariance, reason accounting, Pareto guard, type totals/archived type และ reuse eligibility/API scope

Release preflight: SELECT read-only revision, independent latest-result N เทียบ old Matrix M, numeric cohort audit ก่อน implement ก่อน push ตรวจ origin/schema อีกครั้ง หลัง deployใช้ GET/SELECT เท่านั้น Snapshot ของ release audit อยู่ใน [Comparison redesign audit](comparison-redesign-audit.md) ตัวเลขใน audit ไม่ใช่ค่าคงที่ของระบบ

Read-only verification ไม่เรียก run/evaluate/upload/config endpoints ไม่มี migration ใหม่จาก decision engine และไม่ใช้ผล mock แทน production evidence
