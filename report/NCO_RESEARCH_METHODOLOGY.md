# NCO Research Methodology and Calculation Framework

Updated: 2026-04-07

## 1. วัตถุประสงค์ของเอกสาร

เอกสารนี้จัดทำขึ้นเพื่ออธิบายตรรกะการวิเคราะห์ของระบบ NCO/HR Blueprint ตาม implementation จริงในระบบปัจจุบัน โดยเขียนในรูปแบบที่สามารถนำไปใช้เป็นภาควิธีวิจัย, ภาคเครื่องมือ, หรือ technical appendix ของรายงาน/บทความได้

เป้าหมายของเอกสารนี้มี 4 ข้อ

1. อธิบายว่าระบบใช้ข้อมูลใดบ้าง
2. อธิบายว่าระบบคำนวณอย่างไรทีละขั้นตอน
3. อธิบายว่าทำไมจึงเลือกใช้สถิติและกฎการคำนวณแบบนี้
4. แยกให้ชัดว่าอะไรเป็นหลักฐานภายนอกที่รองรับเชิงแนวคิด และอะไรเป็นค่า benchmark ภายในระบบที่ยังมีสถานะเป็น `provisional`

เอกสารนี้ยึดตามโค้ดจริงของระบบ ณ เวลาจัดทำ ไม่ได้เสนอ architecture ใหม่ และไม่เปลี่ยนสูตรการคำนวณในระบบ

## 2. ขอบเขตของเอกสาร

เอกสารนี้ครอบคลุม calculation path ที่ใช้จริงใน simulation และ backend clinical staffing engine ได้แก่

- Data Quality Gate
- Need-side population burden model
- Health Need Index (HNI)
- Profession need mix
- Workforce Capacity Index (WCI)
- Clinical denominator resolution
- Workload-calibrated Need_FTE preview
- Gap analysis
- Outcome validation
- Service Plan specialty recommendation
- Confidence scoring

เอกสารนี้อ้างถึง PP module เฉพาะในส่วน governance/confidence ที่เชื่อมกับระบบหลัก แต่ไม่ได้ลงรายละเอียดตัวชี้วัด PP phase 1 ทุกตัวแบบเต็มชุด เนื่องจากเป็นเครื่องมือย่อยอีกชิ้นหนึ่ง

## 3. ฐานคิดเชิงวิธีวิจัย

ระบบนี้เป็น `hybrid decision-support model` ไม่ใช่สูตรจัดกรอบอัตรากำลังทางกฎหมายโดยตรง และไม่ใช่ WISN ฉบับเต็มแบบ one-to-one activity time study

ในเชิงวิธีวิจัย ระบบนี้ผสานหลักคิด 5 ชั้นเข้าด้วยกัน

1. `Need-based logic`
ใช้โครงสร้างประชากร ภาระโรคเรื้อรัง และความเสี่ยงสุขภาพจิตเพื่อประมาณแรงกดดันด้านความต้องการบริการ

2. `Capacity-based logic`
ใช้จำนวนบุคลากรจริงต่อประชากรและ skill-mix เพื่อดูว่าศักยภาพกำลังคนเพียงพอเพียงใด

3. `Workload-based logic`
ใช้ workload service functions เช่น OPD, IPD, ER, OR, delivery, mental, chronic เพื่อปรับ Need_FTE ตามภาระงานใช้งานจริง

4. `Outcome-based validation`
ใช้ผลลัพธ์ A-H และ Service Plan เพื่อตรวจว่าปัญหาที่เห็นควรตีความเป็น shortage, process bottleneck, หรือ data quality issue

5. `Governance and confidence logic`
ใช้แหล่งข้อมูล, ปีข้อมูล, ความครบถ้วน, scope match, และ audit availability เพื่อกำหนดระดับความเชื่อมั่นของข้อเสนอ

กล่าวอีกแบบหนึ่ง ระบบนี้ตั้งอยู่บนกรอบ `structure-process-outcome` ของงานคุณภาพบริการสุขภาพ โดย

- `structure` = workforce capacity, denominator scope, benchmark configuration
- `process` = workload, referral flow, specialty pathway, data quality
- `outcome` = mortality, CMI, BOR, referral leakage, service-plan indicators

## 4. ฐานอ้างอิงเชิงแนวคิดจากภายนอก

### 4.1 Workforce planning

แนวคิดหลักด้านการประมาณกำลังคนอิงจากหลัก `workload-based staffing` ซึ่งสอดคล้องกับ WHO WISN ว่าการวางแผนกำลังคนควรผูกกับภาระงานจริงและ skill mix ไม่ใช่นับ headcount แบบหยาบเพียงอย่างเดียว

อย่างไรก็ดี implementation นี้เป็น `simplified workload-calibrated proxy model` ไม่ใช่ WISN เต็มรูปแบบ เพราะระบบยังไม่ได้เก็บ time standard รายกิจกรรมรายวิชาชีพครบทุก task

### 4.2 Ageing, chronic disease, mental health

การเลือกแกน `elderly + chronic disease + mental risk` เป็น need-side inputs สอดคล้องกับหลักฐานสากลที่ชี้ว่าประชากรสูงอายุ, NCD burden, และ mental health burden เป็นตัวขับความต้องการบริการอย่างมีนัยสำคัญ และส่งผลต่อ skill mix ของทีมสุขภาพ

