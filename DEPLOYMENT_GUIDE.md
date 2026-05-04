# Deployment Guide - HR Blueprint Dashboard

## Purpose

คู่มือนี้อธิบายว่าไฟล์ `run_simulator.bat` ต้องใช้ไฟล์อะไรบ้างเพื่อให้ระบบรันได้ครบ, อะไรคือไฟล์ runtime ที่ต้องพาไป deploy จริง, และควรอัปเดตระบบออนไลน์อย่างไรแบบทำงานต่อเนื่องผ่าน Git/GitHub ได้

คู่มือนี้อ้างอิงจากโค้ดจริงใน repo นี้ ไม่ใช่จากการเดาโครงสร้างระบบ

## Scope ที่คู่มือนี้ครอบคลุม

- Local launcher: `run_simulator.bat`
- Simulation UI: `simulation.html`, `simulation.js`, `simulation.css`
- API และ runtime stores ใน `API/`
- ฐานข้อมูลหลัก `hr_blueprint.db`
- ข้อมูลที่ frontend/API อ่านตรงใน runtime
- วิธี deploy แบบ online update ผ่าน Git/GitHub

## สิ่งที่ `run_simulator.bat` ทำจริง

ไฟล์ [`run_simulator.bat`](C:\HR_blueprint\hr_blueprint_dashboard\run_simulator.bat) ทำ 5 อย่างหลัก:

1. ตรวจว่าเครื่องมี `python` ใน `PATH`
2. ตรวจและติดตั้ง package Python ที่จำเป็น
3. bootstrap SQLite stores ที่ API ใช้
4. เปิด API ด้วย `uvicorn API.main:app` ที่ port `8765`
5. เปิด static web server สำหรับไฟล์หน้าเว็บที่ port `8766` แล้วเปิด [`simulation.html`](C:\HR_blueprint\hr_blueprint_dashboard\simulation.html)

ดังนั้นการ deploy จริงที่ต้องการให้ใช้งานได้ครบ ไม่สามารถเอาเฉพาะ `simulation.html` ขึ้น GitHub Pages อย่างเดียวได้ เพราะหน้า simulation เรียก `/api/*` หลาย endpoint และ API ยังต้องอ่านฐานข้อมูล SQLite กับ CSV หลายชุด

## ไฟล์ที่ต้องมีสำหรับ runtime จริง

### 1. ไฟล์บังคับสำหรับหน้า Simulation

- [`simulation.html`](C:\HR_blueprint\hr_blueprint_dashboard\simulation.html)
- [`simulation.js`](C:\HR_blueprint\hr_blueprint_dashboard\simulation.js)
- [`simulation.css`](C:\HR_blueprint\hr_blueprint_dashboard\simulation.css)
- [`data_inputV1.csv`](C:\HR_blueprint\hr_blueprint_dashboard\data_inputV1.csv)

เหตุผล:

- `simulation.js` โหลด `data_inputV1.csv` โดยตรงจาก static root
- `simulation.js` เรียก `/api/mock`, `/api/pp`, `/api/analysis`, `/api/hr`, `/api/reference`, `/api/baseline`, `/api/scope`

### 2. ไฟล์บังคับสำหรับ API

