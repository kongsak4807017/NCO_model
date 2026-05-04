# 📄 A4 HTML Report Template - DNA & Methodology Guide
## คู่มือสร้างรายงาน HTML ขนาด A4 แบบพอดีเป๊ะ

---

## 🎯 หลักการสำคัญ (Core Principles)

### 1. ขนาดหน้ากระดาษ A4 (A4 Dimensions)
```css
.page {
    width: 210mm;
    height: 297mm;           /* ความสูงคงที่ - ไม่ยืดหยุ่น */
    min-height: 297mm;
    max-height: 297mm;       /* บังคับไม่ให้เกิน A4 */
    padding: 12mm 18mm 15mm 18mm;  /* บน ซ้าย-ขวา ล่าง */
    margin: 10mm auto;
    background: #ffffff;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
    position: relative;
    overflow: hidden;        /* ตัดส่วนเกินออก */
    box-sizing: border-box;
}
```

**หมายเหตุ:** ใช้ `overflow: hidden` เพื่อบังคับให้อยู่ในขนาด A4 แต่ต้องตรวจสอบเนื้อหาไม่ให้ล้น

---

## 📝 มาตรฐานฟอนต์ (Font Standards)

### ขนาดฟอนต์หลัก (Primary Font Sizes)
| องค์ประกอบ | ขนาด | การใช้งาน |
|------------|------|----------|
| **H1** | 20px | หัวข้อหลักของหน้า |
| **H2** | 17px | หัวข้อรอง |
| **H3** | 15px | หัวข้อย่อย |
| **Body (p)** | 13px | ข้อความทั่วไป |
| **Table** | 12px | ตารางข้อมูล |
| **List (li)** | 13px | รายการ bullet/number |
| **Footer** | 11px | ท้ายกระดาษ |

### CSS ฟอนต์
```css
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;700&display=swap');

body {
    font-family: 'Sarabun', sans-serif;
    font-size: 13px;
    line-height: 1.4;
    color: #202124;
}

h1 { 
    font-size: 20px; 
    border-left: 6px solid var(--moph-green); 
    padding-left: 12px; 
    margin: 15px 0 12px 0; 
}

h2 { 
    font-size: 17px; 
    border-bottom: 1px solid #ddd; 
    padding-bottom: 4px; 
    margin-top: 15px; 
    margin-bottom: 10px; 
}

h3 { 
    font-size: 15px; 
    margin-top: 12px; 
    margin-bottom: 8px; 
}

p { 
    margin-bottom: 6px; 
    line-height: 1.4; 
    font-size: 13px;
}
```

---

## 🎨 ธีมสี (Color Theme)

### สีหลัก (Primary Colors)
```css
:root {
    --moph-green: #006B3E;    /* เขียวกระทรวงสาธารณสุข */
    --text-black: #202124;     /* ดำตัวอักษร */
    --bg-white: #ffffff;       /* พื้นหลังขาว */
}
```

### สีรอง (Secondary Colors สำหรับ Box)
| Box Type | Background | Border |
|----------|------------|--------|
| **Summary** | `#e8f5e9` | `#006B3E` (left) |
| **Info** | `#e3f2fd` | `#2196f3` (left) |
| **Warning** | `#fff3e0` | `#ff9800` (left) |
| **Model** | `#f3e5f5` | `#9c27b0` (border) |
| **Dual-Track** | `#ffffff` | `#006B3E` (full) |

---

## 📐 ระยะห่างและ Padding (Spacing)

### Box Styles
```css
.summary-box, .info-box, .warning-box {
    padding: 8px 10px;
    margin: 8px 0;
    border-left-width: 4px;
}

.model-box, .dual-track-box {
    padding: 8px 10px;
    margin: 8px 0;
    border-radius: 6px;
}
```

### Table Styles
```css
table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 12px;
}

th {
    background-color: var(--moph-green);
    color: white;
    padding: 5px 6px;
    font-size: 12px;
}

td {
    padding: 5px 6px;
}
```

### List Styles
```css
ul, ol {
    margin: 6px 0;
    padding-left: 18px;
}

li {
    margin-bottom: 4px;
    line-height: 1.35;
    font-size: 13px;
}
```

---

## 🔧 เทคนิคการจัดให้พอดี A4 (Fitting Content to A4)

### วิธีการแก้ปัญหาหน้าล้น

#### 1. ลด Padding/Margin ก่อน (First: Reduce Spacing)
```css
/* ก่อน */
.box { padding: 15px; margin: 20px 0; }

/* หลัง - ถ้าล้น */
.box { padding: 8px 10px; margin: 8px 0; }
```

#### 2. ลดระยะห่างระหว่างบรรทัด (Line Height)
```css
/* ก่อน */
p { line-height: 1.6; }

/* หลัง - ถ้าล้น */
p { line-height: 1.35; }
```

