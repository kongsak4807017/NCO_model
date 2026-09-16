// Friendly Excel presentation layer for the collaborative HR Profile.
// Visible Excel labels are Thai; technical keys stay hidden in row 1 for reliable re-import.

const NCO_EXCEL_GUIDE_SHEET = "คำแนะนำการกรอก";

const NCO_EXCEL_FIELD_GUIDE = {
  key: {
    label: "รายการ",
    description: "ชื่อรายการของ Profile ที่ระบบใช้เชื่อมข้อมูล",
    unit: "ข้อความ",
    source: "ระบบ / ผู้ประสาน Profile",
  },
  value: {
    label: "ค่า",
    description: "ค่าของรายการ Profile ตามข้อมูลพื้นที่จริง",
    unit: "ตามรายการ",
    source: "ผู้ประสาน Profile",
  },
  section: {
    label: "หมวดข้อมูล",
    description: "หมวดข้อมูลที่กลุ่มงานรับผิดชอบ เช่น Population, Workload, Workforce, TargetNeed, WISN",
    unit: "ข้อความ",
    source: "ระบบ",
  },
  owner: {
    label: "ผู้รับผิดชอบข้อมูล",
    description: "ชื่อกลุ่มงานหรือหน่วยงานที่เป็นเจ้าของและรับผิดชอบข้อมูลชุดนี้",
    unit: "ชื่อกลุ่มงาน/หน่วยงาน",
    source: "หน่วยงาน",
  },
  source: {
    label: "แหล่งข้อมูล",
    description: "ระบุระบบ รายงาน หรือทะเบียนต้นทาง และปีอ้างอิงให้ตรวจย้อนกลับได้",
    unit: "ข้อความ",
    source: "เช่น HDC, HIS, HROPS, จ.18, DRG",
  },
  status: {
    label: "สถานะการทวนสอบ",
    description: "Draft = กำลังกรอก, Reviewed = ตรวจทานแล้ว, Verified = ยืนยันพร้อมใช้วิเคราะห์",
    unit: "Draft / Reviewed / Verified",
    source: "ผู้ทวนสอบข้อมูล",
  },
  updated_at: {
    label: "วันที่ปรับปรุง",
    description: "วันที่หรือเวลาที่ข้อมูลชุดนี้ถูกปรับปรุงล่าสุด",
    unit: "วันที่/เวลา",
    source: "ผู้กรอกข้อมูล",
  },
  note: {
    label: "หมายเหตุ",
    description: "บันทึกข้อจำกัด วิธีนับ หรือรายละเอียดสำคัญที่ผู้วิเคราะห์ควรทราบ",
    unit: "ข้อความ",
    source: "ผู้กรอกข้อมูล",
  },
  year: {
    label: "ปี (พ.ศ.)",
    description: "ปีของข้อมูลจริงที่รายงาน",
    unit: "พ.ศ.",
    source: "ตามรายงานต้นทาง",
  },
  population: {
    label: "ประชากรที่รับผิดชอบ",
    description: "ประชากรจริงของพื้นที่หรือหน่วยบริการในปีนั้น ใช้ค่าที่มีหลักฐานตรวจสอบได้",
    unit: "คน",
    source: "HDC / ทะเบียนราษฎร์ / ทะเบียนสิทธิ",
  },
  opdVisits: {
    label: "จำนวนครั้งรับบริการผู้ป่วยนอก",
    description: "จำนวน OPD visit ทั้งปี เป็นจำนวนครั้งรับบริการ ไม่ใช่จำนวนคน",
    unit: "ครั้ง",
    source: "HIS / HDC",
  },
  ipdAdmissions: {
    label: "จำนวนผู้ป่วยในรับใหม่",
    description: "จำนวนครั้งที่รับผู้ป่วยไว้รักษาเป็นผู้ป่วยในในปีนั้น (IPD admission)",
    unit: "ครั้งรับไว้รักษา",
    source: "HIS / DRG",
  },
  erVisits: {
    label: "จำนวนครั้งรับบริการห้องฉุกเฉิน",
    description: "จำนวนครั้งที่มารับบริการห้องฉุกเฉินในปีนั้น",
    unit: "ครั้ง",
    source: "ER report / HIS",
  },
  procedures: {
    label: "จำนวนหัตถการ/ผ่าตัด",
    description: "จำนวน OR หรือ Procedure ตามนิยามที่หน่วยบริการใช้และตรวจสอบได้",
    unit: "ครั้ง",
    source: "OR report / HIS",
  },
  deliveries: {
    label: "จำนวนการคลอด",
    description: "จำนวนการคลอดที่หน่วยบริการให้บริการในปีนั้น",
    unit: "ครั้ง",
    source: "ห้องคลอด / HIS",
  },
  chronicVisits: {
    label: "จำนวนครั้งบริการโรคเรื้อรัง",
    description: "จำนวนครั้งบริการกลุ่มโรคเรื้อรัง/NCD ที่ใช้เป็น workload จริง",
    unit: "ครั้ง",
    source: "HDC / NCD registry / HIS",
  },
  mentalVisits: {
    label: "จำนวนครั้งบริการสุขภาพจิต",
    description: "จำนวนครั้งบริการด้านสุขภาพจิต/จิตเวชที่ใช้เป็น workload จริง",
    unit: "ครั้ง",
    source: "HIS / ระบบสุขภาพจิต",
  },
  outreachVisits: {
    label: "จำนวนครั้งบริการเชิงรุก/ส่งเสริมป้องกัน",
    description: "จำนวนครั้งบริการ Outreach, PP หรือบริการในชุมชนที่ใช้เป็น workload จริง",
    unit: "ครั้ง",
    source: "HDC / PP report / หน่วยบริการ",
  },
  complexityIndex: {
    label: "ค่าความซับซ้อนงาน",
    description: "ตัวคูณความซับซ้อนของงาน หากไม่มีค่าที่ทวนสอบได้ให้คงค่ามาตรฐานเดิมของ Profile",
    unit: "ดัชนี",
    source: "มาตรฐานบริการ / ข้อตกลงพื้นที่",
  },
  groupCode: {
    label: "รหัสกลุ่มเป้าหมาย",
    description: "รหัสภายในของกลุ่ม Health Need ห้ามแก้ถ้าไม่จำเป็น",
    unit: "รหัส",
    source: "ระบบ",
  },
  groupLabel: {
    label: "กลุ่มปัญหา/กลุ่มเป้าหมาย",
    description: "ชื่อกลุ่มประชากรหรือปัญหาสุขภาพที่ต้องการบริการ",
    unit: "ข้อความ",
    source: "Service Plan / แผนงานพื้นที่",
  },
  targetPopulation: {
    label: "จำนวนกลุ่มเป้าหมาย",
    description: "จำนวนประชากรหรือจำนวน case เป้าหมายที่มีหลักฐานจริงในปีนั้น",
    unit: "คน/ราย/ครั้ง ตามนิยาม",
    source: "HDC / Registry / Program report",
  },
  actualServed: {
    label: "จำนวนที่ได้รับบริการจริง",
    description: "จำนวนกลุ่มเป้าหมายที่ได้รับบริการจริงตามนิยามของตัวชี้วัดในปีนั้น",
    unit: "คน/ราย/ครั้ง ตามนิยาม",
    source: "HDC / HIS / Program report",
  },
  coveragePct: {
    label: "เป้าหมายความครอบคลุม",
    description: "ร้อยละความครอบคลุมบริการที่กำหนดไว้สำหรับกลุ่มเป้าหมาย",
    unit: "%",
    source: "นโยบาย / Service Plan / CPG",
  },
  frequency: {
    label: "ความถี่บริการต่อปี",
    description: "จำนวนครั้งบริการที่คาดว่ากลุ่มเป้าหมายหนึ่งรายควรได้รับต่อปีตามมาตรฐาน",
    unit: "ครั้ง/คน/ปี",
    source: "มาตรฐานบริการ / CPG",
  },
  placement: {
    label: "ระดับ/หน่วยบริการที่รับผิดชอบ",
    description: "ระดับหรือประเภทหน่วยบริการที่ควรรับผิดชอบบริการกลุ่มนี้",
    unit: "ข้อความ",
    source: "Service Plan / ระบบบริการ",
  },
  profession_code: {
    label: "รหัสวิชาชีพ",
    description: "รหัสภายในของวิชาชีพที่ระบบใช้เชื่อมข้อมูล ห้ามแก้ถ้าไม่จำเป็น",
    unit: "รหัส",
    source: "ระบบ",
  },
  profession_label: {
    label: "วิชาชีพ",
    description: "ชื่อกลุ่มวิชาชีพ",
    unit: "ข้อความ",
    source: "HR",
  },
  actualHeadcount: {
    label: "จำนวนบุคลากรที่ปฏิบัติงานจริง",
    description: "จำนวนคนจริงของวิชาชีพที่ปฏิบัติงานในพื้นที่/หน่วยบริการในปีนั้น",
    unit: "คน",
    source: "HRIS / HROPS / จ.18",
  },
  recruit: {
    label: "จำนวนบรรจุ/รับเข้า",
    description: "จำนวนบุคลากรที่บรรจุหรือรับเข้ามาปฏิบัติงานจริงในปีนั้น",
    unit: "คน",
    source: "HRIS / คำสั่งบุคลากร",
  },
  transferIn: {
    label: "จำนวนย้ายเข้า",
    description: "จำนวนบุคลากรที่ย้ายเข้ามาปฏิบัติงานจริงในปีนั้น",
    unit: "คน",
    source: "HRIS / คำสั่งย้าย",
  },
  returnIn: {
    label: "จำนวนกลับเข้าปฏิบัติงาน",
    description: "จำนวนบุคลากรที่กลับเข้าปฏิบัติงานจากสถานะลา/ศึกษา/อื่น ๆ ในปีนั้น",
    unit: "คน",
    source: "HRIS / คำสั่งบุคลากร",
  },
  retire: {
    label: "จำนวนเกษียณ",
    description: "จำนวนบุคลากรที่เกษียณจริงในปีนั้น",
    unit: "คน",
    source: "HRIS / ทะเบียนเกษียณ",
  },
  resign: {
    label: "จำนวนลาออก",
    description: "จำนวนบุคลากรที่ลาออกจริงในปีนั้น",
    unit: "คน",
    source: "HRIS / คำสั่งลาออก",
  },
  transferOut: {
    label: "จำนวนย้ายออก",
    description: "จำนวนบุคลากรที่ย้ายออกจากพื้นที่/หน่วยบริการจริงในปีนั้น",
    unit: "คน",
    source: "HRIS / คำสั่งย้าย",
  },
  studyLeave: {
    label: "จำนวนลาศึกษา",
    description: "จำนวนบุคลากรที่ลาศึกษาและไม่สามารถให้บริการตามปกติในปีนั้น",
    unit: "คน",
    source: "HRIS / คำสั่งลาศึกษา",
  },
  fteFactor: {
    label: "สัดส่วนเวลาปฏิบัติงาน (FTE)",
    description: "สัดส่วนการทำงานเต็มเวลา โดย 1.0 = เต็มเวลา, 0.5 = ครึ่งเวลา",
    unit: "0–1",
    source: "HR / ตารางปฏิบัติงาน",
  },
  selected: {
    label: "นำวิชาชีพนี้มาวิเคราะห์",
    description: "ระบุว่าให้นำวิชาชีพนี้เข้าในการวิเคราะห์หรือไม่",
    unit: "ใช่ / ไม่ใช่",
    source: "ผู้วิเคราะห์",
  },
  current: {
    label: "จำนวนบุคลากรปัจจุบัน",
    description: "จำนวนบุคลากรปัจจุบันที่ใช้เป็นข้อมูลประกอบ Profile",
    unit: "คน",
    source: "HRIS / HROPS / จ.18",
  },
  vacant: {
    label: "ตำแหน่งว่าง",
    description: "จำนวนกรอบตำแหน่งที่ว่างตามข้อมูลจริง",
    unit: "ตำแหน่ง",
    source: "HRIS / กรอบอัตรากำลัง",
  },
  retire5y: {
    label: "ผู้ที่จะเกษียณภายใน 5 ปี",
    description: "จำนวนบุคลากรตามทะเบียนที่อยู่ในช่วงเกษียณภายใน 5 ปี ไม่ใช่การกระจายย้อนหลังอัตโนมัติ",
    unit: "คน",
    source: "ทะเบียนบุคลากร / HRIS",
  },
  awtMinutes: {
    label: "เวลาทำงานที่มีจริงต่อคนต่อปี (AWT)",
    description: "Available Working Time ของบุคลากรหนึ่ง FTE ต่อปีที่ใช้ใน WISN",
    unit: "นาที/คน/ปี",
    source: "WISN / ข้อมูลเวลาทำงานของหน่วยงาน",
  },
  casPct: {
    label: "สัดส่วนกิจกรรมสนับสนุน (CAS)",
    description: "Category Allowance Standard สำหรับกิจกรรมสนับสนุนที่ทุกคนในกลุ่มวิชาชีพทำ",
    unit: "%",
    source: "WISN / time-motion / expert consensus",
  },
  iasHours: {
    label: "กิจกรรมเพิ่มเติมรายบุคคล (IAS)",
    description: "Individual Allowance Standard สำหรับกิจกรรมเพิ่มเติมเฉพาะบุคคล",
    unit: "ชั่วโมง/ปี",
    source: "WISN / time-motion / expert consensus",
  },
};

