# FPHM to NCO Mapping Blueprint

## Purpose

เอกสารนี้ใช้ map กรอบ `FPHM` เข้ากับระบบ `NCO` และ asset ปัจจุบันในรีโป
เพื่อให้ทีมใช้เป็น blueprint รอบพัฒนาถัดไปโดยไม่ขยาย scope เกิน milestone

หลักคิด:
- `NCO` เป็น execution engine ของระบบปัจจุบัน
- `FPHM` เป็น reasoning and intervention framework
- การพัฒนารอบถัดไปควรเป็น `layered extension` ไม่ใช่การรื้อระบบเดิม

---

## Executive Summary

สถานะปัจจุบันของรีโป:
- มี `Need`, `Capacity`, `Outcome`, `benchmark`, `policy`, `workload calibration`, `district baseline`, และ `scenario persistence`
- ยังอ่อนในชั้น `disease mechanics`, `behavior`, `finance`, และ `intervention portfolio`
- ดังนั้น FPHM เหมาะจะเข้ามาเติมในส่วน `causal explanation` และ `decision support`

---

## Layer Mapping

| FPHM Layer | ความหมาย | NCO / ระบบปัจจุบันที่สอดคล้อง | ไฟล์ / endpoint ปัจจุบัน | Coverage | Gap หลัก |
|---|---|---|---|---|---|
| Population Reality | ภาพจริงของประชากรและพื้นที่ | Need denominator, district baseline, PP population scope | `API/amphur_population_store.py`, `API/hdc_population_store.py`, `API/district_baseline_store.py`, `GET /api/reference/amphur-population`, `GET /api/reference/amphur-population-hdc`, `GET /api/baseline/district-profile` | กลางถึงสูง | ยังไม่มี archetype layer แบบเมือง/ชนบท/ชายแดน/สูงอายุสูง |
| Disease & Risk Mechanics | กลไกโรคและแรงเสี่ยง | Need inputs, PP indicator shortlist, disease-specific outcome validation | `simulation.js`, `API/pp_store.py`, `API/pp_workforce_dictionary.py`, `GET /api/pp/shortlist`, `GET /api/pp/amphur-outcome-summary` | กลาง | ยังไม่มี causal chain model และ disease progression logic แบบ explicit |
| Service Physics | ฟิสิกส์ของระบบบริการ | WCI, Need_FTE, workload reference, service matrix, district profile | `simulation.js`, `API/need_fte_engine.py`, `API/analysis_governance_store.py`, `GET /api/analysis/workload-references`, `POST /api/analysis/need-fte-preview` | สูง | ยังไม่มี queue/referral friction/waiting time model เต็มรูปแบบ |
| Human Behavior | พฤติกรรมผู้ป่วยและผู้ให้บริการ | มีเพียงการอนุมานผ่าน outcome และบาง baseline | `simulation.js`, `API/district_baseline_store.py` | ต่ำ | ยังไม่มี no-show, adherence, referral acceptance, provider variation layer |
| Financial Logic | ตรรกะต้นทุนและแรงจูงใจ | มี benchmark/policy governance บางส่วน แต่ไม่มี cost engine | `API/analysis_governance_store.py`, `NCO_INDICATOR_STANDARD.md` | ต่ำ | ยังไม่มี claim, cost per outcome, avoidable cost, incentive distortion |
| Intervention Engine | การเลือกมาตรการที่คานงัดสูง | recommendation layer ปัจจุบันใช้ Need + Outcome + specialty map | `simulation.js`, `recommendation_guide.md`, `MockingHospitalPlan.md` | กลาง | ยังไม่มี bottleneck classification และ minimum intervention portfolio แบบเป็นทางการ |
| Outcome & Governance | ผลลัพธ์และการกำกับ | canonical indicators, policy table, benchmark table, run history | `NCO_INDICATOR_STANDARD.md`, `API/analysis_governance_store.py`, `GET /api/analysis/config`, `GET /api/analysis/benchmarks`, `GET /api/analysis/indicator-policies`, `GET /api/analysis/run-history` | สูง | ยังไม่มี quarterly learning loop และ policy learning report ในระบบ |

