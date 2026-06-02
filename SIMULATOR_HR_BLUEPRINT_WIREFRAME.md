# Wireframe: Simulator_HR_blueprint.html

วันที่จัดทำ: 2 มิถุนายน 2569  
ขอบเขต: ระบบจำลองและพยากรณ์อัตรากำลังบุคลากรสุขภาพแบบรายจังหวัด/อำเภอ/โรงพยาบาล โดยผูกแนวคิด NCO Simulation Model และ HR Blueprint

---

## 1) เป้าหมายของระบบ

ระบบ `Simulator_HR_blueprint.html` ต้องตอบคำถามหลักให้ผู้บริหารและทีม HR ได้ว่า:

1. ในพื้นที่ที่เลือก มีภาระสุขภาพและความต้องการบริการเท่าไร
2. ในแต่ละวิชาชีพ ขณะนี้มีกำลังคนจริงเท่าไร
3. ถ้าปรับจำนวนคนเข้า/ออกในแต่ละปี จะเกิด supply projection อย่างไรใน 5 ปี
4. เมื่อเทียบกับ Need FTE ตาม NCO engine แล้ว จะขาด/เกินเท่าไรในแต่ละปี
5. ควรเพิ่ม ลด โยก หมุนเวียน หรือใช้มาตรการอื่นอย่างไร
6. supervisor ตรวจสอบได้หรือไม่ว่าตัวเลขมาจากไหน ใช้สูตรอะไร และ assumption ใด

---

## 2) Process Overview

```text
Start
  -> เลือกหรือสร้าง Scenario
  -> เลือกพื้นที่: จังหวัด / อำเภอ / รพ.
  -> ตรวจ baseline: population + workforce + vacancy + retire
  -> เลือกวิชาชีพ
  -> ตั้งค่า Need parameters
  -> ใส่ Supply movement รายปี: เข้า / ออก / เกษียณ / ย้าย
  -> Run NCO Projection
  -> ดูผล 5 ปี: Need / Supply / GAP / Suggested Add
  -> ดู recommendation
  -> ตรวจ source/สูตร/assumption
  -> Export report
End
```

---

## 3) Information Architecture

เมนูหลักด้านซ้าย:

```text
1. Scenario
2. Scope
3. Baseline
4. Profession
5. Need
6. Supply Projection
7. Run & Results
8. Recommendations
9. Compare
10. Supervisor Review
11. Export
12. Settings
```

แถบบน:

```text
Simulator HR Blueprint | Scenario Name | ปี 2569-2573 | Scope | Confidence | Save | Export
```

สถานะหลัก:

```text
Draft -> Ready to Run -> Calculated -> Supervisor Reviewed -> Exported
```

---

# Page 0: Scenario Workspace

## Purpose

