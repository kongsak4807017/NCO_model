# NCO Health Workforce Simulation Tool - District 1
**"Let's Star Shine : HR blueprint"**

ระบบจำลองการจัดสรรกำลังคนทางด้านสาธารณสุขตามโมเดล **NCO (Need-Capacity-Outcome)** สำหรับเขตสุขภาพที่ 1 เพื่อยกระดับความแม่นยำในการวางแผนทรัพยากรบุคคลโดยอ้างอิงจากหลักฐานเชิงประจักษ์ (Evidence-Based Planning)

## 📁 โครงสร้างไฟล์ที่จำเป็น (Core Files)

เพื่อให้ระบบทำงานได้สมบูรณ์บน GitHub (เช่น GitHub Pages) ต้องมีไฟล์ดังนี้:

### 1. ไฟล์ระบบ Simulation
*   `simulation.html`: หน้าหลักของหน้าจอจำลอง (7-Step Wizard)
*   `simulation.js`: เอนจิ้นคำนวณและประมวลผลข้อมูล
*   `simulation.css`: การตกแต่งหน้าจอ Premium Dark Theme
*   `Simulator_HR_blueprint.html`: ระบบจำลอง HR Blueprint รายจังหวัด/อำเภอ/รพ. พร้อม projection 5 ปี และ export Excel/report.txt
*   `Simulator_HR_blueprint.js`: เอนจิ้นคำนวณ Need/Supply/GAP/Suggested Add ของ HR Blueprint simulator
*   `Simulator_HR_blueprint.css`: การตกแต่งหน้าจอ HR Blueprint simulator
*   `data_inputV1.csv`: **(สำคัญที่สุด)** ฐานข้อมูลหลักที่รวมข้อมูลประชากร (HDC), ผลงาน (CMI) และบุคลากร

### 2. ไฟล์การนำเสนอ (Pitch Deck)
*   `index.html`: สไลด์นำเสนอ 6 หน้า สำหรับผู้บริหาร (เปิดใช้งานได้ทันทีและเป็นหน้าแรก)

### 3. ไฟล์เอกสารประกอบ (Documentation)
*   `recommendation_guide.md`: คู่มือข้อเสนอแนะเชิงนโยบาย
*   `health_metrics_analysis_report.md`: รายงานการวิเคราะห์ตัวชี้วัดสุขภาพ
*   `MockingHospitalPlan.md`: แผน sandbox ฉบับใช้งานจริง (Data Quality gate + FTE/Workload + สูตรแปลงจำนวนอัตรา)
*   `NCO_INDICATOR_STANDARD.md`: มาตรฐานนิยามตัวชี้วัดกลาง (canonical thresholds)

---

## 🚀 วิธีการใช้งาน
1. **Local:** สามารถเปิดไฟล์ `index.html`, `simulation.html` หรือ `Simulator_HR_blueprint.html` ได้โดยตรงผ่านบราวเซอร์
2. **GitHub Pages:**
   *   Upload ไฟล์ทั้งหมดขึ้น Repository
   *   ไปที่ **Settings > Pages**
   *   เลือก Branch เป็น `main` และกด **Save**
   *   ระบบจะสร้าง URL ให้เข้าใช้งานผ่านเว็บได้ทันที

### Direct Links เมื่อเปิด GitHub Pages

*   Pitch deck: `https://kongsak4807017.github.io/NCO_model/`
*   NCO Simulation: `https://kongsak4807017.github.io/NCO_model/simulation.html`
*   HR Blueprint Simulator: `https://kongsak4807017.github.io/NCO_model/Simulator_HR_blueprint.html`


## 🏥 CMI / Service Plan 5-Year Health KPI Pipeline

Health KPI History รองรับฐานข้อมูลย้อนหลัง **พ.ศ. 2565–2569** จากระบบ CMI / Service Plan โดยแยก source provenance และเก็บ numerator/denominator เมื่อแหล่งข้อมูลมีให้

โครงสร้างหลัก:

- `scripts/cmi_collect_browser.py` — collector สำหรับรันบนเครื่องที่ได้รับอนุญาตและเปิดเว็บ CMI ได้
- `scripts/normalize_cmi_archive.py` — แปลง raw pages เป็นข้อมูลระดับ รพ. ที่ใช้วิเคราะห์ได้
- `scripts/validate_cmi_snapshot.py` — ตรวจ duplicate, hospcode, provenance และ arithmetic ของ numerator/denominator
- `data/cmi/catalog/indicators.json` — indicator catalog
- `data/cmi/manifests/completeness.json` — completeness matrix
- `output/cmi_5y/health_kpi_records.json` — merged snapshot ที่ HR Blueprint โหลดโดยตรง
- `docs/CMI_5Y_DATA_PIPELINE.md` — runbook สำหรับเก็บข้อมูลจริง

บนหน้า HR Blueprint ให้ระบุ **รหัสโรงพยาบาล 5 หลัก** แล้วกด **“โหลด CMI 5 ปีย้อนหลัง”** เพื่อเติม Health KPI History จาก snapshot ที่ผ่านการ validate แล้ว

> GitHub-hosted runner ถูกระบบ CMI ปฏิเสธการดึงแบบ server-to-server จึงใช้ authorised browser collection เป็น source acquisition และใช้ GitHub Actions เฉพาะ validation ของ snapshot เพื่อไม่สร้างข้อมูลเทียม

## 🛠 เทคโนโลยีที่ใช้
- **PapaParse:** สำหรับประมวลผลไฟล์ CSV ขนาดใหญ่ในบราวเซอร์
- **Chart.js:** สำหรับแสดงผลกราฟคุณภาพโรงพยาบาล
- **Google Fonts:** Inter & Noto Sans Thai

---
**พัฒนาโดย:** Let's Star Shine : HR blueprint (เขตสุขภาพที่ 1)
