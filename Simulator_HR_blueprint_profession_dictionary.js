// Canonical profession-specific workload dictionary for HR Blueprint WISN v2.
// The visible workload definition/unit, not the legacy technical slot name, controls interpretation.
(() => {
  "use strict";

  const w = (activityCode, label, unit, definition, inclusion, exclusion, sourceHint, overlapPolicy, relatedKpis, overlapSensitive = false) => Object.freeze({
    activity_code: activityCode,
    workload_label: label,
    volume_unit: unit,
    definition,
    inclusion_criteria: inclusion,
    exclusion_criteria: exclusion,
    source_hint: sourceHint,
    overlap_policy_default: overlapPolicy,
    overlap_sensitive: overlapSensitive,
    related_kpi_codes: relatedKpis,
  });

  const workloadDefinitions = Object.freeze({
    doctor: Object.freeze([
      w("opdVisits", "Doctor OPD encounters", "physician visits/year", "physician OPD encounters: จำนวนครั้งที่ผู้ป่วยนอกได้รับการประเมิน/ตรวจโดยแพทย์จริง ไม่ใช่ Total OPD ของโรงพยาบาล", "visit ที่มี provider profession = physician หรือมีหลักฐาน physician encounter", "exclude nurse-only, dental, physiotherapy, pharmacy-only และบริการวิชาชีพอื่นที่ไม่มีแพทย์ตรวจ", "HIS encounter/provider table หรือรายงานแพทย์ตรวจ OPD", "deduplicated", ["A01", "F10"], true),
      w("ipdAdmissions", "Doctor-responsible IPD admissions", "admissions/year", "จำนวน IPD admissions ที่มีแพทย์รับผิดชอบตามนิยามเดียวกับ Activity Standard นาที/admission", "admission ที่อยู่ในความรับผิดชอบของแพทย์/ทีมแพทย์ที่กำลังวิเคราะห์", "exclude admission ที่อยู่นอก scope หรือไม่มี physician workload ตามนิยาม", "HIS/DRG admission + attending physician", "independent", ["A01", "C02", "D01", "F10"]),
      w("erVisits", "Physician-assessed ER encounters", "physician ER visits/year", "จำนวน ER encounters ที่มีการประเมินโดยแพทย์จริง", "ER visit ที่มี physician assessment/provider", "exclude triage/nurse-only encounter ที่ไม่มีแพทย์ประเมิน", "ER HIS/provider log", "deduplicated", ["A04", "A09", "DH0101", "DN0101", "DN0142D", "CI0101"], true),
      w("procedures", "Physician-performed procedures/OR cases", "procedures/year", "จำนวน procedure/OR case ที่แพทย์ทำจริงและหน่วยนับตรงกับนาที/procedure", "procedure ที่แพทย์เป็น operator/ผู้ทำตามนิยาม", "exclude procedure ที่นับอยู่ใน encounter อื่นแล้วหากเวลามาตรฐาน encounter รวม procedure ไว้", "OR log/procedure registry/operator field", "unknown", ["C02", "F10", "DG0201", "DC0401"], true),
      w("deliveries", "Physician-attended deliveries", "deliveries/year", "จำนวนการคลอดที่มีแพทย์ปฏิบัติงานตามบทบาทที่นิยามไว้", "delivery ที่มี physician attendance/intervention ตามเกณฑ์พื้นที่", "exclude delivery ที่ไม่มี physician work ตาม standard นี้", "Labour room log/operative delivery record", "independent", ["B01", "CM0101", "CM0203"]),
      w("chronicVisits", "Physician chronic/NCD encounters", "physician chronic visits/year", "จำนวน chronic/NCD encounters ที่แพทย์ตรวจจริงและต้องไม่ซ้ำกับ Doctor OPD encounters ที่นำมาคำนวณ", "physician NCD/chronic encounter ที่แยกออกจาก OPD numerator ได้", "exclude encounter ที่รวมอยู่ใน Doctor OPD volume แล้ว เว้นแต่ OPD numerator ถูกหักออกอย่างชัดเจน", "NCD registry + provider field", "unknown", ["A01", "F10"], true),
      w("mentalVisits", "Physician mental-health encounters", "physician mental visits/year", "จำนวน mental-health encounters ที่แพทย์ตรวจจริงและไม่ซ้ำกับ Doctor OPD numerator", "psychiatric/mental encounter with physician provider", "exclude psychologist-only/counsellor-only และ encounter ที่ถูกนับใน Doctor OPD แล้วโดยไม่หักซ้ำ", "Mental health HIS/provider registry", "unknown", ["PS0001", "A01"], true),
      w("outreachVisits", "Physician outreach contacts", "physician contacts/year", "จำนวน outreach/home/community contacts ที่แพทย์ให้บริการจริงตามหน่วยที่กำหนด", "contact ที่แพทย์มี direct service activity", "exclude team outreach ที่แพทย์ไม่ได้ให้บริการโดยตรง", "Home visit/outreach roster", "independent", ["F10"]),
    ]),
    nurse: Object.freeze([
      w("opdVisits", "Nursing OPD service contacts", "nursing contacts/year", "จำนวน OPD service contacts ที่พยาบาลทำกิจกรรมตาม Activity Standard ของพยาบาล", "nursing assessment/procedure/contact ที่มีบันทึกจริง", "exclude งานที่ไม่มี nursing activity ตามนิยาม", "Nursing/HIS service log", "deduplicated", ["A01", "F10"], true),
      w("ipdAdmissions", "IPD nursing patient-days", "patient-days/year", "จำนวน patient-days ที่พยาบาลดูแลผู้ป่วยใน ใช้คู่กับ Activity Standard นาที/patient-day; ไม่ใช่ IPD admissions", "occupied inpatient patient-days ใน scope ของทีมพยาบาล", "exclude admissions count เมื่อ standard เป็นนาที/patient-day", "IPD census/bed-day report", "independent", ["A01", "A09", "D01", "CI0101"]),
      w("erVisits", "ER nursing encounters", "nursing ER encounters/year", "จำนวน ER encounters ที่มี nursing workload ตามนิยาม", "triage/ER nursing care ที่บันทึกจริง", "exclude contact ที่ไม่มี nursing service", "ER nursing log/HIS", "deduplicated", ["A04", "A09", "DH0101", "DN0101", "CI0101"], true),
      w("procedures", "Nursing procedures", "nursing procedures/year", "จำนวน nursing procedures ที่หน่วยนับตรงกับนาที/procedure", "procedure ที่พยาบาลเป็นผู้ปฏิบัติ", "exclude procedure ที่รวมอยู่ใน encounter standard แล้วหากจะทำให้นับเวลาซ้ำ", "Nursing procedure log", "unknown", ["A09", "CI0101"], true),
      w("deliveries", "Labour/delivery nursing cases", "deliveries/year", "จำนวน delivery cases ที่พยาบาล/พยาบาลผดุงครรภ์ปฏิบัติงานตาม standard", "delivery ใน labour room ที่ทีมพยาบาลดูแล", "exclude cases outside scope", "Labour room registry", "independent", ["B01", "CM0101", "CM0203"]),
      w("chronicVisits", "Nurse-led chronic/NCD contacts", "nursing chronic contacts/year", "จำนวน nurse-led NCD/chronic contacts ที่มี nursing activity จริง", "nurse-led chronic care contacts", "exclude contact ที่ถูกนับซ้ำใน OPD nursing numerator โดยไม่ deduplicate", "NCD clinic/HIS provider log", "unknown", ["F10"], true),
      w("mentalVisits", "Mental-health nursing contacts", "nursing mental contacts/year", "จำนวน mental-health nursing contacts จริง", "mental-health nursing encounter", "exclude duplicate OPD contact unless deduplicated", "Mental health service log", "unknown", ["PS0001"], true),
      w("outreachVisits", "Nursing outreach/home-care contacts", "nursing contacts/year", "จำนวน home visit/outreach contacts ที่พยาบาลให้บริการจริง", "direct nursing outreach/home-care contact", "exclude team events without nursing service", "Home visit/community nursing log", "independent", ["RH0101", "F10"]),
    ]),
    pharmacist: Object.freeze([
      w("opdVisits", "OPD prescriptions/dispensing episodes", "prescriptions/year", "จำนวน prescriptions หรือ dispensing episodes ที่เภสัชกรให้บริการจริง ไม่ใช่ OPD visits", "prescription/dispensing episode ที่ผ่าน pharmacist workflow", "exclude OPD visit ที่ไม่มี pharmacy workload", "Pharmacy dispensing system", "independent", ["A01", "F10"]),
      w("ipdAdmissions", "IPD pharmacy medication episodes", "medication episodes/year", "จำนวน inpatient medication review/dispensing episodes ตามหน่วยเดียวกับ standard", "IPD medication episode ที่เภสัชกรทำงานจริง", "exclude admission count ถ้าไม่ได้เท่ากับ 1 pharmacy episode", "Pharmacy/IPD medication system", "independent", ["A09", "C02"]),
      w("erVisits", "ER pharmacy dispensing episodes", "dispensing episodes/year", "จำนวน ER medication dispensing/review episodes ที่เภสัชกรให้บริการ", "ER medication episode handled by pharmacist", "exclude ER visits without pharmacy service", "Pharmacy/ER dispensing log", "independent", ["A04", "A09"]),
      w("chronicVisits", "Chronic medication-care episodes", "medication-care episodes/year", "จำนวน medication review/counselling episodes ใน chronic care", "pharmacist chronic medication service", "exclude prescription ที่นับใน OPD dispensing แล้วหากเวลามาตรฐานรวมกิจกรรมเดียวกัน", "Pharmacy chronic clinic log", "unknown", ["F10"], true),
    ]),
    dentist: Object.freeze([
      w("opdVisits", "Dental visits", "dental visits/year", "จำนวน dental visits ที่ทันตแพทย์ให้บริการจริง", "visit with dentist provider", "exclude non-dental OPD", "Dental HIS", "independent", ["F10"]),
      w("procedures", "Dental procedures", "dental procedures/year", "จำนวน dental procedures ที่ทันตแพทย์ทำจริง", "procedure with dentist operator", "exclude visit-only counts if procedure time already represented elsewhere", "Dental procedure registry", "unknown", ["F10"], true),
    ]),
    physio: Object.freeze([
      w("procedures", "Physiotherapy treatment sessions", "sessions/year", "จำนวน treatment sessions ที่นักกายภาพบำบัดให้บริการจริง", "completed physiotherapy session", "exclude appointment/no-show และ encounter ที่ไม่มี treatment", "Rehabilitation/physio system", "independent", ["RH0101", "F10"]),
      w("outreachVisits", "Physiotherapy home/community sessions", "sessions/year", "จำนวน home/community rehabilitation sessions ที่นักกายภาพทำจริง", "completed community/home rehab session", "exclude team visit without physiotherapy service", "Rehab/home visit log", "independent", ["RH0101"]),
    ]),
    psychologist: Object.freeze([
      w("mentalVisits", "Psychology assessment/counselling sessions", "sessions/year", "จำนวน assessment/counselling/psychotherapy sessions ที่นักจิตวิทยาให้บริการจริง", "completed psychologist session", "exclude physician-only mental visit และ administrative contact", "Mental health/psychology service log", "independent", ["PS0001"]),
    ]),
    public_health: Object.freeze([
      w("outreachVisits", "Public-health outreach/home/screening service units", "declared service units/year", "จำนวนหน่วยบริการเชิงรุก/เยี่ยมบ้าน/คัดกรองที่นักวิชาการสาธารณสุขทำจริง โดยต้องประกาศหน่วยนับให้ตรงกับ Activity Standard", "service unit with direct public-health professional activity", "exclude event ที่บุคลากรไม่ได้ปฏิบัติงานจริง และห้ามผสมคน/ครั้ง/event ต่างหน่วยใน numerator เดียว", "PP/HDC/outreach/home-visit registry", "independent", ["F10", "PS0001", "RH0101"]),
      w("chronicVisits", "Public-health chronic follow-up contacts", "contacts/year", "จำนวน chronic follow-up contacts ที่นักวิชาการสาธารณสุขทำจริง", "direct follow-up contact", "exclude contacts already included in outreach numerator unless deduplicated", "NCD/community registry", "unknown", ["F10"], true),
    ]),
  });

  const healthKpis = Object.freeze({
    A01: { code:"A01", name:"Crude Death Rate", unit:"%", direction:"low", threshold:"< 3.5", source:"NCO_INDICATOR_STANDARD.md" },
    A04: { code:"A04", name:"AMI Mortality", unit:"%", direction:"low", threshold:"< 8", source:"NCO_INDICATOR_STANDARD.md" },
    A09: { code:"A09", name:"Septicemia / Sepsis Mortality", unit:"%", direction:"low", threshold:"< 20", source:"NCO_INDICATOR_STANDARD.md" },
    B01: { code:"B01", name:"Maternal Mortality", unit:"/100k", direction:"low", threshold:"< 70", source:"NCO_INDICATOR_STANDARD.md" },
    C02: { code:"C02", name:"CMI", unit:"AdjRW", direction:"high", threshold:"> 1.5", source:"NCO_INDICATOR_STANDARD.md" },
    D01: { code:"D01", name:"Bed Occupancy", unit:"%", direction:"range", threshold:"80-85", source:"NCO_INDICATOR_STANDARD.md" },
    F10: { code:"F10", name:"Referral leakage to tertiary", unit:"%", direction:"low", threshold:"< 15", source:"NCO_INDICATOR_STANDARD.md" },
    DH0101: { code:"DH0101", name:"STEMI Mortality", unit:"%", direction:"low", threshold:"< 12%", source:"NCO_INDICATOR_STANDARD.md" },
    DH0102: { code:"DH0102", name:"AMI Mortality", unit:"%", direction:"low", threshold:null, source:"API/district_baseline_store.py" },
    DN0101: { code:"DN0101", name:"Stroke Mortality", unit:"%", direction:"low", threshold:"< 15%", source:"NCO_INDICATOR_STANDARD.md" },
    DN0142D: { code:"DN0142D", name:"Ischemic Stroke Death with rtPA", unit:"%", direction:"low", threshold:"< 1%", source:"NCO_INDICATOR_STANDARD.md" },
    CI0101: { code:"CI0101", name:"Sepsis Mortality", unit:"%", direction:"low", threshold:"< 20%", source:"NCO_INDICATOR_STANDARD.md" },
    PE0102: { code:"PE0102", name:"Pediatric Pneumonia Mortality", unit:"%", direction:"low", threshold:null, source:"API/district_baseline_store.py" },
    CM0203: { code:"CM0203", name:"Neonatal Mortality", unit:"/1000", direction:"low", threshold:"< 10/1000", source:"NCO_INDICATOR_STANDARD.md" },
    CM0101: { code:"CM0101", name:"Maternal Mortality", unit:"/100k", direction:"low", threshold:"< 70/100k", source:"NCO_INDICATOR_STANDARD.md" },
    DC0401: { code:"DC0401", name:"Cancer Mortality", unit:"", direction:"low", threshold:null, source:"API/district_baseline_store.py" },
    DG0201: { code:"DG0201", name:"Perforated Appendicitis", unit:"", direction:"low", threshold:null, source:"API/district_baseline_store.py" },
    PS0001: { code:"PS0001", name:"Suicide Rate", unit:"", direction:"low", threshold:null, source:"API/district_baseline_store.py" },
    RH0101: { code:"RH0101", name:"Stroke Rehabilitation Coverage", unit:"", direction:"high", threshold:null, source:"API/district_baseline_store.py" },
  });

  window.NCO_HR_PROFESSION_DICTIONARY = Object.freeze({
    version: "2026-09-18",
    workloadDefinitions,
    healthKpis,
    overlapOptions: Object.freeze(["independent", "exclusive", "deduplicated", "unknown"]),
    note: "Health KPI is outcome context only; association does not prove staffing causality.",
  });
})();
