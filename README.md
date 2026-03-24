# NCO Health Workforce Simulation Tool - District 1
**"Let's Star Shine : HR blueprint"**

ระบบจำลองการจัดสรรกำลังคนทางด้านสาธารณสุขตามโมเดล **NCO (Need-Capacity-Outcome)** สำหรับเขตสุขภาพที่ 1 เพื่อยกระดับความแม่นยำในการวางแผนทรัพยากรบุคคลโดยอ้างอิงจากหลักฐานเชิงประจักษ์ (Evidence-Based Planning)

## 📁 โครงสร้างไฟล์ที่จำเป็น (Core Files)

เพื่อให้ระบบทำงานได้สมบูรณ์บน GitHub (เช่น GitHub Pages) ต้องมีไฟล์ดังนี้:

### 1. ไฟล์ระบบ Simulation
*   `simulation.html`: หน้าหลักของหน้าจอจำลอง (7-Step Wizard)
*   `simulation.js`: เอนจิ้นคำนวณและประมวลผลข้อมูล
*   `simulation.css`: การตกแต่งหน้าจอ Premium Dark Theme
*   `data_inputV1.csv`: **(สำคัญที่สุด)** ฐานข้อมูลหลักที่รวมข้อมูลประชากร (HDC), ผลงาน (CMI) และบุคลากร

### 2. ไฟล์การนำเสนอ (Pitch Deck)
*   `pitch_deck.html`: สไลด์นำเสนอ 6 หน้า สำหรับผู้บริหาร (เปิดใช้งานได้ทันที)

### 3. ไฟล์เอกสารประกอบ (Documentation)
*   `recommendation_guide.md`: คู่มือข้อเสนอแนะเชิงนโยบาย
*   `health_metrics_analysis_report.md`: รายงานการวิเคราะห์ตัวชี้วัดสุขภาพ

---

## 🚀 วิธีการใช้งาน
1. **Local:** สามารถเปิดไฟล์ `pitch_deck.html` หรือ `simulation.html` ได้โดยตรงผ่านบราวเซอร์
2. **GitHub Pages:**
   *   Upload ไฟล์ทั้งหมดขึ้น Repository
   *   ไปที่ **Settings > Pages**
   *   เลือก Branch เป็น `main` และกด **Save**
   *   ระบบจะสร้าง URL ให้เข้าใช้งานผ่านเว็บได้ทันที

## 🛠 เทคโนโลยีที่ใช้
- **PapaParse:** สำหรับประมวลผลไฟล์ CSV ขนาดใหญ่ในบราวเซอร์
- **Chart.js:** สำหรับแสดงผลกราฟคุณภาพโรงพยาบาล
- **Google Fonts:** Inter & Noto Sans Thai

---
**พัฒนาโดย:** Let's Star Shine : HR blueprint (เขตสุขภาพที่ 1)