ใช้เริ่มงาน เลือก scenario เดิม หรือสร้าง scenario ใหม่

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Simulator HR Blueprint                         [New Scenario] [Import CSV]      |
+--------------------------------------------------------------------------------+
| Scenario Library                                                               |
|                                                                                |
| [Search scenario...] [Province] [Year range] [Status]                           |
|                                                                                |
| +----------------------+ +----------------------+ +----------------------+      |
| | เชียงใหม่ 5Y Plan    | | เชียงราย Border HR  | | แม่ฮ่องสอน LTC      |      |
| | 2569-2573            | | 2569-2573            | | 2569-2573            |      |
| | Calculated           | | Draft                | | Reviewed             |      |
| | [Open] [Duplicate]   | | [Open] [Duplicate]   | | [Open] [Duplicate]   |      |
| +----------------------+ +----------------------+ +----------------------+      |
+--------------------------------------------------------------------------------+
```

## Inputs

| Field | Type | Required | Source |
|---|---|---:|---|
| scenario_name | text | yes | user |
| year_start | number | yes | user |
| year_end | number | yes | user |
| scenario_type | select | yes | Base / Optimize / Stress / Custom |

## Outputs

| Output | Description |
|---|---|
| scenario_id | รหัส scenario |
| scenario_status | Draft |

## Validation

| Rule | Behavior |
|---|---|
| year range ต้องไม่เกิน 10 ปี | แสดง warning |
| scenario_name ซ้ำ | ให้ rename หรือ duplicate |

---

# Page 1: Scope Selector

## Purpose

เลือกพื้นที่วิเคราะห์แบบ drill-down จากจังหวัด ไปอำเภอ ไปโรงพยาบาล

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 1: Scope Selector                                                          |
+--------------------------------------------------------------------------------+
| จังหวัด              อำเภอ                  หน่วยบริการ                         |
| [เชียงใหม่ v]        [เมืองเชียงใหม่ v]     [นครพิงค์ v]                        |
|                                                                                |
| Scope Mode                                                                      |
| ( ) จังหวัดรวม    ( ) อำเภอ    (x) โรงพยาบาล    ( ) เครือข่ายบริการ           |
|                                                                                |
| Area Profile                                                                    |
| +----------------------+ +----------------------+ +----------------------+      |
| | ประชากรรับผิดชอบ     | | ผู้สูงอายุ           | | ภูมิประเทศ/ชายแดน    |      |
| | 1,170,694            | | 20.0%                | | mixed / non-border    |      |
| +----------------------+ +----------------------+ +----------------------+      |
|                                                                                |
| [Back]                                                   [Next: Baseline]       |
+--------------------------------------------------------------------------------+
```

## Inputs

| Field | Type | Required | Source |
|---|---|---:|---|
| province_code | select | yes | `provinces` |
| amphur_code | select | no | `hdc_amphur_population_reference` |
| unit_name | select | no | `organizational_unit` |
| scope_mode | radio | yes | user |

## Outputs

| Output | Description |
|---|---|
| selected_scope | province/amphur/unit |
| population_context | population + age structure |
| area_archetype | urban/rural/border/elderly-high |

## Validation

| Rule | Behavior |
|---|---|
| unit_name ต้อง match ฐานข้อมูล | ถ้าไม่เจอ แสดง suggestion จาก `scripts/find_hr_unit.py` logic |
| scope_mode = โรงพยาบาล แต่ไม่เลือก unit | disable Next |

---

# Page 2: Baseline Data Check

## Purpose

ตรวจ baseline ที่ระบบจะใช้ก่อนคำนวณ: population, workforce, vacancy, retirement, data confidence

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 2: Baseline Data Check                                    Confidence: B    |
+--------------------------------------------------------------------------------+
| Data Source                                                                    |
| [Population: HDC 2569] [Workforce: hr_blueprint.db] [Vacancy: position table]   |
|                                                                                |
| Baseline Cards                                                                  |
| +----------------+ +----------------+ +----------------+ +----------------+    |
| | Population     | | Workforce      | | Vacancy        | | Retire <=5y    |    |
| | 1,170,694      | | 9,587 all      | | 776 all        | | 613 all        |    |
| +----------------+ +----------------+ +----------------+ +----------------+    |
|                                                                                |
| Data Quality Checklist                                                          |
| [x] population source found                                                     |
| [x] unit workforce found                                                        |
| [x] vacancy available                                                           |
| [x] retirement date available                                                   |
| [ ] workload source complete                                                    |
|                                                                                |
| [View SQL/Source] [Override Baseline]                    [Next: Profession]     |
+--------------------------------------------------------------------------------+
```

## Inputs

| Field | Type | Required | Source |
|---|---|---:|---|
| baseline_override | optional | no | user |
| confidence_note | text | no | user |

## Outputs

| Output | Description |
|---|---|
| baseline_population | ประชากรตั้งต้น |
| baseline_workforce | workforce current |
| baseline_vacancy | vacancy current |
| baseline_retirement | retirement risk |
| confidence_level | A/B/C/Provisional |

## Supervisor Trace

```text
Population -> health_metrics_analysis_report.md / HDC table
Workforce -> assignment + position + organizational_unit
Vacancy -> position.position_status = vacant
Retirement -> personnel.retirement_date <= cutoff
```

---

# Page 3: Profession Selector

## Purpose

เลือกวิชาชีพที่จะทำ projection และกำหนดว่าจะใช้ benchmark/target แบบใด

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 3: Profession Selector                                                     |
+--------------------------------------------------------------------------------+
| Search profession: [แพทย์ / พยาบาล / เภสัช / ...]                               |
|                                                                                |
| [x] แพทย์              Current 761      Rate 6.50/10k      Target: Median       |
| [x] พยาบาลวิชาชีพ      Current 2,815    Rate 24.05/10k     Target: Median       |
| [x] เภสัชกร            Current 287      Rate 2.45/10k      Target: Median       |
| [ ] นักกายภาพบำบัด     Current ...      Rate ...           Target: Benchmark    |
| [ ] นักจิตวิทยา        Current ...      Rate ...           Target: Benchmark    |
|                                                                                |
| Target Mode                                                                     |
| (x) Region Median  ( ) Region P75  ( ) Service Level Standard  ( ) Custom       |
|                                                                                |
| [Back]                                                   [Next: Need Setup]     |
+--------------------------------------------------------------------------------+
```