### 4.3 Quality measurement

การใช้ outcome indicators ควบคู่ capacity indicators สอดคล้องกับกรอบ Donabedian และกรอบคุณภาพบริการที่มองทั้ง structure, process, outcome ร่วมกัน ไม่ตีความ mortality หรือ service outcome โดยไม่ดูทรัพยากรและ workflow

### 4.4 Health information systems and data quality

การมี Data Quality Gate ก่อนการตีความ recommendation สอดคล้องกับ WHO RHIS/DQA toolkit ซึ่งย้ำว่าการตัดสินใจเชิงบริหารต้องผูกกับคุณภาพข้อมูล routine facility data

### 4.5 Statistical robustness

ระบบใช้ median สำหรับ peer baseline และใช้ percentile p50/p75 สำหรับ workload reference calibration เพื่อให้ค่ามาตรฐานทนต่อ outlier มากกว่าการใช้ mean เพียงตัวเดียว

## 5. แหล่งข้อมูลที่ระบบใช้จริง

### 5.1 แหล่งข้อมูลภายในระบบ

- `simulation.js`
- `API/need_fte_engine.py`
- `API/clinical_denominator_store.py`
- `API/analysis_governance_store.py`
- `API/district_baseline_store.py`
- `API/hr_workforce_dictionary.py`
- `NCO_INDICATOR_STANDARD.md`

### 5.2 ตาราง/แหล่งข้อมูล runtime หลัก

- `assignment`, `position`, `organizational_unit`
- `workload`
- `hospital_scope_config`
- `hdc_amphur_population_reference`
- `analysis_benchmark_reference`
- `analysis_workload_reference`
- `analysis_indicator_policy`
- `analysis_run_history`
- `data_inputV1.csv`

### 5.3 แหล่งข้อมูลภายนอกที่รองรับเชิง provenance

เชิง implementation ปัจจุบัน ระบบอาศัยข้อมูลที่ ETL เข้ามาจากฐานข้อมูลภายในโครงการและจากแหล่งข้อมูลภาครัฐ/สาธารณสุขไทยหลายประเภท เช่น population, health service data, workforce report, mental health report, และ service statistics รายหน่วยบริการ

ในเชิงงานวิจัย ควรอธิบายว่าระบบมี `multi-source evidence chain` ดังนี้

- ข้อมูลประชากร: แหล่งอ้างอิงระดับพื้นที่ เช่น DOPA หรือ population reference ที่ ETL มา
- ข้อมูลบริการและ burden: HDC/Open Data/health service statistics
- ข้อมูลกำลังคน: ฐาน HR assignment ภายในโครงการ
- ข้อมูล outcome และ service plan: outcome table/scraped service statistics ที่ถูก canonicalize

## 6. ตัวแปรนำเข้าทั้งหมดที่ใช้ใน calculation path หลัก

### 6.1 กลุ่ม Data Quality

| Code | ตัวแปร | ความหมาย | เกณฑ์ |
|---|---|---|---|
| G01 | `%AdjRW = 0` | ความผิดปกติของ coding/casemix | `< 1%` |
| G02 | `%Pdx Ill-defined` | คุณภาพ principal diagnosis ต่ำ | `< 5%` |
| G03 | `%Pdx Ill-defined (Death)` | คุณภาพ diagnosis ใน death cases ต่ำ | `< 10%` |
| G04 | `%ICD Low Quality` | coding quality ต่ำ | `< 5%` |

บทบาทเชิงวิธีวิจัย:

- ใช้เป็น `data admissibility / interpretability gate`
- ไม่ได้หยุดการคำนวณทุกกรณี แต่ลดความมั่นใจของ recommendation และทำให้ผลควรถูกตีความแบบ `provisional`

### 6.2 กลุ่มประชากรและภาระสุขภาพ

| Variable | หน่วย | บทบาท |
|---|---|---|
| `population_total` | คน | ฐานประชากร fallback |
| `population_male` | คน | คำอธิบายโครงสร้างประชากร |
| `population_female` | คน | คำอธิบายโครงสร้างประชากร |
| `elderly_pct` | % | need-side burden |
| `prevalence_cvd` | ต่อแสนประชากร | chronic burden component |
| `prevalence_cancer` | ต่อแสนประชากร | chronic burden component |
| `prevalence_dm` | ต่อแสนประชากร | chronic burden component |
| `prevalence_ckd` | ต่อแสนประชากร | chronic burden component |
| `mental_risk_rate` | ต่อแสนประชากร | mental burden component |

หมายเหตุเชิงวิธีวิจัย:

- ใน frontend ฟังก์ชัน `getChronicPrevalence()` รวม CVD + Cancer + DM + CKD เป็น composite chronic burden
- ชื่อตัวแปรบางส่วนใน implementation เช่น `chronic_rate_pct` หรือ `Mental_Risk_Rate_%` มีลักษณะเป็น naming debt เพราะในเชิงหน่วยจริงระบบปฏิบัติการผสมทั้งค่าร้อยละและค่าต่อแสน
- หากนำไปเขียนบทความ ควรระบุชัดว่าเป็น `composite chronic burden indicator` มากกว่าจะเรียกเปอร์เซ็นต์โดยตรง

### 6.3 กลุ่มกำลังคนคลินิกหลัก

