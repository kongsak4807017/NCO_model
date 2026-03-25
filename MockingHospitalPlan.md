# Mocking Hospital Plan (Revised)
**Project:** NCO Simulation - Sandbox Mode  
**Version Date:** 25 March 2026  
**Objective:** สร้างโรงพยาบาลจำลองเพื่อทดสอบการจัดสรรอัตรากำลังตามโมเดล **NCO (Need-Capacity-Outcome)** ว่า
- ควรเพิ่มแพทย์/พยาบาลเฉพาะทางเท่าไร
- หรือไม่ต้องเพิ่มคน แต่ต้องปรับกระบวนการอะไร

---

## 1) Minimum Dataset ที่ต้องมี
### 1.1 Data Quality Gate (บังคับก่อนคำนวณข้อเสนอ)
- **G01** %AdjRW=0 (เกณฑ์ `< 1%`)
- **G02** %Pdx Ill-defined (เกณฑ์ `< 5%`)
- **G03** %Pdx Ill-defined ในผู้เสียชีวิต (เกณฑ์ `< 10%`)
- **G04** %ICD คุณภาพต่ำ (เกณฑ์ `< 5%`)

> หากไม่ผ่าน Gate: ระบบยังแสดงผลได้ แต่ต้องติดธง `provisional` และไม่ใช้เป็นฐานอนุมัติอัตรากำลังถาวร

### 1.2 Need (ภาระสุขภาพ)
- ประชากรรับผิดชอบรวม (Population Type 1,3)
- สัดส่วนผู้สูงอายุ 60+
- ความชุกโรคหลัก 4 กลุ่ม (CVD, Cancer, DM, CKD) ต่อแสน
- ความเสี่ยงสุขภาพจิต
- ตัวเลือกเสริม DALY weighting (0-14, 15-59, 60+)

### 1.3 Capacity (กำลังคนและความสามารถบริการ)
- Headcount รายวิชาชีพ/รายสาขาเฉพาะทาง
- **FTE factor** รายสาขา (เช่น 1.0, 0.8, 0.6)
- Coverage รายเวร (กลางวัน/นอกเวลา/24x7)
- Service readiness (Cath lab, Stroke fast track, NICU, OR trauma ฯลฯ)

### 1.4 Outcome (ผลลัพธ์)
- Performance A-H (ขั้นต่ำที่ต้องใช้: A01, A04, A09, B01, C02, D01, F10)
- Service Plan เฉพาะโรคที่โยงสาขาเฉพาะทาง (เช่น DH0101, DN0101, DN0142, CI0101, CM0101, CM0203)

### 1.5 Workload (บังคับถ้าจะคำนวณ “จำนวนที่ต้องเพิ่ม”)
- OPD visits/วัน
- IPD discharges/ปี
- ICU bed-days/ปี
- ER ESI1-2 cases/ปี
- OR major cases/ปี

---

## 2) Sandbox Workflow (ฉบับใช้งานจริง)
### Step 0: Data Quality Gate
ตรวจ G01-G04 และกำหนดสถานะ `pass/fail`

### Step 1: Basic Profile
- ชื่อหน่วยบริการ
- จังหวัด
- ระดับ รพ. (A/S/M1/M2/F)
- ประชากรรับผิดชอบ

### Step 2: Need Engine (HNI)
- Elderly + Chronic burden + Mental risk
- เลือกน้ำหนักแกน (เช่น 40:40:20)
- เลือกเปิด/ปิด DALY modifier

### Step 3: Capacity Engine (WCI)
- กรอกอัตรากำลังรายสาขา
- กรอก FTE factor และความครอบคลุมเวร
- กรอก workload เพื่อปรับ WCI ตามภาระงานจริง

### Step 4: Gap
- คำนวณ `Gap = HNI - AdjWCI`

### Step 5: Outcome Validation
- ตรวจ A-H ชุดหลัก

### Step 6: Service Plan Deep Dive
- วิเคราะห์ตัวชี้วัดรายโรค
- Map ไปยังแพทย์/พยาบาลเฉพาะทางที่เกี่ยวข้อง

### Step 7: Recommendation
- เพิ่มคน (พร้อมจำนวน)
- หรือ Process/Protocol adjustment
- พร้อมระดับความเชื่อมั่น (confidence)

---

