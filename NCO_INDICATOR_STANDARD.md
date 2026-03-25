# NCO Indicator Standard (Canonical)
**Purpose:** นิยามตัวชี้วัดกลางให้เอกสาร แดชบอร์ด และเอนจินคำนวณใช้ชุดเดียวกัน  
**Version:** 2026-03-25

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
| DN0142 | Timely rtPA | high is good | `> 5%` | Neuro + ER fast-track team |
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
- Headcount by specialty
- FTE factor by specialty
- Workload (OPD/IPD/ER/OR/ICU)
- Productivity baseline per FTE

Formula:
```text
Need_FTE = ActualWorkload / Productivity_per_FTE
Deficit_FTE = max(0, Need_FTE - Available_FTE)
Suggested_Headcount = ceil(Deficit_FTE / Avg_FTE_per_person)
```

If workload/FTE unavailable -> output `Scenario Headcount` only (medium confidence).

---

## 5) Naming Alignment Rules
- ห้ามใช้รหัสเดียวกันต่างความหมาย (เช่น A01 ต้องหมายถึง Crude Death Rate เท่านั้น)
- ค่า threshold ในเอกสารกับโค้ดต้องเป็นชุดเดียวกัน
- ถ้าแก้ threshold ให้แก้พร้อมกันใน:
  - `simulation.js`
  - `MockingHospitalPlan.md`
  - `NCO_INDICATOR_STANDARD.md`
