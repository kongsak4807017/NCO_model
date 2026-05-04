# HR Forecast Template (Hospital-Level) for NCO Simulator

เป้าหมาย: ให้ทีม HR ระดับจังหวัด/โรงพยาบาล “ทำ forecast รายปี” แล้วได้คำตอบเป็น output ตาม logic ของ NCO simulation model (Need -> Capacity -> GAP -> Suggested add)

## แนวคิดการใช้งาน

1. เลือก “โรงพยาบาลเป้าหมาย” (ระบุ `province_code` + `unit_name`)
2. กำหนด baseline และสมมติฐานรายปี (เช่น ประชากรรับผิดชอบ, elderly/chronic/mental)
3. ให้ระบบคำนวณ “need FTE preview” ผ่าน API: `/api/analysis/need-fte-preview`
4. สรุปผลเป็น “gapFte + suggestedAdd” รายปี เพื่อใช้ทำแผน 5 ปี/10 ปี

## สิ่งที่ต้องมีให้ระบบตอบได้

ขั้นต่ำต้องมี:
- `province_code` (เช่น 50=เชียงใหม่)
- `unit_name` (ชื่อหน่วยบริการใน `hr_blueprint.db.organizational_unit.unit_name`)
- `population_total`
- `elderly_rate_pct`, `chronic_rate_pct`, `mental_risk_rate_per100k` (ถ้ายังไม่มี ใส่ค่าประมาณก่อน)

หมายเหตุ:
- ถ้าไม่กรอก `workforce_counts` ระบบจะพยายามดึงกำลังคนฐานจาก `hr_blueprint.db` ด้วย `province_code + unit_name` อัตโนมัติ

## วิธีใช้แบบได้คำตอบเลย (แนะนำ)

1. เปิด API + web simulator
   - รัน `run_simulator.bat`
2. เตรียมข้อมูล forecast ใน CSV
   - ใช้ไฟล์ `templates/hr_forecast_template.csv` เป็นตัวอย่าง
3. รันตัวคำนวณ
   - `python scripts/run_hr_forecast.py templates/hr_forecast_template.csv`
4. ดูผลลัพธ์
   - `output/hr_forecast_results.json`

ถ้าไม่แน่ใจว่า `unit_name` ต้องกรอกว่าอะไร (ต้องตรงกับในฐานข้อมูล):
- ค้นหาแบบคำค้น:
  - `python scripts/find_hr_unit.py 50 นครพิงค์`
- หรือ list ทั้งจังหวัด:
  - `python scripts/find_hr_unit.py 50`

## Output ที่ได้

ไฟล์ `output/hr_forecast_results.json` จะมีผลรายแถว (1 แถว = 1 โรงพยาบาล-1 ปี) พร้อม:
- `preview.rows[*].gap_fte` และ `preview.rows[*].suggested_add`
- สรุป top gap 3 รายการต่อปี (เพื่อใช้ตัดสินใจเติมคน/skill mix)

## ข้อจำกัด (ต้องรู้ก่อนใช้กับงานจริง)

- เป็น “preview engine” แบบ scenario: ผลลัพธ์ขึ้นกับ input rates/assumptions ที่กรอก
- ยังไม่ได้ผูก workload จริง (OPD/IP/referral) ครบทุกหน่วยบริการ จึงเหมาะกับการกำหนดทิศทางและวางแผนเบื้องต้น
- ถ้าต้องการแผนกำลังคนระดับ FTE final ต้องเพิ่มข้อมูล workload/service flow และ policy constraint (rotation, network support)
