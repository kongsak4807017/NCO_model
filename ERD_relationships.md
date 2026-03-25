
# HR Blueprint Database - Table Relationships

## 1. Entity: hr_personnel (Main Table)

```
┌─────────────────────────────────────────────────────────────────┐
│                        hr_personnel                             │
│                    (39,733 records)                             │
├─────────────────────────────────────────────────────────────────┤
│ PK │ id                    │ INTEGER │ Auto increment          │
├─────────────────────────────────────────────────────────────────┤
│    │ employment_type_name  │ TEXT    │ ประเภทบุคลากร (A)       │
│    │ employment_rev_status │ TEXT    │ สถานะ/การยุบเลข (B)      │
│    │ employee_id           │ TEXT    │ รหัสพนักงาน (C)          │
│    │ position_id           │ TEXT    │ รหัสตำแหน่ง (D)          │
│    │ position_code         │ TEXT    │ เลขที่ตำแหน่ง (E)        │
├─────────────────────────────────────────────────────────────────┤
│                    ORGANIZATION INFO                            │
├─────────────────────────────────────────────────────────────────┤
│    │ ou_path2_code         │ TEXT    │ รหัสกรม (จ.18)          │
│    │ ou_path2_name         │ TEXT    │ ชื่อกรม (จ.18)          │
│    │ province_code         │ TEXT    │ รหัสจังหวัด (จ.18)      │
│    │ province_name         │ TEXT    │ จังหวัด (จ.18)          │
│    │ amphur_code           │ TEXT    │ รหัสอำเภอ (จ.18)        │
│    │ amphur_name           │ TEXT    │ อำเภอ (จ.18)            │
│    │ pos_ou_path2_code     │ TEXT    │ รหัสกรม (อต.)          │
│    │ pos_ou_path2_name     │ TEXT    │ ชื่อกรม (อต.)          │
│    │ pos_province_code     │ TEXT    │ รหัสจังหวัด (อต.)      │
│    │ pos_province_name     │ TEXT    │ จังหวัด (อต.)          │
├─────────────────────────────────────────────────────────────────┤
│                    PERSONAL INFO                                │
├─────────────────────────────────────────────────────────────────┤
│    │ citizen_no            │ TEXT    │ เลขบัตรปชช (13 หลัก)     │
│    │ name_prefix_name      │ TEXT    │ คำนำหน้า                 │
│    │ name                  │ TEXT    │ ชื่อ                     │
│    │ surname               │ TEXT    │ นามสกุล                 │
│    │ gender                │ TEXT    │ รหัสเพศ                 │
│    │ gender_name           │ TEXT    │ เพศ                      │
│    │ birthdate             │ TEXT    │ วันเกิด                 │
│    │ retirement_date       │ TEXT    │ วันครบเกษียณ            │
│    │ enrollment_date       │ TEXT    │ วันบรรจุ/จ้าง            │
├─────────────────────────────────────────────────────────────────┤
│                    POSITION INFO                                │
├─────────────────────────────────────────────────────────────────┤
│    │ manage_position_name    │ TEXT  │ ตำแหน่งบริหาร (อต.)    │
│    │ position_specialist_name│ TEXT  │ สาขาความเชี่ยวชาญ (อต.)│
│    │ line_position_name      │ TEXT  │ ตำแหน่งสายงาน (อต.)    │
│    │ position_type_name      │ TEXT  │ ประเภทตำแหน่ง (อต.)    │
│    │ from_level_name         │ TEXT  │ ระดับเริ่มต้น (อต.)    │
│    │ to_level_name           │ TEXT  │ ระดับสิ้นสุด (อต.)      │
│    │ pay_manage_position_name    │ TEXT  │ ตำแหน่งบริหาร (จ.18)   │
│    │ pay_position_specialist_name│ TEXT  │ สาขาเชี่ยวชาญ (จ.18)  │
│    │ pay_line_position_name      │ TEXT  │ ตำแหน่งสายงาน (จ.18)  │
│    │ pay_position_type_name      │ TEXT  │ ประเภทตำแหน่ง (จ.18)  │
├─────────────────────────────────────────────────────────────────┤
│                    EDUCATION INFO                               │
├─────────────────────────────────────────────────────────────────┤
│    │ enrollment_education_level_name │ TEXT │ วุฒิบรรจุ-ระดับ   │
│    │ enrollment_degree_name          │ TEXT │ วุฒิบรรจุ-ชื่อ     │
│    │ enrollment_subject_name         │ TEXT │ วุฒิบรรจุ-สาขา     │
│    │ highest_education_level_name    │ TEXT │ วุฒิสูงสุด-ระดับ  │
│    │ highest_degree_name             │ TEXT │ วุฒิสูงสุด-ชื่อ    │
│    │ highest_subject_name            │ TEXT │ วุฒิสูงสุด-สาขา    │
│    │ fte_education_level_name        │ TEXT │ วุฒิFTE-ระดับ      │
│    │ fte_degree_name                 │ TEXT │ วุฒิFTE-ชื่อ        │
│    │ fte_subject_name                │ TEXT │ วุฒิFTE-สาขา        │
├─────────────────────────────────────────────────────────────────┤
│                    MOVEMENT INFO                                │
├─────────────────────────────────────────────────────────────────┤
│    │ movement_name       │ TEXT │ ชื่อการเคลื่อนไหว        │
│    │ movement_name2      │ TEXT │ สาเหตุการย้าย (จ.18)     │
│    │ from_date           │ TEXT │ วันที่มีผล              │
│    │ empty_movement_name │ TEXT │ สาเหตุการย้าย (ว่าง)     │
├─────────────────────────────────────────────────────────────────┤
│                    SALARY INFO                                  │
├─────────────────────────────────────────────────────────────────┤
│    │ salary         │ TEXT │ เงินเดือน                    │
│    │ other_income1  │ TEXT │ เงินประจำตำแหน่ง            │
│    │ other_income2  │ TEXT │ เงินค่าตอบแทนพิเศษ          │
│    │ other_income3  │ TEXT │ เงิน บ.ม.                   │
│    │ other_income4  │ TEXT │ เงิน บ.ช.                   │
│    │ other_income5  │ TEXT │ เงิน บ.ล.                   │
│    │ other_income6  │ TEXT │ เงินค่าตอบแทนเวชสถิติ       │
│    │ other_income7  │ TEXT │ เงินเพิ่มค่าครองชีพ         │
├─────────────────────────────────────────────────────────────────┤
│ METADATA                                                        │
├─────────────────────────────────────────────────────────────────┤
│    │ created_at │ TIMESTAMP │ วันที่สร้าง                 │
│    │ updated_at │ TIMESTAMP │ วันที่อัพเดท                │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Relationships

```
                    ┌─────────────────┐
                    │  hr_personnel   │
                    │   (Main Table)  │
                    │  39,733 records │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ v_personnel_  │   │ v_personnel_  │   │ v_personnel_  │
