# Implementation Backlog

เอกสารนี้แตกจาก `progressionnote3.md` เพื่อให้ทีม dev/data รับช่วงทำงานต่อได้ทันที

หลักการจัด backlog:
- แยกตาม workstream ที่ทำงานคู่ขนานได้
- ระบุ owner type: `data`, `backend`, `frontend`, `analysis`, `qa`
- ระบุ dependency ชัด
- ระบุ acceptance criteria ให้ตรวจรับได้
- เรียงตาม priority จากสิ่งที่กระทบ reliability และ production readiness มากที่สุด

---

## 0. เป้าหมายของ backlog รอบถัดไป

เป้าหมายรอบนี้คือยกระดับระบบจาก
- planning prototype / directional tool

ไปสู่
- workload-grounded planning tool ที่เชื่อถือได้มากขึ้น
- UI ที่ตรวจย้อนกลับได้จริง
- data pipeline ที่ทีมทำงานซ้ำได้โดยไม่ต้องเดา

ผลลัพธ์ที่ต้องการจากรอบนี้:
1. `OR/ICU` หลุดจาก `manual_source_required` ในฐานจริง
2. `service matrix` บน UI แสดง observed source/status/reference จากข้อมูลจริง
3. `analysis_run_history` ใช้งาน audit/replay ได้จริงบนหน้าเว็บ
4. ทีมเข้าใจ source of truth, denominator, policy, formula ตรงกันทั้งระบบ

---

# Workstream A: Service Statistics Real Import

## A1. รวบรวมข้อมูลจริง OR/ICU จากโรงพยาบาลเป้าหมาย
- Priority: `P0`
- Owner: `data`
- Dependency: ไม่มี
- Input files:
  - `templates/service_statistics_region1_or_icu_pack.xlsx`
  - `templates/service_statistics_nakornping_or_icu_mockup.xlsx` ใช้เป็นตัวอย่าง
- Hospitals target รอบแรก:
  - นครพิงค์
  - ลำปาง
  - เชียงรายประชานุเคราะห์
- Activities required:
  - `OR_MAJOR`
  - `OR_MINOR`
  - `ICU_BED_DAYS`

### Task
- ขอข้อมูลจริงรายเดือน 12 เดือนล่าสุดจาก HIS / OR report / ICU census
- กรอก `activity_count` ให้ครบ
- ตรวจ `unit_code_18`, `period_value`, `activity_code` ให้ตรง template

### Acceptance Criteria
- ไฟล์กรอกครบ 3 hospitals
- ไม่มี `activity_count` ว่างใน 3 activity หลัก
- ไม่มี `unit_code_18` missing
- ไม่มี `activity_code` นอก catalog

---

## A2. Import service statistics เข้า DB จริง
- Priority: `P0`
- Owner: `data`
- Dependency: A1
- Script:
  - `import_service_stats.py`

### Task
- import file ที่กรอกจริงเข้า `hr_blueprint.db`
- เก็บ summary report ของการ import

### Command
```powershell
python import_service_stats.py --input templates/service_statistics_region1_or_icu_pack.xlsx --db-path hr_blueprint.db --report templates/service_statistics_region1_or_icu_import_report.csv
```

### Acceptance Criteria
- Import สำเร็จโดยไม่มี exception
- summary report ถูกสร้าง
- `missing_unit_code_18 = 0`
- `missing_activity_count = 0`

---

## A3. Rerun manual refresh + workload recalibration
- Priority: `P0`
- Owner: `backend` หรือ `data`
- Dependency: A2
- API / modules:
  - `POST /api/analysis/refresh-workload-sources`
  - `API/workload_source_store.py`
  - `API/analysis_governance_store.py`

### Task
- rerun refresh workload sources โดยเปิด `refresh_manual=true`
- ตรวจ `analysis_workload_reference` หลัง recalibration

### Command
```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8765/api/analysis/refresh-workload-sources -ContentType 'application/json' -Body '{"requested_year_be":2569,"refresh_manual":true}'
```

### Acceptance Criteria
- `or_per_10k` ไม่เป็น `manual_source_required`
- `icu_per_10k` ไม่เป็น `manual_source_required`
- มี `sample_count > 0`
- `source_strategy` ของ OR/ICU ยังคงถูกต้องตาม policy

---

## A4. Verify recalibrated references against expectations
- Priority: `P1`
- Owner: `analysis`
- Dependency: A3

### Task
- ตรวจว่า reference ใหม่ไม่ผิดธรรมชาติ
- review ค่า `calibrated_reference_value`, `sample_count`, `coverage_ratio`
- เปรียบเทียบกับค่า mockup report และบริบทจริงของโรงพยาบาล

