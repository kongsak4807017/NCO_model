# Google Sheets Collaborative Profile — HR Blueprint

เอกสารนี้ใช้กับ `Simulator_HR_blueprint.html` เพื่อให้หลายกลุ่มงานกรอกข้อมูล Profile เดียวกันพร้อมกัน โดย Simulator ยังคงเป็นหน้าวิเคราะห์แบบ static GitHub Pages

## Workflow ที่แนะนำ

1. เปิด HR Blueprint Simulator แล้วเลือกจังหวัด/อำเภอ/หน่วยบริการให้ถูกต้อง
2. กด **Export Excel Template (.xlsx)**
3. อัปโหลดไฟล์ `.xlsx` เข้า Google Drive แล้วเลือก **Open with Google Sheets**
4. แชร์ Google Sheet ให้เฉพาะผู้รับผิดชอบข้อมูลแต่ละกลุ่มงานตามสิทธิ์ของหน่วยงาน
5. กรอกข้อมูลใน worksheet ที่รับผิดชอบ โดยไม่เปลี่ยนชื่อ worksheet หรือชื่อ header
6. ใน Google Sheet ไปที่ **Extensions → Apps Script**
7. วางโค้ดจาก `integrations/google_apps_script/Code.gs`
8. Deploy → **New deployment → Web app**
9. ตั้ง Execute as เป็นเจ้าของไฟล์ และกำหนดสิทธิ์เข้าถึงตามนโยบายของหน่วยงาน
10. คัดลอก Web App URL (`.../exec`) มาใส่ช่อง **Apps Script JSON Endpoint** ใน Simulator
11. ใส่ Google Sheet URL ในช่อง **Google Sheet URL** แล้วกด **Sync จาก Google Sheets**
12. ตรวจ Completeness และ provenance ก่อนกดวิเคราะห์

> ถ้าองค์กรไม่อนุญาต Web App ที่เข้าถึงจากภายนอก ให้ใช้ Excel Import/Export แทน หรือวาง Apps Script/endpoint หลังระบบ authentication ขององค์กรในระยะถัดไป

## Workbook schema

### `Profile`
ตาราง key/value ของ profile และ scope เช่น `profile_id`, `province_code`, `amphur_code`, `scope_mode`, `latest_year`, `confidence`

### `Section_Metadata`
แต่ละกลุ่มงานกรอกแหล่งข้อมูลและการทวนสอบของ section:

- `section`
- `owner`
- `source`
- `status` — `Draft`, `Reviewed`, `Verified`
- `updated_at`
- `note`

### `Workload_History`
ข้อมูลจริงย้อนหลัง 2569–2565 เช่น Population, OPD, IPD, ER, OR/Procedure, Delivery, Chronic, Mental, Outreach/PP

**สำคัญ:** ช่อง Workload เป็น **ปริมาณงานจริงต่อปี** เช่น `OPD visits/ปี`, `IPD admissions/ปี`, `ER visits/ปี` ไม่ใช่เวลามาตรฐานเป็นนาที

### `TargetNeed_History`
Target Population/Cases และ Actual Served ที่มีหลักฐานจริง แยกตามกลุ่ม Health Need และปี

### `Workforce_History`
Actual Headcount และ movement จริงรายวิชาชีพ/รายปี เช่น Recruit, Transfer, Retire, Resign, Study Leave

Actual Supply FTE ใน historical mode คำนวณจาก **Actual Annual Headcount × FTE Factor** โดย movement รายปีใช้เป็นหลักฐานย้อนหลังและไม่ใช้ back-calculate จำนวนคน

### `Profession_Config`
วิชาชีพที่ใช้วิเคราะห์และ WISN standards เช่น AWT, CAS, IAS และ Activity Standard

