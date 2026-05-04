# Workforce Analysis Reliability

Updated: 2026-03-27
Workspace: `C:\HR_blueprint\hr_blueprint_dashboard`

## Purpose

เอกสารนี้สรุปความน่าเชื่อถือ หลักการคำนวณ ข้อจำกัด และแนวทางยกระดับของระบบวิเคราะห์กำลังคนสุขภาพที่ติดตั้งอยู่ในโปรเจกต์นี้ โดยอิงจาก implementation ที่รันอยู่จริงใน frontend, API และฐานข้อมูลปัจจุบัน

เอกสารนี้เขียนสำหรับ:
- นักพัฒนา
- นักวิเคราะห์ข้อมูลสุขภาพ
- นักวางแผนอัตรากำลัง
- ผู้ดูแล data governance ของระบบ

ขอบเขตของเอกสารนี้ครอบคลุม 2 แกนหลัก:
- ฝั่ง `รักษา-ฟื้นฟู` (hospital treatment / rehab)
- ฝั่ง `ส่งเสริมป้องกัน` (primary care / public health, PP)

---

## 1. Executive Summary

### 1.1 Overall assessment

สถานะปัจจุบันของระบบเหมาะกับการใช้งานในระดับต่อไปนี้:
- `ใช้จัดลำดับปัญหาและชี้วิชาชีพที่ควรขยับก่อน`: ทำได้ดีพอสมควร
- `ใช้ทำ scenario planning เบื้องต้น`: ทำได้
- `ใช้สรุปจำนวนอัตรากำลังถาวรแบบ final`: ยังไม่ควรใช้โดยตรง

### 1.2 Reliability rating by component

| Component | Current reliability | Suitable use |
|---|---:|---|
| HR workforce counts from `hr_blueprint.db` | 8.5/10 | source of truth ด้านจำนวนคนระดับหน่วยบริการ |
| PP scope + amphur population denominator | 8.0/10 | denominator ฝั่งส่งเสริมป้องกัน |
| PP outcome to workforce mapping | 6.5/10 | prioritization และ profession targeting |
| HNI / WCI / GAP composite | 5.5/10 | directional planning, comparative discussion |
| Final recommended headcount | 3.5/10 | scenario only, ยังไม่ใช่ staffing standard |

### 1.3 Current appropriate use cases

ระบบปัจจุบันควรใช้เพื่อ:
1. ระบุว่าฝั่ง `ส่งเสริมป้องกัน` หรือ `รักษา-ฟื้นฟู` มี pressure สูงกว่ากัน
2. ระบุว่าในโรงพยาบาลหนึ่งแห่ง ควรดูวิชาชีพใดก่อน
3. อธิบายเหตุผลเชิง outcome ว่าทำไมต้องขยับกำลังคน
4. ทำ workshop / simulation / policy discussion

ระบบปัจจุบันยังไม่ควรใช้เพื่อ:
1. ขอกรอบอัตรากำลังแบบผูกงบถาวรทันที
2. ใช้แทน workload-based staffing model
3. ใช้แทน FTE planning รายหน่วยงาน / ราย shift / ราย service volume

---

## 2. Current System Architecture

## 2.1 Core layers

ระบบปัจจุบันมี 4 ชั้นหลัก

1. `Data layer`
- `hr_blueprint.db`
- HDC PP outcomes
- HDC amphur population
- local mock SQLite

2. `Rule / calculation layer`
- HNI
- Need-sensitive profession mix
- WCI
- GAP
- outcome validation
- PP outcome-to-workforce mapping
- specialty demand scenarios

3. `Presentation layer`
- split UI ซ้าย `ส่งเสริมป้องกัน`
- ขวา `รักษา-ฟื้นฟู`
- outcome cards
- recommendation cards
- audit trail

4. `Governance / interpretation layer`
- data dictionary
- scope config
- source badge
- audit trail
- provisional logic เมื่อ data quality ไม่ผ่าน

## 2.2 Key source files

### Frontend
- [simulation.js](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js)
- [simulation.css](C:/HR_blueprint/hr_blueprint_dashboard/simulation.css)
- [simulation.html](C:/HR_blueprint/hr_blueprint_dashboard/simulation.html)

