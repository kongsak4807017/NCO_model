# Google Sheets Collaborative Profile — HR Blueprint v2

## โปรไฟล์สาธิตที่ฝังใน Simulator — เชียงราย(mock up)

ในหน้า **Collaborative Data Profile** มีปุ่ม **โหลด เชียงราย(mock up)** สำหรับสาธิต end-to-end โดยใช้ schema `nco-hr-profile-v2` ชุดเดียวกับ Profile จริง

หลักการของชุดนี้:
- แยกชั้นข้อมูลเป็น **ACTUAL / REFERENCE / MOCK** ชัดเจน
- ACTUAL ที่ฝังอยู่ ได้แก่ประชากรเชียงราย HDC ปี 2569, provincial HR baseline จาก `hr_blueprint.db` และ KPI A01/DH0101 ที่เป็น **บริบทระดับ รพศ.เชียงรายประชานุเคราะห์**
- Profession-specific workload, historical trend, movement, Target Need และ KPI อื่นที่ยังไม่มีข้อมูลจริงครบ เป็น **MOCK**
- Facility Workload ใช้เป็น reference/reconciliation เท่านั้น; WISN ใช้ `Profession_Workload`
- ป้าย **MOCK PROFILE — FOR DEMONSTRATION ONLY** ต้องคงอยู่เสมอเมื่อใช้ Profile นี้
- ค่า `Verified` ใน Profile สาธิตหมายถึง “ข้อมูล demo มีโครงสร้างครบเพื่อทดสอบ Data Fitness” ไม่ใช่การรับรองข้อมูลภาคสนาม
- ห้ามใช้ผลขาด/เกินกำลังคนจาก Profile นี้เป็นข้อเสนอเชิงนโยบายจนกว่าค่าจำลองจะถูกแทนด้วยข้อมูลจริงที่ทวนสอบแล้ว

สามารถ Export Profile นี้เป็น Excel เพื่อใช้สาธิต workbook ทั้ง 8 sheets ได้เหมือน Profile จริง


เอกสารนี้ใช้กับ `Simulator_HR_blueprint.html` เพื่อให้หลายกลุ่มงานกรอกข้อมูล Profile เดียวกันพร้อมกัน โดย Simulator ยังคงเป็นหน้าวิเคราะห์บน GitHub Pages

## หลักสำคัญของ v2

HR Blueprint v2 ไม่ใช้ยอดบริการรวมของโรงพยาบาลเป็น workload ของทุกวิชาชีพอีกต่อไป

> **Workload ที่เข้าสูตร WISN ต้องเป็นงานที่วิชาชีพนั้นทำจริง และหน่วยของ workload ต้องตรงกับหน่วยของ Activity Standard แบบ 1:1**

ตัวอย่าง:
- แพทย์ OPD = **physician OPD encounters** ที่มีแพทย์ตรวจจริง ไม่ใช่ Total OPD ของโรงพยาบาล
- พยาบาล IPD = **patient-days** เมื่อเวลามาตรฐานเป็นนาที/patient-day ไม่ใช่จำนวน admissions
- เภสัชกร OPD = **prescriptions / dispensing episodes** ไม่ใช่จำนวน OPD visits
- นักกายภาพบำบัด = treatment sessions
- นักจิตวิทยา = assessment/counselling/psychotherapy sessions

ถ้าไม่มีข้อมูลที่ตรงตามนิยาม ให้ **เว้นว่าง** ระบบจะ Block การสรุปขาด/เกิน แทนการนำ proxy ที่ไม่ตรงมาใช้โดยอัตโนมัติ

## Workflow ที่แนะนำ

1. เปิด HR Blueprint Simulator แล้วเลือกจังหวัด/อำเภอ/หน่วยบริการให้ถูกต้อง
2. กด **Export Excel Template (.xlsx)**
3. อัปโหลดไฟล์ `.xlsx` เข้า Google Drive แล้วเลือก **Open with Google Sheets**
4. แชร์ให้เฉพาะผู้รับผิดชอบข้อมูลตามสิทธิ์ของหน่วยงาน
5. ให้แต่ละกลุ่มงานกรอก worksheet ที่รับผิดชอบ โดยไม่เปลี่ยนชื่อ worksheet หรือ technical header
6. ตรวจนิยาม หน่วย แหล่งข้อมูล การนับซ้ำ และสถานะการทวนสอบ
7. ใน Google Sheet ไปที่ **Extensions → Apps Script** แล้ววางโค้ดจาก `integrations/google_apps_script/Code.gs`
8. Deploy → **New deployment → Web app** และกำหนดสิทธิ์ตามนโยบายองค์กร
9. คัดลอก Web App URL (`.../exec`) มาใส่ช่อง **Apps Script JSON Endpoint** ใน Simulator
10. กด **Sync จาก Google Sheets**
11. ตรวจ **Data Fitness** ก่อนดูผลขาด/เกินกำลังคน
12. ใช้ Health KPI เป็น outcome context ร่วมกับ capacity โดยไม่สรุปเหตุเชิงสาเหตุจาก staffing เพียงตัวเดียว