## Inputs

| Field | Type | Required | Source |
|---|---|---:|---|
| profession_codes | multi-select | yes | dictionary |
| target_mode | select | yes | median/p75/service/custom |
| custom_target_rate | number | conditional | user |

## Outputs

| Output | Description |
|---|---|
| selected_professions | วิชาชีพที่จะคำนวณ |
| target_policy | เกณฑ์เป้าหมาย |

---

# Page 4: Need Parameter Setup

## Purpose

ตั้งค่า demand/need รายปี เช่น ประชากร burden และ weight ที่ใช้ใน NCO engine

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 4: Need Parameter Setup                                                    |
+--------------------------------------------------------------------------------+
| Year Range: 2569 - 2573                                                         |
|                                                                                |
| Population & Burden Table                                                       |
| +------+------------+-----------+----------+-------------+----------------+     |
| | ปี   | Population | Elderly % | Chronic% | Mental/100k | Workload Index |     |
| +------+------------+-----------+----------+-------------+----------------+     |
| | 2569 | 1,170,694  | 20.0      | 12.0     | 350         | 1.00           |     |
| | 2570 | 1,176,547  | 20.5      | 12.2     | 355         | 1.03           |     |
| | 2571 | 1,182,420  | 21.0      | 12.4     | 360         | 1.05           |     |
| | 2572 | 1,188,332  | 21.5      | 12.6     | 365         | 1.08           |     |
| | 2573 | 1,194,274  | 22.0      | 12.8     | 370         | 1.10           |     |
| +------+------------+-----------+----------+-------------+----------------+     |
|                                                                                |
| Weight: Elderly [40] Chronic [40] Mental [20]                                   |
| [Import assumptions CSV] [Auto growth] [Reset from baseline]                    |
|                                                                                |
| [Back]                                            [Next: Supply Projection]     |
+--------------------------------------------------------------------------------+
```

## Inputs

| Field | Type | Required | Source |
|---|---|---:|---|
| population_total_by_year | table | yes | user/HDC |
| elderly_rate_pct_by_year | table | yes | user/HDC |
| chronic_rate_pct_by_year | table | yes | user/registry |
| mental_risk_rate_per100k_by_year | table | yes | user/registry |
| workload_index_by_year | number | no | service statistics |
| weights | number | yes | user |

## Outputs

| Output | Description |
|---|---|
| need_payload_by_year | payload สำหรับ NCO need engine |
| need_assumption_set | assumption ที่ supervisor ตรวจได้ |

---

# Page 5: Supply Projection

## Purpose

ให้ผู้ใช้ใส่จำนวนคนเข้า/ออกในแต่ละปี แยกตามวิชาชีพ แล้วคำนวณ supply FTE ต่อเนื่อง 5 ปี

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 5: Supply Projection                                                       |
+--------------------------------------------------------------------------------+
| Profession: [เภสัชกร v]                         FTE factor default: [1.00]      |
|                                                                                |
| +------+---------+--------+----------+-----------+--------+--------+-------+    |
| | ปี   | Current | Recruit| Transfer | Retirement| Resign | Study  | Net   |    |
| +------+---------+--------+----------+-----------+--------+--------+-------+    |
| | 2569 | 287     | 3      | 1        | 2         | 1      | 0      | +1    |    |
| | 2570 | 288     | 2      | 0        | 3         | 1      | 0      | -2    |    |
| | 2571 | 286     | 4      | 1        | 4         | 1      | 1      | -1    |    |
| | 2572 | 285     | 5      | 0        | 3         | 1      | 0      | +1    |    |
| | 2573 | 286     | 5      | 1        | 5         | 1      | 0      | 0     |    |
| +------+---------+--------+----------+-----------+--------+--------+-------+    |
|                                                                                |
| Formula                                                                        |
| Supply_next = Supply_current + Recruit + TransferIn + ReturnIn                 |
|             - Retirement - Resign - TransferOut - StudyLeave                   |
|                                                                                |
| [Apply to all professions] [Import movement CSV] [Auto retirement from DB]      |
|                                                                                |
| [Back]                                                  [Next: Run Projection]  |
+--------------------------------------------------------------------------------+
```