### Backend API
- [main.py](C:/HR_blueprint/hr_blueprint_dashboard/API/main.py)
- [pp_store.py](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py)
- [hospital_scope_store.py](C:/HR_blueprint/hr_blueprint_dashboard/API/hospital_scope_store.py)
- [hdc_population_store.py](C:/HR_blueprint/hr_blueprint_dashboard/API/hdc_population_store.py)

### Dictionaries
- [hr_workforce_dictionary.py](C:/HR_blueprint/hr_blueprint_dashboard/API/hr_workforce_dictionary.py)
- [pp_workforce_dictionary.py](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_workforce_dictionary.py)

---

## 3. Reliability Assessment by Domain

## 3.1 Workforce counts: hospital treatment / rehab

### Current implementation

ฝั่งรักษา-ฟื้นฟูใช้ `hr_blueprint.db` โดยตรงผ่าน endpoint:
- `GET /api/hr/unit-workforce-summary`

Logic หลักอยู่ใน:
- [main.py:312](C:/HR_blueprint/hr_blueprint_dashboard/API/main.py:312)

Data dictionary กลาง:
- [hr_workforce_dictionary.py:1](C:/HR_blueprint/hr_blueprint_dashboard/API/hr_workforce_dictionary.py:1)

### Current strengths

1. นับจากฐานข้อมูลจริงระดับหน่วยบริการ
2. ล็อกนิยาม metric ชัดเจน เช่น
- `doctor_total = position_name_th = นายแพทย์`
- `nurse_total = พยาบาลวิชาชีพ + พยาบาลวิชาชีพ/นักวิชาการสาธารณสุข`
- `physical_therapist_total = นักกายภาพบำบัด`
3. มี audit trail และ source rows ย้อนกลับได้
4. UI และ API ใช้ dictionary เดียวกัน

### Reliability judgment

`8.5/10`

### Remaining risks

1. ยังไม่แยก FTE จาก headcount
2. ยังไม่แยก assignment ข้ามหน่วยงาน / ข้าม service line
3. บางวิชาชีพเฉพาะทางยังไม่มี specialist registry ที่เชื่อมครบ

---

## 3.2 Workforce counts: primary care / public health (PP)

### Current implementation

ฝั่ง PP ใช้ unit-level capacity summary ผ่าน:
- `GET /api/pp/unit-capacity-summary`
- `GET /api/pp/hospital-summary`

Logic หลักอยู่ใน:
- [pp_store.py:1252](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:1252)
- [pp_store.py:1651](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:1651)

Dictionary กลาง:
- [pp_workforce_dictionary.py:1](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_workforce_dictionary.py:1)

### Current strengths

1. ใช้ dictionary กลางและ audit trail เช่นเดียวกับฝั่ง clinical
2. ใช้ scope ระดับอำเภอของโรงพยาบาลจริง
3. ใช้ crosswalk ตาม position group + specialist + unit type
4. ตัด fallback ที่บวมเกินจริงของ `FAM_MD` ออกบางส่วนแล้ว

### Current limitations

1. ยังพึ่ง crosswalk มากกว่าการนับ exact role โดยตรง
2. บาง function ใน รพศ./รพท. อาจยังนับไม่ครบเพราะ naming ไม่สม่ำเสมอ
3. current capacity ที่ใช้ใน PP recommendation ยังเป็น FTE summary จาก rule-based grouping ไม่ใช่ validated service workload

### Reliability judgment

`6.5-7/10`

---

## 3.3 Population denominator and service scope

### Current implementation

ฝั่ง PP ใช้ hospital scope config:
- [hospital_scope_store.py](C:/HR_blueprint/hr_blueprint_dashboard/API/hospital_scope_store.py)

ข้อมูลประชากรใช้ HDC population เป็นหลัก และบันทึก:
- `pp_population_source`
- `pp_population_reference_year`

ใน API summary จะส่งต่อผ่าน:
- [main.py:285](C:/HR_blueprint/hr_blueprint_dashboard/API/main.py:285)
- [main.py:286](C:/HR_blueprint/hr_blueprint_dashboard/API/main.py:286)

### Current strengths

1. PP ใช้ `amphur scope` ตามบริบทจริงมากขึ้น
2. ใช้ HDC population year ล่าสุดที่มีข้อมูลจริง
3. UI แสดง source badge แล้ว

