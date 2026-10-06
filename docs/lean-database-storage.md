# Lean database storage

## ขอบเขต

Production เริ่มจาก PostgreSQL ใหม่โดยตั้งใจ ไม่ย้ายข้อมูลจาก Neon เก่า และไม่สร้างเอกสาร/ชุดทดสอบ/ผล OCR สมมติ ข้อมูลจริงเริ่มเมื่อผู้ใช้สร้าง Pipeline ใน Settings และทดสอบด้วยตนเอง Catalog สามารถมี OCRModel, DocumentType และ Category ได้; PipelineConfig ว่างเป็นสถานะที่ถูกต้อง

Schema ยังคง `0010_dynamic_pipelines` ไม่ลบตารางหรือคอลัมน์เพื่อประหยัดพื้นที่ และไม่สร้าง migration ใหม่

## สิ่งที่เก็บและสิ่งที่คำนวณเมื่อร้องขอ

- เก็บ OCR `final_text`, `OCRField.ocr_text`, GT ที่ยืนยัน, geometry, metrics และ timing/tracing ที่จำเป็น
- เมื่อ raw/final text เหมือนกัน เก็บ raw_text เป็น NULL; serializer ใช้ final_text เป็น fallback ส่วนผลที่ต่างกันยังเก็บทั้งคู่
- ไม่เก็บ Gateway response เต็มใน PipelineRun; อนุญาตเฉพาะ model identity จาก composition แบบ allowlist ขนาดเล็ก โดยไม่เก็บ payload, model paths, text arrays หรือ envelopes
- Global parent ไม่ซ้อน response ของทุก field; diagnostics ไม่มี raw_response, raw_text และ reading_lines ที่ซ้ำกับ OCRField.ocr_text
- Evaluation JSON เก็บตัวเลข CER/WER/Exact, edit totals, GT unit counts, mode/field IDs/time เท่านั้น
- Detail API และ Check สร้าง spans/events จาก OCR + GT ด้วย normalization/Levenshtein เดิม; History, Dataset และ Comparison ไม่สร้าง alignment
- Error Analysis aggregate คำนวณเมื่อร้องขอ โดยใช้ผลล่าสุดที่มีสิทธิ์ประเมิน; ไม่สร้าง OCRErrorEvent rows ใหม่
- LogService ไม่เขียน AppLog; `/api/logs` คืน `{enabled:false,total:0,items:[]}` โดยไม่ query ตาราง การล้มเหลวส่ง Python runtime ERROR เฉพาะ event/code/safe IDs/duration ไม่ส่ง OCR, GT, filenames, payload หรือ secrets
- ตาราง AppLog/OCRErrorEvent และ compatibility route/model ยังคงอยู่

## หลักฐานขนาดจาก synthetic fixture

ใช้ข้อความไทยสมมติ 20 บรรทัด พร้อมหนึ่ง Global field, parent result และ final Metric ขนาดด้านล่างคือ UTF-8 JSON แบบ compact ไม่ใช่ PostgreSQL heap/index/TOAST measurement หรือการคาดการณ์ขนาดเอกสารจริง

| รายการ | รูปแบบเก่า | รูปแบบใหม่ |
|---|---:|---:|
| Rows: Document, TestCase, GlobalField, PipelineRun, OCRField, Metric รวม routine AppLog 2 events | 8 | 6 |
| Parent raw_response / compact provenance | 1,384 bytes | 136 bytes |
| Evaluation JSON | 8,293 bytes | 129 bytes |
| OCRField diagnostics | 2,127 bytes | 58 bytes |
| Persisted JSON รวมสามส่วน | 11,804 bytes | 323 bytes |
| AppLog rows | 2 | 0 |
| OCRErrorEvent rows สำหรับ Global fixture นี้ | 0 | 0 |

ทดสอบข้อความเดียวกันใน **legacy evaluation** แยกต่างหาก: แบบเก่าจะสร้าง error rows สำหรับ raw/final รวม 80 rows; แบบใหม่เป็น 0 โดย metrics/error analysis ยังสร้างผลจากข้อความเดิม นี่เป็นสอง workflow คนละกรณี ไม่รวมจำนวน rows เข้าด้วยกัน

ตัวเลขไม่รวม durable OCR/GT/geometry ที่ต้องเก็บต่อ ไม่รับประกันอัตราประหยัดคงที่ เนื่องจาก Gateway payload และจำนวนข้อผิดพลาดจริงแตกต่างกัน

## Bulk management และ Comparison

History ใช้ `POST /api/test-cases/bulk-delete` สูงสุด 200 IDs, deduplicate, OCR mutex, transaction/rollback และ FK cascade ที่คง source Document กับชุดทดสอบอื่นไว้

Dataset ใช้ `POST /api/dataset/items/bulk-exclude` รวม case/field IDs สูงสุด 200; soft-exclude เท่านั้น ไม่ลบ GT/history/source/OCR ตัวอย่างที่ขาด source เลือกนำออกได้แต่ส่งออกไม่ได้ ZIP/confirmed GT label semantics ไม่เปลี่ยน

Comparison เปลี่ยนเฉพาะ hierarchy: answer-first, สามการ์ด, next actions, manual pair ที่ไม่เปลี่ยน system recommendation และ advanced content ที่พับไว้ สถิติยังใช้ Document, paired comparisons, bootstrap, 95% CI, active-only recommendation และ engine เดิม

## การตรวจสอบ

Storage tests ตรวจ compact values, detail hydration, zero log/error rows, metrics equivalence, bulk rollback/limits, FK cascades บน local PostgreSQL และ migration/drift บน temporary test schema; ไม่ใช้ Production เป็น fixture