| Variable | ความหมาย |
|---|---|
| `doctor_total` | แพทย์ทั้งหมด |
| `nurse_total` | พยาบาลทั้งหมด |
| `pharmacist_total` | เภสัชกร |
| `physical_therapist_total` | นักกายภาพบำบัด |
| `psychologist_total` | นักจิตวิทยา |
| `clinical_psychologist_total` | นักจิตวิทยาคลินิก |

นิยามเชิงฐานข้อมูล:

- ใช้บุคลากรที่ `assignment.status = 'active'`
- และ `end_date` ว่างหรือไม่มี
- จับคู่กับ `position_name_th` ตาม dictionary กลางใน `API/hr_workforce_dictionary.py`

### 6.4 กลุ่ม workload service functions

| Variable | ความหมาย |
|---|---|
| `outpatient_visits` | OPD visits |
| `inpatient_visits` | IPD visits |
| `emergency_visits` | ER visits |
| `surgery_count` | OR cases |
| `delivery_count` | delivery workload |
| `mental_health_visits` | mental health visits |
| `chronic_disease_visits` | chronic disease visits |
| `icu_bed_days` | ICU load; ในรอบนี้ยังมีการใช้น้อย |
| `total_workload_score` | score รวมเชิง workload หากมีอยู่ในตาราง |

### 6.5 กลุ่ม outcome ระดับระบบบริการ

| Code | ตัวชี้วัด | Direction | Threshold |
|---|---|---|---|
| A01 | Crude Death Rate | ต่ำดีกว่า | `< 3.5` |
| A04 | AMI Mortality | ต่ำดีกว่า | `< 8` |
| A09 | Sepsis Mortality | ต่ำดีกว่า | `< 20` |
| B01 | Maternal Mortality | ต่ำดีกว่า | `< 70/100k` |
| C02 | CMI | สูงดีกว่า | `> 1.5` |
| D01 | Bed Occupancy Rate | อยู่ในช่วงดีกว่า | `80-85` |
| F10 | Referral Leakage to Tertiary | ต่ำดีกว่า | `< 15` |

### 6.6 กลุ่ม Service Plan/Specialty indicators

| Code | ตัวชี้วัด | Threshold | Direction |
|---|---|---|---|
| DH0101 | STEMI Mortality | `< 12` | low is good |
| DH0102 | AMI Mortality | `< 10` | low is good |
| DN0101 | Stroke Mortality | `< 15` | low is good |
| DN0142D | Ischemic Stroke Death with rtPA | `< 1` | low is good |
| CI0101 | Sepsis Mortality | `< 20` | low is good |
| PE0102 | Pediatric pneumonia mortality | `< 3` | low is good |
| CM0203 | Neonatal Mortality | `< 10/1000` | low is good |
| CM0101 | Maternal Mortality | `< 70/100k` | low is good |
| DC0401 | Cancer Mortality | `< 15` | low is good |
| DG0201 | Perforated appendicitis | `< 30` | low is good |
| PS0001 | Suicide rate | `< 5/100k` | low is good |
| RH0101 | Stroke got PT | `> 50` | high is good |

### 6.7 กลุ่ม scope และ denominator metadata

| Variable | บทบาท |
|---|---|
| `hospital_name` | ตัวระบุโรงพยาบาล |
| `province_code` | ตัวระบุจังหวัด |
| `unit_name` | หน่วยบริการ |
| `clinical_scope_type` | amphur / province / network_zone / workload |
| `clinical_scope_name` | ชื่อ scope ที่ใช้จริง |
| `pp_population_total` | amphur population ฝั่งพื้นที่รับผิดชอบ |
| `workload_share` | สัดส่วน workload ของหน่วยต่อจังหวัด |
| `workload_population_proxy` | ประชากรเทียบเท่าจาก workload |

## 7. โครงสร้าง workflow การคำนวณแบบทีละขั้นตอน

## 7.1 ขั้นที่ 1: ตรวจสอบคุณภาพข้อมูลก่อน

ระบบตรวจ G01-G04 ก่อนตีความ recommendation

เหตุผล:

- outcome ที่มาจาก administrative data และ coding data อาจมีความคลาดเคลื่อนจากปัญหา ICD quality
- ถ้า quality ต่ำ การเพิ่มคนจากตัวเลขที่ผิดอาจเป็นการแก้ปัญหาผิดจุด

ตรรกะ:

- ถ้า DQ fail อย่างน้อย 1 ตัว ผลควรถูกอ่านแบบ `provisional`
- ไม่ได้แปลว่า “ห้ามคำนวณ” เสมอ แต่แปลว่า “ห้ามเชื่อผลแบบเด็ดขาด”

## 7.2 ขั้นที่ 2: กำหนดฐานประชากรเชิงคลินิก (Clinical Denominator)

backend ใช้ `resolve_clinical_denominator()` เพื่อหา denominator ที่เหมาะกับระดับบทบาทของโรงพยาบาล

สูตร workload proxy ที่ใช้ใน denominator:

```text
workload_proxy =
  outpatient_visits
  + 12 * inpatient_visits
  + 1.5 * emergency_visits
  + 20 * surgery_count
  + 15 * delivery_count
  + 1.2 * mental_health_visits
  + 1.1 * chronic_disease_visits
  + total_workload_score
```

มี 4 วิธีหลัก

