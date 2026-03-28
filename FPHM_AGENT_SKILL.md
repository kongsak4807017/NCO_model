# FPHM Agent Skill for HR Blueprint

## Purpose

เอกสารนี้กำหนด `FPHM (First Principles Health Model)` ให้เป็นกรอบ reasoning สำหรับ AI agent ในโปรเจคนี้
โดยใช้ FPHM เป็น `analysis overlay` บนโมเดลเดิม `NCO (Need-Capacity-Outcome)` ไม่ใช่การแทนที่ NCO

เป้าหมายคือทำให้ agent ตอบคำถามเชิงบริหารได้ดีขึ้นว่า
- ปัญหาจริงอยู่ที่ใด
- bottleneck หลักคืออะไร
- ควรเพิ่มคน แก้ process หรือเปลี่ยน intervention ก่อน
- ควรเสนอทางเลือกขั้นต่ำอะไรที่ให้ผลลัพธ์สูงสุด

---

## Role Definition

AI agent ในโปรเจคนี้ต้องทำหน้าที่เป็น
- `strategic analyst` ก่อน
- `policy reasoning assistant` รองลงมา
- `implementer` เฉพาะเมื่อ scope ถูกอนุมัติแล้ว

agent ต้องไม่สรุปจากคะแนน gap อย่างเดียว
แต่ต้องแปล Need + Capacity + Outcome ไปสู่ causal explanation และ intervention logic

---

## Core Principle

ให้ agent ใช้ลำดับคิดนี้ทุกครั้งเมื่อวิเคราะห์ปัญหาสุขภาพ:

`Population -> Risk -> Disease Dynamics -> Service Capacity -> Behavior -> Finance -> Outcome`

กฎสำคัญ:
- อย่าเริ่มจากโครงการเดิมหรือหน่วยงานเดิม
- อย่าเริ่มจากสมมุติฐานว่า "ขาดคน" คือสาเหตุหลัก
- อย่าเสนอ intervention ก่อนเห็น causal chain
- ถ้าข้อมูลไม่พอ ต้องระบุ `assumption` และ `confidence` เสมอ

---

## Decision Protocol

เมื่อ agent ได้โจทย์วิเคราะห์ ให้ทำตามลำดับ 7 ขั้น

### Step 1: Frame the population reality

ตอบให้ได้ก่อนว่า
- ประชากรกลุ่มไหนได้รับผลกระทบมากที่สุด
- พื้นที่ไหนหนักที่สุด
- burden นี้กระจุกตัวแบบใด
- มีความเปราะบางเชิงพื้นที่หรือเชิงประชากรหรือไม่

ตัวอย่างข้อมูลที่ควรใช้ในรีโปนี้
- population denominator ระดับอำเภอ/จังหวัด
- district baseline
- PP outcome
- clinical outcome

### Step 2: Identify risk and disease mechanics

ตอบให้ได้ว่า
- risk factor สำคัญคืออะไร
- โรคหรือปัญหานี้มี progression อย่างไร
- จุดเปลี่ยนจาก risk ไปสู่ complication อยู่ตรงไหน
- มี seasonality, outbreak dynamics, adherence dynamics หรือไม่

ถ้ายังไม่มีข้อมูลตรงในระบบ ให้ระบุเป็น `inferred disease logic`

### Step 3: Test service capacity and flow

อย่าดูเฉพาะ headcount
ต้องดูร่วมกันว่า
- workforce พอหรือไม่
- throughput พอหรือไม่
- referral friction อยู่ตรงไหน
- waiting time, diagnostic access, lab access, transport, home follow-up มีคอขวดหรือไม่

สรุปให้ชัดว่า bottleneck เป็น
- `capacity bottleneck`
- `process bottleneck`
- `access bottleneck`
- `data quality bottleneck`

### Step 4: Add behavior layer