- [`API/main.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\main.py)
- [`API/mock_store.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\mock_store.py)
- [`API/pp_store.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\pp_store.py)
- [`API/analysis_governance_store.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\analysis_governance_store.py)
- [`API/workload_source_store.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\workload_source_store.py)
- [`API/district_baseline_store.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\district_baseline_store.py)
- [`API/amphur_population_store.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\amphur_population_store.py)
- [`API/hdc_population_store.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\hdc_population_store.py)
- [`API/hospital_scope_store.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\hospital_scope_store.py)
- [`API/clinical_denominator_store.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\clinical_denominator_store.py)
- [`API/need_fte_engine.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\need_fte_engine.py)
- [`API/hr_workforce_dictionary.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\hr_workforce_dictionary.py)
- [`API/pp_workforce_dictionary.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\pp_workforce_dictionary.py)
- [`API/requirements.txt`](C:\HR_blueprint\hr_blueprint_dashboard\API\requirements.txt)

### 3. ข้อมูลบังคับที่ API อ่านระหว่าง runtime

- [`hr_blueprint.db`](C:\HR_blueprint\hr_blueprint_dashboard\hr_blueprint.db)
- [`API/final_dataset_regional.csv`](C:\HR_blueprint\hr_blueprint_dashboard\API\final_dataset_regional.csv)
- [`API/etl/fact_specialists.csv`](C:\HR_blueprint\hr_blueprint_dashboard\API\etl\fact_specialists.csv)

เหตุผล:

- `API/main.py` อ่าน `hr_blueprint.db`
- `API/main.py` อ่าน `API/final_dataset_regional.csv` สำหรับ `/api/overview`, `/api/ranking`, `/api/scatter`
- `API/main.py` อ่าน `API/etl/fact_specialists.csv` สำหรับ `/api/specialties/{facility_id}`
- `district_baseline_store.py` ใช้ `data_inputV1.csv` เพื่อสร้าง baseline profiles

### 4. ไฟล์ dashboard ถ้าต้องการใช้หน้า dashboard ด้วย

- [`dashboard/index.html`](C:\HR_blueprint\hr_blueprint_dashboard\dashboard\index.html)
- [`dashboard/css/style.css`](C:\HR_blueprint\hr_blueprint_dashboard\dashboard\css\style.css)
- [`dashboard/js/app.js`](C:\HR_blueprint\hr_blueprint_dashboard\dashboard\js\app.js)

หมายเหตุ:

- API mount โฟลเดอร์ `dashboard/` ไว้ที่ `/dashboard`
- ถ้า deploy จริงและต้องการใช้ dashboard ด้วย ต้องพาโฟลเดอร์นี้ไปด้วย

## ไฟล์ที่ระบบสร้างเองได้ตอน bootstrap

ไฟล์ต่อไปนี้ไม่จำเป็นต้องเตรียมจากต้นทางเสมอไป เพราะระบบสร้าง/เติมให้ได้:

- `API/data/mock_scenarios.db`
- `API/data/district_baseline.db`
- ตารางเสริมใน `hr_blueprint.db` ที่สร้างผ่าน store modules

ไฟล์ที่ควรเตรียมล่วงหน้าเฉพาะกรณี:

- `API/data/dopa_stat_67.zip`

ใช้เป็น local cache สำหรับข้อมูลประชากรระดับอำเภอ ถ้าไม่มี ระบบสามารถดึงใหม่ได้เมื่อเรียก refresh แต่ production ควรมี network outbound พร้อม

## ไฟล์ที่ไม่จำเป็นสำหรับ runtime ปกติ

กลุ่มนี้ไม่ใช่ไฟล์บังคับในการเปิดใช้งานระบบให้ผู้ใช้ทั่วไป:

- root `.md` เชิงวิเคราะห์/รายงาน
- ไฟล์สำรอง `.bak_*`
- debug JSON
- `output/` และภาพ screenshot
- ETL/debug scripts ที่ไม่ได้ถูกเรียกโดย `API.main`

แต่ถ้าจะทำงานสาย data refresh หรือ scrape upstream ใหม่ ยังต้องเก็บ ETL/debug scripts ที่เกี่ยวข้องไว้ใน branch งาน

## Environment ที่แนะนำ

### ขั้นต่ำ

- Python 3.11+ หรือเวอร์ชันที่รัน FastAPI/Pandas ชุดปัจจุบันได้
- Git
- พื้นที่ดิสก์เพียงพอสำหรับ `hr_blueprint.db` และ runtime stores

### Python packages ที่ต้องมีสำหรับ runtime

ติดตั้งจาก [`API/requirements.txt`](C:\HR_blueprint\hr_blueprint_dashboard\API\requirements.txt):

- `fastapi`
- `uvicorn`
- `pandas`
- `pydantic`
- `requests`
- `playwright`
- `openpyxl`

หมายเหตุ:

- `playwright` จำเป็นเมื่อจะใช้ script กลุ่ม extraction/debug ที่อาศัย browser automation
- ถ้าจะใช้ Playwright จริง ให้รัน `python -m playwright install`

## วิธีรันในเครื่อง local

### วิธีเร็วสุด

รัน [`run_simulator.bat`](C:\HR_blueprint\hr_blueprint_dashboard\run_simulator.bat)

ผลลัพธ์ที่คาดหวัง:

- API: `http://127.0.0.1:8765/api/overview`
- Simulation: `http://127.0.0.1:8766/simulation.html`

### วิธี manual

1. ติดตั้ง package

```powershell
python -m pip install -r API\requirements.txt
```

2. bootstrap stores

```powershell
python -c "from API.mock_store import build_db; from API.pp_store import build_pp_schema; from API.amphur_population_store import build_amphur_population_schema; from API.hdc_population_store import build_hdc_population_schema; from API.hospital_scope_store import build_scope_schema; from API.analysis_governance_store import build_analysis_governance_schema; from API.workload_source_store import build_workload_source_schema; from API.district_baseline_store import build_district_baseline_schema, ensure_district_baseline_profiles; build_db(); build_pp_schema(); build_amphur_population_schema(); build_hdc_population_schema(); build_scope_schema(); build_analysis_governance_schema(); build_workload_source_schema(); build_district_baseline_schema(); ensure_district_baseline_profiles()"
```

3. เปิด API

```powershell
python -m uvicorn API.main:app --host 127.0.0.1 --port 8765
```

4. เปิด static server

```powershell
python -m http.server 8766 --bind 127.0.0.1
```

## สิ่งสำคัญก่อน deploy จริง

### GitHub Pages อย่างเดียวไม่พอ

GitHub Pages เหมาะกับ:

- [`index.html`](C:\HR_blueprint\hr_blueprint_dashboard\index.html)
- หน้าเอกสาร/landing page ที่เป็น static ล้วน

GitHub Pages ไม่พอสำหรับ full simulator เพราะ:

- ไม่มี FastAPI runtime
- ไม่มี SQLite runtime
- ไม่มี `/api/*`

ดังนั้นถ้าจะให้ “ครบทุก function” ต้อง deploy ไปที่ server ที่รัน Python ได้

### รูปแบบ deploy ที่แนะนำ

แนะนำแบบเดียวสำหรับ repo นี้:

- GitHub เป็น source of truth
- Production เป็น VM/Windows Server/Linux Server ที่ `git pull` ได้
- รัน FastAPI และ static files ภายใต้ domain เดียวกัน

โครงสร้างที่ควรได้:

- `/api/*` -> FastAPI
- `/simulation.html`, `/simulation.js`, `/simulation.css`, `/data_inputV1.csv` -> static root
- `/dashboard/*` -> dashboard ผ่าน FastAPI mount หรือ static proxy

## แนวทาง deploy production

### แบบ 1: Deploy บนเครื่อง Windows Server

1. ติดตั้ง Python และ Git
2. clone repo ลงโฟลเดอร์ deployment
3. ติดตั้ง package:

```powershell
python -m pip install -r API\requirements.txt
```

4. bootstrap stores ตามคำสั่งในหัวข้อ local manual
5. เปิด API:

```powershell
python -m uvicorn API.main:app --host 0.0.0.0 --port 8765
```

6. ให้ web server หรือ reverse proxy ชี้ static root มาที่โฟลเดอร์ repo
7. ให้ reverse proxy ส่ง `/api` ไปที่ `127.0.0.1:8765`

### แบบ 2: Deploy บน Linux VM

คำสั่งหลักเหมือนกัน:

```bash
python -m pip install -r API/requirements.txt
python -m uvicorn API.main:app --host 127.0.0.1 --port 8765
```

แล้วใช้ reverse proxy ให้:

- static root = repo root
- `/api` = FastAPI backend

## วิธีอัปเดต online แบบทำต่อเนื่องผ่าน Git/GitHub

### workflow ที่แนะนำ

1. แก้ไฟล์ในเครื่องพัฒนา ไม่แก้สดบน production เป็นหลัก
2. ทดสอบ local ด้วย `run_simulator.bat`
3. commit และ push ขึ้น GitHub
4. บน production:

```bash
git pull --ff-only
python -m pip install -r API/requirements.txt
```

5. restart process ของ API
6. hard refresh browser และตรวจ health check

### health check หลัง deploy

ตรวจอย่างน้อย:

- `/api/overview`
- `/simulation.html`
- `/dashboard/`
- flow mock hospital
- flow PP summary
- flow HR unit workforce summary

## วิธีทำให้อัปเดตอัตโนมัติ

มี 2 วิธีที่เหมาะกับ repo นี้:

### วิธี A: Manual pull ที่ server

เหมาะเมื่อ:

- ต้องการคุมงานเอง
- ยังไม่มี CI/CD
- ต้องการดูผลก่อน restart ทุกครั้ง

ขั้นตอน:

1. push ขึ้น GitHub
2. login เข้า server
3. backup ฐานข้อมูล runtime
4. `git pull --ff-only`
5. restart API

### วิธี B: GitHub Actions deploy ผ่าน SSH

เหมาะเมื่อ:

- ต้องการ push แล้ว server update ตาม
- มี production server ที่รับ SSH ได้

แนวคิด:

1. เก็บ `SSH_HOST`, `SSH_USER`, `SSH_KEY` ใน GitHub Secrets
2. ให้ workflow SSH เข้า server
3. สั่ง `git pull --ff-only`
4. ติดตั้ง dependency ใหม่ถ้ามี
5. restart service

เอกสารอ้างอิง:

- GitHub Actions documentation: [https://docs.github.com/actions](https://docs.github.com/actions)
- GitHub encrypted secrets: [https://docs.github.com/actions/security-guides/encrypted-secrets](https://docs.github.com/actions/security-guides/encrypted-secrets)
- FastAPI deployment concepts: [https://fastapi.tiangolo.com/deployment/concepts/](https://fastapi.tiangolo.com/deployment/concepts/)

## วิธีเข้าแก้ไขระบบให้ปลอดภัย

### แก้ UI simulation

แก้เฉพาะ:

- [`simulation.html`](C:\HR_blueprint\hr_blueprint_dashboard\simulation.html)
- [`simulation.js`](C:\HR_blueprint\hr_blueprint_dashboard\simulation.js)
- [`simulation.css`](C:\HR_blueprint\hr_blueprint_dashboard\simulation.css)

### แก้ API logic

แก้ใน:

- [`API/main.py`](C:\HR_blueprint\hr_blueprint_dashboard\API\main.py)
- module ใต้ `API/` ที่เกี่ยวข้องกับ endpoint นั้นโดยตรง

### แก้ data asset

ถ้าจะอัปเดตข้อมูลโดยไม่แตะ schema:

- เปลี่ยน [`data_inputV1.csv`](C:\HR_blueprint\hr_blueprint_dashboard\data_inputV1.csv)
- เปลี่ยน [`API/final_dataset_regional.csv`](C:\HR_blueprint\hr_blueprint_dashboard\API\final_dataset_regional.csv)
- เปลี่ยน [`API/etl/fact_specialists.csv`](C:\HR_blueprint\hr_blueprint_dashboard\API\etl\fact_specialists.csv)

แล้ว bootstrap/restart ใหม่

### สิ่งที่ไม่ควรทำตรงบน production

- ไม่แก้ `hr_blueprint.db` โดยตรงโดยไม่มี backup
- ไม่เปลี่ยน schema กลางโดยไม่มี milestone ใหม่
- ไม่แก้หลายชั้นพร้อมกันทั้ง frontend + API + data โดยไม่ทดสอบ local ก่อน

## Backup ที่ควรทำก่อนทุก deploy

อย่างน้อยสำรอง:

- [`hr_blueprint.db`](C:\HR_blueprint\hr_blueprint_dashboard\hr_blueprint.db)
- `API/data/mock_scenarios.db`
- `API/data/district_baseline.db`

เหตุผล:

- `hr_blueprint.db` ไม่ได้เป็นแค่ master data แต่มีตาราง runtime เสริมที่ระบบสร้างเพิ่ม
- `mock_scenarios.db` เก็บ mock scenario
- `district_baseline.db` เก็บ baseline marts ที่สร้างขึ้นแล้ว

## Validation checklist ก่อนบอกว่า deploy ผ่าน

### Functional correctness

- เปิด simulation ได้
- เลือกโรงพยาบาลแล้วไปต่อได้ครบ step
- mock hospital ทำงานได้
- API overview/ranking/scatter ตอบข้อมูลได้
- dashboard เปิดได้ถ้าอยู่ใน scope deploy

### Test or validation evidence

- bootstrap command ผ่าน
- API health check ตอบ 200
- simulation โหลด `data_inputV1.csv` ได้

### Scope compliance

- ไม่มีการเปลี่ยน schema
- ไม่มีการเปลี่ยน data source หลักโดยพลการ
- ไม่มีการเพิ่ม framework/infrastructure layer ใหม่ใน repo

## Release Gate

- `PASS`: health check ผ่าน, step หลักใช้งานได้, scope ไม่บาน
- `PASS WITH MINOR RISKS`: ใช้งานหลักได้ แต่มีความเสี่ยงเล็กน้อยที่ไม่ block production
- `FAIL`: API ไม่ขึ้น, simulation เรียก endpoint ไม่ได้, หรือ runtime data ไม่ครบ

## Suggested Backlog

- `HIGH`: แยก production runtime database ออกจากไฟล์ source DB เพื่อลดความเสี่ยงตอน deploy ทับ
- `MEDIUM`: เพิ่ม service manager จริงสำหรับ API เช่น Windows Service หรือ systemd พร้อม auto-restart
- `MEDIUM`: เพิ่ม GitHub Actions workflow สำหรับ deploy ผ่าน SSH แบบมี health check หลัง deploy
- `LOW`: ปรับ README หลักให้ชี้มาคู่มือนี้แทนเนื้อหา GitHub Pages เดิมที่ครอบคลุมไม่ครบ runtime จริง
