// Per-profession Activity Standard denominator UI.
// A shared activity name does not imply the same workload unit for every profession.
(() => {
  "use strict";

  const UNIT_OPTIONS = Object.freeze({
    visit: "นาที/visit",
    admission: "นาที/admission",
    patient_day: "นาที/patient-day",
    encounter: "นาที/encounter",
    case: "นาที/case",
    procedure: "นาที/procedure",
    delivery: "นาที/delivery",
    prescription: "นาที/prescription",
    medication_case: "นาที/medication case",
    session: "นาที/session",
    contact: "นาที/contact",
    screening: "นาที/screening",
  });

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

  function definitionUnit(professionCode, activityCode) {
    return window.NCO_HR_DATA_FITNESS?.professionWorkloadDefinitions?.[professionCode]?.[activityCode]?.unitKey || "case";
  }

  function unitKey(professionCode, activityCode) {
    const cfg = state.professionConfig?.[professionCode] || {};
    return cfg.activityUnits?.[activityCode] || definitionUnit(professionCode, activityCode);
  }

  function unitText(professionCode, activityCode) {
    return UNIT_OPTIONS[unitKey(professionCode, activityCode)] || `นาที/${unitKey(professionCode, activityCode) || "หน่วย"}`;
  }

  function unitOptionsHtml(selected) {
    return Object.entries(UNIT_OPTIONS).map(([key, label]) =>
      `<option value="${key}"${key === selected ? " selected" : ""}>${label}</option>`).join("");
  }

  // Each cell carries its own denominator. This prevents a generic table header such as
  // "IPD = minutes/admission" from silently being applied to nursing patient-days or other professions.
  renderStandardTable = function renderStandardTableProfessionUnits() {
    const table = $("standardTable");
    const body = table?.querySelector("tbody");
    if (!body) return;
    const selected = Array.from(state.selectedProfessions);
    body.innerHTML = selected.map((code) => {
      const prof = getProfession(code);
      const cfg = state.professionConfig[code] || getDefaultWisn(prof);
      cfg.activityUnits ||= {};
      return `
        <tr>
          <td><strong>${prof.label}</strong><br><small>${code}</small></td>
          ${ACTIVITY_DEFS.map((activity) => {
            const currentUnit = unitKey(code, activity.code);
            cfg.activityUnits[activity.code] = currentUnit;
            return `<td>
              <input type="number" min="0" step="0.1" data-standard="${code}:${activity.code}" value="${n(cfg.activityMinutes?.[activity.code], 0).toFixed(1)}" aria-label="${prof.label} ${ACTIVITY_LABELS[activity.code] || activity.label} นาทีมาตรฐาน">
              <small class="df-unit standard-unit">${unitText(code, activity.code)}</small>
              <select data-standard-unit="${code}:${activity.code}" aria-label="หน่วยมาตรฐาน ${prof.label} ${ACTIVITY_LABELS[activity.code] || activity.label}">
                ${unitOptionsHtml(currentUnit)}
              </select>
            </td>`;
          }).join("")}
        </tr>`;
    }).join("") || `<tr><td colspan="9">ยังไม่ได้เลือกวิชาชีพ</td></tr>`;

    const heads = table.querySelectorAll("thead th");
    if (heads.length >= ACTIVITY_DEFS.length + 1) {
      heads[0].textContent = "วิชาชีพ";
      ACTIVITY_DEFS.forEach((activity, index) => {
        heads[index + 1].textContent = ACTIVITY_LABELS[activity.code] || activity.label;
        heads[index + 1].title = "หน่วยเวลาแตกต่างได้ตามวิชาชีพ — ดู unit ใต้ช่องของแต่ละแถว";
      });
    }
  };

  const baseSyncInputsFromDom = syncInputsFromDom;
  syncInputsFromDom = function syncInputsFromDomProfessionUnits() {
    baseSyncInputsFromDom();
    for (const select of document.querySelectorAll("[data-standard-unit]")) {
      const [code, activityCode] = select.dataset.standardUnit.split(":");
      state.professionConfig[code] ||= {};
      state.professionConfig[code].activityUnits ||= {};
      state.professionConfig[code].activityUnits[activityCode] = select.value;
    }
  };

  document.addEventListener("change", (event) => {
    const select = event.target.closest?.("[data-standard-unit]");
    if (!select) return;
    const [code, activityCode] = select.dataset.standardUnit.split(":");
    state.professionConfig[code] ||= {};
    state.professionConfig[code].activityUnits ||= {};
    state.professionConfig[code].activityUnits[activityCode] = select.value;
    const cell = select.closest("td");
    const label = cell?.querySelector(".df-unit");
    if (label) label.textContent = UNIT_OPTIONS[select.value] || `นาที/${select.value}`;
    if (typeof touchProfileSection === "function") touchProfileSection("WISN");
  });

  // In the Excel sheet, activity_* is a numeric time standard while activity_unit_* carries
  // the denominator for that profession row. Do not print a universal denominator here.
  const baseExcelFieldGuide = excelFieldGuide;
  excelFieldGuide = function excelFieldGuideProfessionUnits(key) {
    if (String(key).startsWith("activity_unit_")) {
      const activityCode = String(key).slice("activity_unit_".length);
      return {
        label: `หน่วยนับ Activity Standard — ${ACTIVITY_LABELS[activityCode] || activityCode}`,
        description: "denominator ของ Activity Standard สำหรับวิชาชีพในแถวนี้ เช่น visit, patient_day, prescription หรือ session; ต้องตรง 1:1 กับ Profession_Workload_History",
        unit: "รหัสหน่วย",
        source: "ทีมวิชาชีพ / time-motion / service standard",
        formula: "Data Fitness: Unit Match",
      };
    }
    if (String(key).startsWith("activity_")) {
      const activityCode = String(key).slice("activity_".length);
      return {
        label: `เวลามาตรฐาน — ${ACTIVITY_LABELS[activityCode] || activityCode}`,
        description: `จำนวนนาทีต่อ 1 workload unit ของวิชาชีพในแถวนี้; หน่วยนับจริงระบุใน activity_unit_${activityCode} ห้ามสมมติว่าทุกวิชาชีพใช้ denominator เดียวกัน`,
        unit: `นาทีต่อหน่วย — ดู activity_unit_${activityCode}`,
        source: "time-motion / service standard / expert consensus ที่ทวนสอบแล้ว",
        formula: "Profession-specific volume × Activity Standard; denominator/หน่วยนับต้องตรงกัน",
      };
    }
    return baseExcelFieldGuide(key);
  };

  function initActivityUnitUi() {
    renderStandardTable();
    if (!document.getElementById("activityUnitCss")) {
      const style = document.createElement("style");
      style.id = "activityUnitCss";
      style.textContent = `#standardTable td{vertical-align:top}.df-unit{display:block;margin-top:4px;font-size:.72rem;font-weight:700;color:#0b6b5f}#standardTable [data-standard-unit]{display:block;width:100%;margin-top:4px;font-size:.72rem;padding:3px 4px}`;
      document.head.appendChild(style);
    }
  }

  window.NCO_HR_ACTIVITY_UNITS = Object.freeze({ UNIT_OPTIONS, unitKey, unitText });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initActivityUnitUi);
  else initActivityUnitUi();
})();
