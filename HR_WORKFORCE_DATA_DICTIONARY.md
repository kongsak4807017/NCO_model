# HR Workforce Data Dictionary

นิยามกลางสำหรับตัวเลขกำลังคนฝั่ง `รักษา-ฟื้นฟู` ที่ใช้ใน UI, WCI และ recommendation

แหล่งข้อมูลหลัก:
- `hr_blueprint.db`
- ตาราง `assignment`
- ตาราง `position`
- ตาราง `organizational_unit`

เงื่อนไขร่วมทุกตัวชี้วัด:
- นับเฉพาะ assignment ที่ `status = 'active'`
- และ `end_date IS NULL OR end_date = ''`
- ผูกกับ `unit_id` ของโรงพยาบาลที่เลือก

## doctor_total
- ชื่อแสดงผล: `แพทย์ทั้งหมด`
- นิยาม: นับเฉพาะ `position_name_th = นายแพทย์`
- หน่วยอัตรา: `คน/หมื่นปชก.`

## nurse_total
- ชื่อแสดงผล: `พยาบาลทั้งหมด`
- นิยาม:
  - `position_name_th = พยาบาลวิชาชีพ`
  - `position_name_th = พยาบาลวิชาชีพ/นักวิชาการสาธารณสุข`
- หน่วยอัตรา: `คน/หมื่นปชก.`

## pharmacist_total
- ชื่อแสดงผล: `เภสัชกรทั้งหมด`
- นิยาม: นับเฉพาะ `position_name_th = เภสัชกร`
- หน่วยอัตรา: `คน/หมื่นปชก.`

## physical_therapist_total
- ชื่อแสดงผล: `นักกายภาพบำบัด`
- นิยาม: นับเฉพาะ `position_name_th = นักกายภาพบำบัด`
- หน่วยอัตรา: `คน/แสนปชก.`

## psychologist_total
- ชื่อแสดงผล: `นักจิตวิทยา`
- นิยาม: นับเฉพาะ `position_name_th = นักจิตวิทยา`
- หน่วยอัตรา: `คน/แสนปชก.`

## clinical_psychologist_total
- ชื่อแสดงผล: `นักจิตวิทยาคลินิก`
- นิยาม: นับเฉพาะ `position_name_th = นักจิตวิทยาคลินิก`
- หน่วยอัตรา: `คน/แสนปชก.`

## หมายเหตุ
- ถ้าต้องการเปลี่ยนนิยาม ให้แก้ที่ `API/hr_workforce_dictionary.py`
- UI และ API ควรอ้างนิยามจากไฟล์นี้และ module เดียวกันเท่านั้น