function excelFieldGuide(key) {
  if (NCO_EXCEL_FIELD_GUIDE[key]) return NCO_EXCEL_FIELD_GUIDE[key];
  if (String(key).startsWith("activity_")) {
    const code = String(key).slice("activity_".length);
    const activity = (typeof ACTIVITY_DEFS !== "undefined" ? ACTIVITY_DEFS : []).find((item) => item.code === code);
    return {
      label: `เวลามาตรฐาน ${activity?.label || code}`,
      description: "เวลามาตรฐานที่ใช้ต่อ 1 กิจกรรมสำหรับคำนวณ WISN",
      unit: "นาที/ครั้ง",
      source: "time-motion / service standard / expert consensus",
    };
  }
  return {
    label: String(key),
    description: `technical key: ${key} — ใช้เชื่อมข้อมูลกับระบบ ไม่ควรเปลี่ยนชื่อ`,
    unit: "",
    source: "ระบบ",
  };
}

function buildExcelInstructionRows() {
  return [
    ["HR Blueprint — คำแนะนำการกรอก Excel Template"],
    ["วิธีใช้", "1) กรอกเฉพาะข้อมูลจริงที่หน่วยงานมี  2) ให้แต่ละกลุ่มงานกรอก Sheet ที่รับผิดชอบ  3) ตรวจแหล่งข้อมูลและสถานะ  4) นำไฟล์กลับไป Import ใน Simulator"],
    ["หลักสำคัญ", "ช่องที่ไม่มีข้อมูลจริงให้เว้นว่าง ไม่ใส่ 0 เพื่อแทนคำว่าไม่มีข้อมูล เว้นแต่ค่าจริงเป็นศูนย์และได้รับการยืนยัน"],
    ["ห้ามแก้", "อย่าเปลี่ยนชื่อ Sheet และอย่าลบแถว technical key ที่ระบบซ่อนไว้ เพราะ Simulator ใช้สำหรับ Import กลับ"],
    ["สถานะข้อมูล", "Draft = กำลังกรอก | Reviewed = ตรวจทานแล้ว | Verified = ยืนยันพร้อมใช้วิเคราะห์"],
    ["หมายเหตุ", "ชื่อคอลัมน์ภาษาไทยและคำอธิบายมีไว้ช่วยผู้กรอก ส่วน technical key ถูกซ่อนอยู่ในแถวแรก"],
    [],
    ["Sheet", "ผู้รับผิดชอบหลักที่แนะนำ", "ข้อมูลที่ต้องกรอก"],
    ["Profile", "ผู้ประสาน Profile / ยุทธศาสตร์", "ข้อมูลพื้นที่ รหัส Profile ระดับการวิเคราะห์ และปีอ้างอิง"],
    ["Section_Metadata", "ทุกกลุ่มงาน + ผู้ทวนสอบ", "ผู้รับผิดชอบ แหล่งข้อมูล สถานะ วันที่ปรับปรุง และหมายเหตุ"],
    ["Workload_History", "ยุทธศาสตร์ / HIS / เวชระเบียน / ประกัน", "ประชากรและปริมาณบริการจริงย้อนหลังรายปี"],
    ["TargetNeed_History", "NCD / ปฐมภูมิ / Service Plan / ยุทธศาสตร์", "กลุ่มเป้าหมาย จำนวนเป้าหมาย และผู้ได้รับบริการจริง"],
    ["Workforce_History", "HR / บริหารทรัพยากรบุคคล", "จำนวนบุคลากรจริง และการเข้า-ออกของบุคลากรรายปี"],
    ["Profession_Config", "HR + ทีมวิชาชีพ / พัฒนาคุณภาพ", "ค่ามาตรฐาน WISN เช่น AWT, CAS, IAS และเวลาต่อกิจกรรม"],
    [],
    ["ข้อควรระวัง", "ข้อมูลในไฟล์นี้ควรเป็นข้อมูลรวมระดับพื้นที่/บริการ ไม่ใส่ชื่อบุคคล เลขบัตรประชาชน หรือข้อมูลสุขภาพรายบุคคล"],
  ];
}

