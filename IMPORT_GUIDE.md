# คู่มือการ Import ข้อมูล จ.18 เข้าสู่ฐานข้อมูล HR Blueprint

## ภาพรวม

มี 2 ขั้นตอนหลัก:
1. **Setup Database** - สร้างฐานข้อมูลและตารางทั้งหมด
2. **Import Data** - อ่านไฟล์ Excel และ import ข้อมูลเข้าฐานข้อมูล

---

## ขั้นตอนที่ 1: Setup Database

### SQLite (แนะนำสำหรับการทดสอบ)

```bash
cd C:\HR_blueprint\hr_blueprint_dashboard
python setup_database.py --db-type sqlite --db-path hr_blueprint.db
```

### PostgreSQL (แนะนำสำหรับ production)

```bash
python setup_database.py --db-type postgresql --db-url postgresql://user:password@localhost:5432/hr_blueprint
```

หลังจากรัน จะได้ฐานข้อมูลพร้อมตารางและข้อมูล reference:
- 8 จังหวัดเขต 1 (เชียงใหม่, เชียงราย, ลำพูน, ลำปาง, แพร่, น่าน, พะเยา, แม่ฮ่องสอน)
- Area classifications (urban, rural, remote, border)
- Employment types (ข้าราชการ, พนักงานราชการ, etc.)
- Specialties (อายุรศาสตร์, ศัลยศาสตร์, พยาบาล, etc.)

---

## ขั้นตอนที่ 2: Import Data จาก Excel

### คำสั่งพื้นฐาน

```bash
python import_excel_to_db.py --db-type sqlite --db-path hr_blueprint.db
```

### Options ที่ใช้บ่อย

```bash
# ระบุไฟล์ Excel ที่ต้องการ import
python import_excel_to_db.py \
  --excel-file "../ไฟล์ข้อมูล จ.18 - เขตสุขภาพที่ 1_(2026-01-01).xlsx" \
  --db-type sqlite \
  --db-path hr_blueprint.db

# ปรับ batch size (default: 1000)
python import_excel_to_db.py \
  --db-type sqlite \
  --db-path hr_blueprint.db \
  --batch-size 500

# Skip validation (import ต่อแม้มี error)
python import_excel_to_db.py \
  --db-type sqlite \
  --db-path hr_blueprint.db \
  --skip-validation
```

---

## ขั้นตอนที่ 3: ตรวจสอบข้อมูล

### ตรวจสอบด้วย sqlite3 CLI

```bash
# ดูตารางทั้งหมด
sqlite3 hr_blueprint.db ".tables"

# นับจำนวนบุคลากร
sqlite3 hr_blueprint.db "SELECT COUNT(*) FROM personnel;"

# นับจำนวนหน่วยงาน
sqlite3 hr_blueprint.db "SELECT COUNT(*) FROM organizational_unit;"

# ดูข้อมูลบุคลากรต่อจังหวัด
sqlite3 hr_blueprint.db "
SELECT p.province_code, pr.province_name_th, COUNT(*) as personnel_count
FROM personnel pe
JOIN organizational_unit ou ON pe.current_unit_id = ou.unit_id
JOIN provinces p ON ou.province_code = p.province_code
GROUP BY p.province_code, pr.province_name_th;
"
```

### ตรวจสอบด้วย Python

```python
import sqlite3
import pandas as pd

conn = sqlite3.connect('hr_blueprint.db')

# ดู schema
df = pd.read_sql("SELECT * FROM sqlite_master WHERE type='table'", conn)
print(df['name'].tolist())

# ดูข้อมูลบุคลากร
df = pd.read_sql("SELECT * FROM personnel LIMIT 5", conn)
print(df)

conn.close()
```

---

## โครงสร้างการแมปข้อมูล (Data Mapping)

### คอลัมน์ Excel → Database Fields

| Excel Column | Database Field | รายละเอียด |
|--------------|----------------|-----------|
| A | employment_type | ประเภทบุคลากร (ข้าราชการ, พนักงานราชการ, etc.) |
| C | employee_id | รหัสบุคลากร |
| E | position_code | รหัสตำแหน่ง |
| O | province_code | รหัสจังหวัด |
| Q | amphur_code | รหัสอำเภอ |
| S | ou_path3_code | รหัสหน่วยงาน |
| U | unit_name | ชื่อหน่วยงาน |
| AK | citizen_id | เลขบัตรประชาชน (13 หลัก) |
| AL | prefix_name | คำนำหน้า |
| AM | first_name | ชื่อ |
| AN | last_name | นามสกุล |
| BC | gender | เพศ |
| BG | birthdate | วันเกิด |
| BH | retirement_date | วันเกษียณ |
| BI | enrollment_date | วันบรรจุ |
| BS | position_name_th | ชื่อตำแหน่ง |

### การคำนวณ Area Classification

ระบบจะกำหนด area classification อัตโนมัติตามจังหวัด:

| จังหวัด | Area Class | Hardship | Incentive |
|---------|-----------|----------|-----------|
| เชียงใหม่ (50) | urban | 1 | 1.0x |
| เชียงราย (51) | border | 4 | 2.0x |
| ลำพูน (52) | rural | 2 | 1.0x |
| ลำปาง (53) | urban | 1 | 1.0x |
| แพร่ (54) | rural | 3 | 1.5x |
| น่าน (55) | remote | 5 | 1.5x |
| พะเยา (56) | rural | 2 | 1.0x |
| แม่ฮ่องสอน (58) | border | 5 | 2.0x |

---

## การแก้ไขปัญหา (Troubleshooting)

### Error: "No module named 'psycopg2'"

```bash
pip install psycopg2-binary
```

### Error: "encoding issues"

ไฟล์ `excel_reader.py` ใช้การ parse XML โดยตรงเพื่อหลีกเลี่ยงปัญหา encoding ไฟล์จึงอ่านได้ถูกต้องแม้มีภาษาไทย

### Error: "citizen_id checksum failed"

ระบบจะตรวจสอบ checksum ของเลขบัตรประชาชน หากไม่ถูกต้องจะไม่ import record นั้น สามารถปิดการตรวจสอบได้โดยแก้ไขใน `DataTransformer.clean_citizen_id()`

### Error: "batch commit failed"

ลด batch size ลง:
```bash
python import_excel_to_db.py --batch-size 100
```

---

## การดูข้อมูลด้วย Dashboard

หลังจาก import เสร็จ สามารถดูข้อมูลผ่าน Streamlit dashboard:

```bash
streamlit run dashboard.py
```

---

## ข้อมูลเพิ่มเติม

- [HR Blueprint Analyst SKILL.md](../SKILL.md)
- [Data Requirements v2.0](DATA_REQUIREMENTS.md)
- [Complete SQL DDL](hr_blueprint_complete_ddl.sql)