### Remaining issues

1. Clinical scope กับ denominator ของ WCI ยังไม่แยกเต็มรูปแบบ
2. รพศ./รพท. ยังมี burden จาก referral network ที่ไม่สะท้อนเต็มใน WCI หลัก

### Reliability judgment

`8/10` สำหรับ PP denominator
`5.5/10` สำหรับ clinical denominator in WCI

---

## 3.4 PP outcome data and shortlist

### Current implementation

PP outcome ใช้ HDC-based extractor และ shortlist phase 1 ใน backend

Shortlist ปัจจุบัน:
- `PP phase 1 = 12 indicators`

Logic หลัก:
- [pp_store.py:245](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:245)
- [pp_store.py:1575](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:1575)
- [pp_store.py:1651](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:1651)

### Important current policy

ตัวชี้วัด MCH 3 ตัวถูกนำออกจาก phase 1 shortlist แล้ว เพราะบริบทจริงมีการรับบริการฝากครรภ์และหลังคลอดในเอกชนสูง ทำให้ไม่สะท้อน performance ของ รพ.รัฐโดยตรง

Indicators excluded:
- `1c1b8e24aff59258a806f122e264031e`
- `5087190fa0a3c28974fdde7fd1443d5e`
- `f50124b9cbc6636272844273980ca42e`

### Current strengths

1. shortlist ชัดขึ้น ไม่กระจายไปทุก indicator
2. มี target / good_direction / mapping จริง
3. มี district-level off-target logic
4. recommendation ฝั่ง PP ไม่อิง workforce อย่างเดียว แต่ผูกกับ outcome แล้ว

### Current limitations

1. target และ mapping ยังเป็น policy heuristic มากกว่ามาตรฐานรับรองระดับประเทศ
2. บาง report family บน HDC มี fragility ด้าน scraping / config
3. ปีข้อมูล outcome อาจไม่ตรงกันทั้งหมดทุก indicator

### Reliability judgment

`6.5/10`

---

## 4. Step-by-Step Calculation Logic

หัวข้อนี้อธิบาย logic ปัจจุบันตามลำดับ execution ของระบบ

## 4.1 Step 1: Data Quality Gate

### Inputs
- `G01 = %AdjRW = 0`
- `G02 = %Pdx Ill-defined`
- `G03 = %Pdx Ill-defined (Death)`
- `G04 = %ICD Low Quality`

Reference:
- [simulation.js:101](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:101)

### Logic

ถ้าค่าเกิน threshold ระบบยังคำนวณต่อได้ แต่ผลลัพธ์สุดท้ายจะถูกตีความเป็น `provisional`

### Role in pipeline

Data quality ไม่ได้หยุด calculation แต่ลด confidence ของ recommendation

---

## 4.2 Step 2: Health Need Index (HNI)

### Inputs
- elderly rate
- chronic burden proxy
- mental risk rate
- user-adjustable weights

References:
- [simulation.js:1880](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:1880)
- [simulation.js:1207](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:1207)

### Current calculation

```text
elderly = Elderly_Rate_%
chronic = getChronicPrevalence()
mental = Mental_Risk_Rate_%

normE = elderly / maxE
normC = chronic / maxC
normM = mental / maxM

HNI = ((normE * wE/total) + (normC * wC/total) + (normM * wM/total)) * 100
```

### Interpretation

- HNI สูง = ภาระสุขภาพสูง
- HNI ต่ำ = ภาระสุขภาพต่ำกว่า peers ในชุดเปรียบเทียบ

### Important caveat

เนื่องจาก `maxE`, `maxC`, `maxM` มาจากชุดโรงพยาบาลที่โหลดอยู่ ค่า HNI จึงเป็น `relative score` ไม่ใช่ absolute planning score

---

## 4.3 Step 3: Need-sensitive profession mix

### Purpose

แปลง burden ให้กลายเป็นน้ำหนักความต้องการของแต่ละวิชาชีพ

Reference:
- [simulation.js:1060](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:1060)

### Current logic

ระบบคำนวณ raw weight ต่อวิชาชีพจาก elderly, chronic, mental, rehab pressure, suicide pressure แล้ว normalize เป็น 100%

