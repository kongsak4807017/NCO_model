// Friendly Excel presentation layer for the collaborative HR Profile.
// Formula-sensitive wording comes from Simulator_HR_blueprint_dictionary.js.

const NCO_EXCEL_GUIDE_SHEET = "คำแนะนำการกรอก";

const NCO_EXCEL_FIELD_GUIDE = {
  key: { label: "รายการ", description: "ชื่อรายการของ Profile ที่ระบบใช้เชื่อมข้อมูล", unit: "ข้อความ", source: "ระบบ / ผู้ประสาน Profile" },
  value: { label: "ค่า", description: "ค่าของรายการ Profile ตามข้อมูลพื้นที่จริง", unit: "ตามรายการ", source: "ผู้ประสาน Profile" },
  section: { label: "หมวดข้อมูล", description: "หมวดข้อมูลที่กลุ่มงานรับผิดชอบ เช่น Population, Workload, Workforce, TargetNeed, WISN", unit: "ข้อความ", source: "ระบบ" },
  owner: { label: "ผู้รับผิดชอบข้อมูล", description: "ชื่อกลุ่มงานหรือหน่วยงานที่เป็นเจ้าของและรับผิดชอบข้อมูลชุดนี้", unit: "ชื่อกลุ่มงาน/หน่วยงาน", source: "หน่วยงาน" },
  source: { label: "แหล่งข้อมูล", description: "ระบุระบบ รายงาน หรือทะเบียนต้นทาง และปีอ้างอิงให้ตรวจย้อนกลับได้", unit: "ข้อความ", source: "เช่น HDC, HIS, HROPS, จ.18, DRG" },
  status: { label: "สถานะการทวนสอบ", description: "Draft = กำลังกรอก, Reviewed = ตรวจทานแล้ว, Verified = ยืนยันพร้อมใช้วิเคราะห์", unit: "Draft / Reviewed / Verified", source: "ผู้ทวนสอบข้อมูล" },
  updated_at: { label: "วันที่ปรับปรุง", description: "วันที่หรือเวลาที่ข้อมูลชุดนี้ถูกปรับปรุงล่าสุด", unit: "วันที่/เวลา", source: "ผู้กรอกข้อมูล" },
  note: { label: "หมายเหตุ", description: "บันทึกข้อจำกัด วิธีนับ หรือรายละเอียดสำคัญที่ผู้วิเคราะห์ควรทราบ", unit: "ข้อความ", source: "ผู้กรอกข้อมูล" },
  year: { label: "ปี (พ.ศ.)", description: "ปีของข้อมูลจริงที่รายงาน", unit: "พ.ศ.", source: "ตามรายงานต้นทาง" },
  population: { label: "ประชากรที่รับผิดชอบ", description: "ประชากรจริงของพื้นที่หรือหน่วยบริการในปีนั้น ใช้ค่าที่มีหลักฐานตรวจสอบได้", unit: "คน", source: "HDC / ทะเบียนราษฎร์ / ทะเบียนสิทธิ" },
  groupCode: { label: "รหัสกลุ่มเป้าหมาย", description: "รหัสภายในของกลุ่ม Health Need ห้ามแก้ถ้าไม่จำเป็น", unit: "รหัส", source: "ระบบ" },
  groupLabel: { label: "กลุ่มปัญหา/กลุ่มเป้าหมาย", description: "ชื่อกลุ่มประชากรหรือปัญหาสุขภาพที่ต้องการบริการ", unit: "ข้อความ", source: "Service Plan / แผนงานพื้นที่" },
  placement: { label: "ระดับ/หน่วยบริการที่รับผิดชอบ", description: "ระดับหรือประเภทหน่วยบริการที่ควรรับผิดชอบบริการกลุ่มนี้", unit: "ข้อความ", source: "Service Plan / ระบบบริการ" },
  profession_code: { label: "รหัสวิชาชีพ", description: "รหัสภายในของวิชาชีพที่ระบบใช้เชื่อมข้อมูล ห้ามแก้ถ้าไม่จำเป็น", unit: "รหัส", source: "ระบบ" },
  profession_label: { label: "วิชาชีพ", description: "ชื่อกลุ่มวิชาชีพ", unit: "ข้อความ", source: "HR" },
  actualHeadcount: { label: "จำนวนบุคลากรที่ปฏิบัติงานจริง", description: "จำนวนคนจริงของวิชาชีพที่ปฏิบัติงานในพื้นที่/หน่วยบริการในปีนั้น", unit: "คน", source: "HRIS / HROPS / จ.18", formula: "Actual Supply FTE = Actual Annual Headcount × FTE Factor" },
  recruit: { label: "จำนวนบรรจุ/รับเข้า", description: "จำนวนบุคลากรที่บรรจุหรือรับเข้ามาปฏิบัติงานจริงในปีนั้น", unit: "คน", source: "HRIS / คำสั่งบุคลากร", formula: "บันทึก movement ย้อนหลัง; historical supply ใช้ Actual Headcount โดยตรง ไม่ back-calculate จาก movement" },
  transferIn: { label: "จำนวนย้ายเข้า", description: "จำนวนบุคลากรที่ย้ายเข้ามาปฏิบัติงานจริงในปีนั้น", unit: "คน", source: "HRIS / คำสั่งย้าย", formula: "บันทึก movement ย้อนหลัง; ไม่ back-calculate Actual Headcount" },
  returnIn: { label: "จำนวนกลับเข้าปฏิบัติงาน", description: "จำนวนบุคลากรที่กลับเข้าปฏิบัติงานจริงในปีนั้น", unit: "คน", source: "HRIS / คำสั่งบุคลากร", formula: "บันทึก movement ย้อนหลัง; ไม่ back-calculate Actual Headcount" },
  retire: { label: "จำนวนเกษียณ", description: "จำนวนบุคลากรที่เกษียณจริงในปีนั้น", unit: "คน", source: "HRIS / ทะเบียนเกษียณ", formula: "บันทึก movement ย้อนหลัง; ไม่กระจายยอดเกษียณ 5 ปีอัตโนมัติ" },
  resign: { label: "จำนวนลาออก", description: "จำนวนบุคลากรที่ลาออกจริงในปีนั้น", unit: "คน", source: "HRIS / คำสั่งลาออก", formula: "บันทึก movement ย้อนหลัง; ไม่ back-calculate Actual Headcount" },
  transferOut: { label: "จำนวนย้ายออก", description: "จำนวนบุคลากรที่ย้ายออกจากพื้นที่/หน่วยบริการจริงในปีนั้น", unit: "คน", source: "HRIS / คำสั่งย้าย", formula: "บันทึก movement ย้อนหลัง; ไม่ back-calculate Actual Headcount" },
  studyLeave: { label: "จำนวนลาศึกษา", description: "จำนวนบุคลากรที่ลาศึกษาและไม่สามารถให้บริการตามปกติในปีนั้น", unit: "คน", source: "HRIS / คำสั่งลาศึกษา", formula: "บันทึก movement ย้อนหลัง; ไม่ back-calculate Actual Headcount" },
  selected: { label: "นำวิชาชีพนี้มาวิเคราะห์", description: "ระบุว่าให้นำวิชาชีพนี้เข้าในการวิเคราะห์หรือไม่", unit: "ใช่ / ไม่ใช่", source: "ผู้วิเคราะห์" },
  current: { label: "จำนวนบุคลากรปัจจุบัน", description: "จำนวนบุคลากรปีอ้างอิงล่าสุดที่ใช้ตั้งต้นหน้า Profession", unit: "คน", source: "HRIS / HROPS / จ.18" },
  vacant: { label: "ตำแหน่งว่าง", description: "จำนวนกรอบตำแหน่งที่ว่างตามข้อมูลจริง", unit: "ตำแหน่ง", source: "HRIS / กรอบอัตรากำลัง" },
  retire5y: { label: "ผู้ที่จะเกษียณภายใน 5 ปี", description: "จำนวนบุคลากรตามทะเบียนที่อยู่ในช่วงเกษียณภายใน 5 ปี ใช้เป็นข้อมูลประกอบ ไม่กระจายย้อนหลังอัตโนมัติ", unit: "คน", source: "ทะเบียนบุคลากร / HRIS" },
};