1. `amphur_population`
- ใช้ประชากรอำเภอ/พื้นที่รับผิดชอบโดยตรง

2. `province_workload_blend`
- ใช้ค่า max ระหว่าง
  - ประชากรอำเภอ
  - province floor = 30% ของประชากรจังหวัด
  - workload-adjusted proxy = workload population proxy x 1.20
- แล้ว cap ไม่ให้เกินประชากรจังหวัด

3. `network_zone_workload_adjusted`
- ใช้ค่า max ระหว่างประชากรอำเภอกับ workload-adjusted proxy
- แล้ว cap ไม่ให้เกิน 60% ของประชากรจังหวัด

4. `workload_population_proxy`
- ใช้ประชากรเทียบเท่าจาก workload เมื่อ role ของหน่วยบริการเป็น referral/service node ชัด

เหตุผลเชิงวิธีวิจัย:

- โรงพยาบาลไม่ได้รับภาระจากประชากรตามทะเบียนเพียงอย่างเดียว
- รพศ./รพท. มักรับภาระ referral เกินขอบเขตอำเภอ
- การใช้ workload-adjusted denominator จึงช่วยลด bias ของการประเมินกำลังคนเมื่อโรงพยาบาลทำหน้าที่เกินพื้นที่ประชากรทะเบียน

## 7.3 ขั้นที่ 3: คำนวณ Health Need Index (HNI)

HNI ใช้ 3 แกน

- elderly burden
- chronic burden
- mental burden

reference defaults จาก benchmark table:

- elderly reference = `30`
- chronic reference = `25`
- mental reference = `5000 per 100k`

การ normalize:

```text
norm_elderly = clamp(elderly / ref_elderly, 0, 1.5)
norm_chronic = clamp(chronic / ref_chronic, 0, 1.5)
norm_mental  = clamp(mental  / ref_mental,  0, 1.5)
```

การถ่วงน้ำหนัก:

```text
HNI =
(
  norm_elderly * weight_elderly / total_weight
  + norm_chronic * weight_chronic / total_weight
  + norm_mental * weight_mental / total_weight
) * 100
```

default weights:

- elderly = 40
- chronic = 40
- mental = 20

เหตุผลที่ใช้ weighted composite:

- ภาระสุขภาพไม่มีตัวเดียวที่อธิบาย demand ได้ทั้งหมด
- composite index ช่วยรวมหลายมิติให้เห็น burden สัมพัทธ์ในตัวเลขเดียว
- การ clamp ที่ 1.5 ป้องกันไม่ให้ค่า extreme ตัวเดียวครอบ index ทั้งก้อน

เหตุผลที่เลือก 3 แกนนี้:

- สูงอายุสัมพันธ์กับ multimorbidity, frailty, rehabilitation need
- chronic disease burden เพิ่มภาระติดตามรักษาต่อเนื่องและยา
- mental burden เพิ่ม demand ด้าน screening, counseling, case management, crisis care

## 7.4 ขั้นที่ 4: แปลง HNI เป็น profession-sensitive need mix

ระบบไม่ได้ถือว่าทุกวิชาชีพถูกกดดันเท่ากันเมื่อ HNI เท่ากัน แต่สร้าง `profession need mix` ตาม burden pattern

สูตร raw weights:

```text
doctor_total = 28 + 18*norm_chronic + 8*norm_elderly
nurse_total = 28 + 12*norm_chronic + 10*norm_elderly + 6*norm_mental
pharmacist_total = 10 + 8*norm_chronic
physical_therapist_total = 8 + 10*rehab_pressure + 6*norm_elderly
psychologist_total = 8 + 10*norm_mental + 4*suicide_pressure
clinical_psychologist_total = 6 + 10*norm_mental + 6*suicide_pressure
```

แล้ว normalize เป็นสัดส่วนรวม 100%

```text
mix_pct_i = raw_weight_i / sum(raw_weights) * 100
```

ตัวแปรเสริม:

```text
rehab_pressure =
  หากไม่มี RH0101 ใช้ 0.45*norm_elderly + 0.2*norm_chronic
  หากมี RH0101 ใช้ max(0, (50 - RH0101) / 50)

suicide_pressure =
  หากไม่มี PS0001 ใช้ norm_mental
  หากมี PS0001 ใช้ max(0, (PS0001 - 5) / 5)
```

เหตุผล:

- ภาระโรคเรื้อรังไม่ได้แปลเป็นความต้องการแพทย์อย่างเดียว แต่เพิ่มภาระ nurse และ pharmacist ด้วย
- ภาระ mental ควรสะท้อนทั้ง psychologist และ clinical psychologist
- stroke rehab และ suicide outcome ถูกใช้เป็น disease-specific modifiers เพื่อให้ skill mix ไวต่อ pain point ของหน่วยบริการ

## 7.5 ขั้นที่ 5: คำนวณ Workforce Capacity Index (WCI)

WCI เป็นดัชนี capacity composite ที่ดูว่า headcount ต่อประชากรของแต่ละวิชาชีพเมื่อเทียบกับ benchmark อยู่ที่ระดับใด และถ่วงด้วย need-sensitive mix

สูตร ratio รายวิชาชีพ:

```text
ratio_i = (headcount_i / population) * rate_per
```

โดย benchmark หลักปัจจุบันใช้หน่วย `per 10,000 population`