ตัวอย่าง:
```text
doctor_total = 28 + 18*normC + 8*normE
nurse_total = 28 + 12*normC + 10*normE + 6*normM
pharmacist_total = 10 + 8*normC
physical_therapist_total = 8 + 10*rehabPressure + 6*normE
psychologist_total = 8 + 10*normM + 4*suicidePressure
clinical_psychologist_total = 6 + 10*normM + 6*suicidePressure
```

### Interpretation

นี่คือการบอกว่า burden แบบนี้ควรถ่วงน้ำหนักไปที่วิชาชีพใดมากกว่ากัน

### Caveat

เป็น heuristic model ไม่ใช่ empirically estimated coefficient

---

## 4.4 Step 4: Workforce Capacity Index (WCI)

Reference:
- [simulation.js:1088](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:1088)

### Inputs
- headcount ต่อวิชาชีพ
- denominator ประชากร
- benchmark target ของแต่ละ profession
- profession mix จากขั้นก่อนหน้า

### Current calculation

```text
ratio = headcount / population * benchmark_unit
score = min(140, (ratio / target) * 100)
WCI = Σ(score_profession * weight_profession)
```

Current benchmark examples:
- doctor: `3.5 / 10,000`
- nurse: `12 / 10,000`
- pharmacist: `1.5 / 10,000`
- PT / psychologist / clinical psychologist ใช้ per `100,000` ใน formula ปัจจุบัน

### Interpretation

- WCI สูง = ศักยภาพกำลังคนสูง
- WCI ต่ำ = ศักยภาพต่ำเมื่อเทียบ benchmark และ burden mix

### Major caveat

หน่วย benchmark ใน formula ยังไม่สอดคล้องกับการแสดงผล UI ทุกจุด โดยเฉพาะ PT / PSY / CPSY

---

## 4.5 Step 5: GAP calculation

Reference:
- [simulation.js:2103](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:2103)

### Current formula

```text
GAP = HNI - WCI
```

### Interpretation

- GAP > 20 = `red`
- GAP > 0 = `yellow`
- GAP <= 0 = `green`

### Meaning

- positive GAP = burden > workforce capacity
- zero / negative GAP = workforce capacity is balanced or above burden

---

## 4.6 Step 6: Clinical outcome validation

Reference:
- [simulation.js:1460](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:1460)
- [simulation.js:2120](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:2120)

### Inputs
Current composite uses A-H style outcome subset such as:
- `A01`
- `A04`
- `A09`
- `B01`
- `C02`
- `D01`
- `F10`

### Logic

1. เทียบค่าจริงกับ threshold รายตัว
2. สรุปว่า outcome โดยรวมดีหรือแย่
3. cross กับ GAP เป็น decision matrix

### Decision interpretation

- GAP สูง + outcome แย่ -> เพิ่มคนเร่งด่วน
- GAP สูง + outcome ดี -> เพิ่มคนเชิงป้องกัน
- GAP ต่ำ + outcome แย่ -> process problem
- GAP ต่ำ + outcome ดี -> maintain

---

## 4.7 Step 7: Service plan specialty scenario

Reference:
- [simulation.js:1630](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:1630)

### Inputs
- specialty indicator actual value
- threshold
- GAP level

### Current logic

```text
severity = distance from threshold
shortageFactor = 1.0 if red, 0.7 if yellow, 0.35 if green
severityFactor = 1 + clamp(severity, 0, 2)
addDoc = ceil(baseDoc * severityFactor * shortageFactor)
addNurse = ceil(baseNurse * severityFactor * shortageFactor)
```

### Interpretation

เป็น `scenario demand` สำหรับแพทย์/พยาบาลเฉพาะทาง ไม่ใช่ approved FTE formula

---

## 4.8 PP outcome -> profession mapping

### Scope

ปัจจุบัน PP recommendation ใช้ `amphur summary` สำหรับโรงพยาบาลจริง

Reference:
- [pp_store.py:1651](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:1651)

### Current logic

1. เลือก outcome rows ในอำเภอของโรงพยาบาล
2. หาตัวที่ `is_off_target = true`
3. map indicator -> function -> profession จาก `pp_indicator_workforce_map`
4. คำนวณ urgency score ต่อ profession