function excelFieldGuide(key) {
  const shared = window.NCO_HR_DATA_DICTIONARY;
  if (shared?.excelFields?.[key]) return shared.excelFields[key];
  if (NCO_EXCEL_FIELD_GUIDE[key]) return NCO_EXCEL_FIELD_GUIDE[key];
  if (String(key).startsWith("activity_")) {
    const code = String(key).slice("activity_".length);
    const standard = shared?.activityStandards?.[code];
    if (standard) {
      return {
        label: standard.label,
        description: standard.definition,
        unit: standard.unit,
        source: standard.source,
        formula: standard.formula,
      };
    }
  }
  return {
    label: String(key),
    description: `technical key: ${key} — ใช้เชื่อมข้อมูลกับระบบ ไม่ควรเปลี่ยนชื่อ`,
    unit: "",
    source: "ระบบ",
    formula: "-",
  };
}

function buildExcelInstructionRows() {
  return [
    ["HR Blueprint — คำแนะนำการกรอก Excel Template"],
    ["วิธีใช้", "1) กรอกเฉพาะข้อมูลจริงที่หน่วยงานมี  2) ให้แต่ละกลุ่มงานกรอก Sheet ที่รับผิดชอบ  3) ตรวจแหล่งข้อมูลและสถานะ  4) นำไฟล์กลับไป Import ใน Simulator"],
    ["หลักสำคัญ", "ช่องที่ไม่มีข้อมูลจริงให้เว้นว่าง ไม่ใส่ 0 เพื่อแทนคำว่าไม่มีข้อมูล เว้นแต่ค่าจริงเป็นศูนย์และได้รับการยืนยัน"],
    ["ห้ามแก้", "อย่าเปลี่ยนชื่อ Sheet และอย่าลบแถว technical key ที่ระบบซ่อนไว้ เพราะ Simulator ใช้สำหรับ Import กลับ"],
    ["สถานะข้อมูล", "Draft = กำลังกรอก | Reviewed = ตรวจทานแล้ว | Verified = ยืนยันพร้อมใช้วิเคราะห์"],
    ["Workload vs Activity Standard", "Workload_History = จำนวนกิจกรรมจริงต่อปี เช่น OPD visits/ปี | Profession_Config activity_* = จำนวนนาทีของวิชาชีพนั้นต่อ 1 หน่วยกิจกรรม ห้ามสลับกัน"],
    ["สูตร WISN หลัก", "Demand Minutes = Σ(Workload Volume × Activity Standard × Complexity Index) → Service FTE = Demand Minutes ÷ AWT → Required FTE = (Service FTE × CAF) + IAF"],
    ["CAS/IAS", "CAF = 1 ÷ (1 − CAS/100) | IAF = IAS × 60 ÷ AWT"],
    ["Supply", "Actual Supply FTE = Actual Annual Headcount × FTE Factor; movement รายปีใช้เป็นหลักฐานย้อนหลังและไม่ back-calculate headcount"],
    [],
    ["Sheet", "ผู้รับผิดชอบหลักที่แนะนำ", "ข้อมูลที่ต้องกรอก"],
    ["Profile", "ผู้ประสาน Profile / ยุทธศาสตร์", "ข้อมูลพื้นที่ รหัส Profile ระดับการวิเคราะห์ และปีอ้างอิง"],
    ["Section_Metadata", "ทุกกลุ่มงาน + ผู้ทวนสอบ", "ผู้รับผิดชอบ แหล่งข้อมูล สถานะ วันที่ปรับปรุง และหมายเหตุ"],
    ["Workload_History", "ยุทธศาสตร์ / HIS / เวชระเบียน / ประกัน", "ประชากรและปริมาณบริการจริงย้อนหลังรายปี"],
    ["TargetNeed_History", "NCD / ปฐมภูมิ / Service Plan / ยุทธศาสตร์", "กลุ่มเป้าหมาย จำนวนเป้าหมาย และผู้ได้รับบริการจริง"],
    ["Workforce_History", "HR / บริหารทรัพยากรบุคคล", "จำนวนบุคลากรจริง และการเข้า-ออกของบุคลากรรายปี"],
    ["Profession_Config", "HR + ทีมวิชาชีพ / พัฒนาคุณภาพ", "AWT, CAS, IAS และ Activity Standard นาทีต่อ 1 หน่วยกิจกรรม"],
    [],
    ["ข้อควรระวัง", "ข้อมูลในไฟล์นี้ควรเป็นข้อมูลรวมระดับพื้นที่/บริการ ไม่ใส่ชื่อบุคคล เลขบัตรประชาชน หรือข้อมูลสุขภาพรายบุคคล"],
  ];
}