## Inputs

| Field | Type | Required | Source |
|---|---|---:|---|
| current_headcount | number | yes first year | DB/user |
| recruit_in | number | yes | user |
| transfer_in | number | yes | user |
| return_in | number | yes | user |
| retire_out | number | yes | DB/user |
| resign_out | number | yes | user |
| transfer_out | number | yes | user |
| study_leave_out | number | yes | user |
| fte_factor | number | yes | user |

## Outputs

| Output | Description |
|---|---|
| projected_supply_headcount_by_year | headcount หลังเข้า/ออก |
| projected_supply_fte_by_year | projected FTE |
| movement_summary | เข้า/ออก/net change |

## Calculation

```text
net_change = recruit_in + transfer_in + return_in - retire_out - resign_out - transfer_out - study_leave_out
projected_headcount(year) = previous_projected_headcount + net_change
projected_fte(year) = projected_headcount(year) * fte_factor
```

---

# Page 6: Constraint & Policy Rules

## Purpose

เพิ่มข้อจำกัดเชิงนโยบายที่ส่งผลต่อคำตอบ เช่น budget cap, minimum staffing, retention package

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 6: Constraint & Policy Rules                                               |
+--------------------------------------------------------------------------------+
| Budget Constraint                                                               |
| [ ] ไม่จำกัดงบ   [x] จำกัดงบต่อปี: [20,000,000] บาท                            |
|                                                                                |
| Staffing Rules                                                                  |
| [x] ห้ามต่ำกว่า service minimum                                                |
| [x] ถ้า vacancy > 15% ให้ขึ้น risk red                                         |
| [x] ถ้า retire_5y > 10% ให้บังคับ replacement plan                             |
|                                                                                |
| Intervention Options                                                            |
| [x] Recruit permanent                                                           |
| [x] Contract / temporary                                                        |
| [x] Rotation from hub                                                           |
| [x] Telehealth substitution                                                     |
| [x] Productivity improvement                                                    |
|                                                                                |
| [Back]                                                  [Next: Run Projection]  |
+--------------------------------------------------------------------------------+
```

## Inputs

| Field | Type | Required | Source |
|---|---|---:|---|
| budget_cap_by_year | number | no | user |
| minimum_staffing_rule | toggle | no | policy |
| vacancy_risk_threshold | number | no | policy |
| retirement_risk_threshold | number | no | policy |
| intervention_options | checklist | no | user |

## Outputs

| Output | Description |
|---|---|
| policy_constraints | constraints ที่ใช้ปรับ recommendation |
| risk_rules | กติกาจัดระดับ risk |

---

# Page 7: Run Projection

## Purpose

ยืนยันข้อมูลก่อนคำนวณ แล้วเรียก NCO engine + supply projection

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 7: Run Projection                                                          |
+--------------------------------------------------------------------------------+
| Ready Check                                                                     |
| [x] Scope selected                                                              |
| [x] Baseline loaded                                                             |
| [x] Professions selected                                                        |
| [x] Need parameters complete                                                     |
| [x] Supply movement complete                                                    |
| [x] Constraints reviewed                                                        |
|                                                                                |
| Calculation Mode                                                                |
| (x) 5-year projection   ( ) 10-year projection   ( ) Custom                     |
|                                                                                |
| [Run NCO Projection] [Save Draft]                                               |
|                                                                                |
| Calculation Log                                                                 |
| - Need engine payload prepared                                                  |
| - Supply movement calculated                                                    |
| - Gap and recommendation calculated                                             |
+--------------------------------------------------------------------------------+
```

