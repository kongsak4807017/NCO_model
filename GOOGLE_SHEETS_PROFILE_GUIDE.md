# Google Sheets Collaborative Profile — HR Blueprint

เอกสารนี้ใช้กับ `Simulator_HR_blueprint.html` เพื่อให้หลายกลุ่มงานกรอกข้อมูล Profile เดียวกัน โดยยึดหลักว่า **ข้อมูลที่นำเข้าสูตรต้องตรงกับสิ่งที่สูตรต้องการวัด** โดยเฉพาะ WISN ซึ่งต้องใช้ workload ที่วิชาชีพนั้นทำจริง ไม่ใช่ยอดบริการรวมของโรงพยาบาล

## Workflow ที่แนะนำ

1. เปิด HR Blueprint Simulator แล้วเลือกจังหวัด/อำเภอ/หน่วยบริการและ `scope_mode` ให้ตรงกับข้อมูลจริง
2. กด **Export Excel Template (.xlsx)**
3. อัปโหลดไฟล์เข้า Google Drive แล้ว **Open with Google Sheets**
4. แชร์ให้ผู้รับผิดชอบแต่ละกลุ่มงานกรอก worksheet ของตน โดยไม่เปลี่ยนชื่อ worksheet หรือ technical header แถวแรก
5. กรอกข้อมูลจริงเท่านั้น; ไม่มีข้อมูลให้เว้นว่าง ไม่ใส่ `0` แทน missing
6. ทวนสอบ `source`, นิยาม, หน่วย, overlap และเปลี่ยนสถานะเป็น `Verified` เมื่อพร้อมใช้
7. ใน Google Sheet ไปที่ **Extensions → Apps Script** แล้ววางโค้ดจาก `integrations/google_apps_script/Code.gs`
8. Deploy → **New deployment → Web app** และคัดลอก URL `/exec`
9. ใส่ Apps Script endpoint และ Google Sheet URL ใน Simulator แล้วกด **Sync จาก Google Sheets**
10. ตรวจ **Data Fitness Gate** ก่อนตีความ HR GAP / Suggested Add

> หากองค์กรไม่อนุญาต Web App ให้ใช้ Excel Import/Export แทน หรือวาง endpoint หลังระบบ authentication ขององค์กรในระยะถัดไป

---

# หลักสำคัญของโมเดลใหม่

## 1. Facility workload ไม่เท่ากับ workload ของทุกวิชาชีพ

`Workload_History` เป็น **บริบทระดับหน่วยบริการ/พื้นที่ (facility context)** เช่น Total OPD, IPD, ER, OR, Delivery ฯลฯ ใช้ดูภาพรวมบริการ แต่ **ไม่เพียงพอสำหรับสรุป WISN ของวิชาชีพใดวิชาชีพหนึ่ง**

ตัวอย่างที่สำคัญ:

- Total OPD ของโรงพยาบาล = 180,000 visits/ปี
- ไม่ได้แปลว่าแพทย์ตรวจ 180,000 visits
- การคำนวณแพทย์ต้องใช้ **Physician OPD encounters** ที่มีหลักฐานว่า provider profession = physician/doctor จริง
- nurse-only clinic, dental, physio, pharmacy-only หรือบริการที่ไม่มีแพทย์ตรวจต้องไม่ถูกนับเป็น workload ของแพทย์

หลักเดียวกันใช้กับทุกวิชาชีพ เช่น:

- พยาบาล IPD อาจใช้ `patient-days` หาก Activity Standard เป็นนาที/patient-day
- เภสัชกร OPD ใช้จำนวน prescription ที่ตรวจสอบ/จ่ายจริง ไม่ใช่จำนวน OPD visits
- นักกายภาพใช้ treatment sessions
- นักจิตวิทยาใช้ assessment/counseling/psychotherapy sessions
- นักวิชาการสาธารณสุขใช้ screening/outreach contacts ตามงานที่ทำจริง

## 2. Workload unit ต้องตรงกับ Activity Standard 1:1

สูตรหลัก:

`Demand Minutes = Σ(Profession-specific Workload Volume × Matching Activity Standard × Complexity)`

ตัวอย่างที่ถูก:

- Physician OPD visits × นาที/physician visit
- Nursing patient-days × นาที/patient-day
- Pharmacy prescriptions × นาที/prescription
- Physical therapy sessions × นาที/session

ห้ามนำ `admission` ไปคูณ `นาที/patient-day` หรือใช้ Total OPD ไปคูณเวลามาตรฐานแพทย์โดยอัตโนมัติ

## 3. ต้องกำหนดกติกาป้องกัน double counting

ใน `Profession_Workload_History` ช่อง `overlap_rule` ใช้ค่าต่อไปนี้:

- `independent` — เป็น workload แยกจากกิจกรรมอื่นจริง
- `mutually_exclusive` — วิธี extract ทำให้ชุดข้อมูลไม่ซ้ำกัน
- `subset_excluded` — เป็น subset ของ activity อื่น จึง **ไม่บวกซ้ำ** ใน Demand Minutes
- `incremental` — บวกเฉพาะงาน/เวลาส่วนเพิ่มที่ไม่ได้อยู่ใน activity หลัก
- `unknown` — ยังไม่ทราบความสัมพันธ์; **ไม่ผ่าน Data Fitness**

ตัวอย่าง: Chronic visit ที่อยู่ใน Physician OPD อยู่แล้ว ไม่ควรบวก OPD + Chronic ซ้ำทั้งสองก้อน เว้นแต่ Chronic ถูกนิยามเป็น incremental work และใช้ time standard เฉพาะส่วนเพิ่ม

---

# Workbook schema

Template รุ่นใหม่มี worksheet สำหรับการทำงานร่วมกันดังนี้

### `Profile`
ข้อมูล profile/scope เช่น `profile_id`, จังหวัด, อำเภอ, หน่วยบริการ, `scope_mode`, ปีอ้างอิง และ confidence

### `Section_Metadata`
provenance ของแต่ละส่วน:

- `owner`
- `source`
- `status` — `Draft`, `Reviewed`, `Verified`
- `updated_at`
- `note`

### `Workload_History`
**Facility context**: ประชากรและยอดบริการจริงของหน่วยบริการ/พื้นที่ย้อนหลัง เช่น Total OPD, IPD, ER, Procedure, Delivery, Chronic, Mental, Outreach

> ไม่ใช้ worksheet นี้เพียงอย่างเดียวเพื่อสรุปขาด/เกินรายวิชาชีพ

### `Profession_Workload_History` — ข้อมูลหลักสำหรับ WISN
หนึ่งแถว = **ปี × วิชาชีพ × activity** และต้องมี:

- `profession_code` / `profession_label`
- `activity_code`
- `workload_metric`
- `volume`
- `unit`
- `standard_unit`
- `definition`
- `include_rule`
- `exclude_rule`
- `source`
- `overlap_rule`
- `status`
- `scope_mode` / `scope_name`
- `note`

ตัวอย่างแพทย์ OPD:

- workload metric: `Physician OPD encounters`
- definition: จำนวน OPD encounter ที่แพทย์เป็นผู้ตรวจ/ผู้ให้บริการหลักจริง
- include: provider profession = physician/doctor
- exclude: nurse-only, dental, physio, pharmacy-only, encounter ที่ไม่มีแพทย์ตรวจ
- source: HIS provider/encounter table หรือรายงานที่ตรวจสอบย้อนกลับได้
- unit: visit/ปี
- standard unit: นาที/visit
- overlap rule: ต้องระบุและทวนสอบ
- status: `Verified` จึงผ่าน gate ด้าน verification

### `TargetNeed_History`
Target Population/Cases และ Actual Served จริงรายปี

**สำคัญ:** `Actual Served` ที่ว่าง = **unknown ไม่ใช่ 0** ดังนั้นระบบจะไม่คำนวณ Coverage Gap จาก missing เป็นศูนย์

### `Workforce_History`
Actual Headcount/FTE และ movement จริงรายวิชาชีพ/รายปี เช่น Recruit, Transfer, Retire, Resign, Study Leave

Historical supply ใช้:

`Actual Supply FTE = Actual Annual Headcount × FTE Factor`

movement เป็นหลักฐานย้อนหลังและไม่ใช้ back-calculate จำนวนคน

### `Profession_Config`
WISN assumptions/config รายวิชาชีพ:

- AWT
- CAS
- IAS
- Activity Standard
- `activity_unit_*` — denominator ของเวลามาตรฐานของแต่ละวิชาชีพ เช่น `visit`, `patient_day`, `prescription`, `session`

Activity Standard ต้องมาจาก time-motion, service standard หรือ expert consensus ที่ได้รับการทวนสอบก่อนใช้เชิงนโยบาย ค่าเริ่มต้นใน Template เป็นเพียง **illustrative default** ไม่ถือว่า Verified โดยอัตโนมัติ

### `Health_KPI_History`
ผลลัพธ์สุขภาพ/บริการจริงรายปีที่เกี่ยวข้องกับ service line เพื่อดูว่า capacity/workforce และผลลัพธ์บริการเปลี่ยนไปในทิศทางใดร่วมกัน

ตัวอย่าง KPI ที่ repository มี mapping อยู่แล้ว ได้แก่:

- AMI / STEMI mortality
- Sepsis mortality
- Stroke mortality
- Ischemic stroke death with rtPA
- Maternal mortality
- Neonatal mortality
- Referral leakage to tertiary
- Suicide rate
- Stroke rehabilitation coverage

ช่องหลัก ได้แก่ `year`, `service_line`, `indicator_code`, `indicator_name`, `value`, `unit`, `direction`, `related_professions`, `source`, `status`