---

## Current Repository Fit by Module

## Module A: Health Reality Mapper

FPHM expectation:
- disease burden map
- hotspot map
- access map
- inequity map
- district ranking

Current repo fit:
- ranking และ baseline มีอยู่แล้ว
- PP/clinical split ช่วยเห็นภาระสองฝั่ง
- district profile และ population reference รองรับการดูบริบทพื้นที่

Current anchors:
- `simulation.js`
- `API/district_baseline_store.py`
- `API/amphur_population_store.py`
- `API/hdc_population_store.py`

Status:
- `partially covered`

Missing next layer:
- archetype segmentation
- inequity scoring
- travel-time / access friction logic

## Module B: Causal Chain Modeler

FPHM expectation:
- causal chain diagram
- root cause ranking
- bottleneck score

Current repo fit:
- outcome validation มี
- service plan mapping มี
- specialty recommendation มี

Current anchors:
- `simulation.js`
- `NCO_INDICATOR_STANDARD.md`
- `recommendation_guide.md`
- `API/pp_store.py`
- `GET /api/pp/indicator-workforce-map`

Status:
- `weakly covered`

Missing next layer:
- bottleneck taxonomy
- explicit causal chain blocks
- policy to process translation

## Module C: Service Re-Design Engine

FPHM expectation:
- redesign entry point
- redesign triage
- redesign referral
- redesign follow-up

Current repo fit:
- ระบบเริ่มชี้ specialty และ process note บางตัว
- district profile กับ workload denominator ช่วยชี้ pressure point

Current anchors:
- `simulation.js`
- `API/need_fte_engine.py`
- `API/workload_source_store.py`

Status:
- `partially covered`

Missing next layer:
- process redesign templates
- referral redesign rules
- home/community workflow integration logic

## Module D: Optimization & Simulation Engine

FPHM expectation:
- simulate intervention alternatives
- compare marginal benefit under constraints

Current repo fit:
- mock hospital / mock scenario / run history มีแล้ว
- Need_FTE preview และ replay ให้ฐาน simulation เริ่มต้นได้

Current anchors:
- `API/mock_store.py`
- `POST /api/mock/hospitals/{mock_hospital_id}/scenarios`
- `POST /api/mock/scenarios/{scenario_id}/runs`
- `GET /api/analysis/run-history`
- `simulation.js`

Status:
- `moderately covered for staffing simulation`

Missing next layer:
- intervention comparison beyond staffing
- equity weighting
- budget constraint logic
- sensitivity analysis by intervention class

## Module E: Governance & Learning Loop

FPHM expectation:
- monthly review
- quarterly redesign
- learning agenda
- exception alerts

Current repo fit:
- benchmark governance
- indicator policy governance
- workload source governance
- run history audit trail

Current anchors:
- `API/analysis_governance_store.py`
- `GET /api/analysis/config`
- `GET /api/analysis/benchmarks`
- `GET /api/analysis/indicator-policies`
- `GET /api/analysis/workload-source-runs`

Status:
- `strong governance foundation`

Missing next layer:
- management review template
- policy learning report
- exception-based executive summary

---

## Mapping of FPHM Questions to Current NCO Questions

| FPHM Question | Current NCO Can Answer? | Current Source | Needed Extension |
|---|---|---|---|
| ใครมี health loss สูงสุด | ได้บางส่วน | Need, PP outcome, district baseline | เพิ่ม health loss framing และ equity lens |
| ขาดคนจริงหรือไม่ | ได้ค่อนข้างดี | WCI, Need_FTE, workload reference | เพิ่ม process-vs-capacity discrimination ให้ชัด |
| outcome แย่เพราะอะไร | ได้จำกัด | outcome validation + service plan map | เพิ่ม causal chain และ bottleneck classification |
| ควรแก้ที่ flow ไหนก่อน | ยังตอบไม่เต็ม | process notes บางตัวใน `simulation.js` | เพิ่ม service redesign rules |
| intervention ไหนคุ้มสุด | ยังตอบไม่ได้จริง | ไม่มี finance/intervention engine เต็ม | เพิ่ม intervention value rubric ก่อน ยังไม่ต้องทำ cost engine |
| พื้นที่ต่างกันควรใช้คำตอบต่างกันไหม | ตอบได้บางส่วน | district baseline | เพิ่ม district archetype logic |