## Processing Steps

```text
1. Build need payload by year
2. Run /api/analysis/need-fte-preview for each year
3. Extract need_fte per profession
4. Calculate supply_fte per profession/year
5. Calculate gap_fte
6. Apply policy constraints
7. Generate recommendation
8. Write scenario result
```

---

# Page 8: Projection Results

## Purpose

แสดงผลลัพธ์หลัก 5 ปี รายวิชาชีพ พร้อมความเสี่ยงและ suggested action

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 8: Projection Results                              Scenario: Base 5Y       |
+--------------------------------------------------------------------------------+
| Summary Cards                                                                   |
| +-------------+ +-------------+ +-------------+ +-------------+                |
| | Total Gap   | | High Risk   | | Replacement | | Budget Need |                |
| | 86 FTE      | | 3 Prof      | | 42 คน       | | 18.4M       |                |
| +-------------+ +-------------+ +-------------+ +-------------+                |
|                                                                                |
| Results Table                                                                   |
| +------+------------+----------+------------+---------+---------------+------+ |
| | ปี   | วิชาชีพ    | Need FTE | Supply FTE | GAP FTE | Suggested Add | Risk | |
| +------+------------+----------+------------+---------+---------------+------+ |
| | 2569 | เภสัชกร    | 320      | 287        | 33      | +33           | Red  | |
| | 2570 | เภสัชกร    | 326      | 288        | 38      | +38           | Red  | |
| | 2571 | เภสัชกร    | 331      | 286        | 45      | +45           | Red  | |
| | 2572 | เภสัชกร    | 337      | 285        | 52      | +52           | Red  | |
| | 2573 | เภสัชกร    | 342      | 286        | 56      | +56           | Red  | |
| +------+------------+----------+------------+---------+---------------+------+ |
|                                                                                |
| [Chart: Need vs Supply by Year]          [Chart: GAP by Profession]             |
|                                                                                |
| [Back]                                             [Next: Recommendations]      |
+--------------------------------------------------------------------------------+
```

## Outputs

| Output | Description |
|---|---|
| need_fte_by_year | Need FTE จาก NCO |
| supply_fte_by_year | Supply projection |
| gap_fte_by_year | Need - Supply |
| suggested_add_by_year | ceil(max(gap, 0)) |
| risk_level | green/yellow/red |

---

# Page 9: Recommendation Portfolio

## Purpose

แปลงผล GAP เป็นข้อเสนอเชิงปฏิบัติ

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 9: Recommendation Portfolio                                                |
+--------------------------------------------------------------------------------+
| Priority                                                                        |
| +----------------------------------------------------------------------------+ |
| | Red: เภสัชกรขาดต่อเนื่อง 5 ปี และ gap เพิ่มขึ้นจาก 33 -> 56 FTE            | |
| | Recommendation: Recruit + retention + rotation from hub                      | |
| +----------------------------------------------------------------------------+ |
|                                                                                |
| Intervention Portfolio                                                          |
| +----------------------+ +----------------------+ +----------------------+      |
| | Quick Win            | | Structural           | | Digital/Network      |      |
| | จ้างชั่วคราว/rotation| | เพิ่มกรอบ/ทุนศึกษา  | | telepharmacy         |      |
| +----------------------+ +----------------------+ +----------------------+      |
|                                                                                |
| Decision Logic                                                                  |
| Need สูง + Supply ลด + vacancy สูง = เพิ่มคนและทำ retention พร้อมกัน           |
|                                                                                |
| [Back]                                                 [Next: Compare]          |
+--------------------------------------------------------------------------------+
```