function friendlyHeadersForRows(rows, sheetName) {
  const headers = [];
  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) {
      if (!headers.includes(key)) headers.push(key);
    }
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
      t: `${guide.description}\nหน่วย/รูปแบบ: ${guide.unit || "-"}\nแหล่งข้อมูลแนะนำ: ${guide.source || "-"}`,
    }];
  });
}

function writeProfileWorkbook(payload, filename) {
  if (typeof XLSX === "undefined") throw new Error("SheetJS ยังไม่พร้อมใช้งาน");
  const wb = XLSX.utils.book_new();

  const guideSheet = XLSX.utils.aoa_to_sheet(buildExcelInstructionRows());
  guideSheet["!cols"] = [{ wch: 26 }, { wch: 86 }, { wch: 48 }];
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
      ...rows.map((row) => headers.map((header) => row?.[header] ?? null)),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!rows"] = [
      { hidden: true },
      { hpt: 30 },
      { hpt: 48 },
      { hpt: 28 },
      { hpt: 34 },
    ];
    ws["!cols"] = guides.map((guide) => ({
      wch: Math.min(42, Math.max(14, String(guide.label || "").length + 6)),
    }));
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

    if (guided && technicalHeaders.some(Boolean)) {
      const rows = XLSX.utils.sheet_to_json(ws, {
        header: technicalHeaders,
        defval: null,
        raw: true,
        range: 5,
      });
      sheets[sheetName] = rows.filter(rowsHaveValues);
    } else {
      sheets[sheetName] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true }).filter(rowsHaveValues);
    }
  }

  const payload = profilePayloadFromSheetRows(sheets);
  applyProfilePayload(payload);
  if (typeof setProfileStatus === "function") {
    setProfileStatus(`นำเข้า ${file.name} แล้ว — คำอธิบายใน Excel ไม่ถูกนำมาคำนวณ`, "success");
  }
  return payload;
}