> ถ้าองค์กรไม่อนุญาต Web App ให้ใช้ Excel Import/Export แทน

## Workbook schema — `nco-hr-profile-v2`

### 1. `Profile`
ข้อมูล Profile และ scope เช่น `profile_id`, จังหวัด, อำเภอ, หน่วยบริการ, ระดับการวิเคราะห์ และปีอ้างอิง

### 2. `Section_Metadata`
ผู้รับผิดชอบ แหล่งข้อมูล สถานะ `Draft / Reviewed / Verified` วันที่ปรับปรุง และหมายเหตุของแต่ละ section

### 3. `Workload_History`
Population และ **facility totals สำหรับ reference/reconciliation เท่านั้น** เช่น Total OPD, IPD, ER, OR/Procedure, Delivery, Chronic, Mental, Outreach/PP

**ข้อมูล Sheet นี้ไม่ถูกนำไปเป็น numerator ของ WISN รายวิชาชีพโดยอัตโนมัติ**

### 4. `Profession_Workload` — Sheet สำคัญของ WISN v2
ข้อมูล workload จริงของแต่ละวิชาชีพ แยกปีและกิจกรรม โดยมี:

- วิชาชีพ
- ปี
- งานตัวแทนที่ใช้คำนวณ
- ปริมาณงานจริง
- หน่วย
- นิยาม
- เกณฑ์รวม / เกณฑ์ไม่รวม
- แหล่งข้อมูล
- สถานะทวนสอบ
- Overlap policy
- Activity Standard (นาทีต่อหน่วย)
- แหล่งที่มาของ Activity Standard
- สถานะทวนสอบ Activity Standard
- Health KPI ที่เกี่ยวข้อง

ตัวอย่างที่ต้องระวัง:

**Doctor OPD**
- Include: visit ที่มีแพทย์เป็นผู้ตรวจ/ประเมินจริง
- Exclude: nurse-only, dental, physio, pharmacy-only หรือบริการที่ไม่มีแพทย์ตรวจ
- ห้ามใช้ Total OPD ของโรงพยาบาลแทน

**Nurse IPD**
- ใช้ patient-days เมื่อ Activity Standard เป็น minutes/patient-day
- ห้ามนำ admissions ไปคูณกับ minutes/patient-day

**Chronic / Mental / Procedure**
- ต้องระบุว่าเป็น `independent`, `exclusive` หรือ `deduplicated`
- ถ้ายังเป็น `unknown` และมีโอกาสซ้ำกับ OPD/ER ระบบจะไม่ยอมให้สรุป shortage/surplus แบบ Verified

### 5. `TargetNeed_History`
Target Population/Cases และ Actual Served ที่มีหลักฐานจริง แยกตามกลุ่ม Health Need และปี

**ช่อง Actual Served ที่ว่าง = ไม่ทราบ ไม่ใช่ 0** จึงไม่สร้าง Coverage Gap จากข้อมูลที่ไม่มี

### 6. `Workforce_History`
Actual Headcount และ movement จริงรายวิชาชีพ/รายปี เช่น Recruit, Transfer, Retire, Resign, Study Leave

`Actual Supply FTE = Actual Annual Headcount × FTE Factor`

Movement ใช้เป็นหลักฐานย้อนหลัง ไม่ใช้ back-calculate headcount

### 7. `Profession_Config`
การเลือกวิชาชีพและค่าประกอบ WISN เช่น AWT, CAS, IAS และค่าเริ่มต้นของ Activity Standard

> ค่า default ในระบบเป็น **Illustrative defaults — NOT VALIDATED** ไม่ใช่มาตรฐานของโรงพยาบาล และยังไม่ควรใช้สรุปเชิงนโยบายจนกว่าจะมี source และผ่านการทวนสอบ

สูตรหลัก:

