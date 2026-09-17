// Shared data dictionary for formula-sensitive WISN terms used by Simulator + Excel.
(() => {
  "use strict";

  const formulas = Object.freeze({
    actualDemand: "Demand Minutes = Σ(Workload Volume × Activity Standard × Complexity Index)",
    targetCases: "Target Cases = Target Population × Coverage %",
    targetEquivalent: "Target Equivalent Activity Volume = Target Cases × Service Frequency × Activity Mix × Target Complexity",
    planningVolume: "Planning Activity Volume = max(Actual Volume × Actual Complexity, Target-Need Equivalent Volume) รายกิจกรรม",
    planningDemand: "Planning Demand Minutes = Σ(Planning Activity Volume × Activity Standard)",
    serviceFte: "Service FTE = Demand Minutes ÷ AWT",
    caf: "CAF = 1 ÷ (1 − CAS/100)",
    iaf: "IAF = IAS × 60 ÷ AWT",
    requiredFte: "Required FTE = (Service FTE × CAF) + IAF",
    supplyFte: "Actual Supply FTE = Actual Annual Headcount × FTE Factor",
    gap: "HR GAP = Planning Required FTE − Actual Supply FTE",
    wisnRatio: "WISN Ratio = Actual Supply FTE ÷ Planning Required FTE",
    pressure: "Pressure Index = Planning Required FTE ÷ Actual Supply FTE",
    trend: "Trend Index = Planning Required FTE ปีนั้น ÷ Planning Required FTE ปีฐาน",
    coverageGap: "Coverage Gap = max(Target Cases − Actual Served, 0)",
    workloadGap: "Workload Gap = Coverage Gap × Service Frequency",
    suggestedAdd: "Suggested Add = ceil(max(HR GAP, 0))",
    reallocate: "Reallocate = max(0, −HR GAP)",
  });

  const workloadFields = {
    opdVisits: ["จำนวนครั้งรับบริการผู้ป่วยนอก", "จำนวน OPD visit จริงทั้งหมดในปีนั้น เป็นปริมาณงานต่อปี ไม่ใช่เวลามาตรฐานต่อ visit", "ครั้ง/ปี", "HIS / HDC / รายงาน OPD ที่ทวนสอบแล้ว", "OPD visits × Activity Standard OPD (นาที/visit) × Complexity Index"],
    ipdAdmissions: ["จำนวนผู้ป่วยในรับใหม่", "จำนวน IPD admission จริงในปีนั้น", "admissions/ปี", "HIS / DRG / IPD census", "IPD admissions × Activity Standard IPD (นาที/admission) × Complexity Index"],
    erVisits: ["จำนวนครั้งรับบริการห้องฉุกเฉิน", "จำนวน ER visit จริงในปีนั้น", "ครั้ง/ปี", "ER report / HIS", "ER visits × Activity Standard ER (นาที/visit) × Complexity Index"],
    procedures: ["จำนวนหัตถการ/ผ่าตัด", "จำนวน OR/Procedure จริงในปีนั้น โดยใช้นิยาม case เดียวกันกับเวลามาตรฐาน", "cases/ปี", "OR log / Procedure registry / HIS", "Procedure cases × Activity Standard OR/Procedure (นาที/procedure) × Complexity Index"],
    deliveries: ["จำนวนการคลอด", "จำนวน delivery จริงที่หน่วยบริการดูแลในปีนั้น", "deliveries/ปี", "ห้องคลอด / HIS", "Deliveries × Activity Standard Delivery (นาที/delivery) × Complexity Index"],
    chronicVisits: ["จำนวนครั้งบริการโรคเรื้อรัง", "จำนวน chronic/NCD service visit จริงในปีนั้น", "ครั้ง/ปี", "HDC / NCD registry / HIS", "Chronic visits × Activity Standard Chronic (นาที/visit) × Complexity Index"],
    mentalVisits: ["จำนวนครั้งบริการสุขภาพจิต", "จำนวน mental health/psychiatric service visit จริงในปีนั้น", "ครั้ง/ปี", "HIS / Mental Health registry", "Mental visits × Activity Standard Mental (นาที/visit) × Complexity Index"],
    outreachVisits: ["จำนวนกิจกรรมบริการเชิงรุก/PP", "จำนวนกิจกรรมหรือ contact Outreach/PP จริงในปีนั้น หน่วยนับต้องตรงกับ Activity Standard", "กิจกรรมหรือ contacts/ปี", "HDC / PP report / ทะเบียนเยี่ยมบ้าน", "Outreach/PP volume × Activity Standard Outreach/PP (นาที/กิจกรรม) × Complexity Index"],
  };
  Object.keys(workloadFields).forEach((key) => {
    const [label, description, unit, source, formula] = workloadFields[key];
    workloadFields[key] = Object.freeze({ label, description, unit, source, formula });
  });
  Object.freeze(workloadFields);

  const activityStandards = {
    opdVisits: ["OPD", "นาที/OPD visit", "จำนวนนาทีที่บุคลากร 1 คนในวิชาชีพนั้นใช้ต่อ OPD 1 visit ตามนิยามของโมเดล ไม่ใช่จำนวนครั้งบริการต่อปี", "OPD visits × นาที/OPD visit × Complexity Index = demand minutes ของ OPD", "แพทย์ 8 นาที/OPD visit", "ใช้เวลาของวิชาชีพนั้นต่อ 1 visit ไม่ใช่เวลารวมทั้งทีม"],
    ipdAdmissions: ["IPD Admit", "นาที/IPD admission", "จำนวนนาทีที่บุคลากร 1 คนในวิชาชีพนั้นใช้ต่อ IPD 1 admission ตามนิยามของโมเดล ไม่ใช่จำนวน admission ต่อปี", "IPD admissions × นาที/admission × Complexity Index = demand minutes ของ IPD", "พยาบาล 60 นาที/IPD admission", "ช่องนี้เป็นนาทีต่อ admission ไม่ใช่นาทีต่อ bed-day"],
    erVisits: ["ER", "นาที/ER visit", "จำนวนนาทีที่บุคลากร 1 คนในวิชาชีพนั้นใช้ต่อ ER 1 visit ไม่ใช่จำนวนครั้งบริการต่อปี", "ER visits × นาที/ER visit × Complexity Index = demand minutes ของ ER", "แพทย์ 15 นาที/ER visit", "ถ้ามีหลาย acuity level ควรใช้ weighted standard ที่พื้นที่รับรอง"],
    procedures: ["OR/Procedure", "นาที/procedure", "จำนวนนาทีที่บุคลากร 1 คนในวิชาชีพนั้นใช้ต่อ OR/Procedure 1 case ไม่ใช่จำนวนหัตถการต่อปี", "Procedure cases × นาที/procedure × Complexity Index = demand minutes ของ OR/Procedure", "แพทย์ 45 นาที/procedure", "นิยาม case ต้องตรงกันทั้ง workload และ standard"],
    deliveries: ["Delivery", "นาที/delivery", "จำนวนนาทีที่บุคลากร 1 คนในวิชาชีพนั้นใช้ต่อการคลอด 1 ครั้ง ไม่ใช่จำนวนการคลอดต่อปี", "Deliveries × นาที/delivery × Complexity Index = demand minutes ของ Delivery", "พยาบาล 120 นาที/delivery", "ใช้เวลาของวิชาชีพนั้น ไม่ใช่เวลารวมตั้งแต่รับถึงจำหน่าย"],
    chronicVisits: ["Chronic", "นาที/chronic visit", "จำนวนนาทีที่บุคลากร 1 คนในวิชาชีพนั้นใช้ต่อ chronic/NCD service visit 1 ครั้ง ไม่ใช่จำนวนครั้งบริการต่อปี", "Chronic visits × นาที/chronic visit × Complexity Index = demand minutes ของ Chronic", "พยาบาล 12 นาที/chronic visit", "ถ้ามีหลาย service mix ควรใช้ standard ที่สะท้อนงานจริง"],
    mentalVisits: ["Mental", "นาที/mental visit", "จำนวนนาทีที่บุคลากร 1 คนในวิชาชีพนั้นใช้ต่อ mental health service visit 1 ครั้ง ไม่ใช่จำนวนครั้งบริการต่อปี", "Mental visits × นาที/mental visit × Complexity Index = demand minutes ของ Mental", "นักจิตวิทยา 45 นาที/mental visit", "กำหนดให้ชัดว่ารวม counseling/psychotherapy หรือ encounter ใด"],
    outreachVisits: ["Outreach/PP", "นาที/กิจกรรม Outreach/PP", "จำนวนนาทีที่บุคลากร 1 คนในวิชาชีพนั้นใช้ต่อ Outreach/PP 1 หน่วยกิจกรรมหรือ contact ตามนิยามเดียวกับ workload ไม่ใช่จำนวนครั้งบริการต่อปี", "Outreach/PP volume × นาที/กิจกรรม × Complexity Index = demand minutes ของ Outreach/PP", "นักวิชาการสาธารณสุข 25 นาที/กิจกรรม Outreach/PP", "หน่วยนับ workload และ Activity Standard ต้องเป็นหน่วยเดียวกัน"],
  };
  for (const [code, values] of Object.entries(activityStandards)) {
    const [shortLabel, unit, definition, formula, example, caution] = values;
    activityStandards[code] = Object.freeze({
      helpKey: `activity-${code}`,
      excelKey: `activity_${code}`,
      label: `เวลามาตรฐาน ${shortLabel}`,
      title: `Activity Standard — ${shortLabel}`,
      definition,
      unit,
      source: "time-motion study / service standard / expert consensus",
      formula,
      example,
      caution,
    });
  }
  Object.freeze(activityStandards);

  const excelFields = {
    ...workloadFields,
    complexityIndex: { label: "ค่าความซับซ้อนงาน (Complexity Index)", description: "ตัวคูณภาระงานของ actual workload; 1.00 = ไม่ปรับ, 1.20 = workload equivalent เพิ่ม 20%", unit: "ดัชนี", source: "case-mix / acuity / referral complexity / ข้อตกลงที่ทวนสอบแล้ว", formula: formulas.actualDemand },
    awtMinutes: { label: "เวลาทำงานที่มีจริงต่อ 1 FTE ต่อปี (AWT)", description: "Available Working Time หลังหักวันหยุด ลา อบรม และเวลาที่ไม่พร้อมทำงานตามนิยาม WISN", unit: "นาที/คน/ปี", source: "ปฏิทินทำงาน + ข้อมูลลา/อบรม หรือมาตรฐานองค์กร", formula: `${formulas.serviceFte}; ${formulas.requiredFte}` },
    casPct: { label: "สัดส่วนกิจกรรมสนับสนุนร่วม (CAS)", description: "ร้อยละเวลาสำหรับกิจกรรมสนับสนุนที่บุคลากรทุกคนในวิชาชีพนั้นทำ", unit: "% ของเวลาทำงาน", source: "time-motion / work sampling / expert consensus", formula: `${formulas.caf}; ${formulas.requiredFte}` },
    iasHours: { label: "กิจกรรมเพิ่มเติมเฉพาะบุคคล (IAS)", description: "ชั่วโมงต่อปีของกิจกรรมเพิ่มเติมที่ทำโดยบุคลากรบางราย ไม่ใช่ทุกคนในวิชาชีพ", unit: "ชั่วโมง/ปี", source: "คำสั่งมอบหมาย / time-motion / ภาระงานจริง", formula: `${formulas.iaf}; ${formulas.requiredFte}` },
    fteFactor: { label: "สัดส่วนเวลาปฏิบัติงาน (FTE Factor)", description: "สัดส่วนการทำงานเทียบเท่าคนเต็มเวลา 1 คน เช่น 1.0 = เต็มเวลา, 0.5 = ครึ่งเวลา", unit: "FTE ต่อคน", source: "HR / ตารางปฏิบัติงานจริง", formula: formulas.supplyFte },
    coveragePct: { label: "เป้าหมายความครอบคลุม", description: "ร้อยละของ Target Population ที่ควรได้รับบริการ", unit: "%", source: "นโยบาย / Service Plan / CPG", formula: formulas.targetCases },
    frequency: { label: "ความถี่บริการต่อปี", description: "จำนวนครั้งบริการที่กลุ่มเป้าหมาย 1 รายควรได้รับต่อปี", unit: "ครั้ง/คน/ปี", source: "CPG / service model / consensus", formula: formulas.targetEquivalent },
    targetPopulation: { label: "จำนวนกลุ่มเป้าหมาย", description: "จำนวนคน/cases ในกลุ่มเป้าหมายของปีนั้นก่อนคูณ Coverage %; ต้องเป็นข้อมูลจริงย้อนหลัง", unit: "คนหรือ cases", source: "HDC / Registry / Program report", formula: formulas.targetCases },
    actualServed: { label: "จำนวนที่ได้รับบริการจริง", description: "จำนวนคน/cases ในกลุ่มเป้าหมายที่ได้รับบริการจริงในปีนั้น", unit: "คนหรือ cases", source: "HDC / HIS / Program report", formula: formulas.coverageGap },
  };
  Object.freeze(excelFields);

  const helpItems = {
    "wisn-mode": { key:"wisn-mode", title:"WISN Standard Mode", category:"4. Profession", aliases:["WISN Standard Mode"], definition:"เลือกชุด Activity Standard: WISN default = ค่าเริ่มต้น, High complexity +10% = เพิ่ม Activity Standard ทุกกิจกรรม 10%, Custom = ผู้ใช้กำหนดเอง", unit:"โหมด", source:"ระบบ/มาตรฐานพื้นที่", example:"Custom เมื่อมี time-motion study", caution:"High complexity +10% ปรับ Activity Standard minutes ไม่ได้เปลี่ยน Complexity Index", origin:"assumption" },
    awt: { key:"awt", title:"AWT — Available Working Time", category:"4. Profession", aliases:["AWT min/year"], definition:excelFields.awtMinutes.description, unit:excelFields.awtMinutes.unit, source:excelFields.awtMinutes.source, example:"90,720 นาที/คน/ปี เป็นค่าเริ่มต้น", formula:excelFields.awtMinutes.formula, origin:"assumption" },
    cas: { key:"cas", title:"CAS — Category Allowance Standard", category:"4. Profession", aliases:["CAS support %"], definition:excelFields.casPct.description, unit:excelFields.casPct.unit, source:excelFields.casPct.source, example:"14%", formula:excelFields.casPct.formula, origin:"assumption" },
    ias: { key:"ias", title:"IAS — Individual Allowance Standard", category:"4. Profession", aliases:["IAS hours/year"], definition:excelFields.iasHours.description, unit:excelFields.iasHours.unit, source:excelFields.iasHours.source, example:"40 ชั่วโมง/ปี", formula:excelFields.iasHours.formula, origin:"assumption" },
    "activity-standard": { key:"activity-standard", title:"Activity Standard", category:"4. Profession", aliases:["Activity Standards (minutes per case)","Activity Standards"], definition:"เวลามาตรฐานของบุคลากร 1 คนในวิชาชีพนั้นต่อ 1 หน่วยกิจกรรมบริการ ใช้แปลง Workload Volume เป็น Demand Minutes", unit:"นาทีต่อ 1 หน่วยกิจกรรม", source:"time-motion study / service standard / expert consensus", example:"แพทย์ OPD 8 นาที/visit", caution:"ไม่ใช่จำนวนครั้งบริการต่อปี และไม่ใช่เวลารวมทั้งทีม", formula:formulas.actualDemand, origin:"assumption" },
    complexity: { key:"complexity", title:"Complexity Index", category:"5. Workload", aliases:["Complexity","Need Complexity"], definition:excelFields.complexityIndex.description, unit:excelFields.complexityIndex.unit, source:excelFields.complexityIndex.source, example:"1.20 = workload equivalent เพิ่ม 20%", formula:formulas.actualDemand, origin:"assumption" },
    "fte-factor": { key:"fte-factor", title:"FTE Factor", category:"6. Supply", aliases:["FTE Factor"], definition:excelFields.fteFactor.description, unit:excelFields.fteFactor.unit, source:excelFields.fteFactor.source, example:"1.0=เต็มเวลา, 0.5=ครึ่งเวลา", formula:formulas.supplyFte, origin:"input" },
    "actual-fte": { key:"actual-fte", title:"Actual Workload FTE", category:"7. Results", aliases:["Actual FTE","Actual Workload FTE"], definition:"Required FTE ที่คำนวณจาก workload จริงย้อนหลังของปีนั้น", unit:"FTE", source:"ระบบคำนวณจาก workload จริง", example:"18.4 FTE", formula:`${formulas.actualDemand}; ${formulas.serviceFte}; ${formulas.requiredFte}`, origin:"output" },
    "target-fte": { key:"target-fte", title:"Target Need FTE", category:"7. Results", aliases:["Target FTE","Target Need FTE"], definition:"Required FTE ที่คำนวณจาก target health need ของปีนั้น", unit:"FTE", source:"ระบบคำนวณจาก Target Need", example:"21.2 FTE", formula:`${formulas.targetCases}; ${formulas.targetEquivalent}; ${formulas.requiredFte}`, origin:"output" },
    "planning-fte": { key:"planning-fte", title:"Planning Required FTE", category:"7. Results", aliases:["Planning FTE","Required FTE","Planning Required FTE"], definition:"กำลังคนสำหรับวางแผน โดยเลือกระดับกิจกรรมที่สูงกว่าระหว่าง actual workload ที่ปรับ complexity กับ target-need equivalent volume แยกรายกิจกรรม แล้วคำนวณ WISN", unit:"FTE", source:"ระบบคำนวณ", example:"22.1 FTE", formula:`${formulas.planningVolume}; ${formulas.planningDemand}; ${formulas.requiredFte}`, origin:"output" },
    "supply-fte": { key:"supply-fte", title:"Actual Supply FTE", category:"7. Results", aliases:["Supply FTE","Actual Supply FTE"], definition:"กำลังคนจริงของปีนั้นใน historical mode = actual annual headcount × FTE factor", unit:"FTE", source:"HR annual headcount + FTE factor", example:"17 × 1.0 = 17.0 FTE", formula:formulas.supplyFte, origin:"output" },
    "hr-gap": { key:"hr-gap", title:"HR GAP", category:"7. Results", aliases:["HR GAP","Total Positive GAP"], definition:"ส่วนต่าง Planning Required FTE กับ Actual Supply FTE", unit:"FTE", source:"ระบบคำนวณ", example:"+5.1 = ขาด 5.1 FTE", formula:formulas.gap, origin:"output" },
    "wisn-ratio": { key:"wisn-ratio", title:"WISN Ratio", category:"7. Results", aliases:["WISN Ratio"], definition:"Actual Supply FTE ต่อ Planning Required FTE", unit:"ratio", source:"ระบบคำนวณ", example:"0.80 = supply เท่ากับ 80% ของ need", formula:formulas.wisnRatio, origin:"output" },
    pressure: { key:"pressure", title:"Pressure Index", category:"7. Results", aliases:["Pressure"], definition:"Planning Required FTE หารด้วย Actual Supply FTE", unit:"ratio", source:"ระบบคำนวณ", example:"1.25", formula:formulas.pressure, origin:"output" },
    trend: { key:"trend", title:"Trend Index", category:"7. Results", aliases:["Trend"], definition:"Planning Required FTE ปีนั้นเทียบปีฐาน", unit:"index", source:"ระบบคำนวณ", example:"1.10", formula:formulas.trend, origin:"output" },
    "coverage-gap": { key:"coverage-gap", title:"Coverage Gap", category:"7. Results", aliases:["Coverage Gap"], definition:"target cases ที่ควรได้รับบริการแต่ยังไม่ได้รับบริการจริง", unit:"คน/cases", source:"ระบบคำนวณ", example:"1,200−900=300", formula:`${formulas.targetCases}; ${formulas.coverageGap}`, origin:"output" },
    "workload-gap": { key:"workload-gap", title:"Workload Gap", category:"7. Results", aliases:["Workload Gap"], definition:"จำนวน service contacts เทียบเท่าที่ต้องเพิ่มเพื่อปิด Coverage Gap", unit:"ครั้งบริการเทียบเท่า", source:"ระบบคำนวณ", example:"300×3=900", formula:formulas.workloadGap, origin:"output" },
    "suggested-add": { key:"suggested-add", title:"Suggested Add", category:"7. Results", aliases:["Suggested Add"], definition:"FTE แบบปัดขึ้นเมื่อ HR GAP เป็นบวก ใช้เป็น planning signal", unit:"FTE โดยประมาณ", source:"ระบบคำนวณ", example:"4.2→5", formula:formulas.suggestedAdd, origin:"output" },
    reallocate: { key:"reallocate", title:"Reallocate", category:"7. Results", aliases:["Reallocate"], definition:"FTE ที่ Actual Supply สูงกว่า Planning Required FTE ตามโมเดล", unit:"FTE", source:"ระบบคำนวณ", example:"GAP -2.3→2.3", formula:formulas.reallocate, origin:"output" },
  };
  for (const [code, item] of Object.entries(activityStandards)) {
    helpItems[item.helpKey] = Object.freeze({ key:item.helpKey, title:item.title, category:"4. Profession / Activity Standard", aliases:[], definition:item.definition, unit:item.unit, source:item.source, example:item.example, caution:item.caution, formula:item.formula, origin:"assumption" });
  }
  Object.freeze(helpItems);

  window.NCO_HR_DATA_DICTIONARY = Object.freeze({ formulas, workloadFields, activityStandards, excelFields, helpItems });
})();