Current backend formula:
```text
urgency_delta = contribution_weight / max(current_capacity, 0.5)
urgency_score_profession += urgency_delta
```

Reference:
- [pp_store.py:1698](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:1698)

### Interpretation

ยิ่งตัวชี้วัดหลุดเป้าและ current capacity ต่ำ profession นั้นจะถูกดันขึ้นมาเป็น priority มากขึ้น

### Output example

ปัจจุบันสำหรับ `นครพิงค์ / แม่ริม` หลังตัด 3 indicators MCH ออกแล้ว:
- `indicator_count = 10`
- `off_target_indicator_count = 6`
- top PP profession recommendation:
  - `RN = 10.0`
  - `PH_ACAD = 4.8`
  - `PH_OFFICER = 4.2`
  - `PSY = 3.0`
  - `FAM_MD = 0.7`

---

## 4.9 UI-level scenario tags in PP recommendation

Reference:
- [simulation.js:1544](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:1544)

### Current logic

UI แปลง urgency score เป็น tag แบบ scenario:

```text
urgency_score >= 8 -> +2
urgency_score > 0 -> +1
```

ตัวอย่าง:
- `RN (+2)`
- `PH_ACAD (+1)`

### Important note

นี่เป็น `presentation heuristic` ไม่ใช่ staffing standard

---

## 5. Data Governance and Source of Truth

## 5.1 Hospital treatment / rehab workforce

Source of truth:
- `hr_blueprint.db`

Access layer:
- [main.py:312](C:/HR_blueprint/hr_blueprint_dashboard/API/main.py:312)

Definition control:
- [hr_workforce_dictionary.py](C:/HR_blueprint/hr_blueprint_dashboard/API/hr_workforce_dictionary.py)

## 5.2 PP workforce

Source of truth:
- `hr_blueprint.db`
- interpreted ผ่าน crosswalk rules

Access layer:
- [pp_store.py:1252](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:1252)

Definition control:
- [pp_workforce_dictionary.py](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_workforce_dictionary.py)

## 5.3 PP outcomes

Source of truth:
- HDC extractor -> `fact_pp_outcome_district`

Selection policy:
- shortlist phase 1 only

Access layer:
- [pp_store.py:1364](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:1364)
- [pp_store.py:1412](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:1412)
- [pp_store.py:1457](C:/HR_blueprint/hr_blueprint_dashboard/API/pp_store.py:1457)

## 5.4 Population denominator

Source priority:
1. HDC amphur population
2. DOPA amphur population
3. proxy fallback

Control layer:
- [hospital_scope_store.py](C:/HR_blueprint/hr_blueprint_dashboard/API/hospital_scope_store.py)

---

## 6. Reliability Gaps and Inconsistencies

หัวข้อนี้คือจุดที่ยังไม่ต่อเนื่อง หรือไม่เป็นไปในทิศทางเดียวกัน และควรแก้

## 6.1 HNI is relative, not absolute

### Problem

HNI ใช้ dynamic normalization เทียบกับค่า max ของโรงพยาบาลที่ถูกโหลดอยู่ในชุดนั้น

### Consequence

ถ้า reference set เปลี่ยน ค่า HNI ของโรงพยาบาลเดิมอาจเปลี่ยน แม้ข้อมูลของโรงพยาบาลเองไม่เปลี่ยน

### Impact

กระทบความสามารถในการใช้เปรียบเทียบข้ามรอบเวลา หรือใช้เป็น policy baseline

### Recommendation

เปลี่ยนเป็น static reference table เช่น
- regional median / p90 / p95
- national reference by hospital level

---

## 6.2 WCI denominator mismatch

### Problem

UI หลายจุดแสดง PT / psychologist / clinical psychologist เป็น `คน/หมื่นปชก.` แล้ว แต่ formula ใน WCI ยังใช้ per `100000` อยู่

Reference:
- [simulation.js:1093](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:1093)

### Consequence

ผู้ใช้เห็นตัวเลขกับ benchmark คนละตรรกะ

### Recommendation

ต้องเลือกอย่างใดอย่างหนึ่งและล็อกทั้งระบบ:
1. ทุกจุดใช้ `คน/หมื่นปชก.`
2. หรือทุกจุดใช้ `คน/แสนปชก.` สำหรับ allied health

