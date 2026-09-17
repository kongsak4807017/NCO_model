# Profession-specific WISN + Health KPI Validation Design

## Goal
ยกระดับ HR Blueprint Simulator จากการใช้ facility workload ชุดเดียวกับทุกวิชาชีพ ไปเป็นการวิเคราะห์ที่ workload แต่ละตัวต้องเป็นงานที่วิชาชีพนั้นทำจริง หน่วยต้องตรงกับ Activity Standard และผล HR shortage/surplus ต้องผ่าน Data Fitness Gate ก่อนจึงสรุปเชิงบริหารได้ พร้อมเชื่อม Health/Service KPI ที่เกี่ยวข้องเป็น outcome context โดยไม่อ้างเหตุเชิงสาเหตุจากกำลังคนเพียงอย่างเดียว

## Design principles
1. **Profession-specific workload only for WISN FTE** — Total OPD/IPD/ER ของโรงพยาบาลเป็นข้อมูลอ้างอิง แต่ไม่ใช้คูณ Activity Standard ของทุกวิชาชีพอัตโนมัติ
2. **Unit match is mandatory** — workload unit และ activity-standard unit ต้องอธิบายเป็นคู่เดียวกัน เช่น physician OPD encounters × doctor minutes/physician OPD encounter; nursing IPD patient-days × nurse minutes/patient-day; pharmacy prescriptions × pharmacist minutes/prescription
3. **No silent proxy** — ถ้าไม่มีข้อมูลตรงตามนิยาม ห้ามใช้ total facility volume แทนอัตโนมัติ ให้สถานะ Data Fitness เป็น Blocked/Provisional
4. **No double counting** — แต่ละ workload row มี overlap policy; กรณี Chronic/Mental/Procedure ที่เป็น subset ของ OPD ต้องระบุ exclusive/deduplicated หรือไม่ให้นับซ้ำ
5. **Missing ≠ zero** — missing target actual served, workload, headcount หรือ KPI ไม่ถูกตีความเป็นศูนย์
6. **Evidence before conclusion** — ข้อสรุป shortage/surplus, Suggested Add และสี risk ใช้ได้เฉพาะเมื่อ gate สำคัญผ่านการทวนสอบ
7. **Outcome KPI is context, not causality** — แสดง KPI ที่เกี่ยวข้องกับ service line/profession เพื่อดูผลลัพธ์ร่วมกับ capacity แต่ไม่สรุปว่า staffing เป็นสาเหตุโดยลำพัง

## Data model
### Profile schema
Bump canonical schema to `nco-hr-profile-v2` while importing `nco-hr-profile-v1` through a compatibility path.

Required sheets in v2:
1. `Profile`
2. `Section_Metadata`
3. `Workload_History` — facility/population reference only; not the direct profession WISN numerator
4. `Profession_Workload` — canonical long-form profession-specific workload
5. `TargetNeed_History`
6. `Workforce_History`
7. `Profession_Config`
8. `Health_KPI_History`

### Profession_Workload fields
- `profession_code`, `profession_label`
- `year`
- `activity_code` — internal slot compatible with current WISN engine
- `workload_label`
- `volume`
- `volume_unit`
- `definition`
- `inclusion_criteria`
- `exclusion_criteria`
- `source`
- `verification_status` = Draft / Reviewed / Verified
- `overlap_policy` = independent / exclusive / deduplicated / unknown
- `note`
- `related_kpi_codes`

The simulator derives the calculation row for each profession/year from these records. Facility `Workload_History` remains reference-only for population and reconciliation.

### Profession workload dictionary
A canonical dictionary maps `(profession_code, activity_code)` to the intended workload proxy and unit. Initial supported professions use existing simulator professions but visible labels/definitions are profession-specific.

Examples:
- Doctor + OPD: physician OPD encounters, `visits/year`; exclude nurse-only/dental/physio/pharmacy-only encounters.
- Doctor + ER: ER encounters with physician assessment, `visits/year`.
- Nurse + IPD slot: nursing inpatient patient-days, `patient-days/year`; Activity Standard becomes minutes/patient-day rather than minutes/admission.
- Pharmacist + OPD slot: prescriptions/dispensing episodes, `prescriptions/year`.
- Dentist + procedure slot: dental procedures, `procedures/year`.
- Physiotherapist + procedure slot: treatment sessions, `sessions/year`.
- Psychologist + mental slot: assessment/counselling/psychotherapy sessions, `sessions/year`.
- Public health + outreach slot: verified outreach/home-visit/screening service units, with the unit declared explicitly.