**Activity Standard คือเวลา ไม่ใช่ปริมาณงาน:** `activity_OPD`, `activity_IPD` ฯลฯ หมายถึง **จำนวนนาทีที่บุคลากร 1 คนในวิชาชีพนั้นใช้ต่อ 1 หน่วยกิจกรรม** เช่น แพทย์ OPD 8 นาที/visit หรือพยาบาล IPD 60 นาที/admission ตามนิยามของโมเดล

สูตรหลักที่ใช้ใน Simulator คือ:

- `Demand Minutes = Σ(Workload Volume × Activity Standard × Complexity Index)`
- `Service FTE = Demand Minutes ÷ AWT`
- `CAF = 1 ÷ (1 − CAS/100)`
- `IAF = IAS × 60 ÷ AWT`
- `Required FTE = (Service FTE × CAF) + IAF`
- `HR GAP = Planning Required FTE − Actual Supply FTE`
- `WISN Ratio = Actual Supply FTE ÷ Planning Required FTE`

> สำหรับ IPD ช่อง Activity Standard ของโมเดลปัจจุบันเป็น **นาทีต่อ admission** ไม่ใช่ nursing minutes ต่อ bed-day หากพื้นที่ต้องการใช้ bed-day model ต้องปรับโมเดลก่อน ไม่ควรนำค่าต่อ bed-day มาใส่ตรง ๆ

## การแบ่งเจ้าของข้อมูลตัวอย่าง

| Section | ผู้รับผิดชอบที่พบบ่อย | ตัวอย่าง Source |
|---|---|---|
| Population | ยุทธศาสตร์/ข้อมูลข่าวสาร | HDC, ทะเบียนราษฎร์, ทะเบียนสิทธิ |
| Workload | ประกันสุขภาพ/เวชระเบียน/กลุ่มภารกิจบริการ | HIS, HDC, DRG, ER report |
| Workforce | HR/บริหารทรัพยากรบุคคล | HROPS, HRIS, จ.18 |
| TargetNeed | NCD/ปฐมภูมิ/Service Plan/ยุทธศาสตร์ | HDC, registry, program report |
| WISN | ทีมวิชาชีพ/HR/พัฒนาคุณภาพ | time-motion, service standard, expert consensus |

## Data governance

- ปี 2569–2565 ใช้ **actual historical data เท่านั้น**
- ช่องที่ไม่มีข้อมูลจริงให้เว้นว่าง ไม่ใส่ `0` เพื่อแทนคำว่า “ไม่มีข้อมูล” เว้นแต่ค่าจริงเป็นศูนย์และมีการยืนยันใน metadata
- ห้ามใช้ growth rate, interpolation, back-cast หรือเฉลี่ยยอดจังหวัดลงอำเภอ
- เมื่อแก้ข้อมูลที่เคย `Verified` ใน Simulator ระบบจะลด section กลับเป็น `Draft` เพื่อให้ทวนสอบใหม่
- `source` ควรระบุระบบ/รายงานและปีอ้างอิงให้ตรวจย้อนกลับได้
- Profile ที่แชร์ผ่าน Google Sheets/Web App ควรเป็น **ข้อมูลรวมระดับพื้นที่/บริการ** เท่านั้น
- ห้ามนำชื่อบุคคล เลขบัตรประชาชน รหัสบุคลากรรายคน หรือข้อมูลสุขภาพระดับบุคคลเข้าสู่ Sheet/Web App สาธารณะ

## การทำงาน offline

หน่วยงานที่ไม่สะดวกใช้ Google Sheets สามารถ:

1. Export Excel Template
2. ส่งแยกให้กลุ่มงานกรอก
3. รวมข้อมูลลง workbook schema เดียว
4. Import Excel กลับ Simulator
5. ตรวจ Completeness/Provenance ก่อนวิเคราะห์

Excel และ Google Sheets ใช้ schema เดียวกัน และคำอธิบายของ Workload / Activity Standard / AWT / CAS / IAS ใช้นิยามเดียวกับ Simulator เพื่อให้การกรอกข้อมูลและสูตรวิเคราะห์สอดคล้องกัน