score รายวิชาชีพ:

```text
score_i = min(140, (ratio_i / target_i) * 100)
```

แล้วรวมเป็น WCI:

```text
WCI = sum(score_i * mix_pct_i / 100)
```

benchmark clinical profession ปัจจุบัน:

| วิชาชีพ | target ต่อ 10,000 | default weight |
|---|---:|---:|
| doctor_total | 3.5 | 32 |
| nurse_total | 12.0 | 38 |
| pharmacist_total | 1.5 | 10 |
| physical_therapist_total | 0.8 | 8 |
| psychologist_total | 0.4 | 6 |
| clinical_psychologist_total | 0.2 | 6 |

ข้อสังเกตเชิงวิธีวิจัย:

- ค่า target เหล่านี้ใน code ถูกกำกับสถานะไว้ว่า `provisional`
- จึงควรเขียนในรายงานว่าเป็น `internal benchmark seeds migrated from system governance table`

เหตุผลที่ cap score ไว้ที่ 140:

- ป้องกันวิชาชีพที่เกิน benchmark มากผิดปกติจากการดัน composite สูงเกินจริง
- ทำให้ WCI ยังตีความเป็น “capacity adequacy” มากกว่า “abundance reward”

## 7.6 ขั้นที่ 6: คำนวณ burden multiplier

ระบบแปลง HNI เป็นตัวคูณ burden เพื่อใช้ใน Need_FTE

```text
burden_multiplier = clamp(0.75 + HNI/100, 0.75, 1.6)
```

ความหมาย:

- HNI ต่ำมาก จะไม่ถูกลดต่ำกว่า 0.75
- HNI สูงมาก จะไม่ดันเกิน 1.6

เหตุผล:

- ป้องกันความผันผวนมากเกินไปจาก composite index
- ทำให้ burden ใช้เป็น `moderating factor` ไม่ใช่ตัวครอบสูตรทั้งหมด

## 7.7 ขั้นที่ 7: สร้าง workload function pressure

ระบบคำนวณ workload ต่อประชากรในหน่วย `per 10,000`

```text
opd_per_10k = outpatient_visits / population * 10000
ipd_per_10k = inpatient_visits / population * 10000
er_per_10k = emergency_visits / population * 10000
or_per_10k = surgery_count / population * 10000
delivery_per_10k = delivery_count / population * 10000
mental_per_10k = mental_health_visits / population * 10000
chronic_per_10k = chronic_disease_visits / population * 10000
```

แล้วเทียบกับ reference workload

default reference seeds:

| Metric | Default reference |
|---|---:|
| opd_per_10k | 1800 |
| ipd_per_10k | 120 |
| er_per_10k | 220 |
| or_per_10k | 18 |
| delivery_per_10k | 12 |
| mental_per_10k | 350 |
| chronic_per_10k | 700 |
| icu_per_10k | 25 |

intensity function:

```text
intensity = clamp(actual_rate / reference_rate, 0, 2)
```

profession-specific workload signal:

```text
doctor_signal =
  0.30*ipd + 0.25*er + 0.25*or + 0.20*delivery

nurse_signal =
  0.35*opd + 0.25*ipd + 0.20*er + 0.20*delivery

pharmacist_signal =
  0.45*opd + 0.55*chronic

pt_signal =
  0.60*ipd + 0.40*or

psych_signal = mental
clinical_psych_signal = mental
```

แล้วแปลงเป็น pressure factor:

```text
doctor_total = clamp(0.85 + doctor_signal*0.35, 0.85, 1.55)
nurse_total = clamp(0.85 + nurse_signal*0.35, 0.85, 1.55)
pharmacist_total = clamp(0.85 + pharmacist_signal*0.30, 0.85, 1.45)
physical_therapist_total = clamp(0.80 + pt_signal*0.35, 0.80, 1.50)
psychologist_total = clamp(0.80 + psych_signal*0.40, 0.80, 1.60)
clinical_psychologist_total = clamp(0.80 + clinical_psych_signal*0.45, 0.80, 1.65)
```

เหตุผลเชิงวิธีวิจัย:

- ไม่ใช่ทุก workload function จะกดดันทุก profession เท่ากัน
- การแยก service function pressure ช่วยทำให้ requirement รายวิชาชีพสอดคล้องกับลักษณะการทำงานจริงมากขึ้น
- การใช้ weighted signals เป็น pragmatic compromise ระหว่าง realism และ data availability

## 7.8 ขั้นที่ 8: คำนวณ Need_FTE

สำหรับแต่ละวิชาชีพ ระบบคำนวณดังนี้

```text
baseline_need_fte = target_value * effective_population_total / rate_per
mix_adjustment = max(0.65, actual_mix_pct / default_weight_pct)
pressure_factor = base_pressure_factor * workload_pressure_factor
need_fte = baseline_need_fte * burden_multiplier * mix_adjustment * pressure_factor
available_fte = headcount * fte_per_headcount
gap_fte = max(0, need_fte - available_fte)
suggested_add = ceil(gap_fte)
```

implementation ปัจจุบันใช้:

```text
suggested_add = int(max(0, round(gap_fte + 0.499999)))
```

ซึ่งมีผลใกล้เคียง `ceil` สำหรับ gap บวกส่วนใหญ่