- `Demand Minutes = Σ(Profession Workload Volume × Activity Standard × Complexity Index)`
- `Service FTE = Demand Minutes ÷ AWT`
- `CAF = 1 ÷ (1 − CAS/100)`
- `IAF = IAS × 60 ÷ AWT`
- `Required FTE = (Service FTE × CAF) + IAF`
- `Actual Supply FTE = Actual Annual Headcount × FTE Factor`
- `HR GAP = Required FTE − Actual Supply FTE`
- `WISN Ratio = Actual Supply FTE ÷ Required FTE`

### 8. `Health_KPI_History`
ค่าตัวชี้วัดผลลัพธ์สุขภาพ/บริการจริงรายปี พร้อม source และ verification status เช่น mortality, CMI, Bed Occupancy, Referral leakage และ Service Plan outcomes ที่มีอยู่ใน repository

KPI ใช้ตอบคำถามว่า **“ผลลัพธ์บริการ/สุขภาพเป็นอย่างไรในช่วงที่ capacity เป็นแบบนี้”** แต่ไม่ถือว่าเป็นหลักฐานว่า staffing เป็นสาเหตุโดยลำพัง เพราะยังมี case mix, referral, technology, process, access และปัจจัยอื่นร่วมด้วย

ระบบไม่สร้าง threshold ใหม่ ถ้า canonical indicator standard ใน repository ไม่ได้กำหนดไว้

## Data Fitness Gate

ผลรายวิชาชีพ/รายปีแบ่งเป็น:

- **Verified** — workforce จริง, profession workload, หน่วย, overlap และ WISN standard ผ่านการทวนสอบ
- **Provisional** — คำนวณสำรวจได้ แต่ยังมี source/standard/provenance ที่ไม่ Verified
- **Blocked** — ข้อมูลสำคัญขาด, หน่วยผิด, ไม่มี profession-specific workload หรือมีความเสี่ยงนับซ้ำที่ยังไม่แก้

ระบบจะแสดง **Suggested Add / ขาด / เกิน / risk color เชิงบริหารเฉพาะแถว Verified** เท่านั้น

ถ้า Provisional/Blocked ระบบจะแสดงว่า **“ยังสรุปขาด/เกินไม่ได้”** พร้อมเหตุผล

## การแบ่งเจ้าของข้อมูลตัวอย่าง

| Section | ผู้รับผิดชอบที่แนะนำ | ตัวอย่าง Source |
|---|---|---|
| Population / Facility reference | ยุทธศาสตร์/ข้อมูลข่าวสาร | HDC, HIS |
| Profession Workload | ทีมวิชาชีพ + HIS/เวชระเบียน | provider encounter, nursing census, pharmacy dispensing, registry |
| Workforce | HR | HROPS, HRIS, จ.18 |
| Target Need | NCD/ปฐมภูมิ/Service Plan | HDC, registry, program report |
| WISN Standards | ทีมวิชาชีพ/HR/QI | time-motion, service standard, expert consensus |
| Health KPI | ยุทธศาสตร์/QI/Service Plan | HDC, Service Plan, registry |

## Data governance

- ปี 2569–2565 ใช้ **actual historical data เท่านั้น**
- ไม่มีข้อมูลจริงให้เว้นว่าง; `0` ใช้เฉพาะเมื่อเป็นค่าศูนย์จริงและยืนยันแล้ว
- ห้ามใช้ growth rate, interpolation, back-cast หรือเฉลี่ยยอดจังหวัดลงอำเภอ
- ห้ามใช้ facility total เป็น workload ของวิชาชีพโดยไม่มีหลักฐาน attribution
- ต้องระบุ source และวิธีนับให้ตรวจย้อนกลับได้
- ข้อมูลที่แชร์ควรเป็น aggregate ระดับพื้นที่/บริการเท่านั้น
- ห้ามใส่ชื่อบุคคล เลขบัตรประชาชน รหัสบุคลากรรายคน หรือข้อมูลสุขภาพรายบุคคลใน public Sheet/Web App

## การทำงาน offline

1. Export Excel Template
2. ให้แต่ละกลุ่มงานกรอก Sheet ของตน
3. ทีมวิชาชีพทวนสอบ Profession_Workload และ Activity Standard
4. HR ทวนสอบ Workforce
5. ทีมยุทธศาสตร์/QI เติม Health KPI
6. รวมไฟล์และ Import กลับ Simulator
7. ตรวจ Data Fitness / Provenance
8. วิเคราะห์เฉพาะผลที่ผ่าน Verified หรือระบุชัดว่าเป็น exploratory/provisional

Excel, Google Sheets และ Simulator ใช้นิยาม profession-specific workload ชุดเดียวกัน เพื่อให้ข้อมูลที่กรอกตรงกับเจตนาของสูตรที่ใช้คำนวณ