---

## 6.3 Clinical scope not fully reflected in WCI

### Problem

แม้ UI จะมี clinical scope ตามระดับ รพ. แล้ว แต่ WCI ยังใช้ population จาก hospital profile เป็นหลัก

Reference:
- [simulation.js:1090](C:/HR_blueprint/hr_blueprint_dashboard/simulation.js:1090)

### Consequence

รพศ. และรพท. อาจถูกประเมินต่ำหรือสูงผิด เพราะภาระ referral ไม่ได้ถูก model เต็ม

### Recommendation

แยก denominator ฝั่ง clinical เป็น:
- district population
- province population
- network referred burden
- หรือ workload-based denominator

---

## 6.4 PP recommendation remains heuristic

### Problem

สูตร PP urgency ยังขึ้นกับ `contribution_weight / current_capacity`

### Consequence

ถ้า capacity ถูกนับไม่ครบ profession จะถูกดัน urgency สูงเกินจริง

### Recommendation

เพิ่ม 3 อย่าง:
1. validated capacity floor
2. service-specific expected staffing coefficients
3. confidence score per recommendation

---

## 6.5 Scenario `+1 / +2` is not a planning standard

### Problem

UI tag `(+1)` / `(+2)` ถูก derive จาก urgency score ในชั้น presentation

### Consequence

ใช้สื่อสารได้ แต่ยังไม่ควรนำไปอนุมัติอัตราโดยตรง

### Recommendation

ย้าย logic นี้ลง backend และผูกกับสูตร:
```text
Need_FTE - Available_FTE = Headcount recommendation
```

---

## 6.6 Multi-year and multi-source inconsistency

### Problem

ระบบใช้ข้อมูลจากหลายแหล่งและหลายปี
- HR counts
- HDC PP outcomes
- HDC population
- CMI / A-H / service plan source

### Consequence

ถ้าไม่แสดง source/year ชัด จะตีความผิดได้ง่าย

### Recommendation

เพิ่ม source metadata card ในทุก panel และสร้าง confidence policy เช่น:
- ปีตรงกันทั้งหมด = high confidence
- ต่างกัน 1 ปี = medium confidence
- ต่างกัน >1 ปี = provisional

---

## 6.7 Indicator inclusion / exclusion policy still manual

### Problem

การตัด indicator เช่น ANC / postnatal ออกจาก phase 1 ถูกต้องเชิงบริบท แต่ตอนนี้ยังเป็น policy encoded in shortlist seed

### Recommendation

สร้างตารางกลาง เช่น:
- `indicator_inclusion_policy`
- `attribution_scope`
- `private_sector_bias_flag`
- `recommended_use = include/exclude/caution`

---

## 6.8 No workload-based staffing engine yet

### Problem

ระบบยังไม่มี workload layer จริงสำหรับ
- OPD
- IPD
- ER
- OR
- ANC / PNC contacts
- NCD screening volume
- home visit load
- mental follow-up load

### Consequence

ระบบตอบได้ดีว่า `ใครควรถูกขยับก่อน` แต่ยังตอบได้ไม่ดีพอว่า `ต้องเพิ่มกี่ FTE จริง`

---

## 7. What the System Can and Cannot Support Today

## 7.1 What it can support now

1. prioritization ของวิชาชีพ
2. split interpretation ระหว่าง `PP` กับ `clinical`
3. outcome-led explanation ว่าทำไมต้องขยับคน
4. scenario planning ระดับ `+1/+2`
5. auditability ของจำนวนคนและ source rows

## 7.2 What it cannot support yet

1. staffing establishment final approval
2. sanctioned FTE planning
3. shift-based manpower planning
4. exact cross-hospital network allocation
5. precise annual hiring plan by specialty without workload data

---

## 8. Current Planning Interpretation Framework

แนวทางที่ควรตีความผลลัพธ์ ณ ตอนนี้:

### 8.1 If goal is policy discussion

ใช้ได้เลยในรูปแบบนี้:
- ดู `HNI / WCI / GAP`
- ดู `clinical outcome validation`
- ดู `PP off-target indicators`
- ดู profession priority
- ทำ scenario ว่าเพิ่มคนกลุ่มใดก่อน

### 8.2 If goal is annual HR planning

