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
      w("opdVisits", "OPD ที่แพทย์ตรวจจริง", "physician visits/year", "physician OPD encounters: จำนวนครั้งที่ผู้ป่วยนอกได้รับการประเมิน/ตรวจโดยแพทย์จริง ไม่ใช่ Total OPD ของโรงพยาบาล", "visit ที่มี provider profession = physician หรือมีหลักฐาน physician encounter", "exclude nurse-only, dental, physiotherapy, pharmacy-only และบริการวิชาชีพอื่นที่ไม่มีแพทย์ตรวจ", "HIS encounter/provider table หรือรายงานแพทย์ตรวจ OPD", "deduplicated", ["A01", "F10"], true),
      w("ipdAdmissions", "IPD admission ที่แพทย์รับผิดชอบ", "admissions/year", "จำนวน IPD admissions ที่มีแพทย์รับผิดชอบตามนิยามเดียวกับ Activity Standard นาที/admission", "admission ที่อยู่ในความรับผิดชอบของแพทย์/ทีมแพทย์ที่กำลังวิเคราะห์", "exclude admission ที่อยู่นอก scope หรือไม่มี physician workload ตามนิยาม", "HIS/DRG admission + attending physician", "independent", ["A01", "C02", "D01", "F10"]),
      w("erVisits", "ER ที่แพทย์ประเมิน", "physician ER visits/year", "จำนวน ER encounters ที่มีการประเมินโดยแพทย์จริง", "ER visit ที่มี physician assessment/provider", "exclude triage/nurse-only encounter ที่ไม่มีแพทย์ประเมิน", "ER HIS/provider log", "deduplicated", ["DH0102", "CI0101", "DH0101", "DN0101", "DN0142D"], true),
      w("procedures", "หัตถการ/ผ่าตัดที่แพทย์ทำ", "procedures/year", "จำนวน procedure/OR case ที่แพทย์ทำจริงและหน่วยนับตรงกับนาที/procedure", "procedure ที่แพทย์เป็น operator/ผู้ทำตามนิยาม", "exclude procedure ที่นับอยู่ใน encounter อื่นแล้วหากเวลามาตรฐาน encounter รวม procedure ไว้", "OR log/procedure registry/operator field", "unknown", ["C02", "F10", "DG0201", "DC0401"], true),
      w("deliveries", "การคลอดที่แพทย์เข้าร่วมดูแล", "deliveries/year", "จำนวนการคลอดที่มีแพทย์ปฏิบัติงานตามบทบาทที่นิยามไว้", "delivery ที่มี physician attendance/intervention ตามเกณฑ์พื้นที่", "exclude delivery ที่ไม่มี physician work ตาม standard นี้", "Labour room log/operative delivery record", "independent", ["B01", "CM0101", "CM0203"]),
      w("chronicVisits", "NCD/โรคเรื้อรังที่แพทย์ตรวจ", "physician chronic visits/year", "จำนวน chronic/NCD encounters ที่แพทย์ตรวจจริงและต้องไม่ซ้ำกับ Doctor OPD encounters ที่นำมาคำนวณ", "physician NCD/chronic encounter ที่แยกออกจาก OPD numerator ได้", "exclude encounter ที่รวมอยู่ใน Doctor OPD volume แล้ว เว้นแต่ OPD numerator ถูกหักออกอย่างชัดเจน", "NCD registry + provider field", "unknown", ["A01", "F10"], true),
      w("mentalVisits", "บริการสุขภาพจิตที่แพทย์ตรวจ", "physician mental visits/year", "จำนวน mental-health encounters ที่แพทย์ตรวจจริงและไม่ซ้ำกับ Doctor OPD numerator", "psychiatric/mental encounter with physician provider", "exclude psychologist-only/counsellor-only และ encounter ที่ถูกนับใน Doctor OPD แล้วโดยไม่หักซ้ำ", "Mental health HIS/provider registry", "unknown", ["PS0001", "A01"], true),
      w("outreachVisits", "เยี่ยมบ้าน/บริการเชิงรุกที่แพทย์ให้บริการ", "physician contacts/year", "จำนวน outreach/home/community contacts ที่แพทย์ให้บริการจริงตามหน่วยที่กำหนด", "contact ที่แพทย์มี direct service activity", "exclude team outreach ที่แพทย์ไม่ได้ให้บริการโดยตรง", "Home visit/outreach roster", "independent", ["F10"]),
    ]),
    nurse: Object.freeze([
      w("opdVisits", "OPD contact ที่พยาบาลให้บริการ", "nursing contacts/year", "จำนวน OPD service contacts ที่พยาบาลทำกิจกรรมตาม Activity Standard ของพยาบาล", "nursing assessment/procedure/contact ที่มีบันทึกจริง", "exclude งานที่ไม่มี nursing activity ตามนิยาม", "Nursing/HIS service log", "deduplicated", ["A01", "F10"], true),
      w("ipdAdmissions", "วันนอนผู้ป่วยในที่ทีมพยาบาลดูแล (patient-days)", "patient-days/year", "จำนวน patient-days ที่พยาบาลดูแลผู้ป่วยใน ใช้คู่กับ Activity Standard นาที/patient-day; ไม่ใช่ IPD admissions", "occupied inpatient patient-days ใน scope ของทีมพยาบาล", "exclude admissions count เมื่อ standard เป็นนาที/patient-day", "IPD census/bed-day report", "independent", ["A01", "A09", "D01", "CI0101"]),
      w("erVisits", "ER encounter ที่พยาบาลดูแล", "nursing ER encounters/year", "จำนวน ER encounters ที่มี nursing workload ตามนิยาม", "triage/ER nursing care ที่บันทึกจริง", "exclude contact ที่ไม่มี nursing service", "ER nursing log/HIS", "deduplicated", ["DH0102", "CI0101", "DH0101", "DN0101"], true),
      w("procedures", "หัตถการที่พยาบาลทำ", "nursing procedures/year", "จำนวน nursing procedures ที่หน่วยนับตรงกับนาที/procedure", "procedure ที่พยาบาลเป็นผู้ปฏิบัติ", "exclude procedure ที่รวมอยู่ใน encounter standard แล้วหากจะทำให้นับเวลาซ้ำ", "Nursing procedure log", "unknown", ["A09", "CI0101"], true),
      w("deliveries", "การคลอดที่ทีมพยาบาล/ผดุงครรภ์ดูแล", "deliveries/year", "จำนวน delivery cases ที่พยาบาล/พยาบาลผดุงครรภ์ปฏิบัติงานตาม standard", "delivery ใน labour room ที่ทีมพยาบาลดูแล", "exclude cases outside scope", "Labour room registry", "independent", ["B01", "CM0101", "CM0203"]),
      w("chronicVisits", "NCD/โรคเรื้อรังที่พยาบาลให้บริการ", "nursing chronic contacts/year", "จำนวน nurse-led NCD/chronic contacts ที่มี nursing activity จริง", "nurse-led chronic care contacts", "exclude contact ที่ถูกนับซ้ำใน OPD nursing numerator โดยไม่ deduplicate", "NCD clinic/HIS provider log", "unknown", ["F10"], true),
      w("mentalVisits", "บริการสุขภาพจิตที่พยาบาลให้บริการ", "nursing mental contacts/year", "จำนวน mental-health nursing contacts จริง", "mental-health nursing encounter", "exclude duplicate OPD contact unless deduplicated", "Mental health service log", "unknown", ["PS0001"], true),
      w("outreachVisits", "เยี่ยมบ้าน/บริการเชิงรุกที่พยาบาลให้บริการ", "nursing contacts/year", "จำนวน home visit/outreach contacts ที่พยาบาลให้บริการจริง", "direct nursing outreach/home-care contact", "exclude team events without nursing service", "Home visit/community nursing log", "independent", ["RH0101", "F10"]),
    ]),
    pharmacist: Object.freeze([
      w("opdVisits", "ใบสั่งยา/การจ่ายยา OPD ที่เภสัชกรให้บริการ", "prescriptions/year", "จำนวน prescriptions หรือ dispensing episodes ที่เภสัชกรให้บริการจริง ไม่ใช่ OPD visits", "prescription/dispensing episode ที่ผ่าน pharmacist workflow", "exclude OPD visit ที่ไม่มี pharmacy workload", "Pharmacy dispensing system", "independent", ["A01", "F10"]),
      w("ipdAdmissions", "งานทบทวน/จ่ายยา IPD ของเภสัชกร", "medication episodes/year", "จำนวน inpatient medication review/dispensing episodes ตามหน่วยเดียวกับ standard", "IPD medication episode ที่เภสัชกรทำงานจริง", "exclude admission count ถ้าไม่ได้เท่ากับ 1 pharmacy episode", "Pharmacy/IPD medication system", "independent", ["A09", "C02"]),
      w("erVisits", "การจ่ายยา/ทบทวนยา ER ของเภสัชกร", "dispensing episodes/year", "จำนวน ER medication dispensing/review episodes ที่เภสัชกรให้บริการ", "ER medication episode handled by pharmacist", "exclude ER visits without pharmacy service", "Pharmacy/ER dispensing log", "independent", ["A04", "A09"]),
      w("chronicVisits", "งานดูแลด้านยาในคลินิกโรคเรื้อรัง", "medication-care episodes/year", "จำนวน medication review/counselling episodes ใน chronic care", "pharmacist chronic medication service", "exclude prescription ที่นับใน OPD dispensing แล้วหากเวลามาตรฐานรวมกิจกรรมเดียวกัน", "Pharmacy chronic clinic log", "unknown", ["F10"], true),
    ]),
    dentist: Object.freeze([
      w("opdVisits", "ผู้รับบริการทันตกรรมที่ทันตแพทย์ตรวจ", "dental visits/year", "จำนวน dental visits ที่ทันตแพทย์ให้บริการจริง", "visit with dentist provider", "exclude non-dental OPD", "Dental HIS", "independent", ["F10"]),
      w("procedures", "หัตถการทันตกรรมที่ทันตแพทย์ทำ", "dental procedures/year", "จำนวน dental procedures ที่ทันตแพทย์ทำจริง", "procedure with dentist operator", "exclude visit-only counts if procedure time already represented elsewhere", "Dental procedure registry", "unknown", ["F10"], true),
    ]),
    physio: Object.freeze([
      w("procedures", "ครั้งการรักษากายภาพบำบัด", "sessions/year", "จำนวน treatment sessions ที่นักกายภาพบำบัดให้บริการจริง", "completed physiotherapy session", "exclude appointment/no-show และ encounter ที่ไม่มี treatment", "Rehabilitation/physio system", "independent", ["RH0101", "F10"]),
      w("outreachVisits", "ครั้งกายภาพบำบัดที่บ้าน/ชุมชน", "sessions/year", "จำนวน home/community rehabilitation sessions ที่นักกายภาพทำจริง", "completed community/home rehab session", "exclude team visit without physiotherapy service", "Rehab/home visit log", "independent", ["RH0101"]),
    ]),
    psychologist: Object.freeze([
      w("mentalVisits", "ครั้งประเมิน/ให้คำปรึกษาโดยนักจิตวิทยา", "sessions/year", "จำนวน assessment/counselling/psychotherapy sessions ที่นักจิตวิทยาให้บริการจริง", "completed psychologist session", "exclude physician-only mental visit และ administrative contact", "Mental health/psychology service log", "independent", ["PS0001"]),
    ]),
    public_health: Object.freeze([
      w("outreachVisits", "หน่วยบริการเชิงรุก/เยี่ยมบ้าน/คัดกรองของนักวิชาการสาธารณสุข", "declared service units/year", "จำนวนหน่วยบริการเชิงรุก/เยี่ยมบ้าน/คัดกรองที่นักวิชาการสาธารณสุขทำจริง โดยต้องประกาศหน่วยนับให้ตรงกับ Activity Standard", "service unit with direct public-health professional activity", "exclude event ที่บุคลากรไม่ได้ปฏิบัติงานจริง และห้ามผสมคน/ครั้ง/event ต่างหน่วยใน numerator เดียว", "PP/HDC/outreach/home-visit registry", "independent", ["F10", "PS0001", "RH0101"]),
      w("chronicVisits", "ครั้งติดตามผู้ป่วยโรคเรื้อรังโดยนักวิชาการสาธารณสุข", "contacts/year", "จำนวน chronic follow-up contacts ที่นักวิชาการสาธารณสุขทำจริง", "direct follow-up contact", "exclude contacts already included in outreach numerator unless deduplicated", "NCD/community registry", "unknown", ["F10"], true),
    ]),
  });

  // HIS extraction guidance is intentionally conceptual because field/table names vary by HIS vendor.
  // It tells data teams what to COUNT and how to link the workload to the profession.
  const hisExtractionGuide = Object.freeze({
    doctor: Object.freeze({
      opdVisits: Object.freeze({
        counting_basis: "distinct OPD visit/VN",
        provider_rule: "นับเฉพาะ visit ที่มีแพทย์เป็นผู้ตรวจ/ผู้ให้บริการ (physician provider)",
        his_extract_rule: "COUNT DISTINCT visit/VN ในช่วงปีงบประมาณ WHERE มี provider วิชาชีพแพทย์; ไม่ใช้ Total OPD ของ รพ.",
        his_fields_hint: "visit/VN, วันที่รับบริการ, provider_id/provider_profession, clinic/department"
      }),
      ipdAdmissions: Object.freeze({
        counting_basis: "distinct IPD admission/AN",
        provider_rule: "นับ admission ที่มีแพทย์รับผิดชอบ/attending physician ใน scope ที่วิเคราะห์",
        his_extract_rule: "COUNT DISTINCT AN ที่มี attending/responsible physician; ถ้า HIS มีหลายแพทย์ต่อ AN ให้นับ AN ครั้งเดียวต่อ scope",
        his_fields_hint: "AN, admit/discharge date, attending/responsible physician, ward/service"
      }),
      erVisits: Object.freeze({
        counting_basis: "distinct ER visit",
        provider_rule: "นับเฉพาะ ER visit ที่มี physician assessment",
        his_extract_rule: "COUNT DISTINCT ER visit/VN WHERE มีบันทึกแพทย์ประเมินหรือ provider=physician",
        his_fields_hint: "ER visit id/VN, visit date, provider profession, ER disposition"
      }),
      procedures: Object.freeze({
        counting_basis: "distinct procedure/OR case",
        provider_rule: "นับ procedure ที่แพทย์เป็น operator/ผู้ทำจริง",
        his_extract_rule: "COUNT procedure/OR case WHERE operator/provider เป็นแพทย์ใน scope; ใช้ case id เดียวกันเพื่อกันซ้ำ",
        his_fields_hint: "procedure/OR case id, procedure code, operator/provider, procedure date"
      }),
      deliveries: Object.freeze({
        counting_basis: "distinct delivery case",
        provider_rule: "นับ delivery ที่มีแพทย์เข้าร่วมตามบทบาทที่นิยาม",
        his_extract_rule: "COUNT DISTINCT delivery case WHERE มี physician attendance/intervention ตามเกณฑ์ของ รพ.",
        his_fields_hint: "delivery id/AN, delivery date, mode of delivery, physician/provider"
      }),
      chronicVisits: Object.freeze({
        counting_basis: "distinct chronic/NCD encounter",
        provider_rule: "นับ encounter NCD ที่แพทย์ตรวจจริง",
        his_extract_rule: "COUNT DISTINCT visit/VN ของคลินิก NCD WHERE provider=physician และต้องตัดรายการที่ถูกนับใน Doctor OPD ถ้าใช้สองแถวพร้อมกัน",
        his_fields_hint: "visit/VN, NCD clinic/service code, diagnosis, provider profession"
      }),
      mentalVisits: Object.freeze({
        counting_basis: "distinct mental-health encounter",
        provider_rule: "นับ encounter จิตเวชที่แพทย์ตรวจจริง",
        his_extract_rule: "COUNT DISTINCT visit/VN ของบริการ mental/psychiatric WHERE provider=physician; ไม่รวม psychologist-only/counsellor-only",
        his_fields_hint: "visit/VN, mental clinic/service, diagnosis, provider profession"
      }),
      outreachVisits: Object.freeze({
        counting_basis: "distinct physician direct-service contact",
        provider_rule: "นับเฉพาะ home/community contact ที่แพทย์ให้บริการโดยตรง",
        his_extract_rule: "COUNT contact/visit ที่มี physician participation จริงจาก home visit/outreach roster; ไม่ใช้จำนวน event ทั้งทีม",
        his_fields_hint: "contact/event id, date, patient/HN (ถ้ามี), provider/profession, service type"
      })
    }),
    nurse: Object.freeze({
      opdVisits: Object.freeze({
        counting_basis: "distinct nursing OPD service contact",
        provider_rule: "นับ contact ที่มี nursing assessment/procedure/service บันทึกจริง",
        his_extract_rule: "COUNT DISTINCT service contact/VN ที่มี nursing activity code หรือ nurse provider; ถ้า HIS ไม่เก็บ provider พยาบาลให้ใช้ nursing service log",
        his_fields_hint: "visit/VN, nursing activity/service code, nurse/provider, clinic"
      }),
      ipdAdmissions: Object.freeze({
        counting_basis: "patient-days",
        provider_rule: "เป็น team workload ของหน่วยพยาบาล ไม่ต้องผูกกับพยาบาลรายบุคคล",
        his_extract_rule: "SUM occupied patient-days ของ ward ในปีงบประมาณ; ไม่ใช้จำนวน admissions เมื่อ Activity Standard เป็นนาที/patient-day",
        his_fields_hint: "AN, ward, admit date, discharge date, daily census/occupied bed-days"
      }),
      erVisits: Object.freeze({
        counting_basis: "distinct ER nursing encounter",
        provider_rule: "นับ ER encounter ที่มี triage/ER nursing care",
        his_extract_rule: "COUNT DISTINCT ER visit ที่มี nursing service/triage record",
        his_fields_hint: "ER visit id/VN, triage record, nursing activity, date"
      }),
      procedures: Object.freeze({
        counting_basis: "nursing procedure count",
        provider_rule: "นับ procedure ที่พยาบาลเป็นผู้ปฏิบัติจริง",
        his_extract_rule: "COUNT procedure/service code ของงานพยาบาลตามรายการที่กำหนด; กันซ้ำกับ encounter standard หากรวมเวลาไว้แล้ว",
        his_fields_hint: "procedure/service id, service code, performer/provider profession, date"
      }),
      deliveries: Object.freeze({
        counting_basis: "delivery cases",
        provider_rule: "นับ delivery case ที่ทีมพยาบาล/ผดุงครรภ์ดูแล",
        his_extract_rule: "COUNT DISTINCT delivery case จาก labour room registry ใน scope",
        his_fields_hint: "delivery id/AN, labour room, delivery date, nursing/midwife service"
      }),
      chronicVisits: Object.freeze({
        counting_basis: "nurse-led chronic contact",
        provider_rule: "นับ contact NCD ที่มี nurse-led activity จริง",
        his_extract_rule: "COUNT DISTINCT chronic/NCD service contact ที่มี nursing activity; deduplicate กับ Nursing OPD ถ้าใช้ทั้งสอง numerator",
        his_fields_hint: "visit/VN, chronic clinic, nursing service/activity, provider"
      }),
      mentalVisits: Object.freeze({
        counting_basis: "mental-health nursing contact",
        provider_rule: "นับ contact ที่มี mental-health nursing activity",
        his_extract_rule: "COUNT DISTINCT contact/session ที่พยาบาลให้บริการสุขภาพจิตจริง",
        his_fields_hint: "visit/session id, mental service code, nurse/provider, date"
      }),
      outreachVisits: Object.freeze({
        counting_basis: "nursing home/outreach contact",
        provider_rule: "นับ direct nursing contact ไม่ใช่จำนวน event ทั้งทีม",
        his_extract_rule: "COUNT DISTINCT home visit/outreach contact ที่มีพยาบาลเป็นผู้ให้บริการ",
        his_fields_hint: "home visit/contact id, date, provider/profession, service type"
      })
    }),
    pharmacist: Object.freeze({
      opdVisits: Object.freeze({
        counting_basis: "prescription/dispensing episode",
        provider_rule: "นับ transaction ที่ผ่าน workflow เภสัชกร",
        his_extract_rule: "COUNT DISTINCT prescription/dispensing episode ของ OPD; ไม่ใช้จำนวน OPD visit",
        his_fields_hint: "prescription/dispense id, dispense date, pharmacy department, pharmacist/provider"
      }),
      ipdAdmissions: Object.freeze({
        counting_basis: "IPD medication review/dispensing episode",
        provider_rule: "นับ episode ที่เภสัชกรให้บริการจริง",
        his_extract_rule: "COUNT medication review/dispensing episode ของ IPD ตามหน่วยที่กำหนด; ไม่ใช้ AN แทนถ้า 1 AN มีหลาย episode",
        his_fields_hint: "AN, medication episode/order id, dispense/review date, pharmacist/provider"
      }),
      erVisits: Object.freeze({
        counting_basis: "ER dispensing/review episode",
        provider_rule: "นับ episode ยาที่เภสัชกรให้บริการแก่ ER",
        his_extract_rule: "COUNT DISTINCT ER pharmacy dispensing/review episode",
        his_fields_hint: "ER visit/VN, prescription/dispense id, pharmacy service, date"
      }),
      chronicVisits: Object.freeze({
        counting_basis: "chronic medication-care episode",
        provider_rule: "นับ medication review/counselling ที่เภสัชกรทำจริง",
        his_extract_rule: "COUNT chronic medication review/counselling episode; deduplicate กับ OPD dispensing ถ้าเป็นกิจกรรมเดียวกัน",
        his_fields_hint: "visit/VN, medication-care service code, pharmacist/provider, date"
      })
    }),
    dentist: Object.freeze({
      opdVisits: Object.freeze({
        counting_basis: "dental visit",
        provider_rule: "นับ visit ที่มีทันตแพทย์เป็น provider",
        his_extract_rule: "COUNT DISTINCT dental visit WHERE provider profession=dentist",
        his_fields_hint: "dental visit id/VN, provider, service date"
      }),
      procedures: Object.freeze({
        counting_basis: "dental procedure",
        provider_rule: "นับ procedure ที่ทันตแพทย์เป็น operator",
        his_extract_rule: "COUNT dental procedure code/case ที่ทันตแพทย์ทำจริง",
        his_fields_hint: "procedure id/code, tooth/site (ถ้ามี), dentist/operator, date"
      })
    }),
    physio: Object.freeze({
      procedures: Object.freeze({
        counting_basis: "completed physiotherapy session",
        provider_rule: "นับ session ที่นักกายภาพให้ treatment จริง",
        his_extract_rule: "COUNT DISTINCT completed treatment session; exclude appointment/no-show",
        his_fields_hint: "session id, service code, therapist/provider, session date, status"
      }),
      outreachVisits: Object.freeze({
        counting_basis: "completed home/community rehab session",
        provider_rule: "นับ session ที่นักกายภาพให้บริการจริง",
        his_extract_rule: "COUNT DISTINCT home/community rehab session ที่มี physiotherapist provider",
        his_fields_hint: "session/contact id, therapist, service type, date"
      })
    }),
    psychologist: Object.freeze({
      mentalVisits: Object.freeze({
        counting_basis: "completed psychology session",
        provider_rule: "นับ assessment/counselling/psychotherapy ที่นักจิตวิทยาเป็นผู้ให้บริการ",
        his_extract_rule: "COUNT DISTINCT completed psychology session; ไม่รวม physician-only encounter",
        his_fields_hint: "session/visit id, psychology service code, psychologist/provider, date"
      })
    }),
    public_health: Object.freeze({
      outreachVisits: Object.freeze({
        counting_basis: "declared public-health service unit",
        provider_rule: "นับเฉพาะหน่วยบริการที่นักวิชาการสาธารณสุขปฏิบัติงานจริง",
        his_extract_rule: "กำหนดหน่วยให้ชัดก่อน (คน/ครั้ง/event) แล้ว COUNT หน่วยนั้นจาก PP/outreach/home-visit registry ห้ามผสมหน่วยใน numerator เดียว",
        his_fields_hint: "service/contact/event id, service type, provider/profession, date"
      }),
      chronicVisits: Object.freeze({
        counting_basis: "public-health chronic follow-up contact",
        provider_rule: "นับ follow-up ที่นักวิชาการสาธารณสุขให้บริการโดยตรง",
        his_extract_rule: "COUNT DISTINCT chronic follow-up contact; deduplicate กับ outreach ถ้าเป็น contact เดียวกัน",
        his_fields_hint: "contact/visit id, chronic program, provider/profession, date"
      })
    })
  });

  const CMI_BASE = "https://cmi.maewanghospital.go.th/web/index.php";
  const serviceUrl = (code) => `${CMI_BASE}?co_thip_new=${encodeURIComponent(code)}&r=service%2Findex`;
  const reportUrl = (code) => `${CMI_BASE}?id=${encodeURIComponent(code)}&r=report%2Fdrgindexreport`;

  // Display policy for Health_KPI_History.
  // A04 and DH0102 both present as AMI mortality labels in the merged catalogs.
  // We show the Service Plan code DH0102 by default, but DO NOT migrate A04 values
  // automatically because numerator/denominator equivalence must be verified first.
  const kpiAliases = Object.freeze({});
  const kpiDisplayExclusions = Object.freeze({
    A04: { prefer: "DH0102", reason: "duplicate AMI label across Core Outcome and Service Plan catalogs; definitions must be verified before value migration" },
  });

  const healthKpis = Object.freeze({
    A01: { code:"A01", name:"Crude Death Rate", unit:"%", direction:"low", threshold:"< 3.5", sourceSystem:"CMI/DRG outcome", sourceUrl:reportUrl("A01") },
    A04: { code:"A04", name:"AMI Mortality (Core Outcome)", unit:"%", direction:"low", threshold:"< 8", sourceSystem:"Core Outcome / DRG report", sourceUrl:reportUrl("A04"), display:false, duplicateLabelOf:"DH0102" },
    A09: { code:"A09", name:"Septicemia / Sepsis Mortality (Core Outcome)", unit:"%", direction:"low", threshold:"< 20", sourceSystem:"Core Outcome / DRG report", sourceUrl:reportUrl("A09") },
    B01: { code:"B01", name:"Maternal Mortality (Core Outcome)", unit:"/100k", direction:"low", threshold:"< 70", sourceSystem:"Core Outcome / DRG report", sourceUrl:reportUrl("B01") },
    C02: { code:"C02", name:"CMI", unit:"AdjRW", direction:"high", threshold:"> 1.5", sourceSystem:"CMI main report", sourceUrl:CMI_BASE },
    D01: { code:"D01", name:"Bed Occupancy", unit:"%", direction:"range", threshold:"80-85", sourceSystem:"CMI main report", sourceUrl:CMI_BASE },
    F10: { code:"F10", name:"Referral leakage to tertiary", unit:"%", direction:"low", threshold:"< 15", sourceSystem:"NCO context", sourceUrl:"" },

    DH0101: { code:"DH0101", name:"STEMI Mortality", unit:"%", direction:"low", threshold:"< 12%", sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("DH0101") },
    DH0102: { code:"DH0102", name:"AMI Mortality", unit:"%", direction:"low", threshold:null, sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("DH0102") },
    DN0101: { code:"DN0101", name:"Stroke Mortality", unit:"%", direction:"low", threshold:"< 15%", sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("DN0101") },
    DN0142D: { code:"DN0142D", name:"Ischemic Stroke Death with rtPA", unit:"%", direction:"low", threshold:"< 1%", sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("DN0142D") },
    CI0101: { code:"CI0101", name:"Sepsis Mortality", unit:"%", direction:"low", threshold:"< 20%", sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("CI0101") },
    PE0102: { code:"PE0102", name:"Pediatric Pneumonia Mortality", unit:"%", direction:"low", threshold:null, sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("PE0102") },
    CM0203: { code:"CM0203", name:"Neonatal Mortality", unit:"/1000", direction:"low", threshold:"< 10/1000", sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("CM0203") },
    CM0101: { code:"CM0101", name:"Maternal Mortality", unit:"/100k", direction:"low", threshold:"< 70/100k", sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("CM0101") },
    DC0401: { code:"DC0401", name:"Cancer Mortality", unit:"", direction:"low", threshold:null, sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("DC0401") },
    DG0201: { code:"DG0201", name:"Perforated Appendicitis", unit:"", direction:"low", threshold:null, sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("DG0201") },
    PS0001: { code:"PS0001", name:"Suicide Rate", unit:"", direction:"low", threshold:null, sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("PS0001") },
    RH0101: { code:"RH0101", name:"Stroke Rehabilitation Coverage", unit:"", direction:"high", threshold:null, sourceSystem:"CMI Service Plan", sourceUrl:serviceUrl("RH0101") },
  });;

  window.NCO_HR_PROFESSION_DICTIONARY = Object.freeze({
    version: "2026-09-18",
    workloadDefinitions,
    hisExtractionGuide,
    healthKpis,
    kpiAliases,
    kpiDisplayExclusions,
    overlapOptions: Object.freeze(["independent", "exclusive", "deduplicated", "unknown"]),
    note: "Health KPI is outcome context only; association does not prove staffing causality.",
  });
})();
