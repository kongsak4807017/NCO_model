# NCO Indicator Standard (Canonical)
**Purpose:** นิยามตัวชี้วัดกลางให้เอกสาร แดชบอร์ด และเอนจินคำนวณใช้ชุดเดียวกัน  
**Version:** 2026-09-18

---

## 1) Canonical Outcome Set
| Code | Name | Direction | Threshold | Unit | Role in NCO |
|---|---|---|---|---|---|
| A01 | Crude Death Rate | low is good | `< 3.5` | % | Outcome validation |
| A04 | AMI Mortality | low is good | `< 8` | % | Outcome validation |
| A09 | Septicemia Mortality | low is good | `< 20` | % | Outcome validation |
| B01 | Maternal Mortality | low is good | `< 70` | /100k | Outcome validation |
| C02 | CMI | high is good | `> 1.5` | AdjRW | Capability signal |
| D01 | Bed Occupancy | in range is good | `80-85` | % | Efficiency signal |
| F10 | Referral leakage to tertiary | low is good | `< 15` | % | Self-reliance signal |

---

## 2) Canonical Service Plan -> Specialty Map
| Code | Name | Direction | Threshold | Suggested Specialty |
|---|---|---|---|---|
| DH0101 | STEMI mortality | low is good | `< 12%` | Interventional cardio + CCU/Cath nurse |
| DN0101 | Stroke mortality | low is good | `< 15%` | Neurologist + Stroke nurse |
| DN0142D | Ischemic Stroke Death with rtPA | low is good | `< 1%` | Neuro + ER team |
| CI0101 | Sepsis mortality | low is good | `< 20%` | ID/Internal med + ICU nurse |
| CM0101 | Maternal mortality | low is good | `< 70/100k` | OB + Labor nurse |
| CM0203 | Neonatal mortality | low is good | `< 10/1000` | Neonatologist + NICU nurse |

---

## 3) Data Quality Gate
| Code | Meaning | Rule |
|---|---|---|
| G01 | %AdjRW=0 | `< 1%` |
| G02 | %Pdx Ill-defined | `< 5%` |
| G03 | %Pdx Ill-defined (death) | `< 10%` |
| G04 | %ICD low quality | `< 5%` |

Rule: ถ้าไม่ผ่านอย่างน้อย 1 ตัว ให้ผลแนะนำเป็น `provisional`.

---

## 4) Capacity Quantification Standard
Required inputs for numeric staffing recommendation:
- Headcount by specialty/profession
- FTE factor by specialty/profession
- **Profession-specific workload ที่นิยามและหน่วยตรงกับกิจกรรมของวิชาชีพนั้น**
- Productivity/Activity Standard ที่ผ่านการทวนสอบ

สำหรับ HR Blueprint WISN v2:
```text
Demand_Minutes = Σ(Profession_Workload_Volume × Activity_Standard_Minutes_per_Unit × Complexity_Index)
Service_FTE = Demand_Minutes / AWT
CAF = 1 / (1 - CAS/100)
IAF = IAS_hours × 60 / AWT
Required_FTE = (Service_FTE × CAF) + IAF
Actual_Supply_FTE = Actual_Annual_Headcount × FTE_Factor
HR_GAP = Required_FTE - Actual_Supply_FTE
```

หลักการสำคัญ:
- Total OPD/IPD/ER ของโรงพยาบาลเป็น facility reference และ **ห้ามนำไปเป็น workload ของทุกวิชาชีพโดยอัตโนมัติ**
- ตัวอย่าง Doctor OPD ต้องเป็น physician OPD encounters ที่แพทย์ตรวจจริง
- ตัวอย่าง Nurse IPD ถ้าใช้ minutes/patient-day ต้องใช้ patient-days เป็น workload numerator
- ตัวอย่าง Pharmacist OPD ควรใช้ prescription/dispensing workload ไม่ใช่ OPD visits
- ถ้า workload/FTE/หน่วย/overlap/standard ยังไม่ผ่าน Data Fitness Gate ให้ผลเป็น `provisional` หรือ `blocked` และไม่ออก Suggested Add เชิงนโยบาย

---

## 5) Health KPI Use in HR Blueprint v2

Health/Service KPI ใช้เป็น **outcome context** เพื่อประกอบการตอบว่า “ผลลัพธ์บริการ/สุขภาพเป็นอย่างไรในช่วงที่ capacity เป็นแบบนี้” ไม่ใช่หลักฐานเชิงสาเหตุว่าจำนวนบุคลากรเป็นเหตุของ KPI โดยลำพัง

แนวทางเชื่อม:
- Doctor/ER/Cardio workload → A04, DH0101
- Doctor/Nurse ER-IPD sepsis workload → A09, CI0101
- Doctor/Nurse stroke workload → DN0101, DN0142D
- Maternal/Delivery workload → B01, CM0101, CM0203
- IPD capacity → C02, D01
- Network/service capability → F10
- Rehabilitation workload → RH0101 (เมื่อมีค่าจริงจาก source)
- Mental health workload → PS0001 (เมื่อมีค่าจริงจาก source)

ตัวชี้วัดเพิ่มเติมที่มีอยู่ใน `API/district_baseline_store.py` เช่น `DH0102`, `PE0102`, `DC0401`, `DG0201`, `PS0001`, `RH0101` สามารถใช้เป็น context ได้ แต่ **ห้ามสร้าง threshold ขึ้นเอง** หาก canonical standard ยังไม่ได้กำหนด

การตีความ KPI ต้องคำนึงถึง case mix, referral pattern, technology, clinical process, access และปัจจัยอื่นร่วมด้วย

---

## 6) Naming Alignment Rules
- ห้ามใช้รหัสเดียวกันต่างความหมาย (เช่น A01 ต้องหมายถึง Crude Death Rate เท่านั้น)
- ค่า threshold ในเอกสารกับโค้ดต้องเป็นชุดเดียวกัน
- ถ้าแก้ threshold ให้แก้พร้อมกันใน:
  - `simulation.js`
  - `MockingHospitalPlan.md`
  - `NCO_INDICATOR_STANDARD.md`
  - `Simulator_HR_blueprint_profession_dictionary.js` เมื่อ KPI นั้นถูกใช้ใน HR Blueprint