function friendlyHeadersForRows(rows, sheetName) {
  const headers = [];
  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) if (!headers.includes(key)) headers.push(key);
  }
  if (headers.length) return headers;
  if (sheetName === "Profile") return ["key", "value"];
  if (sheetName === "Section_Metadata") return ["section", "owner", "source", "status", "updated_at", "note"];
  return [];
}

function addHeaderComments(ws, guides) {
  guides.forEach((guide, index) => {
    const address = XLSX.utils.encode_cell({ r: 1, c: index });
    if (!ws[address]) return;
    ws[address].c = [{
      a: "HR Blueprint",
      t: `${guide.description}\nหน่วย/รูปแบบ: ${guide.unit || "-"}\nแหล่งข้อมูลแนะนำ: ${guide.source || "-"}\nใช้ในสูตร: ${guide.formula || "-"}`,
    }];
  });
}

function writeProfileWorkbook(payload, filename) {
  if (typeof XLSX === "undefined") throw new Error("SheetJS ยังไม่พร้อมใช้งาน");
  const wb = XLSX.utils.book_new();

  const guideSheet = XLSX.utils.aoa_to_sheet(buildExcelInstructionRows());
  guideSheet["!cols"] = [{ wch: 28 }, { wch: 96 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, guideSheet, NCO_EXCEL_GUIDE_SHEET);

  const sheetRows = profileRowsFromPayload(payload);
  for (const sheetName of NCO_PROFILE_SHEETS) {
    const rows = sheetRows[sheetName] || [];
    const headers = friendlyHeadersForRows(rows, sheetName);
    const guides = headers.map(excelFieldGuide);
    const aoa = [
      headers,
      guides.map((guide) => guide.label),
      guides.map((guide) => `คำอธิบาย: ${guide.description}`),
      guides.map((guide) => `หน่วย/รูปแบบ: ${guide.unit || "-"}`),
      guides.map((guide) => `แหล่งข้อมูลแนะนำ: ${guide.source || "-"}`),
      guides.map((guide) => `ใช้ในสูตร: ${guide.formula || "-"}`),
      ...rows.map((row) => headers.map((header) => row?.[header] ?? null)),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!rows"] = [
      { hidden: true },
      { hpt: 30 },
      { hpt: 52 },
      { hpt: 28 },
      { hpt: 36 },
      { hpt: 44 },
    ];
    ws["!cols"] = guides.map((guide) => ({ wch: Math.min(48, Math.max(16, String(guide.label || "").length + 8)) }));
    addHeaderComments(ws, guides);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, filename);
}

function rowsHaveValues(row) {
  return Object.values(row || {}).some((value) => value !== null && value !== undefined && String(value).trim() !== "");
}

async function importProfileWorkbook(file) {
  if (typeof XLSX === "undefined") throw new Error("SheetJS ยังไม่พร้อมใช้งาน");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheets = {};

  for (const sheetName of NCO_PROFILE_SHEETS) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) {
      sheets[sheetName] = [];
      continue;
    }

    const preview = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    const technicalHeaders = (preview[0] || []).map((value) => String(value ?? "").trim());
    const guided = preview.length >= 5 && (preview[2] || []).some((value) => String(value ?? "").startsWith("คำอธิบาย:"));
    const hasFormulaRow = guided && (preview[5] || []).some((value) => String(value ?? "").startsWith("ใช้ในสูตร:"));
    const dataStartRow = hasFormulaRow ? 6 : 5;

    if (guided && technicalHeaders.some(Boolean)) {
      const rows = XLSX.utils.sheet_to_json(ws, {
        header: technicalHeaders,
        defval: null,
        raw: true,
        range: dataStartRow,
      });
      sheets[sheetName] = rows.filter(rowsHaveValues);
    } else {
      sheets[sheetName] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true }).filter(rowsHaveValues);
    }
  }

  const payload = profilePayloadFromSheetRows(sheets);
  applyProfilePayload(payload);
  if (typeof setProfileStatus === "function") {
    setProfileStatus(`นำเข้า ${file.name} แล้ว — แถวคำอธิบาย/สูตรใน Excel ไม่ถูกนำมาคำนวณ`, "success");
  }
  return payload;
}

// Load the profession-specific workload/Data Fitness extension without changing the static HTML deployment order.
(() => {
  if (document.querySelector('script[data-nco-data-fitness]')) return;
  const script = document.createElement('script');
  script.src = 'Simulator_HR_blueprint_data_fitness.js';
  script.async = false;
  script.dataset.ncoDataFitness = '1';
  document.head.appendChild(script);
})();