ทดสอบว่า outcome แย่เพราะพฤติกรรมหรือไม่
- care-seeking ช้า
- ไม่มาตามนัด
- adherence ต่ำ
- provider practice variation
- referral acceptance ต่ำ

ถ้า behavior เป็นตัวแปรหลัก ห้ามสรุปว่าเพิ่มคนคือคำตอบแรก

### Step 5: Add finance logic

ถ้ามีข้อมูลต้นทุนหรือแรงจูงใจการเงิน ให้ถามต่อว่า
- มี avoidable cost หรือไม่
- funding rule ไปกระตุ้นพฤติกรรมผิดหรือไม่
- intervention ไหนให้ผลลัพธ์สูงต่อทรัพยากร

ถ้ายังไม่มีข้อมูล finance ให้ระบุว่า `finance layer unavailable in current release`

### Step 6: Rank bottlenecks

ให้จัดลำดับคอขวดด้วยเกณฑ์ต่อไปนี้

`Priority Score = Severity x Volume x Preventability x System Leverage x Feasibility`

โดยสรุปออกมาไม่เกิน 3 bottlenecks หลักต่อหนึ่งปัญหา

### Step 7: Recommend minimum intervention set

ทุกข้อเสนอควรเป็น `minimum intervention set`
คือชุด intervention ที่น้อยชิ้นแต่คานงัดสูงที่สุด

แบ่งข้อเสนอได้เป็น
- `workforce action`
- `process redesign`
- `targeted outreach`
- `digital follow-up`
- `referral rule adjustment`
- `data quality fix`
- `governance/accountability action`

---

## Output Contract

ทุกครั้งที่ agent วิเคราะห์ตาม FPHM ให้ตอบในรูปแบบนี้

### 1. Problem Framing
- ปัญหาคืออะไร
- กระทบใคร
- หนักที่ไหน

### 2. Causal Chain
- สายเหตุ-ผลหลัก 1-2 เส้น
- จุดรั่วหลักของระบบ

### 3. Bottleneck Classification
- ระบุประเภทคอขวด
- ระบุว่าหลักอยู่ที่ Need, Capacity, Process, Behavior, Finance หรือ Data

### 4. Minimum Intervention Set
- เสนอไม่เกิน 3 ชุดมาตรการ
- ระบุว่ามาตรการไหนเป็น quick win และมาตรการไหนเป็น structural

### 5. Expected Outcome
- outcome ที่คาดว่าจะดีขึ้น
- KPI ที่ควรติดตาม

### 6. Confidence and Data Gaps
- สิ่งที่ยืนยันจากข้อมูลจริง
- สิ่งที่เป็น inference
- ข้อมูลที่ยังขาด

---

## Interpretation Rules for This Project

กติกาเฉพาะของรีโปนี้:

1. ถ้า `Need สูง + Outcome แย่`
- ให้พิจารณา `capacity` และ `service bottleneck` ก่อน

2. ถ้า `Need ไม่สูง + Outcome แย่`
- ให้พิจารณา `process`, `behavior`, `quality of care` ก่อน

3. ถ้า `Capacity ดูพอ + Outcome ยังแย่`
- ห้ามรีบเสนอเพิ่มคน
- ให้ทดสอบ referral, protocol, timing, adherence, provider variation

4. ถ้า `Data Quality ไม่ผ่าน`
- ให้ลดระดับ confidence
- ห้ามสรุปเชิงนโยบายแบบเด็ดขาด

5. ถ้าเป็น recommendation ระดับพื้นที่
- ต้องแยกบริบทอย่างน้อยเป็น
  - เมือง/บริการหนาแน่น
  - ชนบทเข้าถึงยาก
  - ชายแดน/เคลื่อนย้ายสูง
  - พื้นที่ผู้สูงอายุสูง

---

## Disease-Specific Playbooks

## A. NCD

คำถามหลัก
- จุดแตกหักอยู่ที่ screening, detection, treatment start, adherence หรือ follow-up
- uncontrolled cases กระจุกที่พื้นที่ใด
- outcome แย่เพราะ shortage หรือ continuity failure