### Acceptance Criteria
- มีโน้ตสรุปว่าค่า reference ที่ได้สมเหตุสมผลหรือไม่
- ถ้าผิดธรรมชาติ ต้องเปิด issue แยกว่าปัญหาอยู่ที่ input หรือ calibration logic

---

# Workstream B: Service Matrix UI Hardening

## B1. Visual QA ของ Clinical Service Matrix บนหน้าใช้งานจริง
- Priority: `P0`
- Owner: `frontend` + `qa`
- Dependency: A3 ดีที่สุด แต่เริ่มจาก data ปัจจุบันได้
- Files:
  - `simulation.js`
  - `simulation.css`
  - `simulation.html`

### Task
- เปิด Step 3 ของโรงพยาบาลจริง
- ตรวจ panel `Clinical Service Matrix`
- ตรวจการแสดงผลต่อ metric:
  - actual rate
  - observed reference
  - availability status
  - source strategy
  - sample count / coverage
  - mapped professions
  - source note

### Acceptance Criteria
- ไม่เกิด overflow/line break ที่อ่านยากบน desktop
- mobile/tablet ไม่พัง layout
- status color อ่านเข้าใจได้ทันที
- metric ที่ `manual_required` ไม่ถูกแสดงเหมือน observed

---

## B2. ปรับ visual hierarchy ของ service matrix
- Priority: `P1`
- Owner: `frontend`
- Dependency: B1

### Task
- ถ้า observed data มาแล้ว ให้เน้น observed metrics ก่อน
- จัดกลุ่ม metric ให้ผู้ใช้แยกได้ว่าอะไร
  - observed
  - sparse
  - proxy
  - manual required
- ลดข้อความยาวเกินจำเป็นใน note

### Acceptance Criteria
- ผู้ใช้มอง 5 วินาทีแล้วรู้ว่า metric ไหนเชื่อถือได้ที่สุด
- ไม่ต้องกดอ่าน note ยาวเพื่อเข้าใจสถานะพื้นฐาน

---

## B3. เพิ่ม source legend / confidence hint ใน service matrix
- Priority: `P2`
- Owner: `frontend`
- Dependency: B1

### Task
- เพิ่ม legend เช่น
  - observed
  - sparse
  - proxy
  - manual required
- แสดง source hint สั้น ๆ ใน header

### Acceptance Criteria
- ผู้ใช้หน้าใหม่เข้าใจความหมายของ status ได้โดยไม่ต้องเปิดเอกสาร

---

# Workstream C: Audit / Replay

## C1. ทดสอบ `analysis_run_history` end-to-end บน browser จริง
- Priority: `P0`
- Owner: `qa`
- Dependency: ไม่มี
- Source:
  - `analysis_run_history`
  - Step 7 panel `Analysis Run History`

### Task
- สร้าง run ใหม่จาก Step 7
- ตรวจว่ามี record ถูก persist
- กด replay run
- ตรวจว่า
  - slider weight ถูก restore
  - WCI / Need_FTE / denominator metadata เปลี่ยนตาม persisted preview
- กดล้าง replay
- ตรวจว่ากลับสู่ current state

### Acceptance Criteria
- replay ใช้งานได้โดยไม่เกิด JS error
- clear replay คืนค่าปัจจุบันได้จริง
- ไม่มี stale state หลัง replay

---

## C2. เพิ่ม replay provenance ที่มองเห็นชัดขึ้น
- Priority: `P1`
- Owner: `frontend`
- Dependency: C1

### Task
- แสดง badge ชัดว่า UI อยู่ใน `replay mode`
- ระบุ `run_id`, `created_at`, `engine_version`
- แยกให้เห็นว่าค่าที่กำลังดูคือ persisted result ไม่ใช่ current recompute

### Acceptance Criteria
- ผู้ใช้ไม่สับสนระหว่าง replay กับ current state

---

## C3. เพิ่ม export run history
- Priority: `P2`
- Owner: `frontend` + `backend`
- Dependency: C1

### Task
- export JSON/CSV ของ run history row
- ใช้สำหรับแนบประชุมหรือ debug audit

### Acceptance Criteria
- export ได้อย่างน้อย 1 format โดยไม่ต้องแกะ DB ด้วยมือ

---

# Workstream D: Reliability / Analytics Upgrade

## D1. Review benchmark table หลังมี OR/ICU observed data
- Priority: `P1`
- Owner: `analysis`
- Dependency: A3

### Task
- ทบทวน `analysis_benchmark_reference` และ `analysis_workload_reference`
- ดูว่าค่า default/fallback ยังเหมาะหรือควรปรับ

### Acceptance Criteria
- มีสรุปว่าค่าใดควร keep / adjust / deprecate

---

## D2. Recalibrate profession pressure coefficients
- Priority: `P1`
- Owner: `analysis` + `backend`
- Dependency: A3, D1
- Files:
  - `API/need_fte_engine.py`