## Recommendation Rules

| Condition | Recommendation |
|---|---|
| gap_fte > 0 และเพิ่มขึ้นทุกปี | เพิ่มคน + retention |
| gap_fte > 0 แต่ supply คงที่ | recruit หรือ productivity |
| gap_fte <= 0 แต่ outcome แย่ | process redesign |
| retirement_out สูง | replacement pipeline |
| vacancy สูง | recruitment bottleneck + incentive |
| budget cap ต่ำ | rotation/telehealth/skill mix |

---

# Page 10: Scenario Compare

## Purpose

เปรียบเทียบ scenario เช่น Base vs Recruit More vs Retention vs Digital

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 10: Scenario Compare                                                       |
+--------------------------------------------------------------------------------+
| Compare: [Base v] vs [Retention Package v] vs [Aggressive Recruit v]            |
|                                                                                |
| +-------------------+------------+------------+------------+----------------+   |
| | Metric            | Base       | Retention  | Recruit    | Best           |   |
| +-------------------+------------+------------+------------+----------------+   |
| | Total Gap 5Y      | 214 FTE    | 166 FTE    | 88 FTE     | Recruit        |   |
| | Budget            | 0          | 8M         | 25M        | Retention      |   |
| | High Risk Years   | 5          | 4          | 2          | Recruit        |   |
| | Feasibility       | High       | Medium     | Low        | Base           |   |
| +-------------------+------------+------------+------------+----------------+   |
|                                                                                |
| [Select Recommended Scenario] [Export Compare]                                  |
+--------------------------------------------------------------------------------+
```

## Outputs

| Output | Description |
|---|---|
| scenario_rank | ranking ตาม impact/feasibility |
| recommended_scenario | scenario ที่เสนอให้ใช้ |

---

# Page 11: Supervisor Review

## Purpose

ให้ supervisor ตรวจสอบตัวเลขทุกชุดก่อนอนุมัติหรือ export

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 11: Supervisor Review                                    Status: Pending   |
+--------------------------------------------------------------------------------+
| Traceability                                                                     |
| +----------------------+----------------------+-----------------------------+  |
| | Number               | Source               | Formula / Query             |  |
| +----------------------+----------------------+-----------------------------+  |
| | Population 1,170,694 | HDC table            | parsed from report          |  |
| | Current Pharm 287    | hr_blueprint.db      | assignment + position       |  |
| | Need FTE 320         | NCO need engine      | benchmark * denominator     |  |
| | Supply 287           | projection table     | baseline + in - out         |  |
| | GAP 33               | calculated           | need - supply               |  |
| +----------------------+----------------------+-----------------------------+  |
|                                                                                |
| Assumption Checklist                                                             |
| [x] population assumption accepted                                               |
| [x] profession baseline accepted                                                 |
| [x] movement in/out reviewed                                                     |
| [ ] workload data incomplete acknowledged                                        |
|                                                                                |
| Supervisor Comment                                                               |
| [............................................................................]   |
|                                                                                |
| [Reject] [Request Revision] [Approve Scenario]                                  |
+--------------------------------------------------------------------------------+
```