เหตุผลเชิงวิธีวิจัย:

- `baseline_need_fte` ให้ฐานตาม target ratio
- `mix_adjustment` ทำให้แต่ละวิชาชีพเบี่ยงจาก default ratio ได้ตาม need profile ของพื้นที่
- `pressure_factor` ทำให้หน่วยบริการที่มี service workload หนักจริงถูกขยับ need ขึ้น
- `available_fte` แยกจาก headcount เพื่อรองรับกรณี part-time/mixed role ในอนาคต แม้ค่าปัจจุบันส่วนใหญ่เป็น 1.0

## 7.9 ขั้นที่ 9: วิเคราะห์ช่องว่าง Need vs Capacity

ในระดับ summary ระบบใช้

```text
gap_score = HNI - WCI
```

เกณฑ์ตีความ:

- `red` ถ้า gap > 20
- `yellow` ถ้า gap > 0
- `green` ถ้า gap <= 0

หลักคิด:

- HNI เป็นฝั่ง demand pressure
- WCI เป็นฝั่ง supply/capacity adequacy
- เมื่อ HNI สูงกว่า WCI มาก แปลว่าภาระนำหน้าศักยภาพ

## 7.10 ขั้นที่ 10: Outcome validation

ระบบไม่สรุป shortage จาก gap เพียงตัวเดียว แต่ cross-check กับ outcome

ตรรกะหลัก:

- `gap สูง + outcome แย่` = มีความเป็นไปได้สูงว่า capacity shortage เป็นปัจจัยร่วมสำคัญ
- `gap สูง + outcome ดี` = ระบบอาจอยู่ในภาวะ over-stretched but resilient ต้องเฝ้าระวัง
- `gap ต่ำ + outcome แย่` = มีแนวโน้มเป็น process/protocol/referral/data quality problem มากกว่าขาดคนอย่างเดียว

เหตุผล:

- outcome ที่แย่ไม่ได้เกิดจากจำนวนคนไม่พอเสมอ
- การแยก shortage ออกจาก process failure ช่วยลด false recommendation

## 7.11 ขั้นที่ 11: Specialty deep dive

เมื่อ service plan indicator มีปัญหา ระบบคำนวณ severity จากระยะห่างจาก threshold

ถ้า `low is good`

```text
severity = (actual - threshold) / threshold
```

ถ้า `high is good`

```text
severity = (threshold - actual) / threshold
```

แล้วใช้

```text
severity = max(0, severity)
shortage_factor =
  1.0 ถ้า gap red
  0.7 ถ้า gap yellow
  0.35 ถ้า gap green

severity_factor = 1 + clamp(severity, 0, 2)
addDoc = ceil(baseDoc * severity_factor * shortage_factor)
addNurse = ceil(baseNurse * severity_factor * shortage_factor)
```

กฎ process-first:

```text
ถ้า gapLevel = green และ severity < 0.40
ให้ addDoc = 0 และ addNurse = 0
```

เหตุผล:

- ถ้า overall capacity ไม่ได้ขาด แต่ specialty outcome แย่เล็กน้อย ควรเริ่มจาก pathway/process review ก่อน
- ถ้า gap สูงและ severity สูง จึงค่อยตีความไปที่การเพิ่มคนเฉพาะทาง

## 7.12 ขั้นที่ 12: Confidence scoring

### PP confidence

สูตรองค์ประกอบ:

- source_score
- year_score
- scope_score
- completeness_score
- audit_score

ตรรกะ:

- ถ้า source มีคำว่า `hdc` ได้ 30
- ถ้า source มีคำว่า `dopa` ได้ 25
- ถ้า unknown ได้ 10
- ปีข้อมูลใหม่กว่าจะได้คะแนนสูงกว่า
- scope ระดับ amphur ได้ 20 มิฉะนั้น 8
- completeness = observed / expected capped ที่ 1.0 แล้วคูณ 15
- audit_available เพิ่ม 10

ระดับ:

- `high` ถ้า score >= 80
- `medium` ถ้า score >= 60
- `provisional` ถ้าต่ำกว่านั้น

### HR confidence

องค์ประกอบ:

- source_score = 40
- scope_score = 25 ถ้า unit matched มิฉะนั้น 10
- dictionary_score = 20
- audit_score = 15 ถ้ามี audit
- year_score = 10

ข้อจำกัดสำคัญ:

- HR schema ปัจจุบันยังไม่ได้ version ปีข้อมูลชัดในทุกตาราง จึงมี `year_note` ว่า year not explicitly versioned

## 8. สถิติและเครื่องมือวิเคราะห์ที่ระบบใช้

### 8.1 อัตราต่อประชากร

ใช้การแปลง headcount/workload เป็นอัตราต่อประชากร เช่น `per 10,000` หรือ `per 100,000`

เหตุผล:

- ช่วยเปรียบเทียบหน่วยบริการต่างขนาดกันได้
- เป็นมาตรฐานปฏิบัติที่ใช้ทั่วไปใน epidemiology และ health systems monitoring

### 8.2 Composite weighted index

ใช้ทั้งใน HNI และ WCI

เหตุผล:

- ปัญหาจริงมีหลายมิติ
- การรวมแบบ weighted index เหมาะกับ decision-support ที่ต้องการค่า summary แต่ยังย้อนดู component ได้

### 8.3 Clamping / bounded normalization