│ by_type       │   │ by_province   │   │ display       │
│ (Aggregate)   │   │ (Aggregate)   │   │ (View)        │
└───────────────┘   └───────────────┘   └───────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ data_dictionary │
                    │  (Metadata)     │
                    └─────────────────┘
```

## 3. Field Groups

```
hr_personnel
├── Group 1: Identification (Fields A-E)
│   ├── employment_type_name
│   ├── employment_rev_status
│   ├── employee_id
│   ├── position_id
│   └── position_code
│
├── Group 2: Organization จ.18 (Fields F-AB)
│   ├── 22 fields for organization info
│   └── province, amphur, department
│
├── Group 3: Organization อต. (Fields AC-AX)
│   ├── 26 fields for position organization
│   └── parallel structure to Group 2
│
├── Group 4: Personal Info (Fields AY-BG)
│   ├── citizen_no, name, surname
│   ├── gender, birthdate
│   └── status fields
│
├── Group 5: Dates (Fields BH-BP)
│   ├── birthdate, retirement_date
│   ├── enrollment_date
│   └── various entry dates
│
├── Group 6: Position อต. (Fields BQ-CJ)
│   ├── management position
│   ├── specialist position
│   └── line position
│
├── Group 7: Position จ.18 (Fields CK-DB)
│   └── parallel to Group 6
│
├── Group 8: Conditions (Fields DC-EX)
│   ├── p_condition (กัน)
│   ├── c_condition (ตรึง)
│   └── g_condition (พรก.)
│
├── Group 9: Education (Fields CZ-EU)
│   ├── enrollment education
│   ├── position education
│   ├── highest education
│   └── FTE education
│
├── Group 10: Movement (Fields EV-FS)
│   └── transfer and movement info
│
└── Group 11: Salary (Fields FH-FW)
    ├── salary
    └── other_income 1-19
```