## Review Rules

| Rule | Behavior |
|---|---|
| missing source | cannot approve |
| missing movement assumption | warning |
| workload incomplete | mark provisional |
| supervisor approves | status = Supervisor Reviewed |

---

# Page 12: Export & Report

## Purpose

ส่งออกผลเพื่อใช้ประชุมคณะกรรมการหรือแนบแผนจังหวัด

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Step 12: Export                                                                 |
+--------------------------------------------------------------------------------+
| Export Options                                                                  |
| [x] Executive Summary                                                            |
| [x] 5-Year Projection Table                                                      |
| [x] Profession GAP Detail                                                        |
| [x] Scenario Compare                                                             |
| [x] Supervisor Traceability                                                      |
| [ ] Raw JSON                                                                     |
|                                                                                |
| Format                                                                          |
| (x) Markdown   ( ) HTML A4   ( ) CSV   ( ) JSON                                  |
|                                                                                |
| [Generate Report] [Download CSV] [Print]                                         |
|                                                                                |
| Export Preview                                                                  |
| +----------------------------------------------------------------------------+ |
| | HR Blueprint Projection Report: เชียงใหม่ / นครพิงค์ / 2569-2573            | |
| +----------------------------------------------------------------------------+ |
+--------------------------------------------------------------------------------+
```

## Outputs

| Output | Description |
|---|---|
| report_md | รายงาน Markdown |
| projection_csv | ตารางผลลัพธ์ |
| scenario_json | raw scenario result |
| supervisor_audit | audit trail |

---

# Page 13: Settings & Data Dictionary

## Purpose

จัดการ mapping วิชาชีพ benchmark และ data source

## Wireframe

```text
+--------------------------------------------------------------------------------+
| Settings                                                                        |
+--------------------------------------------------------------------------------+
| Tabs: [Profession Dictionary] [Benchmark] [Risk Rules] [Data Sources]           |
|                                                                                |
| Profession Dictionary                                                           |
| +------------------+------------------+------------------+------------------+  |
| | profession_code  | name_th          | source field     | active           |  |
| +------------------+------------------+------------------+------------------+  |
| | pharmacist_total | เภสัชกร          | position_name_th | yes              |  |
| +------------------+------------------+------------------+------------------+  |
|                                                                                |
| [Add] [Edit] [Export Dictionary]                                                |
+--------------------------------------------------------------------------------+
```

## Settings Scope

| Area | Purpose |
|---|---|
| Profession Dictionary | map วิชาชีพกับฐานข้อมูล |
| Benchmark | target rate / service standard |
| Risk Rules | green/yellow/red |
| Data Sources | source + vintage + confidence |

---

# 4) Data Model for Projection

## Scenario Header

| Field | Description |
|---|---|
| scenario_id | unique id |
| scenario_name | ชื่อ scenario |
| year_start | ปีเริ่ม |
| year_end | ปีสิ้นสุด |
| scope_mode | province/amphur/unit/network |
| province_code | รหัสจังหวัด |
| amphur_code | รหัสอำเภอ |
| unit_id/unit_name | หน่วยบริการ |
| status | Draft/Calculated/Reviewed/Exported |

## Need Assumption

| Field | Description |
|---|---|
| year_be | ปี พ.ศ. |
| population_total | ประชากร |
| elderly_rate_pct | สัดส่วนผู้สูงอายุ |
| chronic_rate_pct | chronic proxy |
| mental_risk_rate_per100k | mental proxy |
| workload_index | workload multiplier |
| weight_elderly | weight |
| weight_chronic | weight |
| weight_mental | weight |

## Supply Movement

| Field | Description |
|---|---|
| year_be | ปี พ.ศ. |
| profession_code | วิชาชีพ |
| current_headcount | baseline เฉพาะปีแรก |
| recruit_in | รับเข้าใหม่ |
| transfer_in | ย้ายเข้า |
| return_in | กลับเข้าระบบ |
| retire_out | เกษียณ |
| resign_out | ลาออก |
| transfer_out | ย้ายออก |
| study_leave_out | ลาศึกษา/ช่วยราชการ |
| fte_factor | factor แปลง headcount เป็น FTE |

## Projection Result

| Field | Description |
|---|---|
| year_be | ปี พ.ศ. |
| profession_code | วิชาชีพ |
| need_fte | จาก NCO engine |
| supply_headcount | projected headcount |
| supply_fte | projected FTE |
| gap_fte | need_fte - supply_fte |
| suggested_add | ceil(max(gap_fte, 0)) |
| potential_reallocate | max(supply_fte - need_fte, 0) |
| risk_level | green/yellow/red |
| recommendation | action |

---

# 5) End-to-End User Flow

```text
1. ผู้ใช้เปิด Simulator_HR_blueprint.html
2. สร้าง scenario ใหม่
3. เลือกจังหวัด/อำเภอ/รพ.
4. ระบบโหลด baseline จาก hr_blueprint.db และ HDC source
5. ผู้ใช้เลือกวิชาชีพที่จะทำแผน
6. ผู้ใช้ปรับ Need parameters รายปี
7. ผู้ใช้ใส่จำนวนคนเข้า/ออกในแต่ละปี
8. ผู้ใช้ตั้ง policy constraints
9. ระบบ run projection
10. ระบบแสดง Need / Supply / GAP / Suggested Add รายปี
11. ระบบสร้าง recommendation
12. supervisor ตรวจ traceability
13. approve หรือ request revision
14. export report
```

---

# 6) Acceptance Criteria

## Functional

| Criteria | Expected |
|---|---|
| เลือกจังหวัด/อำเภอ/รพ. ได้ | dropdown ทำงานครบ |
| เลือกวิชาชีพได้หลายรายการ | multi-select ทำงาน |
| ปรับพารามิเตอร์รายปีได้ | table editable |
| ใส่คนเข้า/ออกรายปีได้ | supply projection คำนวณต่อเนื่อง |
| Run projection ได้ | ได้ Need/Supply/GAP |
| Export ได้ | ได้ Markdown/CSV/JSON |

## Supervisor

| Criteria | Expected |
|---|---|
| ตัวเลขทุกตัวมี source | แสดง trace |
| สูตรคำนวณดูได้ | แสดง formula |
| assumption ดูได้ | แสดง assumption |
| ข้อมูลไม่ครบต้องเตือน | confidence ลดลง |

## Technical

| Criteria | Expected |
|---|---|
| ไม่กระทบ `simulation.html` เดิม | แยกไฟล์ |
| ใช้ NCO engine เดิมได้ | call `/api/analysis/need-fte-preview` |
| รองรับ CSV import/export | template ใช้ได้ |
| ใช้ offline local ได้ | run ผ่าน `run_simulator.bat` |

---

# 7) MVP Scope

ควรทำ MVP ก่อนใน 6 หน้า:

```text
1. Scenario Workspace
2. Scope Selector
3. Baseline Data Check
4. Profession Selector
5. Need + Supply Projection
6. Projection Results + Export
```

หลัง MVP ค่อยแยกหน้า Compare, Supervisor Review, Settings ให้ละเอียดขึ้น

---

# 8) Suggested Backlog

| Priority | Item |
|---|---|
| HIGH | สร้าง `Simulator_HR_blueprint.html/js/css` จาก wireframe MVP |
| HIGH | เพิ่ม projection engine สำหรับคนเข้า/ออก 5 ปี |
| HIGH | ทำ CSV import template สำหรับ supply movement |
| HIGH | เพิ่ม supervisor traceability panel |
| MEDIUM | ทำ scenario compare A/B |
| MEDIUM | ทำ report export แบบ A4 HTML |
| MEDIUM | เพิ่ม district-level archetype rules |
| LOW | เพิ่ม budget optimization เมื่อข้อมูล cost พร้อม |