ใช้กับ HNI, workload intensity, pressure factor, และบาง score

เหตุผล:

- ลดผลของ outlier
- ลด instability จากข้อมูลผิดปกติหรือหน่วยบริการที่มีเคสเฉพาะทางสูงผิดปกติชั่วคราว
- ทำให้โมเดลมี numerical stability และสื่อสารง่ายขึ้น

### 8.4 Median

ใช้ใน district baseline และ peer aggregation

เหตุผล:

- median ทนต่อ outlier มากกว่า mean
- เหมาะกับข้อมูลโรงพยาบาลที่ distribution มัก skewed และมีหน่วยใหญ่ดึงค่าเฉลี่ยขึ้น

### 8.5 Percentile p50 / p75

ใช้ใน workload reference calibration

สูตร percentile ใน code ใช้ interpolation ระหว่างตำแหน่ง lower-upper

ตรรกะ:

```text
idx = (n - 1) * q
lower = floor(idx)
upper = lower + 1
percentile = ordered[lower] + (ordered[upper] - ordered[lower]) * fraction
```

การเลือก `p75` เป็น calibrated reference:

- ถ้าคิดเชิง workforce planning ค่ามาตรฐานที่สูงกว่า median เล็กน้อยเหมาะกับการสะท้อน workload ที่ “ควรรับได้” โดยไม่ไวต่อ outlier สูงสุด
- จึงเป็นจุดสมดุลระหว่าง underestimation กับ overreaction

### 8.6 Ceiling-style rounding

ใช้ใน recommendation `suggested_add`

เหตุผล:

- FTE gap 0.2 คนไม่สามารถจ้างคนจริง 0.2 คนได้ในหลายบริบทการบริหาร
- การปัดขึ้นจึงเหมาะกว่า round ลงในเชิง policy recommendation

## 9. ทำไมระบบจึงออกแบบแบบนี้

### 9.1 ไม่ใช้ประชากรทะเบียนอย่างเดียว

เพราะโรงพยาบาลระดับ referral รับภาระนอกทะเบียนจำนวนมาก ถ้าใช้ประชากรตามทะเบียนอย่างเดียวจะทำให้ประเมิน need ต่ำเกินจริง

### 9.2 ไม่ใช้ headcount ratio อย่างเดียว

เพราะจำนวนคนเท่ากันไม่ได้แปลว่ารองรับงานเท่ากัน ถ้า workload ต่างกันมาก การเทียบ ratio อย่างเดียวจะบิดเบือน

### 9.3 ไม่ใช้ outcome อย่างเดียว

เพราะ outcome ที่แย่เกิดได้จาก

- data quality ต่ำ
- referral delay
- protocol ไม่ได้มาตรฐาน
- case severity สูง
- shortage จริง

ดังนั้น outcome ต้องถูกวางหลัง data quality และ capacity analysis

### 9.4 ไม่ใช้ WISN เต็มรูปแบบในรอบนี้

เพราะ implementation จริงยังไม่มี time standard รายกิจกรรมครบทุกวิชาชีพ/ทุกหน่วยบริการ

จึงใช้ proxy model ที่

- อิง workload จริง
- ถ่วงตาม service function
- เปิดทางให้เพิ่ม manual service statistics และ time standard ในอนาคต

### 9.5 ใช้ benchmark table กลาง

เพื่อให้ formula, threshold, และ governance values ไม่กระจาย hardcode หลายที่ ช่วย audit ได้ และปรับ version ได้ง่ายขึ้น

## 10. จุดแข็งเชิงวิธีวิจัย

1. ใช้หลายมิติร่วมกัน ไม่พึ่งตัวเลขตัวเดียว
2. ผูก population need กับ service workload และ workforce capacity พร้อมกัน
3. แยก overall gap ออกจาก disease-specific specialty gap
4. มี data quality gate และ confidence score
5. มี audit/replay ผ่าน analysis run history
6. มี peer baseline ที่ใช้ median ซึ่ง robust กว่า mean

## 11. ข้อจำกัดที่ต้องเขียนไว้ตรงไปตรงมา

1. ค่า benchmark หลายตัวในระบบยังเป็น `provisional internal seeds`
2. โมเดลยังไม่ใช่ WISN เต็มรูปแบบ เพราะยังไม่ได้ใช้ activity-time standards ราย task
3. naming ของบางตัวแปรยังไม่สอดคล้องหน่วยจริงทุกตัว เช่น chronic/mental labels
4. workload บางฟังก์ชันยังใช้ manual-preferred หรือ manual-required source
5. HR year-versioning ยังไม่ explicit ใน schema ปัจจุบัน
6. service outcome ยังอาจได้รับอิทธิพลจาก referral pattern, severity mix, และ practice variation ที่โมเดลยังไม่ได้ model เต็ม

## 12. ข้อเสนอเชิงวิชาการสำหรับการเขียนรายงาน/บทความ

หากนำไปเขียนรายงานวิจัย ควรเขียนระบบนี้ว่า

`a hybrid, workload-calibrated, need-capacity-outcome decision-support model for hospital workforce analysis`

และควรแยกคำอธิบาย 3 ชั้นเสมอ

1. `conceptual justification`
อ้างอิง WHO, RHIS, Donabedian, ageing/NCD/mental health evidence

