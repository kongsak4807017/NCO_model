# Collaborative HR Data Profile Specification

## Goal
ให้ `Simulator_HR_blueprint.html` ใช้ Data Profile เดียวเป็นศูนย์กลางสำหรับข้อมูลจริงจากหลายกลุ่มงาน โดยรองรับ Google Sheets สำหรับแก้ไขพร้อมกัน, Excel สำหรับงาน offline/หนังสือราชการ และ Simulator สำหรับวิเคราะห์ โดยไม่สร้างหรืออนุมานข้อมูลที่ขาดหาย

## Architecture
1. **Profile-centric** — ทุกชุดข้อมูลผูกกับ `profile_id` ระดับจังหวัด/อำเภอ/หน่วยบริการและช่วงปี 2569–2565
2. **Google Sheets = collaborative source** — ผู้ใช้หลายกลุ่มงานแก้ workbook schema เดียวกันใน Google Sheets และ Simulator ดึง snapshot ผ่าน Apps Script JSON endpoint
3. **Excel = interchange/offline channel** — Simulator สร้าง `.xlsx` template, export current profile และ import `.xlsx` กลับได้
4. **Simulator = analysis only** — ข้อมูลจาก profile ถูกนำเข้าสู่ state เดิมของ WISN; ไม่มีการคาดเดาค่าที่ไม่มี
5. **Provenance** — เก็บ `section`, `owner`, `source`, `status`, `updated_at`, `note` อย่างน้อยระดับ section

## Workbook schema
- `Profile`: key/value metadata ของ profile และ scope
- `Section_Metadata`: owner/source/status/updated_at/note แยก Population, Workload, Workforce, TargetNeed, WISN
- `Workload_History`: ปี, population, OPD, IPD, ER, procedure, delivery, chronic, mental, outreach, complexity
- `TargetNeed_History`: ปีและกลุ่ม health need พร้อม target/actual/coverage/frequency/complexity/placement
- `Workforce_History`: วิชาชีพ × ปี พร้อม actual headcount และ movement จริง
- `Profession_Config`: วิชาชีพที่เลือก, baseline HR และ WISN standards

## Profile ID
รูปแบบหลัก `HR1-<province_code>-<amphur_code|PROV>-<latest_year>` และเพิ่ม unit suffix เมื่อมีหน่วยบริการ เพื่อให้ profile แยกขอบเขตชัดเจน

## Completeness
แสดง completeness แยก Population, Workload, Workforce, Target Need และ Provenance พร้อม overall percentage โดย completeness เป็นการตรวจว่ามีค่าจริง/metadata ครบ ไม่ใช่การเติมค่าทดแทน

## Google Sheets integration
- ผู้ใช้สร้าง/นำเข้า workbook template เป็น Google Sheet แล้วแชร์ให้กลุ่มงานแก้ไข
- เพิ่ม Apps Script ตามไฟล์ `integrations/google_apps_script/Code.gs`
- Deploy เป็น Web App endpoint และใส่ URL ใน Simulator
- Simulator GET JSON snapshot แล้ว import ด้วย schema เดียวกับ Excel
- ไม่ส่งข้อมูลส่วนบุคคลขึ้น GitHub Pages หรือ endpoint สาธารณะ

## Non-negotiable data rules
- Historical years 2569, 2568, 2567, 2566, 2565 ใช้ actual data เท่านั้น
- Missing remains 0/blank/Not available ตามชนิดข้อมูล; ห้าม interpolation, growth, province-to-district allocation หรือ back-cast
- การ import ต้องไม่ลบค่าที่ผู้ใช้กรอก เว้นแต่ workbook มี field นั้นชัดเจน
- ผู้ใช้ยังแก้ค่าบน Simulator ได้หลัง import เพื่อทวนสอบพื้นที่