#### 3. ลดขนาดฟอนต์ทีละขั้น (Reduce Font Size Gradually)
```css
/* ถ้ายังล้นอีก ลดทีละ 1px */
table { font-size: 11px; }  /* จาก 12px */
```

#### 4. ย่อเนื้อหา (Condense Content)
- ตัดคำที่ไม่จำเป็นออก
- ใช้ bullet points แทนประโยคเต็ม
- รวมตารางที่เกี่ยวข้องกัน

---

## 📤 ระบบ Export (Export Functionality)

### Libraries ที่ต้องใช้
```html
<!-- สำหรับ PNG -->
<script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>

<!-- สำหรับ PDF -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

### JavaScript Functions
```javascript
// Export single page as PNG
async function exportPage(pageId, fileName) {
    const page = document.getElementById(pageId);
    const btn = page.querySelector('.page-export-btn');
    
    btn.style.visibility = 'hidden';
    page.scrollIntoView({ behavior: 'instant', block: 'start' });
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,        /* 210mm @ 96 DPI */
        height: 1123       /* 297mm @ 96 DPI */
    });
    
    const link = document.createElement('a');
    link.download = fileName + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    btn.style.visibility = 'visible';
}

// Export single page as PDF
async function exportPagePDF(pageId, fileName) {
    const page = document.getElementById(pageId);
    const btn = page.querySelector('.page-export-btn-pdf');
    
    btn.style.visibility = 'hidden';
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new window.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    pdf.save(fileName + '.pdf');
    
    btn.style.visibility = 'visible';
}
```

---

## 📋 HTML Structure Template

```html
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>รายงาน...</title>
    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <style>
        /* ===== A4 PAGE SETUP ===== */
        .page {
            width: 210mm;
            height: 297mm;
            min-height: 297mm;
            max-height: 297mm;
            padding: 12mm 18mm 15mm 18mm;
            margin: 10mm auto;
            background: #ffffff;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            position: relative;
            overflow: hidden;
            box-sizing: border-box;
        }
        
        /* ===== FONT IMPORT ===== */
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;700&display=swap');
        
        body {
            font-family: 'Sarabun', sans-serif;
            background-color: #f0f0f0;
            margin: 0;
            padding: 0;
            color: #202124;
            line-height: 1.4;
        }
        
        /* ===== COLOR THEME ===== */
        :root {
            --moph-green: #006B3E;
            --text-black: #202124;
            --bg-white: #ffffff;
        }
        
        /* ===== TYPOGRAPHY ===== */
        h1 { font-size: 20px; border-left: 6px solid var(--moph-green); padding-left: 12px; margin: 15px 0 12px 0; color: var(--moph-green); }
        h2 { font-size: 17px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 15px; margin-bottom: 10px; color: var(--moph-green); }
        h3 { font-size: 15px; margin-top: 12px; margin-bottom: 8px; color: var(--moph-green); }
        p { margin-bottom: 6px; text-align: justify; line-height: 1.4; font-size: 13px; }
        
        /* ===== BOX STYLES ===== */
        .summary-box { background-color: #e8f5e9; border-left: 4px solid var(--moph-green); padding: 8px 10px; margin: 8px 0; }
        .info-box { background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 8px 10px; margin: 8px 0; }
        .warning-box { background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 8px 10px; margin: 8px 0; }
        .model-box { background-color: #f3e5f5; border: 2px solid #9c27b0; border-radius: 6px; padding: 8px 10px; margin: 8px 0; }
        
        /* ===== TABLE STYLES ===== */
        table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
        th { background-color: var(--moph-green); color: white; padding: 5px 6px; text-align: left; border: 1px solid #ddd; font-size: 12px; }
        td { padding: 5px 6px; border: 1px solid #ddd; vertical-align: top; font-size: 12px; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        
        /* ===== LIST STYLES ===== */
        ul, ol { margin: 6px 0; padding-left: 18px; }
        li { margin-bottom: 4px; line-height: 1.35; font-size: 13px; }
        
        /* ===== FOOTER ===== */
        .footer {
            position: absolute;
            bottom: 8mm;
            left: 20mm;
            right: 20mm;
            border-top: 1px solid #ddd;
            padding-top: 5px;
            font-size: 11px;
            color: #999;
            text-align: center;
        }
        
        /* ===== EXPORT BUTTONS ===== */
        .export-btn { position: fixed; top: 20px; right: 20px; background-color: var(--moph-green); color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; z-index: 1000; }
        .export-btn-pdf { position: fixed; top: 20px; right: 200px; background-color: #d32f2f; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; z-index: 1000; }
        .page-export-btn { position: absolute; top: 10mm; right: 20mm; background-color: #ff9800; color: white; border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer; font-size: 12px; }
        .page-export-btn-pdf { position: absolute; top: 10mm; right: 55mm; background-color: #d32f2f; color: white; border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer; font-size: 12px; }
        
        /* ===== PRINT HIDE BUTTONS ===== */
        @media print {
            body { background: none; }
            .page { margin: 0; box-shadow: none; page-break-after: always; }
            .export-btn, .export-btn-pdf, .page-export-btn, .page-export-btn-pdf { display: none !important; }
        }
    </style>
</head>
<body>
    <!-- Export All Buttons -->
    <button class="export-btn" onclick="exportAllPages()">📷 Export PNG</button>
    <button class="export-btn-pdf" onclick="exportAllPagesPDF()">📄 Export PDF</button>

    <!-- PAGE 1 -->
    <div class="page" id="page1">
        <button class="page-export-btn" onclick="exportPage('page1', '01_Page')">📷 PNG</button>
        <button class="page-export-btn-pdf" onclick="exportPagePDF('page1', '01_Page')">📄 PDF</button>
        
        <!-- Header -->
        <div style="border-bottom: 3px solid var(--moph-green); padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between;">
            <p style="color: var(--moph-green); font-size: 22px; font-weight: bold; margin: 0;">📋 หัวข้อรายงาน</p>
            <p style="font-size: 14px; color: #666;">วันที่ ...</p>
        </div>
        
        <!-- Content -->
        <h1>หัวข้อหลัก</h1>
        <div class="summary-box">
            <p>เนื้อหาสรุปสำคัญ...</p>
        </div>
        
        <h2>หัวข้อรอง</h2>
        <p>เนื้อหา...</p>
        
        <table>
            <thead><tr><th>คอลัมน์ 1</th><th>คอลัมน์ 2</th></tr></thead>
            <tbody><tr><td>ข้อมูล</td><td>ข้อมูล</td></tr></tbody>
        </table>
        
        <!-- Footer -->
        <div class="footer">รายงาน... | หน้า 1</div>
    </div>

    <script>
        // [ใส่ฟังก์ชัน Export ตามด้านบน]
    </script>
</body>
</html>
```

---

## ⚠️ Checklist ก่อน Export

### ตรวจสอบก่อนสร้าง PDF/PNG
- [ ] เนื้อหาไม่ล้นขอบล่างของหน้า
- [ ] ตารางไม่ล้นขอบ
- [ ] รูปภาพ (ถ้ามี) มีขนาดพอดี
- [ ] Footer อยู่ในตำแหน่งที่ถูกต้อง
- [ ] ปุ่ม Export ซ่อนเมื่อ Print

### การแก้ปัญหาฉุกเฉิน
| ปัญหา | วิธีแก้ |
|-------|---------|
| หน้าล้น | ลด padding/margin → ลด line-height → ลด font-size |
| ตารางล้น | ลด padding cell → ลด font-size table → ย่อข้อความ |
| รูปใหญ่เกิน | กำหนด max-width: 100% |
| ฟอนต์ไม่โหลด | ใช้ document.fonts.ready ก่อน capture |

---

## 🎓 Best Practices

### 1. การวางโครงสร้างเนื้อหา
```
หน้า 1: หน้าปก / Executive Summary
หน้า 2: สารบัญ / ภาพรวม
หน้า 3+: เนื้อหาละเอียดแต่ละหัวข้อ
หน้าสุดท้าย: สรุป / ข้อเสนอแนะ
```

### 2. การใช้ Box ให้เหมาะสม
- **Summary Box**: ใช้สำหรับข้อสรุปสำคัญ
- **Info Box**: ข้อมูลเพิ่มเติม/คำอธิบาย
- **Warning Box**: ปัญหาหรือข้อควรระวัง
- **Model Box**: กรณีศึกษาหรือตัวอย่าง

### 3. การใช้ตาราง
- ไม่เกิน 5-6 คอลัมน์ต่อตาราง (ถ้ามากกว่านั้นลด font size)
- ใช้ `white-space: nowrap` กับหัวตารางถ้าจำเป็น
- สลับสีแถว (striped rows) เพื่อความสะดวกในการอ่าน

---

## 📁 File Structure แนะนำ

```
project/
├── report.html              # ไฟล์หลัก
├── css/
│   └── a4-template.css      # แยก CSS ออกมา (optional)
├── js/
│   └── export-functions.js  # แยก JS ออกมา (optional)
└── assets/
    └── logo.png             # โลโก้หน่วยงาน
```

---

## 🔗 References

- **html2canvas**: https://html2canvas.hertzen.com/
- **jsPDF**: https://parall.ax/products/jspdf
- **A4 Dimensions**: 210mm × 297mm (8.27in × 11.69in)
- **96 DPI Conversion**: 1mm = 3.78px

---

## 👤 Author
- **Created**: 6 เมษายน 2569
- **Purpose**: Template for A4 HTML Reports in Thai Government/Health Sector
- **Theme**: Ministry of Public Health (MOPH) Style

---

*หมายเหตุ: เอกสารนี้เป็น Template และสามารถปรับแต่งตามความเหมาะสมของโครงการได้*