2. `operationalization in this system`
อธิบายว่าระบบแปลงหลักการเป็นตัวแปรและสูตรอย่างไร

3. `governance status`
ระบุว่าค่าใดเป็น official external benchmark และค่าใดเป็น internal provisional benchmark

## 13. Internal Implementation References

- `simulation.js`
- `API/need_fte_engine.py`
- `API/clinical_denominator_store.py`
- `API/analysis_governance_store.py`
- `API/district_baseline_store.py`
- `API/hr_workforce_dictionary.py`
- `NCO_INDICATOR_STANDARD.md`

## 14. External References

### Health workforce and staffing need

1. World Health Organization. Workload indicators of staffing need (WISN). Available at: https://www.who.int/tools/wisn
2. World Health Organization. Workload Indicators for Staffing Need (WISN) methodology for health workforce planning and estimation. Available at: https://www.who.int/news-room/articles-detail/workload-indicators-for-staffing-need-%28wisn%29-methodology-for-health-workforce-planning-and-estimation

### Health systems and quality frameworks

3. World Health Organization. Monitoring the building blocks of health systems: a handbook of indicators and their measurement strategies. Available at: https://iris.who.int/handle/10665/258734
4. Agency for Healthcare Research and Quality. Types of Health Care Quality Measures. Available at: https://www.ahrq.gov/talkingquality/measures/types.html
5. National Academies of Sciences, Engineering, and Medicine. Crossing the Quality Chasm: A New Health System for the 21st Century. Available at: https://nap.nationalacademies.org/catalog/10027/crossing-the-quality-chasm-a-new-health-system-for-the

### Routine health information systems and data quality

6. World Health Organization. Health Service Data. Available at: https://www.who.int/data/data-collection-tools/health-service-data
7. World Health Organization. Data Quality Assurance (DQA). Available at: https://www.who.int/data/data-collection-tools/health-service-data/data-quality-assurance-dqa
8. World Health Organization. Toolkit for analysis and use of routine health facility data: integrated health services analysis: district and facility level. Available at: https://www.who.int/publications/i/item/9789240060616
9. World Health Organization. Strategy for optimizing national routine health information systems. Available at: https://www.who.int/publications/i/item/9789240087163
10. Agency for Healthcare Research and Quality. Measurement of Patient Safety. Available at: https://psnet.ahrq.gov/primer/measurement-patient-safety

### Ageing, NCDs, mental health, suicide, rehabilitation

11. World Health Organization. Ageing and health. Available at: https://www.who.int/news-room/fact-sheets/detail/ageing-and-health
12. World Health Organization. Integrated care for older people: guidelines on community-level interventions to manage declines in intrinsic capacity. Available at: https://www.who.int/publications-detail-redirect/9789241550109
13. World Health Organization. ICOPE training programme. Available at: https://www.who.int/tools/icope-training-programme
14. World Health Organization. Noncommunicable diseases. Available at: https://www.who.int/news-room/fact-sheets/detail/noncommunicable-diseases
15. World Health Organization. Suicide. Available at: https://www.who.int/news-room/fact-sheets/detail/suicide
16. World Health Organization. Rehabilitation in health systems: guide for action. Available at: https://www.who.int/publications/i/item/9789241515986

### Statistical robustness

17. National Institute of Standards and Technology. Median Confidence Limits. Available at: https://itl.nist.gov/div898/software/dataplot/refman1/auxillar/mediancl.htm

### Thai public-data provenance examples

18. Open Government Data of Thailand. รายงานข้อมูลบุคลากรด้านสาธารณสุข. Available at: https://www.data.go.th/dataset/gdpublish-public-health-personnel-report-65
19. Open Government Data of Thailand. จำนวนประชากรในประเทศไทย แยกตามพื้นที่. Available at: https://www.data.go.th/th/dataset/statbyyear
20. Open Government Data of Thailand. จำนวนผู้ป่วยโรคซึมเศร้าเข้าถึงบริการสุขภาพจิต. Available at: https://www.data.go.th/dataset/depression-report

## 15. ข้อความสรุปสำหรับใช้ในบทความ

ถ้าต้องการเขียนสั้นแบบภาควิธีวิจัย สามารถสรุปสาระสำคัญของเครื่องมือนี้ได้ว่า:

> ระบบนี้เป็นแบบจำลองช่วยตัดสินใจเชิงกำลังคนที่ผสานข้อมูลความต้องการสุขภาพของประชากร ภาระงานบริการจริง ศักยภาพกำลังคน ผลลัพธ์บริการ และคุณภาพข้อมูลเข้าด้วยกัน โดยใช้ดัชนี Health Need Index (HNI) เพื่อประมาณแรงกดดันด้านความต้องการบริการ ใช้ Workforce Capacity Index (WCI) เพื่อประมาณความเพียงพอของกำลังคน และใช้ workload-calibrated Need_FTE engine เพื่อแปลง need-capacity gap ไปเป็นข้อเสนอระดับวิชาชีพ ทั้งนี้การตีความผลลัพธ์ถูกกำกับด้วย outcome validation, specialty indicators, และ confidence scoring เพื่อหลีกเลี่ยงการสรุปปัญหาว่าเกิดจาก “ขาดคน” เพียงอย่างเดียวในกรณีที่อาจเป็นผลจาก data quality หรือ process bottleneck