## 3) Core Indicator Dictionary (ฉบับย่อ)
### 3.1 Outcome A-H (ใช้ยืนยันระดับระบบ)
- **A01** Crude Death Rate (`ต่ำ=ดี`, threshold `3.5%`)
- **A04** AMI Mortality (`ต่ำ=ดี`, threshold `8%`)
- **A09** Septicemia Mortality (`ต่ำ=ดี`, threshold `20%`)
- **B01** Maternal Mortality (`ต่ำ=ดี`, threshold `70/100k`)
- **C02** CMI (`สูง=ดี`, threshold `1.5`)
- **D01** Bed Occupancy (`ช่วงเหมาะสม 80-85%`)
- **F10** Referral leakage to tertiary (`ต่ำ=ดี`, threshold `15%`)

### 3.2 Service Plan (ใช้ชี้เป้าสาขาเฉพาะทาง)
- **DH0101** STEMI mortality (`<12%`) -> Interventional cardio + CCU/Cath nurse
- **DN0101** Stroke mortality (`<15%`) -> Neurologist + Stroke nurse
- **DN0142** rtPA timely (`>5%`) -> Neuro + ER team
- **CI0101** Sepsis mortality (`<20%`) -> ID/Internal med + ICU nurse
- **CM0101** Maternal mortality (`<70/100k`) -> OB + labor nurse
- **CM0203** Neonatal mortality (`<10/1000`) -> Neonatologist + NICU nurse

---

## 4) Calculation Core Logic (Production-ready)
### 4.1 HNI (Need)
```text
Norm_i = Input_i / Max_i_in_zone
HNI = ((wE*Norm_Elderly) + (wC*Norm_Chronic4D) + (wM*Norm_Mental)) / (wE+wC+wM) * 100
If DALY enabled:
HNI_final = HNI * (1 + DALY_weight/100)
```

### 4.2 WCI (Capacity, รายสาขา)
```text
HeadcountRate = (Headcount_specialty / Population) * 10,000
CapacityScore = (HeadcountRate / StandardRate_by_level) * 100
FTE_available = Headcount_specialty * FTE_factor
LoadPressure = ActualWorkload / StandardWorkload
AdjWCI_specialty = CapacityScore * (FTE_available / Headcount_specialty) / LoadPressure
```

### 4.3 Gap
```text
Gap_specialty = HNI_disease_specific - AdjWCI_specialty
```

### 4.4 สูตรแปลงเป็น “จำนวนที่ต้องเพิ่ม”
```text
Need_FTE = ActualWorkload / Productivity_per_FTE
Deficit_FTE = max(0, Need_FTE - Available_FTE)
Suggested_Headcount = ceil(Deficit_FTE / Avg_FTE_per_person)
```

> ถ้าไม่มี Workload/FTE ให้แสดงผลเป็น `Scenario Headcount` เท่านั้น และติดธงความเชื่อมั่นปานกลาง

---

## 5) Decision Rules (NCO Matrix)
1. **Gap สูง + Outcome แย่** -> เพิ่มคนเร่งด่วน + ปรับ process
2. **Gap สูง + Outcome ดี** -> เพิ่มคนเชิงป้องกัน (preventive staffing)
3. **Gap ต่ำ + Outcome แย่** -> ไม่เน้นเพิ่มคน ให้ปรับ protocol/skill mix/equipment
4. **Gap ต่ำ + Outcome ดี** -> รักษาระดับ และ benchmark
5. **Data Quality fail** -> ทุกข้อเสนอเป็น `provisional`

---

## 6) Output Spec ที่ระบบต้องส่งออก
- Risk level: `red/yellow/green`
- ข้อเสนอรายสาขา:
  - แพทย์เฉพาะทาง `+N`
  - พยาบาลเฉพาะทาง `+N`
  - Process action ที่ต้องทำทันที
- Confidence score: `high/medium/low` (ขึ้นกับ Data Quality + ความครบ workload/FTE)
- Assumptions log: สมมติฐานที่ใช้คำนวณ

---

## 7) Data Gap ที่ยังต้องเติมเพื่อความแม่นยำสูง
- วุฒิเฉพาะทางแพทย์จริง (แพทยสภา)
- FTE จริงรายบุคคล/หน่วยงาน
- Workload รายหน่วยบริการ (OPD/IPD/ER/OR/ICU)
- Coverage เวรนอกเวลาและ on-call burden
- Service readiness (เครื่องมือ/เตียงเฉพาะทาง)

> สถานะปัจจุบัน: ระบบพร้อมสำหรับ Scenario planning และ workshop เชิงนโยบาย แต่ถ้าจะใช้เพื่ออนุมัติอัตราถาวรต้องเติม FTE + workload + specialty registry ให้ครบ