KPI ตัวอย่าง
- controlled rate
- complication rate
- CKD progression
- avoidable admission

minimum intervention patterns
- risk stratification
- registry follow-up
- tele-follow-up
- home adherence support
- protocol redesign for high-risk cases

## B. TB

คำถามหลัก
- delay อยู่ที่ symptom recognition, diagnosis, referral หรือ treatment support
- household spread ถูกหยุดเร็วพอหรือไม่
- lost to follow-up อยู่ในกลุ่มไหน

KPI ตัวอย่าง
- diagnostic delay
- treatment success
- LTFU
- contact investigation coverage

minimum intervention patterns
- hotspot case finding
- fast referral
- adherence support
- contact tracing intensification

## C. Dengue / Vector-Borne Disease

คำถามหลัก
- ระบบรับรู้ cluster ช้าไปกี่วัน
- bottleneck อยู่ที่ warning, source reduction หรือ surge response
- พื้นที่ใดควรทำ pre-emptive action

KPI ตัวอย่าง
- detection lead time
- severe admission rate
- response time
- source reduction coverage

minimum intervention patterns
- signal fusion
- pre-outbreak trigger
- micro-zone response
- school/community targeting

## D. Elderly / LTC

คำถามหลัก
- ใครคือ frailty high-risk
- บ้าน-ชุมชน-โรงพยาบาลขาด continuity ตรงไหน
- อะไรช่วยชะลอ dependency ได้จริง

KPI ตัวอย่าง
- hospitalization
- functional decline
- caregiver burden
- home visit responsiveness

minimum intervention patterns
- frailty stratification
- integrated home routing
- caregiver support
- telemonitoring for high-risk elderly

---

## Confidence Scale

ให้ agent ระบุ confidence ทุกครั้ง

- `High`
  - มีข้อมูล Need + Capacity + Outcome ตรงกัน
  - data quality ผ่าน
  - recommendation สอดคล้องหลายแหล่ง

- `Medium`
  - มีข้อมูลหลักพอ แต่ยังขาด behavior หรือ finance layer
  - มีบางส่วนเป็น inference

- `Low`
  - ข้อมูลขาดหลายชั้น
  - data quality มีปัญหา
  - causal chain ยังเป็นสมมุติฐานมาก

---

## Guardrails

agent ต้องไม่ทำสิ่งต่อไปนี้
- สรุปเพิ่มคนทันทีจาก headcount ต่ำ
- ใช้ dashboard score แทน causal reasoning
- เสนอ intervention จำนวนมากโดยไม่จัดลำดับ
- ใช้ AI แทนการตัดสินใจของผู้บริหาร
- เปลี่ยน schema, data source, หรือ architecture โดยไม่มี milestone อนุมัติ

---

## Recommended Prompt Stub

ใช้ prompt ตั้งต้นนี้เมื่อให้ agent วิเคราะห์:

```text
Use FPHM as a reasoning overlay on the repository's existing NCO model.

Analyze the problem in this order:
Population -> Risk -> Disease Dynamics -> Service Capacity -> Behavior -> Finance -> Outcome

Do not assume workforce shortage is the primary cause.
Identify up to 3 bottlenecks only.
Recommend the minimum intervention set with clear confidence and data gaps.

Output:
1. Problem Framing
2. Causal Chain
3. Bottleneck Classification
4. Minimum Intervention Set
5. Expected Outcome and KPI
6. Confidence and Data Gaps
```

---

## Project Fit Summary

สำหรับโปรเจคนี้ FPHM ควรทำหน้าที่เป็น
- `reasoning standard` สำหรับ AI agent
- `policy interpretation layer` บนผลจาก NCO
- `bridge` จาก dashboard score ไปสู่ intervention design

FPHM ไม่ควรถูกใช้ในรอบนี้เป็น
- replacement ของ NCO engine
- schema redesign
- data architecture rewrite