### Task
- ทบทวน weight ของ workload signal ต่อ profession เช่น
  - doctor_signal
  - nurse_signal
  - pharmacist_signal
  - pt_signal
  - psych_signal
- เช็กว่าแรงกดดันฝั่ง `mental` ไม่ dominate เกินจริงในบาง รพ.

### Acceptance Criteria
- มี coefficient set ที่ review แล้ว
- ตัวอย่างโรงพยาบาลหลัก 3 แห่งไม่ให้ผลผิดธรรมชาติ

---

## D3. เพิ่ม confidence score ฝั่ง clinical ให้ละเอียดขึ้น
- Priority: `P2`
- Owner: `backend` + `analysis`
- Dependency: D1

### Task
- เพิ่ม scoring ฝั่ง clinical ตาม
  - denominator method
  - workload source quality
  - observed vs proxy vs manual
  - year recency
  - completeness

### Acceptance Criteria
- Step 3/7 สามารถแสดง confidence ฝั่ง clinical ได้แบบมีเหตุผลรองรับ

---

# Workstream E: Data Source Expansion

## E1. หา source จริงสำหรับ ER visit ทั้งหมด
- Priority: `P1`
- Owner: `data`
- Dependency: ไม่มี

### Task
- หา source ที่ดีกว่า `s_urgency_admit`
- อาจมาจาก Open Data, HDC, หรือ manual service statistics

### Acceptance Criteria
- มีข้อสรุปชัดว่า
  - ใช้ source ไหน
  - coverage ระดับไหน
  - map เข้า metric `er_per_10k` อย่างไร

---

## E2. วางแผน source จริงสำหรับ OPD/IPD ราย hospital
- Priority: `P2`
- Owner: `data`
- Dependency: ไม่มี

### Task
- ตรวจว่า public source ที่ใช้ตอนนี้เหมาะกับ calibration ระดับ hospital หรือไม่
- ถ้าไม่พอ ให้กำหนด manual import specification เพิ่ม

### Acceptance Criteria
- มี recommendation ว่าจะใช้ public / manual / hybrid สำหรับ OPD/IPD ใน production

---

# Workstream F: Documentation / Handoff

## F1. อัปเดต `progression2.md` และ `progressionnote3.md` หลัง OR/ICU observed จริง
- Priority: `P1`
- Owner: `analysis`
- Dependency: A3

### Task
- อัปเดตสถานะ reliability
- อัปเดตว่าตอนนี้ `OR/ICU` ใช้ observed ได้แล้วหรือยัง
- อัปเดต percent completion ใหม่

### Acceptance Criteria
- เอกสาร handoff ไม่ขัดกับระบบจริง

---

## F2. ทำ data operation runbook
- Priority: `P2`
- Owner: `data` + `backend`
- Dependency: A3

### Task
- เขียนขั้นตอน standard สำหรับ
  - รับไฟล์จากโรงพยาบาล
  - validate
  - import
  - refresh workload sources
  - QA calibration
  - rollback ถ้าข้อมูลผิด

### Acceptance Criteria
- ทีม data ใหม่เข้ามาแล้วทำงานตาม runbook ได้

---

# Sprint Order ที่แนะนำ

## Sprint 1
- A1
- A2
- A3
- C1
- B1

## Sprint 2
- A4
- B2
- D1
- D2
- F1

## Sprint 3
- C2
- C3
- B3
- D3
- E1
- E2
- F2

---

# Definition of Done รอบถัดไป

รอบถัดไปถือว่าสำเร็จเมื่อ:
1. `OR/ICU` มี observed/sparse จากข้อมูลจริงในฐานจริง
2. service matrix แสดง observed source/status/reference จาก browser จริงได้ถูกต้อง
3. run history replay ใช้งานได้จริงและ QA ผ่าน
4. reliability ของระบบขยับจาก ~`7.5/10` ไปใกล้ `8/10`
5. ทีมสามารถอธิบาย chain การคำนวณได้ตั้งแต่
   - source
   - denominator
   - benchmark
   - workload pressure
   - Need_FTE
   - outcome validation
   - recommendation

---

# คำสั่งที่ทีมใช้บ่อย

## import service stats
```powershell
python import_service_stats.py --input templates/service_statistics_region1_or_icu_pack.xlsx --db-path hr_blueprint.db --report templates/service_statistics_region1_or_icu_import_report.csv
```

## refresh workload sources
```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8765/api/analysis/refresh-workload-sources -ContentType 'application/json' -Body '{"requested_year_be":2569,"refresh_manual":true}'
```

## check syntax
```powershell
node --check simulation.js
python -m py_compile API/main.py API/analysis_governance_store.py API/need_fte_engine.py API/workload_source_store.py
```