Technical activity codes may remain compatible with the current engine, but visible definition/unit is profession-specific and comes from the canonical dictionary.

## Data Fitness Gate
Each profession-year result receives a fitness level:
- **Verified** — workforce actual headcount/FTE observed, profession workload present and Verified with source, overlap safe, WISN standards/assumptions Verified, and units match the dictionary.
- **Provisional** — enough data to calculate an exploratory FTE but one or more standards/provenance items are not Verified.
- **Blocked** — missing actual workforce, no profession-specific workload, unit mismatch, unknown overlap on included overlapping workload, or no usable source.

When level is not Verified:
- `Risk` displays Provisional/Blocked, not red/yellow/green shortage risk.
- `Suggested Add` and `Reallocate` display `—`.
- recommendation begins with `ยังสรุปขาด/เกินไม่ได้` and lists gate failures.

## Target need missing-data rule
`actualServed` is only used for coverage/workload gap when explicitly observed. Blank means unknown, not zero. Target service need may still be shown from documented target population/coverage/frequency, but coverage gap is `N/A` until actual served is observed.

## Health KPI layer
Use existing repository definitions as the source catalog.

Canonical outcomes from `NCO_INDICATOR_STANDARD.md`:
- A01 Crude Death Rate
- A04 AMI Mortality
- A09 Septicemia/Sepsis Mortality
- B01 Maternal Mortality
- C02 CMI
- D01 Bed Occupancy
- F10 Referral leakage to tertiary

Service-plan outcomes already represented in `API/district_baseline_store.py`:
- DH0101 STEMI Mortality
- DH0102 AMI Mortality
- DN0101 Stroke Mortality
- DN0142D Ischemic Stroke Death with rtPA
- CI0101 Sepsis Mortality
- PE0102 Pediatric Pneumonia Mortality
- CM0203 Neonatal Mortality
- CM0101 Maternal Mortality
- DC0401 Cancer Mortality
- DG0201 Perforated Appendicitis
- PS0001 Suicide Rate
- RH0101 Stroke Rehabilitation Coverage

Do not invent thresholds where the canonical standard has none. `Health_KPI_History` stores actual yearly values, source, status, note. UI links relevant KPI codes to profession/service workload as an outcome context. Copy must explicitly state that KPI association does not prove causal effect of staffing.

## UI changes
1. Rename WISN default option to `Illustrative defaults — NOT VALIDATED`.
2. Historical workload section clearly separates:
   - Population/facility totals = reference/reconciliation only
   - Profession-specific workload = data used for WISN
3. Add profession filter and editable profession workload table with definition, unit, source, verification and overlap policy.
4. Add Data Fitness summary cards and per-result fitness column.
5. Add Health Outcome KPI panel with year, KPI, value, threshold/direction when canonical, source/status, and linked profession/service context.
6. Tooltip/help and trace use the same canonical profession-workload/KPI dictionary.

## Excel template changes
The generated workbook must be understandable without separate training:
- Add `Profession_Workload` and `Health_KPI_History` sheets.
- Friendly Thai headers plus helper rows for definition, unit, source, formula role and examples.
- `Workload_History` wording explicitly states facility reference only and not directly used for profession WISN FTE.
- `Profession_Workload` rows are pre-seeded for selected professions and 5 historical years with blank volumes and canonical units/definitions.
- `Health_KPI_History` rows are pre-seeded from repository KPI catalog with blank actual values.
- Blank stays blank; true observed zero is allowed only when explicitly entered.

## Google Sheets sync
Apps Script is updated to schema v2 and the 8-sheet list. Missing optional v2 sheets during v1 import are handled by simulator compatibility, but a v2 endpoint is expected to expose all 8 names.

## Testing
Add regression coverage for:
1. generic facility OPD cannot be used as doctor WISN workload in v2.
2. doctor OPD definition is physician encounters and excludes non-physician-only services.
3. nurse IPD expected unit is patient-days, not admissions.
4. missing actualServed does not become zero coverage gap.
5. unverified/missing workload blocks shortage conclusion and Suggested Add.
6. verified profession workload + workforce + WISN can yield verified risk.
7. KPI catalog uses repository codes and does not create missing thresholds.
8. Excel/Google schema v2 includes the two new sheets while v1 import remains supported.