---

## Recommended Controlled Extensions

ลำดับถัดไปที่สอดคล้องกับ controlled delivery:

### Priority 1
- สร้าง `FPHM analysis rubric` สำหรับ AI agent
- เพิ่ม `bottleneck classification` ใน recommendation layer โดยยังไม่แตะ schema

เหตุผล:
- leverage สูง
- ใช้กับข้อมูลเดิมได้
- ไม่บังคับให้เปลี่ยน data architecture

### Priority 2
- เพิ่ม `intervention portfolio` บน UI จาก Need + Outcome + district baseline
- เพิ่ม `district archetype logic`

เหตุผล:
- ยกระดับจาก ranking ไปสู่ decision support
- ยังอยู่ใน logic/UI layer

### Priority 3
- ทำ `finance-outcome layer` เมื่อ claim/cost พร้อม

เหตุผล:
- ต้องใช้ data เพิ่ม
- เสี่ยง scope expansion ถ้าทำก่อนเวลา

---

## Suggested File-Level Blueprint

ถ้าจะพัฒนาต่อโดยไม่ขยาย scope เกินจำเป็น ให้ใช้แนวทางนี้

| Work Item | In-Scope Files | Purpose |
|---|---|---|
| FPHM analysis rubric | root `.md` file, prompt pack docs | มาตรฐาน reasoning สำหรับ agent |
| Bottleneck classification | `simulation.js`, อาจมี policy note ใน root `.md` | เพิ่มการแปลผลจาก outcome/gap ไปสู่ชนิดของคอขวด |
| Intervention portfolio UI | `simulation.html`, `simulation.js`, `simulation.css` | แสดงทางเลือก quick win / structural / digital / governance |
| District archetype logic | `simulation.js`, `API/district_baseline_store.py` | แยกข้อเสนอเชิงพื้นที่ |
| Finance-outcome layer | `API/`, root design doc | เพิ่ม cost and incentive reasoning เมื่อข้อมูลพร้อม |

---

## Practical Interpretation for This Project

ถ้าใช้ FPHM ร่วมกับ NCO ในรีโปนี้อย่างถูกต้อง ระบบจะขยับจาก
- `workforce planning tool`

ไปเป็น
- `health system intervention planning tool`

โดยยังใช้แกนเดิมของรีโป:
- Need
- Capacity
- Outcome
- Governance
- Scenario

แล้วเพิ่มสิ่งที่ยังขาด:
- causal explanation
- bottleneck typing
- intervention portfolio
- spatial differentiation

---

## Stop Rules

เพื่อคุม scope ให้ชัด เอกสารนี้เสนอว่าใน milestone ถัดไปไม่ควรทำสิ่งต่อไปนี้โดยอัตโนมัติ
- เปลี่ยน database schema
- เปลี่ยน source of truth
- รื้อ recommendation engine ทั้งชุด
- สร้าง finance module เต็มรูปแบบก่อนมีข้อมูลจริง
- ทำ simulation เชิง epidemiology เต็มรูปแบบก่อนมีโจทย์อนุมัติชัดเจน

---

## Conclusion

ข้อสรุปเชิงสถาปัตย์:
- `NCO` ควรคงเป็นแกนของระบบปัจจุบัน
- `FPHM` ควรเป็นกรอบคิดและชั้นแปลผลเชิงนโยบาย
- การต่อยอดที่เหมาะสมที่สุดคือเพิ่ม logic ในชั้น recommendation และ agent reasoning ก่อน

ดังนั้น FPHM ในรีโปนี้ควรถูกนำมาใช้เป็น
- `AI analysis skill`
- `decision-support rubric`
- `blueprint for next controlled milestone`

ไม่ใช่เป็น
- full replacement ของ NCO
- architecture rewrite
- unbounded platform redesign