> **Health KPI ไม่ถูกนำไปเพิ่มหรือลด Required FTE** และไม่ควรตีความว่า workforce เป็นสาเหตุโดยตรงจาก correlation เพียงอย่างเดียว เพราะ outcome ยังขึ้นกับ case mix, clinical process, equipment, referral system และปัจจัยระบบอื่น

---

# Data Fitness Gate

ระบบแยกผลเป็น 2 ชั้น:

1. **Diagnostic calculation** — แสดงตัวเลขเพื่อช่วยหา data/model problem ได้
2. **Decision-eligible result** — ใช้สรุปขาด/เกินและ Suggested Add ได้เมื่อผ่าน gate

ต้องผ่านครบ 4 ด้าน:

| Gate | ต้องยืนยันอะไร |
|---|---|
| Attribution | workload เป็นงานของวิชาชีพนั้นจริง, scope/source/inclusion/exclusion ชัด |
| Unit Match | workload unit ตรงกับ denominator ของ Activity Standard |
| Overlap | มี rule ป้องกัน double counting และไม่ใช่ `unknown` |
| Verification | Profession workload + WISN assumptions + Actual workforce ได้รับการ Verified |

ถ้าไม่ผ่าน ระบบจะแสดง:

**`DATA NOT FIT — ยังสรุปขาด/เกินไม่ได้`**

และจะไม่ให้ `Suggested Add` / `Reallocate` แม้ยังแสดง diagnostic FTE เพื่อช่วยตรวจสอบข้อมูล

---

# สูตรที่ใช้

- `Demand Minutes = Σ(Profession-specific Workload Volume × Activity Standard × Complexity)`
- `Service FTE = Demand Minutes ÷ AWT`
- `CAF = 1 ÷ (1 − CAS/100)`
- `IAF = IAS × 60 ÷ AWT`
- `Required FTE = (Service FTE × CAF) + IAF`
- `Actual Supply FTE = Actual Annual Headcount × FTE Factor`
- `HR GAP = Planning Required FTE − Actual Supply FTE`
- `WISN Ratio = Actual Supply FTE ÷ Planning Required FTE`

ผล HR GAP จะถือเป็นข้อสรุปเชิงตัดสินใจต่อเมื่อ Data Fitness ผ่านเท่านั้น

---

# การแบ่งเจ้าของข้อมูลที่แนะนำ

| ข้อมูล | ผู้รับผิดชอบหลัก | ตัวอย่าง Source |
|---|---|---|
| Population / facility context | ยุทธศาสตร์/ข้อมูลข่าวสาร | HDC, HIS, ทะเบียนประชากร |
| Profession workload | ทีมวิชาชีพ + HIS/เวชระเบียน | provider/encounter table, OR log, dispensing, rehab sessions |
| Workforce | HR | HROPS, HRIS, จ.18, ตารางปฏิบัติงาน |
| Target Need | NCD/ปฐมภูมิ/Service Plan | HDC, registry, program report |
| WISN standards | ทีมวิชาชีพ + QI/HR | time-motion, work sampling, official/local service standard |
| Health KPI | ยุทธศาสตร์/Service Plan/QI | HDC, HIS, registry, MOPH Refer |

## Data governance

- ปี 2569–2565 ใช้ actual historical data เท่านั้น
- Missing = blank/null; `0` ใช้เฉพาะ observed zero ที่ยืนยันแล้ว
- ไม่ใช้ growth rate, interpolation, back-cast หรือเฉลี่ยยอดจังหวัดลงอำเภอ
- scope ของ Population / Workload / Workforce / KPI ต้องระบุให้ตรงกันก่อนเปรียบเทียบ
- เปลี่ยนข้อมูลที่เคย Verified ต้องทวนสอบใหม่
- Profile ที่แชร์ผ่าน Google Sheets/Web App ใช้ข้อมูลรวมระดับพื้นที่/บริการเท่านั้น
- ห้ามใส่ชื่อผู้ป่วย เลขบัตรประชาชน รหัสบุคลากรรายบุคคล หรือข้อมูลสุขภาพรายบุคคลใน endpoint สาธารณะ

## Offline workflow

1. Export Excel Template
2. ให้แต่ละกลุ่มงานกรอก worksheet ที่รับผิดชอบ
3. ทีมวิชาชีพและเวชระเบียนทวนสอบ `Profession_Workload_History`
4. HR ทวนสอบ `Workforce_History`
5. ทีมวิชาชีพ/QI ทวนสอบ `Profession_Config`
6. ยุทธศาสตร์/Service Plan เติม `Health_KPI_History`
7. Import Excel กลับ Simulator
8. ดู Data Fitness Gate ก่อนอ่าน HR GAP
9. ใช้ Health KPI เป็น outcome/context เพื่อประเมินผลเชิงระบบ ไม่ใช่เป็นตัวคูณ FTE