ใช้ระบบนี้เป็น `screening and prioritization layer` ก่อน แล้วต้องมีชั้นต่อไป:
- validate by workload
- validate by service volume
- convert headcount to FTE need
- check budget and establishment constraints

---

## 9. Recommended Upgrade Path

## 9.1 Short-term upgrades

1. สร้าง `reference benchmark table` แทน hardcoded benchmark ใน frontend
2. ทำ `confidence score` จาก source/year/completeness
3. สร้าง `indicator inclusion/exclusion policy` กลาง
4. ทำ unit alignment ให้ทุก profession benchmark ตรงกับ UI

## 9.2 Mid-term upgrades

1. แยก `clinical denominator` จาก `local population`
2. เพิ่ม referral-adjusted burden สำหรับ รพศ./รพท.
3. ทำ PP function workload table
4. ทำ service-specific burden to workforce coefficients

## 9.3 Long-term upgrades

1. สร้าง `Need_FTE - Available_FTE engine`
2. ใช้ validated staffing norms โดย service / function / shift
3. แปลง scenario เป็น hiring plan / redeployment plan / training plan

---

## 10. Recommended Interpretation of Current Outputs

## 10.1 Recommended wording for analysts

เมื่อใช้ผลลัพธ์ชุดนี้ ควรสื่อสารว่า:

- ระบบนี้เป็น `decision support for prioritization`, not final establishment calculator
- คะแนน `HNI / WCI / GAP` เป็น composite score เพื่อจัดลำดับ ไม่ใช่มาตรฐานอนุมัติอัตราโดยตรง
- recommendation `(+1) / (+2)` เป็น scenario เพื่อให้เห็นทิศทาง ไม่ใช่ final staffing norm
- ถ้าจะเสนอจำนวนจริง ต้องผ่าน workload/FTE review เพิ่มเติม

## 10.2 Recommended wording for executives

- “ใช้ระบบนี้เพื่อบอกว่า ปัญหาอยู่ฝั่งไหน วิชาชีพใดควรขยับก่อน และ outcome ใดรองรับข้อเสนอ”
- “ตัวเลขเพิ่มคนยังเป็น scenario ต้องยืนยันด้วย workload และกรอบอัตรากำลัง”

---

## 11. Practical Conclusion

### Current practical confidence

ถ้าใช้เพื่อ `ชี้ทิศทาง`:
- usable now

ถ้าใช้เพื่อ `อนุมัติจำนวนอัตรา`:
- not yet sufficient

### Current best use

ระบบในปัจจุบันเหมาะที่สุดสำหรับ:
1. prioritization
2. explanation
3. scenario planning
4. governance and audit trail

### Minimum conditions before using for formal manpower approval

ต้องมีอย่างน้อย:
1. static reference benchmark table
2. workload-based denominator
3. Need_FTE - Available_FTE engine
4. confidence scoring
5. source-year harmonization

---

## 12. Developer Notes

### Key rule classification

| Rule type | Current status |
|---|---|
| exact dictionary count | strong |
| scope resolution | strong-moderate |
| PP crosswalk | moderate |
| HNI normalization | heuristic |
| WCI benchmark | semi-heuristic |
| service plan add count | heuristic |
| PP `+1 / +2` scenario tags | heuristic |

### Immediate technical priorities

1. move hardcoded benchmark values to database table
2. standardize denominator units across formula and UI
3. add `confidence_score` to every summary endpoint
4. introduce `indicator_policy` table
5. build workload schema for true staffing conversion

---

## 13. Final Recommendation

หากต้องเดินงานต่อจากจุดนี้ แนะนำลำดับดังนี้

1. `Freeze governance layer`
- benchmark dictionary
- indicator inclusion policy
- source/year confidence policy

2. `Build workload layer`
- OPD/IPD/ER/OR/service contacts
- PP outreach and follow-up workload

3. `Build formal staffing engine`
- Need_FTE
- Available_FTE
- Gap_FTE
- Headcount recommendation

เมื่อทำครบ 3 ชั้นนี้ ระบบจะขยับจาก
- `prioritization tool`
ไปเป็น
- `workforce planning engine`
ได้อย่างน่าเชื่อถือกว่าปัจจุบันอย่างมีนัยสำคัญ
