// Profession-specific workload, Data Fitness Gate, and Health Outcome KPI linkage.
// Loaded after the collaborative profile + friendly Excel layers.
// Policy: facility totals may be used for diagnostics, but shortage/surplus decisions require verified profession-specific workload.

(() => {
  "use strict";

  const EXTENSION_VERSION = 1;
  const EXTENSION_SHEETS = ["Profession_Workload_History", "Health_KPI_History"];
  const EXTENSION_SECTIONS = ["ProfessionWorkload", "HealthKPI"];
  const ALLOWED_OVERLAP_RULES = new Set(["independent", "mutually_exclusive", "subset_excluded", "incremental"]);

  for (const sheetName of EXTENSION_SHEETS) {
    if (!NCO_PROFILE_SHEETS.includes(sheetName)) NCO_PROFILE_SHEETS.push(sheetName);
  }
  for (const section of EXTENSION_SECTIONS) {
    if (!PROFILE_SECTIONS.includes(section)) PROFILE_SECTIONS.push(section);
  }

  state.professionWorkloadHistory ||= [];
  state.healthKpiHistory ||= [];
  state.dataFitnessResults ||= [];

  const ACTIVITY_LABELS = Object.freeze({
    opdVisits: "OPD / Ambulatory",
    ipdAdmissions: "IPD / Inpatient",
    erVisits: "ER / Emergency",
    procedures: "OR / Procedure",
    deliveries: "Delivery",
    chronicVisits: "Chronic / NCD",
    mentalVisits: "Mental health",
    outreachVisits: "Outreach / PP",
  });

  const UNIT_LABELS = Object.freeze({
    visit: { workload: "visit/ปี", standard: "นาที/visit" },
    admission: { workload: "admission/ปี", standard: "นาที/admission" },
    patient_day: { workload: "patient-day/ปี", standard: "นาที/patient-day" },
    encounter: { workload: "encounter/ปี", standard: "นาที/encounter" },
    case: { workload: "case/ปี", standard: "นาที/case" },
    procedure: { workload: "procedure/ปี", standard: "นาที/procedure" },
    delivery: { workload: "delivery/ปี", standard: "นาที/delivery" },
    prescription: { workload: "prescription/ปี", standard: "นาที/prescription" },
    medication_case: { workload: "medication case/ปี", standard: "นาที/medication case" },
    session: { workload: "session/ปี", standard: "นาที/session" },
    contact: { workload: "contact/ปี", standard: "นาที/contact" },
    screening: { workload: "screening/ปี", standard: "นาที/screening" },
  });

  const PROFESSION_WORKLOAD_DEFINITIONS = Object.freeze({
    doctor: {
      opdVisits: {
        metric: "Physician OPD encounters",
        unitKey: "visit",
        definition: "จำนวน OPD encounter ที่แพทย์เป็นผู้ตรวจหรือผู้ให้บริการหลักจริงในปีนั้น",
        include: "provider profession = physician / doctor และมี encounter ที่ตรวจสอบย้อนกลับได้",
        exclude: "ไม่ใช่ยอด OPD รวมของโรงพยาบาล; ตัด nurse-only, dental, physio, pharmacy-only และบริการที่ไม่มีแพทย์ตรวจ",
        note: "Physician OPD ต้องดึงจาก provider/encounter จริง ไม่ใช้ Total OPD เป็นตัวแทน",
      },
      ipdAdmissions: {
        metric: "Physician-managed IPD admissions",
        unitKey: "admission",
        definition: "จำนวน IPD admission ที่แพทย์ในวิชาชีพ/ทีมนี้รับผิดชอบจริงตามนิยามที่ตกลง",
        include: "admission ที่มี responsible/admitting physician ตามแหล่งข้อมูล",
        exclude: "ไม่รวม admission ที่อยู่นอกขอบเขตทีมแพทย์นั้น และไม่ใช้ patient-day มาปนกับ admission",
        note: "ถ้าพื้นที่ใช้ rounds หรือ patient-days เป็น workload หลัก ต้องเปลี่ยนหน่วยและ Activity Standard ให้ตรงกัน",
      },
      erVisits: {
        metric: "Physician ER encounters",
        unitKey: "visit",
        definition: "จำนวน ER encounter ที่แพทย์เป็นผู้ประเมิน/รักษาจริง",
        include: "ER encounter ที่มี physician provider",
        exclude: "ตัด triage/nursing-only contact ที่ไม่มีแพทย์ประเมิน",
      },
      procedures: {
        metric: "Physician-performed procedures",
        unitKey: "procedure",
        definition: "จำนวนหัตถการ/ผ่าตัดที่แพทย์เป็นผู้ทำหรือรับผิดชอบตามนิยามเดียวกับ time standard",
        include: "procedure log ที่ระบุ operator/responsible physician",
        exclude: "ไม่รวม procedure ที่นับอยู่ใน activity อื่นแล้ว เว้นแต่ time standard เป็นเวลาส่วนเพิ่ม",
      },
      deliveries: {
        metric: "Physician-attended deliveries",
        unitKey: "delivery",
        definition: "จำนวนการคลอดที่มีแพทย์เข้าร่วมดูแลตามเกณฑ์ที่กำหนด",
        include: "delivery ที่มี physician attendance/management",
        exclude: "ไม่เหมารวมทุก delivery หากแพทย์ไม่ได้เกี่ยวข้องทุก case",
      },
      chronicVisits: {
        metric: "Physician chronic/NCD encounters",
        unitKey: "visit",
        definition: "จำนวน chronic/NCD encounter ที่แพทย์ตรวจจริงและถูกแยกจาก OPD อย่างไม่ซ้ำซ้อน",
        include: "encounter ที่มี physician provider และ extraction rule ชัดเจน",
        exclude: "ถ้า chronic visit เป็น subset ของ OPD เดิม ให้ใช้ overlap_rule=subset_excluded หรือใช้ incremental time เท่านั้น",
      },
      mentalVisits: {
        metric: "Physician mental-health encounters",
        unitKey: "visit",
        definition: "จำนวน mental-health encounter ที่แพทย์ตรวจจริง",
        include: "encounter ที่มี physician provider",
        exclude: "ไม่รวม counseling/psychotherapy ที่ทำโดยวิชาชีพอื่นถ้าไม่มีแพทย์ร่วม",
      },
      outreachVisits: {
        metric: "Physician outreach contacts",
        unitKey: "contact",
        definition: "จำนวน outreach/home/community contact ที่แพทย์เข้าร่วมให้บริการจริง",
        include: "contact ที่มี physician participation",
        exclude: "ไม่รวมกิจกรรมชุมชนทั้งหมดที่ไม่มีแพทย์ร่วม",
      },
    },
    nurse: {
      opdVisits: { metric: "Nursing OPD encounters", unitKey: "encounter", definition: "จำนวน OPD encounter ที่พยาบาลทำกิจกรรมวิชาชีพตามนิยามที่กำหนด", include: "nursing encounter/triage/procedure ที่บันทึกผู้ให้บริการ", exclude: "ไม่ใช้ Total OPD หากไม่ได้สะท้อนงานพยาบาลทุก visit" },
      ipdAdmissions: { metric: "Inpatient nursing patient-days", unitKey: "patient_day", definition: "จำนวน patient-days ที่ต้องใช้ nursing care", include: "occupied inpatient days ตาม ward scope", exclude: "ไม่ใช้จำนวน admission หาก Activity Standard เป็นนาทีต่อ patient-day" },
      erVisits: { metric: "ER nursing encounters", unitKey: "encounter", definition: "จำนวน ER encounters ที่มี nursing care", include: "triage/ER nursing encounter ตามนิยามที่ตรวจสอบได้", exclude: "ตัด contact ที่ซ้ำจากการนับซ้ำใน source" },
      procedures: { metric: "Nursing procedure cases", unitKey: "procedure", definition: "จำนวน procedure cases ที่พยาบาลมีบทบาทตาม time standard", include: "procedure/OR cases ที่ nursing team รับผิดชอบ", exclude: "ไม่รวม case ที่ไม่มีบทบาทตามนิยาม standard" },
      deliveries: { metric: "Nursing/midwifery deliveries", unitKey: "delivery", definition: "จำนวน delivery ที่พยาบาล/ผดุงครรภ์ดูแล", include: "delivery room cases ตามขอบเขตทีม", exclude: "ตัด case นอก scope" },
      chronicVisits: { metric: "Nursing chronic-care encounters", unitKey: "encounter", definition: "จำนวน chronic/NCD encounters ที่พยาบาลให้บริการจริง", include: "nurse-led/ร่วมทีม encounters", exclude: "ถ้าเป็น subset ของ OPD ต้องกำหนด overlap rule" },
      mentalVisits: { metric: "Mental-health nursing encounters", unitKey: "encounter", definition: "จำนวน mental-health encounters ที่พยาบาลให้บริการ", include: "nursing assessment/care encounters", exclude: "ไม่เหมารวมทุก mental visit หากไม่มี nursing activity ตามนิยาม" },
      outreachVisits: { metric: "Nursing outreach contacts", unitKey: "contact", definition: "จำนวน home/community contacts ที่พยาบาลให้บริการ", include: "home visit/outreach ที่มี nursing provider", exclude: "ตัดกิจกรรมที่พยาบาลไม่ได้เข้าร่วม" },
    },
    pharmacist: {
      opdVisits: { metric: "OPD prescriptions dispensed", unitKey: "prescription", definition: "จำนวนใบสั่งยาผู้ป่วยนอกที่เภสัชกรตรวจสอบ/จ่ายจริง", include: "prescription ที่ผ่าน pharmacist workflow", exclude: "ไม่ใช้จำนวน OPD visit เป็น proxy หากจำนวน prescription แตกต่าง" },
      ipdAdmissions: { metric: "IPD medication-review cases", unitKey: "medication_case", definition: "จำนวน inpatient medication review/reconciliation cases ที่เภสัชกรทำจริง", include: "case ที่มี pharmacist intervention/review", exclude: "ไม่ใช้ IPD admission ทั้งหมดหากเภสัชกรไม่ได้ review ทุก admission" },
      erVisits: { metric: "ER medication cases", unitKey: "medication_case", definition: "จำนวน ER medication cases ที่เภสัชกรให้บริการจริง", include: "ER prescription/medication intervention", exclude: "ไม่ใช้ ER visit ทั้งหมดถ้าไม่ได้มี pharmacist service" },
      chronicVisits: { metric: "Chronic medication-review encounters", unitKey: "encounter", definition: "จำนวน chronic medication review/counseling encounters", include: "เภสัชกรมี documented service", exclude: "ถ้านับรวมใน OPD prescription อยู่แล้วต้องกำหนด overlap rule" },
      mentalVisits: { metric: "Mental-health medication counseling", unitKey: "encounter", definition: "จำนวน medication counseling/review ใน mental-health service", include: "documented pharmacist service", exclude: "ไม่ใช้ mental visit ทั้งหมด" },
      outreachVisits: { metric: "Pharmacy outreach contacts", unitKey: "contact", definition: "จำนวน outreach contacts ที่เภสัชกรมีบทบาทจริง", include: "community medication review/visit", exclude: "ตัดกิจกรรมที่ไม่มี pharmacist service" },
    },
    dentist: {
      erVisits: { metric: "Dental emergency encounters", unitKey: "encounter", definition: "จำนวน dental emergency encounters ที่ทันตแพทย์รักษา", include: "dental provider encounter", exclude: "ไม่ใช้ ER visit ทั้งหมด" },
      procedures: { metric: "Dental procedures", unitKey: "procedure", definition: "จำนวน dental procedures ที่ทันตแพทย์ทำจริง", include: "procedure log/dental HIS", exclude: "ตัด procedure ของวิชาชีพอื่น" },
      outreachVisits: { metric: "Dental outreach contacts", unitKey: "contact", definition: "จำนวน outreach contacts ที่ทันตแพทย์ให้บริการ", include: "school/community dental service", exclude: "ตัดกิจกรรมที่ไม่มี dentist" },
    },
    physio: {
      ipdAdmissions: { metric: "Inpatient rehabilitation sessions", unitKey: "session", definition: "จำนวน inpatient rehab sessions ที่นักกายภาพทำจริง", include: "documented treatment session", exclude: "ไม่ใช้ IPD admission ทั้งหมดเป็น proxy" },
      procedures: { metric: "Physical-therapy treatment sessions", unitKey: "session", definition: "จำนวน treatment sessions ที่นักกายภาพทำจริง", include: "PT session record", exclude: "ตัด appointment ที่ไม่เกิดบริการ" },
      chronicVisits: { metric: "Chronic rehabilitation sessions", unitKey: "session", definition: "จำนวน rehab sessions ใน chronic condition", include: "documented PT session", exclude: "ถ้ารวมใน procedure sessions แล้วต้องกำหนด overlap rule" },
      outreachVisits: { metric: "Home/community rehabilitation visits", unitKey: "contact", definition: "จำนวน home/community rehab contacts", include: "PT home/community visit", exclude: "ตัดกิจกรรมที่ไม่มี PT provider" },
    },
    psychologist: {
      erVisits: { metric: "Crisis psychological assessments", unitKey: "encounter", definition: "จำนวน crisis/ER assessments ที่นักจิตวิทยาทำจริง", include: "documented psychologist assessment", exclude: "ไม่ใช้ ER visit ทั้งหมด" },
      chronicVisits: { metric: "Psychological chronic-care encounters", unitKey: "encounter", definition: "จำนวน counseling/behavioral encounters ใน chronic care", include: "psychologist provider encounter", exclude: "ถ้ารวมใน mental session ต้องกำหนด overlap rule" },
      mentalVisits: { metric: "Psychology assessment/counseling sessions", unitKey: "session", definition: "จำนวน assessment/counseling/psychotherapy sessions ที่นักจิตวิทยาทำจริง", include: "documented psychologist session", exclude: "ไม่ใช้ mental-health visit ทั้งหมด" },
      outreachVisits: { metric: "Psychology outreach contacts", unitKey: "contact", definition: "จำนวน outreach contacts ที่นักจิตวิทยาให้บริการ", include: "community mental-health contact", exclude: "ตัดกิจกรรมที่ไม่มี psychologist" },
    },
    public_health: {
      opdVisits: { metric: "Public-health service encounters", unitKey: "encounter", definition: "จำนวน service encounters ที่นักวิชาการสาธารณสุขให้บริการจริง", include: "documented provider/service record", exclude: "ไม่ใช้ OPD total เป็น proxy" },
      chronicVisits: { metric: "NCD screening/follow-up activities", unitKey: "screening", definition: "จำนวน screening/follow-up activities ที่นักวิชาการสาธารณสุขทำจริง", include: "documented screening/follow-up", exclude: "ถ้ารวมใน outreach ต้องกำหนด overlap rule" },
      mentalVisits: { metric: "Mental-health screening activities", unitKey: "screening", definition: "จำนวน mental-health screening activities ที่ทำจริง", include: "2Q/8Q/other documented screening by role", exclude: "ไม่ใช้ mental visit ทั้งหมด" },
      outreachVisits: { metric: "Public-health outreach activities", unitKey: "contact", definition: "จำนวน community/outreach contacts ที่นักวิชาการสาธารณสุขทำจริง", include: "documented outreach/contact", exclude: "ตัดกิจกรรมที่ทำโดยทีมอื่นโดยไม่มีบทบาทของวิชาชีพนี้" },
    },
  });

  const HEALTH_KPI_CATALOG = Object.freeze([
    { service_line: "cardiac", indicator_code: "A04", indicator_name: "AMI Mortality", unit: "%", direction: "lower_better", relation_type: "Clinical outcome", related_professions: "doctor,nurse,pharmacist" },
    { service_line: "sepsis", indicator_code: "A09", indicator_name: "Sepsis Mortality", unit: "%", direction: "lower_better", relation_type: "Clinical outcome", related_professions: "doctor,nurse,pharmacist" },
    { service_line: "maternal", indicator_code: "B01", indicator_name: "Maternal Mortality", unit: "/100k", direction: "lower_better", relation_type: "Clinical outcome", related_professions: "doctor,nurse" },
    { service_line: "network", indicator_code: "F10", indicator_name: "Referral Leakage to Tertiary", unit: "%", direction: "lower_better", relation_type: "Access / network outcome", related_professions: "doctor,nurse" },
    { service_line: "cardiac", indicator_code: "DH0101", indicator_name: "STEMI Mortality", unit: "%", direction: "lower_better", relation_type: "Clinical outcome", related_professions: "doctor,nurse,pharmacist" },
    { service_line: "stroke", indicator_code: "DN0101", indicator_name: "Stroke Mortality", unit: "%", direction: "lower_better", relation_type: "Clinical outcome", related_professions: "doctor,nurse,physio" },
    { service_line: "stroke", indicator_code: "DN0142D", indicator_name: "Ischemic Stroke Death with rtPA", unit: "%", direction: "lower_better", relation_type: "Clinical outcome", related_professions: "doctor,nurse,pharmacist" },
    { service_line: "sepsis", indicator_code: "CI0101", indicator_name: "Sepsis Mortality", unit: "%", direction: "lower_better", relation_type: "Clinical outcome", related_professions: "doctor,nurse,pharmacist" },
    { service_line: "maternal", indicator_code: "CM0101", indicator_name: "Maternal Mortality", unit: "ตามตัวชี้วัด", direction: "lower_better", relation_type: "Clinical outcome", related_professions: "doctor,nurse" },
    { service_line: "newborn", indicator_code: "CM0203", indicator_name: "Neonatal Mortality", unit: "ตามตัวชี้วัด", direction: "lower_better", relation_type: "Clinical outcome", related_professions: "doctor,nurse" },
    { service_line: "mental_health", indicator_code: "PS0001", indicator_name: "อัตราฆ่าตัวตาย", unit: "ตามตัวชี้วัด", direction: "lower_better", relation_type: "Clinical outcome", related_professions: "doctor,nurse,psychologist,public_health" },
    { service_line: "stroke", indicator_code: "RH0101", indicator_name: "Stroke ได้กายภาพ", unit: "%", direction: "higher_better", relation_type: "Service outcome", related_professions: "doctor,nurse,physio" },
  ]);

  function definitionFor(professionCode, activityCode) {
    const exact = PROFESSION_WORKLOAD_DEFINITIONS[professionCode]?.[activityCode];
    if (exact) return exact;
    const prof = typeof getProfession === "function" ? getProfession(professionCode) : null;
    return {
      metric: `${prof?.label || professionCode} ${ACTIVITY_LABELS[activityCode] || activityCode}`,
      unitKey: "case",
      definition: `จำนวนงาน ${ACTIVITY_LABELS[activityCode] || activityCode} ที่วิชาชีพ ${prof?.label || professionCode} ทำจริง`,
      include: "ต้องมีหลักฐาน provider/service record ที่ผูกกับวิชาชีพนี้",
      exclude: "ไม่ใช้ยอดรวมของหน่วยบริการที่รวมงานของวิชาชีพอื่น",
      note: "กำหนดนิยามและหน่วยให้ตรงกับ Activity Standard ก่อน Verified",
    };
  }

  function currentScopeName() {
    return String($("unitName")?.value || $("amphurName")?.value || state.provinceRow?.province || "").trim();
  }

  function defaultActivityUnit(professionCode, activityCode) {
    return definitionFor(professionCode, activityCode).unitKey || "case";
  }

  function ensureActivityUnits() {
    for (const prof of PROFESSION_DEFS) {
      state.professionConfig[prof.code] ||= getDefaultWisn(prof);
      state.professionConfig[prof.code].activityUnits ||= {};
      for (const activity of ACTIVITY_DEFS) {
        state.professionConfig[prof.code].activityUnits[activity.code] ||= defaultActivityUnit(prof.code, activity.code);
      }
    }
  }

  function defaultProfessionWorkloadRows() {
    ensureActivityUnits();
    const rows = [];
    const selected = Array.from(state.selectedProfessions || []);
    for (const code of selected) {
      const prof = getProfession(code);
      const cfg = state.professionConfig[code] || getDefaultWisn(prof);
      for (const year of years()) {
        for (const activity of ACTIVITY_DEFS) {
          const standard = nullableNumber(cfg.activityMinutes?.[activity.code]) ?? 0;
          if (standard <= 0) continue;
          const def = definitionFor(code, activity.code);
          const unitKey = cfg.activityUnits?.[activity.code] || def.unitKey || "case";
          const units = UNIT_LABELS[unitKey] || UNIT_LABELS.case;
          rows.push({
            year,
            profession_code: code,
            profession_label: prof?.label || code,
            activity_code: activity.code,
            activity_label: ACTIVITY_LABELS[activity.code] || activity.label || activity.code,
            workload_metric: def.metric,
            volume: null,
            unit: units.workload,
            standard_unit: units.standard,
            definition: def.definition,
            include_rule: def.include,
            exclude_rule: def.exclude,
            source: "",
            overlap_rule: "unknown",
            status: "Draft",
            scope_mode: $("scopeMode")?.value || "district",
            scope_name: currentScopeName(),
            note: def.note || "",
          });
        }
      }
    }
    return rows;
  }

  function defaultHealthKpiRows() {
    const rows = [];
    for (const year of years()) {
      for (const item of HEALTH_KPI_CATALOG) {
        rows.push({
          year,
          service_line: item.service_line,
          indicator_code: item.indicator_code,
          indicator_name: item.indicator_name,
          numerator: null,
          denominator: null,
          value: null,
          unit: item.unit,
          direction: item.direction,
          relation_type: item.relation_type,
          related_professions: item.related_professions,
          source: "",
          status: "Draft",
          note: "",
        });
      }
    }
    return rows;
  }

  function normalizeExtensionRows(rows, numericKeys = []) {
    return (rows || []).map((row) => {
      const next = { ...row };
      if (Object.prototype.hasOwnProperty.call(next, "year")) next.year = nullableNumber(next.year);
      for (const key of numericKeys) {
        if (Object.prototype.hasOwnProperty.call(next, key)) next[key] = nullableNumber(next[key]);
      }
      return next;
    });
  }

  const baseCollectProfilePayload = collectProfilePayload;
  collectProfilePayload = function collectProfilePayloadDataFitness() {
    ensureActivityUnits();
    const payload = baseCollectProfilePayload();
    payload.data_fitness_version = EXTENSION_VERSION;
    payload.profession_workload_history = state.professionWorkloadHistory.length
      ? JSON.parse(JSON.stringify(state.professionWorkloadHistory))
      : defaultProfessionWorkloadRows();
    payload.health_kpi_history = state.healthKpiHistory.length
      ? JSON.parse(JSON.stringify(state.healthKpiHistory))
      : defaultHealthKpiRows();
    payload.profession_config = (payload.profession_config || []).map((row) => {
      const cfg = state.professionConfig?.[row.profession_code] || {};
      const next = { ...row };
      for (const activity of ACTIVITY_DEFS) {
        next[`activity_unit_${activity.code}`] = cfg.activityUnits?.[activity.code] || defaultActivityUnit(row.profession_code, activity.code);
      }
      return next;
    });
    return payload;
  };

  const baseApplyProfilePayload = applyProfilePayload;
  applyProfilePayload = function applyProfilePayloadDataFitness(payload) {
    baseApplyProfilePayload(payload);
    ensureActivityUnits();
    state.professionWorkloadHistory = normalizeExtensionRows(payload.profession_workload_history, ["volume"]);
    state.healthKpiHistory = normalizeExtensionRows(payload.health_kpi_history, ["numerator", "denominator", "value"]);
    for (const row of payload.profession_config || []) {
      const code = String(row.profession_code || "");
      if (!code || !state.professionConfig?.[code]) continue;
      state.professionConfig[code].activityUnits ||= {};
      for (const activity of ACTIVITY_DEFS) {
        const key = `activity_unit_${activity.code}`;
        if (row[key] !== null && row[key] !== undefined && String(row[key]).trim()) {
          state.professionConfig[code].activityUnits[activity.code] = String(row[key]).trim();
        }
      }
    }
    renderProfileMetadata();
    renderDataFitnessPanel();
    renderHealthKpiPanel();
  };

  const baseProfileRowsFromPayload = profileRowsFromPayload;
  profileRowsFromPayload = function profileRowsFromPayloadDataFitness(payload) {
    const rows = baseProfileRowsFromPayload(payload);
    rows.Profession_Workload_History = payload.profession_workload_history || [];
    rows.Health_KPI_History = payload.health_kpi_history || [];
    return rows;
  };

  const baseBlankTemplatePayload = blankTemplatePayload;
  blankTemplatePayload = function blankTemplatePayloadDataFitness(payload) {
    const copy = baseBlankTemplatePayload(payload);
    copy.data_fitness_version = EXTENSION_VERSION;
    copy.profession_workload_history = defaultProfessionWorkloadRows();
    copy.health_kpi_history = defaultHealthKpiRows();
    copy.profession_config = (copy.profession_config || []).map((row) => {
      const next = { ...row };
      for (const activity of ACTIVITY_DEFS) {
        next[`activity_unit_${activity.code}`] = defaultActivityUnit(row.profession_code, activity.code);
      }
      return next;
    });
    for (const section of EXTENSION_SECTIONS) {
      copy.section_metadata[section] = {
        owner: payload.profile_owner || "",
        source: "",
        status: "Draft",
        updated_at: "",
        note: "",
      };
    }
    return copy;
  };

  const baseProfilePayloadFromSheetRows = profilePayloadFromSheetRows;
  profilePayloadFromSheetRows = function profilePayloadFromSheetRowsDataFitness(sheets) {
    const payload = baseProfilePayloadFromSheetRows(sheets);
    payload.data_fitness_version = EXTENSION_VERSION;
    payload.profession_workload_history = normalizeExtensionRows(sheets.Profession_Workload_History, ["volume"]);
    payload.health_kpi_history = normalizeExtensionRows(sheets.Health_KPI_History, ["numerator", "denominator", "value"]);
    payload.profession_config = (payload.profession_config || []).map((row) => ({ ...row }));
    return payload;
  };

  const EXTRA_EXCEL_GUIDE = Object.freeze({
    activity_code: { label: "รหัสกิจกรรม", description: "รหัส activity ที่เชื่อม Workload กับ Activity Standard", unit: "รหัส", source: "ระบบ", formula: "จับคู่ volume กับ activity standard ของวิชาชีพเดียวกัน" },
    activity_label: { label: "กลุ่มกิจกรรม", description: "ชื่อกลุ่มกิจกรรมของโมเดล", unit: "ข้อความ", source: "ระบบ", formula: "-" },
    workload_metric: { label: "ตัวแทนภาระงานของวิชาชีพ", description: "ชื่อ workload metric ที่สะท้อนงานจริงของวิชาชีพนั้น เช่น Physician OPD encounters หรือ OPD prescriptions dispensed", unit: "ข้อความ", source: "ทีมวิชาชีพ + HIS", formula: "ต้องตรงกับ denominator ของ Activity Standard" },
    volume: { label: "ปริมาณงานจริง", description: "จำนวนหน่วยงานจริงที่วิชาชีพนั้นทำในปีนั้น; ไม่มีข้อมูลให้เว้นว่าง", unit: "ตามคอลัมน์ unit", source: "HIS / registry / service log ที่ระบุ provider", formula: "Demand Minutes = Volume × Activity Standard × Complexity" },
    standard_unit: { label: "หน่วยของ Activity Standard", description: "หน่วยเวลาที่ต้องจับคู่ 1:1 กับ workload เช่น นาที/visit, นาที/patient-day, นาที/prescription", unit: "นาที/หน่วย", source: "Profession_Config + time-motion", formula: "หน่วยต้องตรงกับ Workload" },
    definition: { label: "นิยามข้อมูล", description: "นิยามว่าตัวเลขนี้นับอะไร", unit: "ข้อความ", source: "data dictionary", formula: "Data Fitness: Attribution" },
    include_rule: { label: "เกณฑ์รวม", description: "เกณฑ์ inclusion ที่ระบุว่า record ใดนับเป็น workload ของวิชาชีพนี้", unit: "ข้อความ", source: "ทีมข้อมูล/วิชาชีพ", formula: "Data Fitness: Attribution" },
    exclude_rule: { label: "เกณฑ์ตัดออก", description: "เกณฑ์ exclusion เพื่อกันงานของวิชาชีพอื่นและกันการนับซ้ำ", unit: "ข้อความ", source: "ทีมข้อมูล/วิชาชีพ", formula: "Data Fitness: Attribution / Overlap" },
    overlap_rule: { label: "กติกาป้องกันการนับซ้ำ", description: "ใช้ independent, mutually_exclusive, subset_excluded หรือ incremental; unknown = ยังไม่ผ่าน Data Fitness", unit: "ข้อความ", source: "ทีมวิชาชีพ/เวชระเบียน", formula: "Data Fitness: Overlap" },
    scope_mode: { label: "ระดับขอบเขตข้อมูล", description: "ระดับของ workload row ต้องตรงกับ Profile เช่น hospital/district/network/province", unit: "ระดับ", source: "Profile", formula: "Data Fitness: Attribution" },
    scope_name: { label: "ชื่อขอบเขตข้อมูล", description: "ชื่อหน่วยบริการ/พื้นที่ของ workload row", unit: "ข้อความ", source: "Profile/HIS", formula: "Data Fitness: Attribution" },
    service_line: { label: "Service line", description: "สายบริการที่ KPI สะท้อน", unit: "ข้อความ", source: "NCO indicator/service plan mapping", formula: "ใช้ประกอบการตีความ ไม่ใช้คำนวณ FTE" },
    indicator_code: { label: "รหัส KPI", description: "รหัสตัวชี้วัดตามชุดข้อมูล NCO/Service Plan", unit: "รหัส", source: "NCO_model", formula: "ไม่ใช้คำนวณ FTE" },
    indicator_name: { label: "ชื่อ Health KPI", description: "ชื่อผลลัพธ์สุขภาพ/บริการที่เกี่ยวข้องกับ service line", unit: "ข้อความ", source: "NCO_model", formula: "ไม่ใช้คำนวณ FTE" },
    numerator: { label: "ตัวตั้ง KPI", description: "ตัวตั้งจริงของปีนั้น ถ้ามี", unit: "ตาม KPI", source: "HDC/HIS/registry", formula: "ใช้คำนวณ KPI ตามนิยามต้นทาง" },
    denominator: { label: "ตัวหาร KPI", description: "ตัวหารจริงของปีนั้น ถ้ามี", unit: "ตาม KPI", source: "HDC/HIS/registry", formula: "ใช้คำนวณ KPI ตามนิยามต้นทาง" },
    direction: { label: "ทิศทางที่พึงประสงค์", description: "higher_better / lower_better / context_only", unit: "ข้อความ", source: "indicator definition", formula: "ใช้ตีความแนวโน้ม" },
    relation_type: { label: "ประเภทความสัมพันธ์", description: "เช่น Clinical outcome, Service outcome, Access / network outcome", unit: "ข้อความ", source: "NCO mapping", formula: "เป็น context linkage ไม่ใช่ causal coefficient" },
    related_professions: { label: "วิชาชีพที่เกี่ยวข้อง", description: "รหัสวิชาชีพที่เกี่ยวข้องกับ service line; ไม่ได้แปลว่าวิชาชีพนั้นเป็นสาเหตุของ KPI", unit: "comma-separated codes", source: "service-line mapping", formula: "ใช้จับคู่ KPI กับผลวิเคราะห์" },
  });

  const baseExcelFieldGuide = excelFieldGuide;
  excelFieldGuide = function excelFieldGuideDataFitness(key) {
    if (EXTRA_EXCEL_GUIDE[key]) return EXTRA_EXCEL_GUIDE[key];
    if (String(key).startsWith("activity_unit_")) {
      const code = String(key).slice("activity_unit_".length);
      return {
        label: `หน่วยนับ Activity Standard — ${ACTIVITY_LABELS[code] || code}`,
        description: "denominator ของ Activity Standard สำหรับวิชาชีพนี้ เช่น visit, patient_day, prescription, session; ต้องตรงกับ Profession_Workload_History",
        unit: "รหัสหน่วย",
        source: "ทีมวิชาชีพ / time-motion",
        formula: "Data Fitness: Unit match",
      };
    }
    return baseExcelFieldGuide(key);
  };

  const baseBuildExcelInstructionRows = buildExcelInstructionRows;
  buildExcelInstructionRows = function buildExcelInstructionRowsDataFitness() {
    const rows = baseBuildExcelInstructionRows();
    const insertAt = Math.max(0, rows.length - 1);
    rows.splice(insertAt, 0,
      [],
      ["หลักใหม่: Profession-specific workload", "Workload_History เป็นบริบทระดับหน่วยบริการ (facility context) เท่านั้น และไม่เพียงพอสำหรับสรุป WISN ของวิชาชีพ ต้องกรอก Profession_Workload_History ด้วย workload ที่วิชาชีพนั้นทำจริง"],
      ["ตัวอย่างแพทย์ OPD", "ใช้ Physician OPD encounters ที่ provider profession = physician ไม่ใช่ Total OPD ที่รวมบริการของพยาบาล ทันตกรรม กายภาพ เภสัช หรือวิชาชีพอื่น"],
      ["Data Fitness Gate", "จะสรุปขาด/เกินและ Suggested Add ได้ต่อเมื่อ Attribution + Unit match + Overlap + Verification ผ่านทั้งหมด; หากไม่ผ่านจะแสดง DATA NOT FIT"],
      ["Overlap rule", "independent = งานแยกจริง | mutually_exclusive = extraction กันซ้ำแล้ว | subset_excluded = เป็น subset ที่ไม่บวกซ้ำ | incremental = บวกเฉพาะเวลาส่วนเพิ่ม | unknown = ยังสรุปไม่ได้"],
      ["Health KPI", "Health_KPI_History ใช้ outcome/context เช่น mortality, referral leakage, rehab coverage เพื่อประกอบการตีความหลังวางกำลังคน ไม่ได้ใช้เพิ่มหรือลด Required FTE และไม่พิสูจน์เหตุ-ผลโดยลำพัง"],
      ["Profession_Workload_History", "ทีมวิชาชีพ + HIS/เวชระเบียน", "workload จริงแยกวิชาชีพ/กิจกรรม/ปี พร้อมนิยาม หน่วย inclusion/exclusion overlap source status และ scope"],
      ["Health_KPI_History", "ยุทธศาสตร์ / Service Plan / QI / HDC", "Health outcome/service KPI จริงรายปี พร้อม source และสถานะทวนสอบ"]
    );
    return rows;
  };

  function professionWorkloadRowsFor(year, professionCode) {
    return (state.professionWorkloadHistory || []).filter((row) =>
      Number(row.year) === Number(year) && String(row.profession_code) === String(professionCode));
  }

  function activityUnitKeyFromLabels(row, fallbackKey) {
    const text = `${row?.unit || ""} ${row?.standard_unit || ""}`.toLowerCase();
    for (const key of Object.keys(UNIT_LABELS)) {
      const labels = UNIT_LABELS[key];
      if (text.includes(String(labels.workload).toLowerCase().replace("/ปี", "")) || text.includes(String(labels.standard).toLowerCase().replace("นาที/", ""))) return key;
    }
    return fallbackKey || "";
  }

  function buildProfessionActivityRow(year, professionCode, facilityFallbackRow = null) {
    ensureActivityUnits();
    const basePopulation = nullableNumber(facilityFallbackRow?.population) ?? 0;
    const row = createEmptyActivityRow(year, basePopulation);
    row.complexityIndex = Math.max(0.1, nullableNumber(facilityFallbackRow?.complexityIndex) ?? 1);
    const professionRows = professionWorkloadRowsFor(year, professionCode);
    row.professionSpecific = professionRows.length > 0;
    row.sourceMode = professionRows.length ? "profession_specific" : "facility_context_fallback";

    if (!professionRows.length && facilityFallbackRow) {
      for (const activity of ACTIVITY_DEFS) row[activity.code] = n(facilityFallbackRow[activity.code], 0);
      return row;
    }

    for (const source of professionRows) {
      const activityCode = String(source.activity_code || "");
      if (!ACTIVITY_DEFS.some((item) => item.code === activityCode)) continue;
      const volume = nullableNumber(source.volume);
      if (volume === null) continue;
      const overlapRule = String(source.overlap_rule || "unknown").trim();
      if (overlapRule === "subset_excluded") continue;
      row[activityCode] += Math.max(0, volume);
    }
    return row;
  }

  function observedActualHeadcount(year, professionCode) {
    const key = `${professionCode}:${year}:actualHeadcount`;
    if (state.profileObserved?.workforce?.[key]) return true;
    const value = nullableNumber(state.movements?.[professionCode]?.[year]?.actualHeadcount);
    return value !== null && value !== 0;
  }

  function evaluateDataFitness(year, professionCode, actualRow, supplyRow) {
    ensureActivityUnits();
    const rows = professionWorkloadRowsFor(year, professionCode);
    const cfg = state.professionConfig?.[professionCode] || {};
    const issues = [];
    let attribution = true;
    let unitMatch = true;
    let overlap = true;
    let verification = true;

    if (!rows.length) {
      attribution = false;
      issues.push("ไม่มี Profession_Workload_History; Workload_History เป็น facility context และ not sufficient for profession WISN");
    }

    const activeActivities = ACTIVITY_DEFS.filter((activity) => n(cfg.activityMinutes?.[activity.code], 0) > 0);
    for (const activity of activeActivities) {
      const row = rows.find((item) => String(item.activity_code) === activity.code);
      if (!row) {
        attribution = false;
        issues.push(`ไม่มี workload ของ ${ACTIVITY_LABELS[activity.code] || activity.code}`);
        continue;
      }
      if (!String(row.definition || "").trim() || !String(row.include_rule || "").trim() || !String(row.exclude_rule || "").trim() || !String(row.source || "").trim()) {
        attribution = false;
        issues.push(`${activity.code}: นิยาม/inclusion/exclusion/source ยังไม่ครบ`);
      }
      if (String(row.scope_mode || "").trim() !== String($("scopeMode")?.value || "").trim()) {
        attribution = false;
        issues.push(`${activity.code}: scope ของ workload ไม่ตรงกับ Profile`);
      }
      if (nullableNumber(row.volume) === null) {
        attribution = false;
        issues.push(`${activity.code}: ยังไม่มี volume จริง`);
      }

      const expectedUnitKey = cfg.activityUnits?.[activity.code] || defaultActivityUnit(professionCode, activity.code);
      const actualUnitKey = activityUnitKeyFromLabels(row, expectedUnitKey);
      const expectedLabels = UNIT_LABELS[expectedUnitKey] || UNIT_LABELS.case;
      if (actualUnitKey !== expectedUnitKey || String(row.standard_unit || "").trim() !== expectedLabels.standard) {
        unitMatch = false;
        issues.push(`${activity.code}: หน่วย Workload/Activity Standard ไม่ตรงกัน`);
      }

      const overlapRule = String(row.overlap_rule || "unknown").trim();
      if (!ALLOWED_OVERLAP_RULES.has(overlapRule)) {
        overlap = false;
        issues.push(`${activity.code}: overlap_rule ยังไม่ยืนยัน`);
      }
      if (String(row.status || "Draft") !== "Verified") {
        verification = false;
        issues.push(`${activity.code}: workload ยังไม่ Verified`);
      }
    }

    if (String(state.profileMetadata?.WISN?.status || "Draft") !== "Verified") {
      verification = false;
      issues.push("WISN/Activity Standard ยังไม่ Verified");
    }
    if (String(state.profileMetadata?.Workforce?.status || "Draft") !== "Verified" || !observedActualHeadcount(year, professionCode)) {
      verification = false;
      issues.push("Actual Headcount/FTE ของปีนี้ยังไม่ Verified");
    }

    const decisionEligible = Boolean(attribution && unitMatch && overlap && verification && actualRow?.professionSpecific);
    return {
      year,
      professionCode,
      attribution,
      unitMatch,
      overlap,
      verification,
      decisionEligible,
      status: decisionEligible ? "FIT FOR DECISION" : "DATA NOT FIT",
      issues: Array.from(new Set(issues)),
      supplyFte: n(supplyRow?.supplyFte, 0),
    };
  }

  // Missing Actual Served is unknown, not zero. Target demand may still be estimated from a verified target population,
  // but Coverage Gap / Workload Gap are null until Actual Served is observed.
  buildTargetActivityModel = function buildTargetActivityModelDataFitness(year, population = 0) {
    const targetActivityRow = createEmptyActivityRow(year, population);
    const groups = [];

    for (const row of getTargetRowsByYear(year)) {
      const def = getTargetNeedDef(row.groupCode);
      if (!def) continue;
      const targetPopulationRaw = nullableNumber(row.targetPopulation);
      const targetPopulationKnown = Boolean(state.profileObserved?.targetNeed?.[`${row.year}:${row.groupCode}:targetPopulation`]) || (targetPopulationRaw !== null && targetPopulationRaw !== 0);
      const actualServedRaw = nullableNumber(row.actualServed);
      const actualServedKnown = Boolean(state.profileObserved?.targetNeed?.[`${row.year}:${row.groupCode}:actualServed`]) || (actualServedRaw !== null && actualServedRaw !== 0);
      const targetPopulation = targetPopulationKnown ? targetPopulationRaw : null;
      const actualServed = actualServedKnown ? actualServedRaw : null;
      const coveragePct = n(row.coveragePct, 0);
      const frequency = n(row.frequency, 0);
      const complexity = Math.max(0.1, n(row.complexityIndex, 1));
      const targetCases = targetPopulationKnown ? n(targetPopulation, 0) * (coveragePct / 100) : 0;
      const targetServiceVolume = targetCases * frequency;
      const actualServiceEquivalent = actualServedKnown ? n(actualServed, 0) * frequency : null;
      const coverageGap = actualServedKnown ? Math.max(0, targetCases - n(actualServed, 0)) : null;
      const workloadGap = actualServedKnown ? Math.max(0, targetServiceVolume - n(actualServiceEquivalent, 0)) : null;
      const activityVolumes = {};

      for (const activity of ACTIVITY_DEFS) {
        const mix = n(def.activityMix?.[activity.code], 0);
        const adjustedVolume = targetServiceVolume * mix * complexity;
        activityVolumes[activity.code] = adjustedVolume;
        targetActivityRow[activity.code] += adjustedVolume;
      }

      groups.push({
        year,
        groupCode: row.groupCode,
        groupLabel: row.groupLabel,
        placement: row.placement,
        targetPopulation,
        targetPopulationKnown,
        targetCases,
        actualServed,
        actualServedKnown,
        coveragePct,
        frequency,
        complexityIndex: complexity,
        targetServiceVolume,
        actualServiceEquivalent,
        coverageGap: actualServedKnown ? Math.max(0, targetCases - n(actualServed, 0)) : null,
        workloadGap,
        activityVolumes,
      });
    }

    const knownCoverage = groups.map((item) => item.coverageGap).filter((value) => Number.isFinite(value));
    const knownWorkload = groups.map((item) => item.workloadGap).filter((value) => Number.isFinite(value));
    return {
      row: targetActivityRow,
      groups,
      coverageGap: knownCoverage.length ? knownCoverage.reduce((sum, value) => sum + value, 0) : null,
      workloadGap: knownWorkload.length ? knownWorkload.reduce((sum, value) => sum + value, 0) : null,
      unknownActualServed: groups.filter((item) => !item.actualServedKnown && item.targetPopulationKnown).length,
      targetServiceVolume: groups.reduce((sum, item) => sum + item.targetServiceVolume, 0),
      actualServiceEquivalent: groups.reduce((sum, item) => sum + (Number.isFinite(item.actualServiceEquivalent) ? item.actualServiceEquivalent : 0), 0),
    };
  };

  summarizeTargetNeedByYear = function summarizeTargetNeedByYearDataFitness() {
    const byYear = {};
    for (const needRow of state.needRows) byYear[needRow.year] = buildTargetActivityModel(needRow.year, n(needRow.population, 0));
    const values = Object.values(byYear);
    return {
      byYear,
      totalCoverageGap: values.reduce((sum, item) => sum + (Number.isFinite(item.coverageGap) ? item.coverageGap : 0), 0),
      totalWorkloadGap: values.reduce((sum, item) => sum + (Number.isFinite(item.workloadGap) ? item.workloadGap : 0), 0),
      unknownActualServed: values.reduce((sum, item) => sum + n(item.unknownActualServed, 0), 0),
    };
  };

  function relatedHealthKpis(year, professionCode) {
    return (state.healthKpiHistory || []).filter((row) => {
      const professions = String(row.related_professions || "").split(",").map((value) => value.trim()).filter(Boolean);
      return Number(row.year) === Number(year) && professions.includes(professionCode) && nullableNumber(row.value) !== null;
    });
  }

  runProjection = function runProjectionDataFitness() {
    syncInputsFromDom();
    ensureActivityUnits();
    const selected = Array.from(state.selectedProfessions);
    const results = [];
    const baseNeedByProfession = {};
    state.targetSummary = summarizeTargetNeedByYear();

    for (const code of selected) {
      const prof = getProfession(code);
      const supply = calculateSupplyTimeline(code);
      for (const needRow of state.needRows) {
        const supplyRow = supply.find((item) => item.year === needRow.year);
        const targetModel = state.targetSummary.byYear[needRow.year] || buildTargetActivityModel(needRow.year, n(needRow.population, 0));
        const actualRow = buildProfessionActivityRow(needRow.year, code, needRow);
        const actualWisn = calculateWisnNeed(actualRow, code);
        const targetWisn = calculateWisnNeed(targetModel.row, code);
        const planningRow = buildPlanningActivityRow(actualRow, targetModel.row);
        const planningWisn = calculateWisnNeed(planningRow, code);
        if (!baseNeedByProfession[code]) baseNeedByProfession[code] = Math.max(planningWisn.needFte, 0.0001);
        const supplyFte = n(supplyRow?.supplyFte, 0);
        const gapFte = planningWisn.needFte - supplyFte;
        const wisnRatio = planningWisn.needFte > 0 ? supplyFte / planningWisn.needFte : null;
        const pressureIndex = supplyFte > 0 ? planningWisn.needFte / supplyFte : (planningWisn.needFte > 0 ? Infinity : 0);
        const trendIndex = planningWisn.needFte / baseNeedByProfession[code];
        const professionWorkloadGap = Math.max(0, planningWisn.demandMinutes - actualWisn.demandMinutes);
        const fitness = evaluateDataFitness(needRow.year, code, actualRow, supplyRow);
        const decisionEligible = fitness.decisionEligible;
        const suggestedAdd = decisionEligible ? Math.ceil(Math.max(0, gapFte)) : null;
        const reallocate = decisionEligible ? Math.max(0, -gapFte) : null;
        const risk = decisionEligible ? riskLevel({ gapFte, needFte: planningWisn.needFte, wisnRatio, pressureIndex }) : "data-not-fit";
        const recommendation = decisionEligible
          ? recommendationText({ gapFte, risk, supplyRow, code, wisnRatio, pressureIndex, coverageGap: targetModel.coverageGap, professionWorkloadGap })
          : `DATA NOT FIT — ยังสรุปขาด/เกินไม่ได้: ${fitness.issues.slice(0, 3).join("; ")}`;

        results.push({
          year: needRow.year,
          professionCode: code,
          professionLabel: prof.label,
          population: n(needRow.population, 0),
          actualNeedFte: actualWisn.needFte,
          targetNeedFte: targetWisn.needFte,
          needFte: planningWisn.needFte,
          supplyFte,
          gapFte,
          suggestedAdd: decisionEligible ? Math.ceil(Math.max(0, gapFte)) : null,
          reallocate: decisionEligible ? Math.max(0, -gapFte) : null,
          risk,
          outflow: n(supplyRow?.outflow, 0),
          netChange: n(supplyRow?.net, 0),
          wisnRatio,
          pressureIndex,
          trendIndex,
          coverageGap: targetModel.coverageGap,
          workloadGap: targetModel.workloadGap,
          professionWorkloadGap,
          demandMinutes: planningWisn.demandMinutes,
          actualDemandMinutes: actualWisn.demandMinutes,
          targetDemandMinutes: targetWisn.demandMinutes,
          serviceFte: planningWisn.serviceFte,
          awtMinutes: planningWisn.awtMinutes,
          casPct: planningWisn.casPct,
          caf: planningWisn.caf,
          iaf: planningWisn.iaf,
          complexityIndex: planningWisn.complexityIndex,
          activityLines: planningWisn.activityLines,
          targetGroups: targetModel.groups,
          actualWorkloadSource: actualRow.sourceMode,
          dataFitness: fitness,
          decisionEligible,
          relevantKpis: relatedHealthKpis(needRow.year, code),
          recommendation,
        });
      }
    }
    state.results = results;
    state.dataFitnessResults = results.map((row) => row.dataFitness);
    renderResults();
    renderDataFitnessPanel();
    renderHealthKpiPanel();
    renderTrace();
    $("sideStatus").textContent = results.some((row) => !row.decisionEligible) ? "Calculated / gated" : "Calculated / verified";
  };

  function displayMaybe(value, digits = 1) {
    return Number.isFinite(value) ? fmt(value, digits) : "—";
  }

  renderResults = function renderResultsDataFitness() {
    const body = $("resultTable").querySelector("tbody");
    body.innerHTML = state.results.map((row) => {
      const diagnostic = row.decisionEligible ? "" : `<small class="df-diagnostic">diagnostic only</small>`;
      return `
      <tr class="${row.decisionEligible ? "" : "df-row-not-fit"}">
        <td>${row.year}</td>
        <td>${row.professionLabel}<br>${diagnostic}</td>
        <td>${fmt(row.actualNeedFte, 1)}</td>
        <td>${fmt(row.targetNeedFte, 1)}</td>
        <td>${fmt(row.needFte, 1)}</td>
        <td>${fmt(row.supplyFte, 1)}</td>
        <td>${fmt(row.gapFte, 1)}${row.decisionEligible ? "" : "*"}</td>
        <td>${fmtRatio(row.wisnRatio)}</td>
        <td>${fmtRatio(row.pressureIndex)}</td>
        <td>${fmtRatio(row.trendIndex)}</td>
        <td>${displayMaybe(row.coverageGap, 0)}</td>
        <td>${displayMaybe(row.workloadGap, 0)}</td>
        <td>${row.decisionEligible ? (row.suggestedAdd > 0 ? `+${fmt(row.suggestedAdd, 0)}` : "0") : "—"}</td>
        <td>${row.decisionEligible ? fmt(row.reallocate, 1) : "—"}</td>
        <td><span class="risk ${row.risk}">${row.risk === "data-not-fit" ? "DATA NOT FIT" : row.risk}</span></td>
        <td>${row.recommendation}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="16">กรอก/โหลดข้อมูลจริงย้อนหลัง แล้วกดวิเคราะห์ข้อมูลย้อนหลัง</td></tr>`;

    const eligible = state.results.filter((row) => row.decisionEligible);
    const totalGap = eligible.reduce((sum, row) => sum + Math.max(0, row.gapFte), 0);
    const highRisk = eligible.filter((row) => row.risk === "red").length;
    $("summaryGap").textContent = `${fmt(totalGap, 1)} FTE`;
    $("summaryRisk").textContent = fmt(highRisk, 0);
    const unknownTarget = n(state.targetSummary?.unknownActualServed, 0);
    $("summaryReplacement").textContent = `${fmt(state.targetSummary.totalCoverageGap, 0)} คน${unknownTarget ? ` + ${unknownTarget} กลุ่มไม่ทราบ Actual Served` : ""}`;
    $("summaryNetOutflow").textContent = `${fmt(state.targetSummary.totalWorkloadGap, 0)} service units`;
  };

  function gateMark(value) {
    return value ? '<span class="df-pass">PASS</span>' : '<span class="df-fail">FAIL</span>';
  }

  function renderDataFitnessPanel() {
    const body = document.getElementById("dataFitnessBody");
    const status = document.getElementById("dataFitnessSummary");
    if (!body || !status) return;
    const fitnessRows = state.results.length ? state.results.map((row) => row.dataFitness) : [];
    const fitCount = fitnessRows.filter((row) => row?.decisionEligible).length;
    status.textContent = fitnessRows.length ? `${fitCount}/${fitnessRows.length} แถวพร้อมใช้ตัดสินใจ` : "ยังไม่ได้วิเคราะห์";
    body.innerHTML = fitnessRows.map((row) => `
      <tr>
        <td>${row.year}</td>
        <td>${getProfession(row.professionCode)?.label || row.professionCode}</td>
        <td>${gateMark(row.attribution)}</td>
        <td>${gateMark(row.unitMatch)}</td>
        <td>${gateMark(row.overlap)}</td>
        <td>${gateMark(row.verification)}</td>
        <td><strong>${row.status}</strong></td>
        <td>${row.issues.join("; ") || "-"}</td>
      </tr>`).join("") || '<tr><td colspan="8">Import Profession_Workload_History และ Workforce/WISN ที่ Verified แล้วกดวิเคราะห์</td></tr>';
  }

  function renderHealthKpiPanel() {
    const body = document.getElementById("healthKpiBody");
    const summary = document.getElementById("healthKpiSummary");
    if (!body || !summary) return;
    const rows = (state.healthKpiHistory || []).filter((row) => nullableNumber(row.value) !== null);
    const verified = rows.filter((row) => String(row.status) === "Verified");
    summary.textContent = `${verified.length}/${rows.length || 0} KPI ที่มีค่าได้รับการ Verified`;
    body.innerHTML = rows
      .sort((a, b) => Number(b.year) - Number(a.year))
      .slice(0, 40)
      .map((row) => `
      <tr>
        <td>${row.year ?? "-"}</td><td>${row.service_line || "-"}</td><td>${row.indicator_code || "-"}</td>
        <td>${row.indicator_name || "-"}</td><td>${nullableNumber(row.value) ?? "-"}</td><td>${row.unit || "-"}</td>
        <td>${row.direction || "-"}</td><td>${row.related_professions || "-"}</td><td>${row.status || "Draft"}</td><td>${row.source || "-"}</td>
      </tr>`).join("") || '<tr><td colspan="10">ยังไม่มี Health KPI actual data — Template เตรียมรหัสตัวชี้วัดไว้ให้กรอกข้อมูลจริง</td></tr>';
  }

  renderTrace = function renderTraceDataFitness() {
    $("formulaText").textContent = [
      "WISN historical analysis — profession-specific, decision-gated",
      "Decision workload = actual workload that the profession actually performed, not total facility workload",
      "Demand Minutes = Σ(profession-specific workload volume × matching activity standard minutes × complexity)",
      "Overlap: subset_excluded rows are not added again; incremental rows are allowed only when the time standard is incremental",
      "Service FTE = Demand Minutes / AWT",
      "CAF = 1 / (1 - CAS support % / 100)",
      "IAF = IAS hours per year x 60 / AWT",
      "Required FTE = (Service FTE x CAF) + IAF",
      "Actual Supply FTE = verified actual annual headcount x FTE factor",
      "HR GAP = Planning Required FTE - Actual Supply FTE",
      "Decision gate = Attribution PASS + Unit PASS + Overlap PASS + Verification PASS",
      "If decision gate fails: numeric FTE is diagnostic only; shortage/surplus and Suggested Add are suppressed",
      "Missing Actual Served is unknown, not zero; Coverage Gap is not calculated until Actual Served is observed",
      "Health Outcome KPI is contextual/lagging evidence and is not used to increase or decrease Required FTE",
    ].join("\n");

    const fit = state.results.filter((row) => row.decisionEligible).length;
    const total = state.results.length;
    $("sourceText").textContent = [
      `Scenario: ${$("scenarioName").value}`,
      `Historical years: ${years().join(", ")}`,
      `Scope: ${state.provinceRow?.province || "-"} / ${$("amphurName").value || "-"} / ${$("unitName").value || "-"} / ${$("scopeMode").value}`,
      `Data Fitness: ${fit}/${total} result rows decision-eligible`,
      "Workload_History: facility context only; not sufficient for profession-level WISN conclusion.",
      "Profession_Workload_History: decision workload with profession, activity, volume, unit, definition, inclusion, exclusion, source, overlap rule, scope and verification status.",
      "Example physician OPD: count only encounters where provider profession = physician; do not use total OPD that includes other professions.",
      "Activity Standard denominator must match each profession-specific workload unit (e.g. prescription, patient-day, session), not a generic hospital visit denominator.",
      "Health_KPI_History: actual outcome/service indicators used to judge whether service performance changes alongside workforce/capacity changes; it does not establish causality by itself.",
      "Historical policy: missing = unknown, not zero; no interpolation, growth, back-cast, or provincial allocation.",
    ].join("\n");
  };

  function outcomeKpiRowsHtml() {
    return (state.healthKpiHistory || []).filter((row) => nullableNumber(row.value) !== null).map((row) => `
      <tr><td>${row.year ?? ""}</td><td>${profileEscape(row.service_line || "")}</td><td>${profileEscape(row.indicator_code || "")}</td><td>${profileEscape(row.indicator_name || "")}</td><td>${nullableNumber(row.value) ?? ""}</td><td>${profileEscape(row.unit || "")}</td><td>${profileEscape(row.status || "Draft")}</td><td>${profileEscape(row.source || "")}</td></tr>`).join("");
  }

  exportExcel = function exportExcelDataFitness() {
    if (!state.results.length) runProjection();
    const resultRows = state.results.map((row) => `
      <tr><td>${row.year}</td><td>${escapeHtml(row.professionLabel)}</td><td>${row.actualNeedFte.toFixed(2)}</td><td>${row.targetNeedFte.toFixed(2)}</td><td>${row.needFte.toFixed(2)}</td><td>${row.supplyFte.toFixed(2)}</td><td>${row.gapFte.toFixed(2)}</td><td>${row.decisionEligible ? row.suggestedAdd : "DATA NOT FIT"}</td><td>${row.dataFitness.status}</td><td>${escapeHtml(row.recommendation)}</td></tr>`).join("");
    const html = `\ufeff<html><head><meta charset="UTF-8"></head><body>
      <h1>HR Blueprint WISN Historical Analysis — Profession-specific workload</h1>
      <p>${escapeHtml($("scenarioName").value)} | ${escapeHtml(state.provinceRow?.province || "")} | ${escapeHtml($("amphurName").value || "")}</p>
      <p><b>Decision rule:</b> DATA NOT FIT rows are diagnostic only and must not be interpreted as shortage/surplus.</p>
      <h2>Results</h2><table border="1"><thead><tr><th>Year</th><th>Profession</th><th>Actual Workload FTE</th><th>Target Need FTE</th><th>Planning Required FTE</th><th>Actual Supply FTE</th><th>Diagnostic GAP</th><th>Suggested Add</th><th>Data Fitness</th><th>Recommendation</th></tr></thead><tbody>${resultRows}</tbody></table>
      <h2>Health Outcome KPI context</h2><p>Outcome KPI ไม่ได้ใช้เพิ่มหรือลด Required FTE และไม่พิสูจน์ causal effect โดยลำพัง</p><table border="1"><thead><tr><th>Year</th><th>Service line</th><th>Code</th><th>KPI</th><th>Value</th><th>Unit</th><th>Status</th><th>Source</th></tr></thead><tbody>${outcomeKpiRowsHtml()}</tbody></table>
      <h2>Formula</h2><pre>${escapeHtml($("formulaText").textContent)}</pre>
      <h2>Source / Assumption</h2><pre>${escapeHtml($("sourceText").textContent)}</pre>
    </body></html>`;
    downloadBlob(html, "HR_Blueprint_WISN_Historical.xls", "application/vnd.ms-excel;charset=utf-8");
  };

  exportJson = function exportJsonDataFitness() {
    if (!state.results.length) runProjection();
    const profile = collectProfilePayload();
    const payload = {
      mode: "historical_actual_profession_specific",
      scenario: $("scenarioName").value,
      historical_years: years(),
      scope: profile.scope,
      section_metadata: profile.section_metadata,
      profession_workload_history: profile.profession_workload_history,
      health_kpi_history: profile.health_kpi_history,
      profession_config: profile.profession_config,
      target_need_history: profile.target_need_history,
      workforce_history: profile.workforce_history,
      target_summary: state.targetSummary,
      data_fitness: state.dataFitnessResults,
      results: state.results,
    };
    downloadBlob(JSON.stringify(payload, null, 2), "HR_Blueprint_WISN_Historical.json", "application/json;charset=utf-8");
  };

  if (typeof buildReportText === "function") {
    buildReportText = function buildReportTextDataFitness() {
      const lines = [
        "HR Blueprint WISN Historical Analysis Report — Profession-specific workload",
        `Scenario: ${$("scenarioName").value}`,
        `Scope: ${state.provinceRow?.province || "-"} / ${$("amphurName").value || "-"} / ${$("unitName").value || "-"} / ${$("scopeMode").value}`,
        "",
        "Decision policy: DATA NOT FIT = diagnostic calculation only; do not conclude shortage/surplus.",
        "Health KPI is contextual outcome evidence and does not modify Required FTE.",
        "",
        "Year | Profession | Actual Workload FTE | Planning Required FTE | Actual Supply FTE | Diagnostic GAP | Data Fitness | Recommendation",
      ];
      for (const row of state.results) lines.push(`${row.year} | ${row.professionLabel} | ${row.actualNeedFte.toFixed(1)} | ${row.needFte.toFixed(1)} | ${row.supplyFte.toFixed(1)} | ${row.gapFte.toFixed(1)} | ${row.dataFitness.status} | ${row.recommendation}`);
      lines.push("", "Formula", $("formulaText").textContent, "", "Source / Assumption", $("sourceText").textContent);
      return lines.join("\n");
    };
  }

  function injectStyles() {
    if (document.getElementById("dataFitnessStyle")) return;
    const style = document.createElement("style");
    style.id = "dataFitnessStyle";
    style.textContent = `
      .df-callout{padding:12px 14px;border:1px solid #c8d8d4;border-radius:12px;background:#f5faf8;margin:10px 0;font-size:.92rem;line-height:1.55}
      .df-callout strong{color:#0b6b5f}.df-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px;margin:12px 0}.df-gate{border:1px solid #d5dfdc;border-radius:10px;padding:10px;background:white}.df-gate b{display:block;margin-bottom:4px}.df-pass{font-weight:800;color:#087a54}.df-fail{font-weight:800;color:#b42318}.risk.data-not-fit{background:#eef1f4;color:#475467;border:1px solid #cfd4dc}.df-row-not-fit{background:#fbfcfd}.df-diagnostic{color:#667085}.df-table-wrap{overflow:auto;max-height:420px}.df-panel-note{color:#475467;font-size:.9rem;line-height:1.55}@media(max-width:900px){.df-grid{grid-template-columns:1fr 1fr}}`;
    document.head.appendChild(style);
  }

  function injectDataFitnessPanels() {
    if (document.getElementById("dataFitnessPanel")) return;
    const resultPanel = $("resultTable")?.closest("section.panel");
    if (!resultPanel?.parentNode) return;

    const fitnessPanel = document.createElement("section");
    fitnessPanel.className = "panel";
    fitnessPanel.id = "dataFitnessPanel";
    fitnessPanel.innerHTML = `
      <div class="section-head"><div><h3>Data Fitness Gate — ข้อมูลพร้อมสรุปขาด/เกินหรือยัง</h3><p>ระบบแยก Diagnostic calculation ออกจาก Decision-eligible result</p></div><strong id="dataFitnessSummary">ยังไม่ได้วิเคราะห์</strong></div>
      <div class="df-callout"><strong>หลักสำคัญ:</strong> Workload ของแต่ละวิชาชีพต้องเป็นงานที่วิชาชีพนั้นทำจริง และหน่วยต้องตรงกับ Activity Standard แบบ 1:1 ตัวอย่างแพทย์ OPD = physician OPD encounters ที่มี provider profession เป็นแพทย์ <b>ไม่ใช่ Total OPD</b> ของโรงพยาบาล</div>
      <div class="df-grid"><div class="df-gate"><b>1. Attribution</b>นิยาม/provider/scope/source ถูกวิชาชีพ</div><div class="df-gate"><b>2. Unit Match</b>workload unit ตรง denominator ของ time standard</div><div class="df-gate"><b>3. Overlap</b>รู้ว่า independent/subset/incremental เพื่อไม่ double count</div><div class="df-gate"><b>4. Verification</b>workload + WISN + actual workforce ได้รับการ Verified</div></div>
      <div class="df-table-wrap"><table class="data-table"><thead><tr><th>ปี</th><th>วิชาชีพ</th><th>Attribution</th><th>Unit</th><th>Overlap</th><th>Verification</th><th>Status</th><th>เหตุที่ยังไม่ผ่าน</th></tr></thead><tbody id="dataFitnessBody"></tbody></table></div>`;

    const kpiPanel = document.createElement("section");
    kpiPanel.className = "panel";
    kpiPanel.id = "healthKpiPanel";
    kpiPanel.innerHTML = `
      <div class="section-head"><div><h3>Health Outcome KPI — ผลลัพธ์สุขภาพ/บริการที่เกี่ยวข้อง</h3><p>ใช้ดูว่าผลลัพธ์บริการเปลี่ยนไปในทิศทางใดร่วมกับ capacity/workforce</p></div><strong id="healthKpiSummary">ยังไม่มีข้อมูล</strong></div>
      <p class="df-panel-note"><strong>ข้อจำกัดการตีความ:</strong> KPI เหล่านี้เป็น outcome/context linkage ไม่ได้ใช้เพิ่มหรือลด Required FTE และไม่ควรตีความว่า “จำนวนบุคลากรเป็นสาเหตุโดยตรง” โดยไม่ควบคุม case mix, process, equipment, referral และปัจจัยระบบอื่น</p>
      <div class="df-table-wrap"><table class="data-table"><thead><tr><th>ปี</th><th>Service line</th><th>Code</th><th>KPI</th><th>Value</th><th>Unit</th><th>Direction</th><th>Related professions</th><th>Status</th><th>Source</th></tr></thead><tbody id="healthKpiBody"></tbody></table></div>`;

    resultPanel.parentNode.insertBefore(fitnessPanel, resultPanel);
    resultPanel.parentNode.insertBefore(kpiPanel, resultPanel);
  }

  function annotateExistingInputs() {
    const needTable = $("needTable");
    const needSection = needTable?.closest("section.panel");
    if (needSection && !needSection.querySelector(".df-workload-context-note")) {
      const note = document.createElement("div");
      note.className = "df-callout df-workload-context-note";
      note.innerHTML = '<strong>Workload_History ด้านล่าง = facility context:</strong> ใช้ดูภาพรวมปริมาณบริการของหน่วยงาน แต่ <b>ไม่ใช้เพียงอย่างเดียวเพื่อสรุป WISN ของวิชาชีพ</b> การตัดสินใช้ข้อมูลจาก <code>Profession_Workload_History</code> ที่ระบุผู้ให้บริการ/หน่วย/กติกากันซ้ำและผ่าน Data Fitness.';
      needSection.insertBefore(note, needTable.parentElement || needTable);
    }
    const standardTable = $("standardTable");
    const standardSection = standardTable?.closest("section.panel");
    if (standardSection && !standardSection.querySelector(".df-standard-note")) {
      const note = document.createElement("div");
      note.className = "df-callout df-standard-note";
      note.innerHTML = '<strong>Activity Standard = นาทีต่อ workload unit ของวิชาชีพนั้น</strong> เช่น แพทย์อาจเป็น นาที/physician visit, พยาบาล IPD อาจเป็น นาที/patient-day, เภสัชกรอาจเป็น นาที/prescription. หน่วยที่ใช้จริงบันทึกใน <code>Profession_Config activity_unit_*</code> และต้องตรงกับ <code>Profession_Workload_History</code>.';
      standardSection.appendChild(note);
    }
    const headers = $("resultTable")?.querySelectorAll("thead th");
    if (headers?.length >= 16) {
      headers[6].textContent = "HR GAP (diagnostic until FIT)";
      headers[12].textContent = "Suggested Add (gated)";
      headers[14].textContent = "Risk / Data Fitness";
    }
  }

  function initDataFitnessExtension() {
    ensureActivityUnits();
    ensureProfileMetadata();
    for (const section of EXTENSION_SECTIONS) {
      state.profileMetadata[section] ||= blankSectionMetadata();
    }
    injectStyles();
    injectDataFitnessPanels();
    annotateExistingInputs();
    renderProfileMetadata();
    renderDataFitnessPanel();
    renderHealthKpiPanel();
    if (typeof setProfileStatus === "function") {
      setProfileStatus("Profile พร้อมใช้ Data Fitness: Workload วิชาชีพ + Health KPI ถูกแยกจาก facility totals", "success");
    }
  }

  window.NCO_HR_DATA_FITNESS = Object.freeze({
    version: EXTENSION_VERSION,
    professionWorkloadDefinitions: PROFESSION_WORKLOAD_DEFINITIONS,
    healthKpiCatalog: HEALTH_KPI_CATALOG,
    evaluateDataFitness,
    buildProfessionActivityRow,
    professionWorkloadRowsFor,
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDataFitnessExtension);
  else initDataFitnessExtension();
})();
