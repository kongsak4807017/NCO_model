const FALLBACK_BASELINE = {
  benchmarks_per10k: {
    doctor_per10k: { median: 6.378083209905196, p75: 7.254572122801848 },
    nurse_per10k: { median: 28.155734885317464, p75: 29.17668526244761 },
    pharmacist_per10k: { median: 2.890227260187073, p75: 3.167935424804301 },
  },
  rows: [
    { province: "เชียงใหม่", province_code: "50", population: 1170694, doctor: 761, nurse: 2815, pharmacist: 287, vacant_all: 776, vacant_doctor: 51, vacant_nurse: 241, vacant_pharmacist: 19, retire_5y_all: 613, retire_5y_doctor: 29, retire_5y_nurse: 163, retire_5y_pharmacist: 16 },
    { province: "เชียงราย", province_code: "57", population: 884137, doctor: 546, nurse: 2222, pharmacist: 231, vacant_all: 656, vacant_doctor: 41, vacant_nurse: 168, vacant_pharmacist: 15, retire_5y_all: 508, retire_5y_doctor: 14, retire_5y_nurse: 127, retire_5y_pharmacist: 6 },
    { province: "ลำปาง", province_code: "52", population: 501176, doctor: 432, nurse: 1616, pharmacist: 163, vacant_all: 654, vacant_doctor: 39, vacant_nurse: 186, vacant_pharmacist: 10, retire_5y_all: 489, retire_5y_doctor: 15, retire_5y_nurse: 149, retire_5y_pharmacist: 10 },
    { province: "น่าน", province_code: "55", population: 350346, doctor: 284, nurse: 1209, pharmacist: 123, vacant_all: 283, vacant_doctor: 15, vacant_nurse: 83, vacant_pharmacist: 5, retire_5y_all: 355, retire_5y_doctor: 7, retire_5y_nurse: 96, retire_5y_pharmacist: 4 },
    { province: "พะเยา", province_code: "56", population: 350078, doctor: 219, nurse: 1008, pharmacist: 107, vacant_all: 358, vacant_doctor: 16, vacant_nurse: 107, vacant_pharmacist: 5, retire_5y_all: 278, retire_5y_doctor: 8, retire_5y_nurse: 95, retire_5y_pharmacist: 5 },
    { province: "ลำพูน", province_code: "51", population: 337453, doctor: 197, nurse: 827, pharmacist: 89, vacant_all: 212, vacant_doctor: 14, vacant_nurse: 65, vacant_pharmacist: 4, retire_5y_all: 221, retire_5y_doctor: 9, retire_5y_nurse: 73, retire_5y_pharmacist: 3 },
    { province: "แพร่", province_code: "54", population: 315663, doctor: 229, nurse: 921, pharmacist: 100, vacant_all: 211, vacant_doctor: 11, vacant_nurse: 65, vacant_pharmacist: 4, retire_5y_all: 308, retire_5y_doctor: 11, retire_5y_nurse: 112, retire_5y_pharmacist: 3 },
    { province: "แม่ฮ่องสอน", province_code: "58", population: 179883, doctor: 96, nurse: 495, pharmacist: 49, vacant_all: 304, vacant_doctor: 5, vacant_nurse: 111, vacant_pharmacist: 5, retire_5y_all: 173, retire_5y_doctor: 2, retire_5y_nurse: 45, retire_5y_pharmacist: 0 },
  ],
};

const ACTIVITY_DEFS = [
  { code: "opdVisits", label: "OPD", seedRate: (population, index) => population * (2.2 + index * 0.03) },
  { code: "ipdAdmissions", label: "IPD Admit", seedRate: (population, index) => population * (0.075 + index * 0.001) },
  { code: "erVisits", label: "ER", seedRate: (population, index) => population * (0.16 + index * 0.002) },
  { code: "procedures", label: "OR/Procedure", seedRate: (population, index) => population * (0.018 + index * 0.0005) },
  { code: "deliveries", label: "Delivery", seedRate: (population, index) => population * Math.max(0.003, 0.008 - index * 0.0002) },
  { code: "chronicVisits", label: "Chronic", seedRate: (population, index) => population * (0.12 + index * 0.004) * 3 },
  { code: "mentalVisits", label: "Mental", seedRate: (population, index) => population * (0.0035 + index * 0.00008) * 3 },
  { code: "outreachVisits", label: "Outreach/PP", seedRate: (population, index) => population * (0.16 + index * 0.003) },
];

const TARGET_NEED_DEFS = [
  {
    code: "elderly_specialist",
    label: "สูงอายุซับซ้อน/พบแพทย์เฉพาะทาง",
    ratePct: 8,
    actualRatePct: 3.5,
    coveragePct: 70,
    frequency: 2,
    complexity: 1.25,
    placement: "รพศ./รพท./รพช.ใหญ่",
    activityMix: { opdVisits: 1, ipdAdmissions: 0.05, chronicVisits: 0.8, outreachVisits: 0.2 },
  },
  {
    code: "ncd_complication",
    label: "NCD ควบคุมไม่ได้/เสี่ยงภาวะแทรกซ้อน",
    ratePct: 12,
    actualRatePct: 7,
    coveragePct: 80,
    frequency: 3,
    complexity: 1.15,
    placement: "รพท./รพช.ใหญ่/รพช.",
    activityMix: { opdVisits: 0.8, chronicVisits: 1, mentalVisits: 0.05, outreachVisits: 0.25 },
  },
  {
    code: "ckd_dialysis",
    label: "CKD ระยะ 3-5/ฟอกไต/ไตเสื่อมเร็ว",
    ratePct: 1.8,
    actualRatePct: 1,
    coveragePct: 85,
    frequency: 6,
    complexity: 1.35,
    placement: "รพศ./รพท./รพช.ใหญ่",
    activityMix: { opdVisits: 0.6, ipdAdmissions: 0.08, procedures: 0.35, chronicVisits: 1 },
  },
  {
    code: "road_trauma",
    label: "อุบัติเหตุทางถนน/trauma",
    ratePct: 1.8,
    actualRatePct: 1.2,
    coveragePct: 90,
    frequency: 1,
    complexity: 1.35,
    placement: "รพศ./รพท./รพช.ใหญ่",
    activityMix: { erVisits: 1, ipdAdmissions: 0.16, procedures: 0.08, opdVisits: 0.25 },
  },
  {
    code: "mental_smi",
    label: "จิตเวชรุนแรง/SMI/สารเสพติด",
    ratePct: 1.2,
    actualRatePct: 0.65,
    coveragePct: 75,
    frequency: 4,
    complexity: 1.3,
    placement: "รพศ./รพท./รพช.ใหญ่ + community",
    activityMix: { mentalVisits: 1, erVisits: 0.08, opdVisits: 0.2, outreachVisits: 0.35 },
  },
  {
    code: "rehab_imc",
    label: "IMC/rehab หลัง stroke-fracture-post op",
    ratePct: 1.5,
    actualRatePct: 0.7,
    coveragePct: 70,
    frequency: 8,
    complexity: 1.2,
    placement: "รพท./รพช.ใหญ่/รพช.",
    activityMix: { opdVisits: 0.35, ipdAdmissions: 0.05, procedures: 0.4, outreachVisits: 0.5 },
  },
  {
    code: "ltc_home",
    label: "LTC/frailty/home care/palliative",
    ratePct: 3,
    actualRatePct: 1.2,
    coveragePct: 75,
    frequency: 6,
    complexity: 1.25,
    placement: "รพช.ใหญ่/รพช./ปฐมภูมิ",
    activityMix: { opdVisits: 0.2, chronicVisits: 0.4, mentalVisits: 0.05, outreachVisits: 1 },
  },
  {
    code: "maternal_high_risk",
    label: "ครรภ์เสี่ยง/มารดาเด็ก",
    ratePct: 0.8,
    actualRatePct: 0.55,
    coveragePct: 95,
    frequency: 5,
    complexity: 1.15,
    placement: "รพศ./รพท./รพช.ใหญ่",
    activityMix: { opdVisits: 0.4, deliveries: 0.2, ipdAdmissions: 0.06, outreachVisits: 0.25 },
  },
];

const DEFAULT_AWT_MINUTES = 90720; // 210 days x 7.2 hours x 60 minutes, aligned with WISN manual examples.

const PROFESSION_DEFS = [
  {
    code: "doctor",
    label: "แพทย์",
    sourceKey: "doctor",
    wisn: {
      awtMinutes: DEFAULT_AWT_MINUTES,
      casPct: 14,
      iasHours: 40,
      activityMinutes: { opdVisits: 8, ipdAdmissions: 18, erVisits: 15, procedures: 45, deliveries: 60, chronicVisits: 5, mentalVisits: 12, outreachVisits: 4 },
    },
  },
  {
    code: "nurse",
    label: "พยาบาลวิชาชีพ",
    sourceKey: "nurse",
    wisn: {
      awtMinutes: DEFAULT_AWT_MINUTES,
      casPct: 18,
      iasHours: 32,
      activityMinutes: { opdVisits: 10, ipdAdmissions: 60, erVisits: 22, procedures: 35, deliveries: 120, chronicVisits: 12, mentalVisits: 15, outreachVisits: 25 },
    },
  },
  {
    code: "pharmacist",
    label: "เภสัชกร",
    sourceKey: "pharmacist",
    wisn: {
      awtMinutes: DEFAULT_AWT_MINUTES,
      casPct: 12,
      iasHours: 24,
      activityMinutes: { opdVisits: 4, ipdAdmissions: 6, erVisits: 2, procedures: 0, deliveries: 0, chronicVisits: 8, mentalVisits: 4, outreachVisits: 1 },
    },
  },
  {
    code: "dentist",
    label: "ทันตแพทย์",
    sourceKey: null,
    wisn: {
      awtMinutes: DEFAULT_AWT_MINUTES,
      casPct: 12,
      iasHours: 20,
      activityMinutes: { opdVisits: 0, ipdAdmissions: 0, erVisits: 2, procedures: 45, deliveries: 0, chronicVisits: 0, mentalVisits: 0, outreachVisits: 8 },
    },
  },
  {
    code: "physio",
    label: "นักกายภาพบำบัด",
    sourceKey: null,
    wisn: {
      awtMinutes: DEFAULT_AWT_MINUTES,
      casPct: 12,
      iasHours: 20,
      activityMinutes: { opdVisits: 0, ipdAdmissions: 25, erVisits: 0, procedures: 20, deliveries: 0, chronicVisits: 10, mentalVisits: 0, outreachVisits: 15 },
    },
  },
  {
    code: "psychologist",
    label: "นักจิตวิทยา",
    sourceKey: null,
    wisn: {
      awtMinutes: DEFAULT_AWT_MINUTES,
      casPct: 15,
      iasHours: 24,
      activityMinutes: { opdVisits: 0, ipdAdmissions: 0, erVisits: 5, procedures: 0, deliveries: 0, chronicVisits: 2, mentalVisits: 45, outreachVisits: 10 },
    },
  },
  {
    code: "public_health",
    label: "นักวิชาการสาธารณสุข",
    sourceKey: null,
    wisn: {
      awtMinutes: DEFAULT_AWT_MINUTES,
      casPct: 18,
      iasHours: 30,
      activityMinutes: { opdVisits: 1, ipdAdmissions: 0, erVisits: 0, procedures: 0, deliveries: 0, chronicVisits: 6, mentalVisits: 6, outreachVisits: 25 },
    },
  },
];

const state = {
  baseline: FALLBACK_BASELINE,
  provinceRow: null,
  selectedProfessions: new Set(["doctor", "nurse", "pharmacist"]),
  professionConfig: {},
  needRows: [],
  targetNeedRows: [],
  targetSummary: { byYear: {}, totalCoverageGap: 0, totalWorkloadGap: 0 },
  movements: {},
  results: [],
};

function $(id) {
  return document.getElementById(id);
}

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fmt(value, digits = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtRatio(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "∞";
  return num.toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function years() {
  const start = n($("startYear").value, 2569);
  const count = Math.max(1, Math.min(10, n($("yearCount").value, 5)));
  return Array.from({ length: count }, (_, i) => start + i);
}

function getProfession(code) {
  return PROFESSION_DEFS.find((item) => item.code === code);
}

function getDefaultWisn(prof, standardFactor = 1) {
  const defaults = prof.wisn || {};
  const activityMinutes = Object.fromEntries(
    ACTIVITY_DEFS.map((activity) => [
      activity.code,
      Number((n(defaults.activityMinutes?.[activity.code], 0) * standardFactor).toFixed(2)),
    ]),
  );
  return {
    awtMinutes: n(defaults.awtMinutes, DEFAULT_AWT_MINUTES),
    casPct: n(defaults.casPct, 12),
    iasHours: n(defaults.iasHours, 0),
    activityMinutes,
  };
}

async function loadBaseline() {
  try {
    const response = await fetch("output/hr_blueprint_provincial_baseline_region1.json", { cache: "no-store" });
    if (response.ok) {
      state.baseline = await response.json();
    }
  } catch (error) {
    state.baseline = FALLBACK_BASELINE;
  }
  renderProvinceSelect();
  applyProvinceBaseline();
}

function renderProvinceSelect() {
  const select = $("provinceSelect");
  select.innerHTML = (state.baseline.rows || [])
    .map((row) => `<option value="${row.province_code}">${row.province}</option>`)
    .join("");
  if (!select.value && state.baseline.rows?.length) {
    select.value = state.baseline.rows[0].province_code;
  }
}

function applyProvinceBaseline() {
  const code = $("provinceSelect").value || state.baseline.rows?.[0]?.province_code;
  state.provinceRow = (state.baseline.rows || []).find((row) => String(row.province_code) === String(code)) || state.baseline.rows?.[0];
  if (!state.provinceRow) return;

  $("populationBase").value = Math.round(state.provinceRow.population || 0);
  $("vacancyAll").value = Math.round(state.provinceRow.vacant_all || 0);
  $("retireAll").value = Math.round(state.provinceRow.retire_5y_all || 0);
  syncProfessionConfigFromProvince();
  initNeedRows(true);
  initTargetNeedRows(true);
  initMovementDefaults(false);
  renderAll();
}

function syncProfessionConfigFromProvince() {
  for (const prof of PROFESSION_DEFS) {
    const existing = state.professionConfig[prof.code] || {};
    const defaults = getDefaultWisn(prof);
    const current = prof.sourceKey ? n(state.provinceRow?.[prof.sourceKey], 0) : n(existing.current, 0);
    const retire = prof.sourceKey ? n(state.provinceRow?.[`retire_5y_${prof.sourceKey}`], 0) : n(existing.retire5y, 0);
    const vacant = prof.sourceKey ? n(state.provinceRow?.[`vacant_${prof.sourceKey}`], 0) : n(existing.vacant, 0);
    state.professionConfig[prof.code] = {
      current,
      retire5y: retire,
      vacant,
      fteFactor: n(existing.fteFactor, 1),
      awtMinutes: n(existing.awtMinutes, defaults.awtMinutes),
      casPct: n(existing.casPct, defaults.casPct),
      iasHours: n(existing.iasHours, defaults.iasHours),
      activityMinutes: { ...defaults.activityMinutes, ...(existing.activityMinutes || {}) },
    };
  }
}

function initNeedRows(force = false) {
  if (!force && state.needRows.length === years().length) return;
  const basePop = n($("populationBase").value, state.provinceRow?.population || 0);
  state.needRows = years().map((year, index) => {
    const population = Math.round(basePop * Math.pow(1.005, index));
    return {
      year,
      population,
      opdVisits: Math.round(ACTIVITY_DEFS.find((item) => item.code === "opdVisits").seedRate(population, index)),
      ipdAdmissions: Math.round(ACTIVITY_DEFS.find((item) => item.code === "ipdAdmissions").seedRate(population, index)),
      erVisits: Math.round(ACTIVITY_DEFS.find((item) => item.code === "erVisits").seedRate(population, index)),
      procedures: Math.round(ACTIVITY_DEFS.find((item) => item.code === "procedures").seedRate(population, index)),
      deliveries: Math.round(ACTIVITY_DEFS.find((item) => item.code === "deliveries").seedRate(population, index)),
      chronicVisits: Math.round(ACTIVITY_DEFS.find((item) => item.code === "chronicVisits").seedRate(population, index)),
      mentalVisits: Math.round(ACTIVITY_DEFS.find((item) => item.code === "mentalVisits").seedRate(population, index)),
      outreachVisits: Math.round(ACTIVITY_DEFS.find((item) => item.code === "outreachVisits").seedRate(population, index)),
      complexityIndex: Number((1 + index * 0.02).toFixed(2)),
    };
  });
}

function initTargetNeedRows(force = false) {
  const expectedRows = years().length * TARGET_NEED_DEFS.length;
  if (!force && state.targetNeedRows.length === expectedRows) return;
  state.targetNeedRows = [];
  for (const needRow of state.needRows) {
    const index = years().indexOf(needRow.year);
    const population = n(needRow.population, 0);
    for (const def of TARGET_NEED_DEFS) {
      const growthFactor = 1 + (Math.max(0, index) * 0.025);
      const targetPopulation = Math.round(population * (def.ratePct / 100) * growthFactor);
      const actualServed = Math.round(population * (def.actualRatePct / 100) * (1 + Math.max(0, index) * 0.01));
      state.targetNeedRows.push({
        year: needRow.year,
        groupCode: def.code,
        groupLabel: def.label,
        targetPopulation,
        actualServed,
        coveragePct: def.coveragePct,
        frequency: def.frequency,
        complexityIndex: Number((def.complexity + Math.max(0, index) * 0.01).toFixed(2)),
        placement: def.placement,
      });
    }
  }
}

function initMovementDefaults(reset = false) {
  const y = years();
  for (const prof of PROFESSION_DEFS) {
    if (!reset && state.movements[prof.code]) continue;
    const retireYear = Math.round(n(state.professionConfig[prof.code]?.retire5y, 0) / Math.max(1, y.length));
    state.movements[prof.code] = {};
    for (const year of y) {
      state.movements[prof.code][year] = {
        recruit: 0,
        transferIn: 0,
        returnIn: 0,
        retire: retireYear,
        resign: 0,
        transferOut: 0,
        studyLeave: 0,
        fteFactor: n(state.professionConfig[prof.code]?.fteFactor, 1),
      };
    }
  }
}

function renderAll() {
  updateSideInfo();
  renderBaselineCards();
  renderProfessions();
  renderStandardTable();
  renderNeedTable();
  renderTargetNeedTable();
  renderSupplyFilter();
  renderSupplyTable();
  renderTrace();
}

function updateSideInfo() {
  const province = state.provinceRow?.province || "-";
  const amphur = $("amphurName").value || "ไม่ระบุอำเภอ";
  const unit = $("unitName").value || "ไม่ระบุรพ.";
  $("sideScope").textContent = `${province} / ${amphur} / ${unit}`;
}

function renderBaselineCards() {
  $("metricPopulation").textContent = fmt($("populationBase").value);
  $("metricVacancy").textContent = fmt($("vacancyAll").value);
  $("metricRetire").textContent = fmt($("retireAll").value);
  $("metricConfidence").textContent = $("confidenceLevel").value || "B";
}

function renderProfessions() {
  const grid = $("professionGrid");
  grid.innerHTML = PROFESSION_DEFS.map((prof) => {
    const cfg = state.professionConfig[prof.code] || getDefaultWisn(prof);
    const selected = state.selectedProfessions.has(prof.code);
    return `
      <article class="profession-card ${selected ? "selected" : ""}" data-prof-card="${prof.code}">
        <div class="profession-card-header">
          <div>
            <h4>${prof.label}</h4>
            <small>${prof.code}</small>
          </div>
          <input type="checkbox" data-prof-toggle="${prof.code}" ${selected ? "checked" : ""} aria-label="เลือก ${prof.label}">
        </div>
        <div class="mini-grid">
          <label class="field">
            <span>Current headcount</span>
            <input type="number" min="0" data-prof-current="${prof.code}" value="${Math.round(n(cfg.current, 0))}">
          </label>
          <label class="field">
            <span>AWT min/year</span>
            <input type="number" min="1" step="60" data-prof-awt="${prof.code}" value="${Math.round(n(cfg.awtMinutes, DEFAULT_AWT_MINUTES))}">
          </label>
          <label class="field">
            <span>CAS support %</span>
            <input type="number" min="0" max="80" step="0.1" data-prof-cas="${prof.code}" value="${n(cfg.casPct, 0).toFixed(1)}">
          </label>
          <label class="field">
            <span>IAS hours/year</span>
            <input type="number" min="0" step="1" data-prof-ias="${prof.code}" value="${n(cfg.iasHours, 0).toFixed(1)}">
          </label>
          <label class="field">
            <span>Vacancy</span>
            <input type="number" min="0" data-prof-vacant="${prof.code}" value="${Math.round(n(cfg.vacant, 0))}">
          </label>
          <label class="field">
            <span>Retire <=5Y</span>
            <input type="number" min="0" data-prof-retire="${prof.code}" value="${Math.round(n(cfg.retire5y, 0))}">
          </label>
        </div>
      </article>
    `;
  }).join("");
}

function renderStandardTable() {
  const body = $("standardTable").querySelector("tbody");
  const selected = Array.from(state.selectedProfessions);
  body.innerHTML = selected.map((code) => {
    const prof = getProfession(code);
    const cfg = state.professionConfig[code] || getDefaultWisn(prof);
    return `
      <tr>
        <td><strong>${prof.label}</strong></td>
        ${ACTIVITY_DEFS.map((activity) => `
          <td>
            <input type="number" min="0" step="0.1" data-standard="${code}:${activity.code}" value="${n(cfg.activityMinutes?.[activity.code], 0).toFixed(1)}">
          </td>
        `).join("")}
      </tr>
    `;
  }).join("") || `<tr><td colspan="9">ยังไม่ได้เลือกวิชาชีพ</td></tr>`;
}

function renderNeedTable() {
  const body = $("needTable").querySelector("tbody");
  body.innerHTML = state.needRows.map((row, index) => `
    <tr>
      <td>${row.year}</td>
      <td><input type="number" min="0" data-need="${index}:population" value="${Math.round(row.population)}"></td>
      <td><input type="number" min="0" data-need="${index}:opdVisits" value="${Math.round(row.opdVisits)}"></td>
      <td><input type="number" min="0" data-need="${index}:ipdAdmissions" value="${Math.round(row.ipdAdmissions)}"></td>
      <td><input type="number" min="0" data-need="${index}:erVisits" value="${Math.round(row.erVisits)}"></td>
      <td><input type="number" min="0" data-need="${index}:procedures" value="${Math.round(row.procedures)}"></td>
      <td><input type="number" min="0" data-need="${index}:deliveries" value="${Math.round(row.deliveries)}"></td>
      <td><input type="number" min="0" data-need="${index}:chronicVisits" value="${Math.round(row.chronicVisits)}"></td>
      <td><input type="number" min="0" data-need="${index}:mentalVisits" value="${Math.round(row.mentalVisits)}"></td>
      <td><input type="number" min="0" data-need="${index}:outreachVisits" value="${Math.round(row.outreachVisits)}"></td>
      <td><input type="number" min="0.1" step="0.01" data-need="${index}:complexityIndex" value="${n(row.complexityIndex, 1).toFixed(2)}"></td>
    </tr>
  `).join("");
}

function renderTargetNeedTable() {
  const body = $("targetNeedTable").querySelector("tbody");
  body.innerHTML = state.targetNeedRows.map((row, index) => `
    <tr>
      <td>${row.year}</td>
      <td><strong>${row.groupLabel}</strong></td>
      <td><input type="number" min="0" data-target="${index}:targetPopulation" value="${Math.round(row.targetPopulation)}"></td>
      <td><input type="number" min="0" data-target="${index}:actualServed" value="${Math.round(row.actualServed)}"></td>
      <td><input type="number" min="0" max="100" step="0.1" data-target="${index}:coveragePct" value="${n(row.coveragePct, 0).toFixed(1)}"></td>
      <td><input type="number" min="0" step="0.1" data-target="${index}:frequency" value="${n(row.frequency, 0).toFixed(1)}"></td>
      <td><input type="number" min="0.1" step="0.01" data-target="${index}:complexityIndex" value="${n(row.complexityIndex, 1).toFixed(2)}"></td>
      <td><input type="text" data-target="${index}:placement" value="${escapeHtml(row.placement || "")}"></td>
    </tr>
  `).join("");
}

function renderSupplyFilter() {
  const select = $("supplyProfessionFilter");
  const selected = Array.from(state.selectedProfessions);
  select.innerHTML = `<option value="all">ทุกวิชาชีพที่เลือก</option>` + selected
    .map((code) => `<option value="${code}">${getProfession(code)?.label || code}</option>`)
    .join("");
}

function renderSupplyTable() {
  const filter = $("supplyProfessionFilter").value || "all";
  const selected = Array.from(state.selectedProfessions).filter((code) => filter === "all" || filter === code);
  const body = $("supplyTable").querySelector("tbody");
  const rows = [];
  for (const code of selected) {
    const prof = getProfession(code);
    const timeline = calculateSupplyTimeline(code);
    for (const item of timeline) {
      const m = state.movements[code][item.year];
      rows.push(`
        <tr>
          <td>${prof.label}</td>
          <td>${item.year}</td>
          <td>${fmt(item.current, 0)}</td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:recruit" value="${m.recruit}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:transferIn" value="${m.transferIn}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:returnIn" value="${m.returnIn}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:retire" value="${m.retire}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:resign" value="${m.resign}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:transferOut" value="${m.transferOut}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:studyLeave" value="${m.studyLeave}"></td>
          <td><input type="number" min="0" step="0.01" data-move="${code}:${item.year}:fteFactor" value="${m.fteFactor}"></td>
          <td><strong>${fmt(item.projected, 1)}</strong></td>
        </tr>
      `);
    }
  }
  body.innerHTML = rows.join("") || `<tr><td colspan="12">ยังไม่ได้เลือกวิชาชีพ</td></tr>`;
}

function calculateSupplyTimeline(code) {
  const cfg = state.professionConfig[code] || {};
  let current = n(cfg.current, 0);
  return years().map((year) => {
    const m = state.movements[code]?.[year] || {};
    const net = n(m.recruit) + n(m.transferIn) + n(m.returnIn) - n(m.retire) - n(m.resign) - n(m.transferOut) - n(m.studyLeave);
    const projected = Math.max(0, current + net);
    const fteFactor = n(m.fteFactor, 1);
    const row = {
      year,
      current,
      net,
      projected,
      supplyFte: projected * fteFactor,
      outflow: n(m.retire) + n(m.resign) + n(m.transferOut) + n(m.studyLeave),
    };
    current = projected;
    return row;
  });
}

function getTargetNeedDef(code) {
  return TARGET_NEED_DEFS.find((item) => item.code === code);
}

function getTargetRowsByYear(year) {
  return state.targetNeedRows.filter((row) => Number(row.year) === Number(year));
}

function createEmptyActivityRow(year, population = 0) {
  return {
    year,
    population,
    complexityIndex: 1,
    ...Object.fromEntries(ACTIVITY_DEFS.map((activity) => [activity.code, 0])),
  };
}

function buildComplexityAdjustedActualRow(row) {
  const adjusted = createEmptyActivityRow(row.year, row.population);
  const complexityIndex = Math.max(0.1, n(row.complexityIndex, 1));
  for (const activity of ACTIVITY_DEFS) {
    adjusted[activity.code] = n(row[activity.code], 0) * complexityIndex;
  }
  return adjusted;
}

function buildTargetActivityModel(year, population = 0) {
  const targetActivityRow = createEmptyActivityRow(year, population);
  const groups = [];

  for (const row of getTargetRowsByYear(year)) {
    const def = getTargetNeedDef(row.groupCode);
    if (!def) continue;
    const targetCases = n(row.targetPopulation, 0) * (n(row.coveragePct, 0) / 100);
    const actualServed = n(row.actualServed, 0);
    const frequency = n(row.frequency, 0);
    const complexity = Math.max(0.1, n(row.complexityIndex, 1));
    const targetServiceVolume = targetCases * frequency;
    const actualServiceEquivalent = actualServed * frequency;
    const coverageGap = Math.max(0, targetCases - actualServed);
    const workloadGap = Math.max(0, targetServiceVolume - actualServiceEquivalent);
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
      targetPopulation: n(row.targetPopulation, 0),
      targetCases,
      actualServed,
      coveragePct: n(row.coveragePct, 0),
      frequency,
      complexityIndex: complexity,
      targetServiceVolume,
      actualServiceEquivalent,
      coverageGap,
      workloadGap,
      activityVolumes,
    });
  }

  return {
    row: targetActivityRow,
    groups,
    coverageGap: groups.reduce((sum, item) => sum + item.coverageGap, 0),
    workloadGap: groups.reduce((sum, item) => sum + item.workloadGap, 0),
    targetServiceVolume: groups.reduce((sum, item) => sum + item.targetServiceVolume, 0),
    actualServiceEquivalent: groups.reduce((sum, item) => sum + item.actualServiceEquivalent, 0),
  };
}

function buildPlanningActivityRow(actualRow, targetRow) {
  const planningRow = createEmptyActivityRow(actualRow.year, actualRow.population);
  const actualAdjustedRow = buildComplexityAdjustedActualRow(actualRow);
  for (const activity of ACTIVITY_DEFS) {
    planningRow[activity.code] = Math.max(n(actualAdjustedRow[activity.code], 0), n(targetRow[activity.code], 0));
  }
  return planningRow;
}

function summarizeTargetNeedByYear() {
  const byYear = {};
  for (const needRow of state.needRows) {
    byYear[needRow.year] = buildTargetActivityModel(needRow.year, n(needRow.population, 0));
  }
  return {
    byYear,
    totalCoverageGap: Object.values(byYear).reduce((sum, item) => sum + item.coverageGap, 0),
    totalWorkloadGap: Object.values(byYear).reduce((sum, item) => sum + item.workloadGap, 0),
  };
}

function calculateWisnNeed(row, code) {
  const prof = getProfession(code);
  const cfg = state.professionConfig[code] || getDefaultWisn(prof);
  const awtMinutes = Math.max(1, n(cfg.awtMinutes, DEFAULT_AWT_MINUTES));
  const casPct = clamp(n(cfg.casPct, 0), 0, 80);
  const caf = 1 / (1 - (casPct / 100));
  const iaf = (n(cfg.iasHours, 0) * 60) / awtMinutes;
  const complexityIndex = Math.max(0.1, n(row.complexityIndex, 1));
  const activityLines = ACTIVITY_DEFS.map((activity) => {
    const volume = n(row[activity.code], 0);
    const standardMinutes = n(cfg.activityMinutes?.[activity.code], 0);
    const minutes = volume * standardMinutes * complexityIndex;
    return {
      code: activity.code,
      label: activity.label,
      volume,
      standardMinutes,
      minutes,
    };
  });
  const demandMinutes = activityLines.reduce((sum, item) => sum + item.minutes, 0);
  const serviceFte = demandMinutes / awtMinutes;
  const needFte = (serviceFte * caf) + iaf;
  return {
    awtMinutes,
    casPct,
    caf,
    iaf,
    complexityIndex,
    activityLines,
    demandMinutes,
    serviceFte,
    needFte,
  };
}

function runProjection() {
  syncInputsFromDom();
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
      const actualWisn = calculateWisnNeed(needRow, code);
      const targetWisn = calculateWisnNeed(targetModel.row, code);
      const planningRow = buildPlanningActivityRow(needRow, targetModel.row);
      const planningWisn = calculateWisnNeed(planningRow, code);
      if (!baseNeedByProfession[code]) baseNeedByProfession[code] = Math.max(planningWisn.needFte, 0.0001);
      const supplyFte = n(supplyRow?.supplyFte, 0);
      const gapFte = planningWisn.needFte - supplyFte;
      const suggestedAdd = Math.ceil(Math.max(0, gapFte));
      const reallocate = Math.max(0, -gapFte);
      const wisnRatio = planningWisn.needFte > 0 ? supplyFte / planningWisn.needFte : null;
      const pressureIndex = supplyFte > 0 ? planningWisn.needFte / supplyFte : (planningWisn.needFte > 0 ? Infinity : 0);
      const trendIndex = planningWisn.needFte / baseNeedByProfession[code];
      const professionWorkloadGap = Math.max(0, planningWisn.demandMinutes - actualWisn.demandMinutes);
      const risk = riskLevel({ gapFte, needFte: planningWisn.needFte, wisnRatio, pressureIndex });
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
        suggestedAdd,
        reallocate,
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
        recommendation: recommendationText({ gapFte, risk, supplyRow, code, wisnRatio, pressureIndex, coverageGap: targetModel.coverageGap, professionWorkloadGap }),
      });
    }
  }
  state.results = results;
  renderResults();
  renderTrace();
  $("sideStatus").textContent = "Calculated";
}

function riskLevel({ gapFte, needFte, wisnRatio, pressureIndex }) {
  if (gapFte <= 0 && n(wisnRatio, 1) >= 1) return "green";
  if (!Number.isFinite(pressureIndex) || n(wisnRatio, 0) < 0.85 || gapFte >= 10 || (needFte > 0 && gapFte / needFte >= 0.2)) return "red";
  if (n(wisnRatio, 0) < 1 || gapFte > 0) return "yellow";
  return "green";
}

function recommendationText({ gapFte, risk, supplyRow, code, wisnRatio, pressureIndex, coverageGap, professionWorkloadGap }) {
  const cfg = state.professionConfig[code] || {};
  const retireShare = n(cfg.current, 0) > 0 ? n(cfg.retire5y, 0) / n(cfg.current, 0) : 0;
  if (risk === "green" && gapFte < -3) return "กำลังคนเกิน WISN need: พิจารณา hub support / rotation";
  if (risk === "green") return "สมดุลตาม WISN: ติดตาม workload และ AWT รายปี";
  if (n(coverageGap, 0) > 1000 && n(professionWorkloadGap, 0) > 0) return "ขาดตาม target need: เพิ่ม coverage ให้กลุ่มเป้าหมายและเติมกำลังคนตาม workload ที่ควรเกิด";
  if (retireShare >= 0.1) return "ขาดตาม WISN + เกษียณสูง: ทำ replacement pipeline และ retention";
  if (n(supplyRow?.net, 0) < 0) return "ขาดตาม WISN + supply ลด: เพิ่มรับเข้า/ลด outflow";
  if (risk === "red") return `แรงกดดันสูง: WISN ratio ${fmtRatio(wisnRatio)} / pressure ${fmtRatio(pressureIndex)} ควรเพิ่มคน จัดเวร หรือ redistribute`;
  return "ขาดปานกลาง: เพิ่มคนตาม GAP หรือปรับ productivity/activity standard ที่ตรวจสอบแล้ว";
}

function renderResults() {
  const body = $("resultTable").querySelector("tbody");
  body.innerHTML = state.results.map((row) => `
    <tr>
      <td>${row.year}</td>
      <td>${row.professionLabel}</td>
      <td>${fmt(row.actualNeedFte, 1)}</td>
      <td>${fmt(row.targetNeedFte, 1)}</td>
      <td>${fmt(row.needFte, 1)}</td>
      <td>${fmt(row.supplyFte, 1)}</td>
      <td>${fmt(row.gapFte, 1)}</td>
      <td>${fmtRatio(row.wisnRatio)}</td>
      <td>${fmtRatio(row.pressureIndex)}</td>
      <td>${fmtRatio(row.trendIndex)}</td>
      <td>${fmt(row.coverageGap, 0)}</td>
      <td>${fmt(row.workloadGap, 0)}</td>
      <td>${row.suggestedAdd > 0 ? `+${fmt(row.suggestedAdd, 0)}` : "0"}</td>
      <td>${fmt(row.reallocate, 1)}</td>
      <td><span class="risk ${row.risk}">${row.risk}</span></td>
      <td>${row.recommendation}</td>
    </tr>
  `).join("") || `<tr><td colspan="16">กดคำนวณ Projection เพื่อดูผลลัพธ์</td></tr>`;

  const totalGap = state.results.reduce((sum, row) => sum + Math.max(0, row.gapFte), 0);
  const highRisk = state.results.filter((row) => row.risk === "red").length;
  $("summaryGap").textContent = `${fmt(totalGap, 1)} FTE`;
  $("summaryRisk").textContent = fmt(highRisk, 0);
  $("summaryReplacement").textContent = `${fmt(state.targetSummary.totalCoverageGap, 0)} คน`;
  $("summaryNetOutflow").textContent = `${fmt(state.targetSummary.totalWorkloadGap, 0)} visits`;
}

function renderTrace() {
  $("formulaText").textContent = [
    "WISN core formula",
    "Actual workload = workload volume that the hospital actually delivered",
    "Target need = target population/cases x target coverage x service frequency",
    "Target activity volume = target need x service frequency x activity mix x need complexity",
    "Planning activity volume = max(actual activity volume, target activity volume)",
    "AWT = available working time minutes per worker per year",
    "Demand minutes = Σ(planning activity volume x activity standard minutes)",
    "A = staff for health service activities = Demand minutes / AWT",
    "CAF = 1 / (1 - CAS support % / 100)",
    "IAF = IAS hours per year x 60 / AWT",
    "Required FTE = (A x CAF) + IAF",
    "Projected supply FTE = projected headcount x FTE factor",
    "GAP FTE = Required FTE - Projected supply FTE",
    "WISN ratio = Projected supply FTE / Required FTE",
    "Pressure index = Required FTE / Projected supply FTE",
    "Workload trend index = Required FTE in year / Required FTE in base year",
    "Coverage gap = target cases - actual served",
    "Workload gap = target service volume - actual service equivalent",
    "Suggested Add = ceil(max(GAP FTE, 0))",
  ].join("\n");

  const province = state.provinceRow?.province || "-";
  const firstRow = state.results[0];
  const demandNote = firstRow
    ? `First result demand minutes: ${fmt(firstRow.demandMinutes, 0)} | AWT: ${fmt(firstRow.awtMinutes, 0)} | CAF: ${fmtRatio(firstRow.caf)} | IAF: ${fmtRatio(firstRow.iaf)}`
    : "First result demand minutes: calculate projection to populate";
  $("sourceText").textContent = [
    `Scenario: ${$("scenarioName").value}`,
    `Scope: ${province} / ${$("amphurName").value || "-"} / ${$("unitName").value || "-"} / ${$("scopeMode").value}`,
    "WISN reference: WHO Workload Indicators of Staffing Need user manual 2nd ed. (9789240070066) and software manual 2nd ed. (9789240107687)",
    "Population: output/hr_blueprint_provincial_baseline_region1.json or user-edited HDC catchment/service population for the selected district/hospital",
    "Workload statistics: OPD, IPD, ER, OR/procedure, delivery, chronic, mental, outreach annual volumes. Defaults are generated from service-use assumptions and should be replaced by HIS/HDC service statistics.",
    "Target need forecast: editable target population/cases, actual served, target coverage, service frequency, complexity, and placement for elderly specialist, NCD, CKD, trauma, SMI, rehab, LTC, and high-risk maternal-child groups.",
    "Activity standards: editable minutes per case by profession; use local time-motion, expert consensus, or official service standard where available.",
    "AWT/CAS/IAS: editable by profession. AWT default uses 210 days x 7.2 hours x 60 minutes from WISN example logic.",
    "Supply: current headcount from province baseline for doctor/nurse/pharmacist; editable movements by year for local district/hospital reality.",
    `Confidence: ${$("confidenceLevel").value}`,
    demandNote,
    "Budget constraint: not included in current MVP",
  ].join("\n");
}

function syncInputsFromDom() {
  renderBaselineCards();
  for (const input of document.querySelectorAll("[data-prof-current]")) {
    const code = input.dataset.profCurrent;
    state.professionConfig[code].current = n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-prof-awt]")) {
    const code = input.dataset.profAwt;
    state.professionConfig[code].awtMinutes = n(input.value, DEFAULT_AWT_MINUTES);
  }
  for (const input of document.querySelectorAll("[data-prof-cas]")) {
    const code = input.dataset.profCas;
    state.professionConfig[code].casPct = n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-prof-ias]")) {
    const code = input.dataset.profIas;
    state.professionConfig[code].iasHours = n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-prof-vacant]")) {
    const code = input.dataset.profVacant;
    state.professionConfig[code].vacant = n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-prof-retire]")) {
    const code = input.dataset.profRetire;
    state.professionConfig[code].retire5y = n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-standard]")) {
    const [code, activityCode] = input.dataset.standard.split(":");
    state.professionConfig[code] ||= {};
    state.professionConfig[code].activityMinutes ||= {};
    state.professionConfig[code].activityMinutes[activityCode] = n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-need]")) {
    const [index, field] = input.dataset.need.split(":");
    if (state.needRows[index]) state.needRows[index][field] = n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-target]")) {
    const [index, field] = input.dataset.target.split(":");
    if (!state.targetNeedRows[index]) continue;
    state.targetNeedRows[index][field] = field === "placement" ? input.value : n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-move]")) {
    const [code, year, field] = input.dataset.move.split(":");
    state.movements[code] ||= {};
    state.movements[code][year] ||= {};
    state.movements[code][year][field] = n(input.value, 0);
  }
}

function handleProfessionChange(event) {
  const toggle = event.target.closest("[data-prof-toggle]");
  if (toggle) {
    const code = toggle.dataset.profToggle;
    if (toggle.checked) state.selectedProfessions.add(code);
    else state.selectedProfessions.delete(code);
    renderProfessions();
    renderStandardTable();
    renderSupplyFilter();
    renderSupplyTable();
    return;
  }

  const card = event.target.closest("[data-prof-card]");
  if (!card) return;
  const code = card.dataset.profCard;
  state.professionConfig[code] ||= {};
  if (event.target.matches("[data-prof-current]")) state.professionConfig[code].current = n(event.target.value);
  if (event.target.matches("[data-prof-awt]")) state.professionConfig[code].awtMinutes = n(event.target.value, DEFAULT_AWT_MINUTES);
  if (event.target.matches("[data-prof-cas]")) state.professionConfig[code].casPct = n(event.target.value);
  if (event.target.matches("[data-prof-ias]")) state.professionConfig[code].iasHours = n(event.target.value);
  if (event.target.matches("[data-prof-vacant]")) state.professionConfig[code].vacant = n(event.target.value);
  if (event.target.matches("[data-prof-retire]")) state.professionConfig[code].retire5y = n(event.target.value);
}

function applyTargetMode() {
  const mode = $("targetMode").value;
  if (mode === "custom") return;
  const standardFactor = mode === "high-complexity" ? 1.1 : 1;
  for (const prof of PROFESSION_DEFS) {
    const cfg = state.professionConfig[prof.code] || {};
    const defaults = getDefaultWisn(prof, standardFactor);
    state.professionConfig[prof.code] = {
      ...cfg,
      awtMinutes: defaults.awtMinutes,
      casPct: defaults.casPct,
      iasHours: defaults.iasHours,
      activityMinutes: defaults.activityMinutes,
    };
  }
  renderProfessions();
  renderStandardTable();
}

function autoRetire() {
  syncInputsFromDom();
  const y = years();
  for (const code of Array.from(state.selectedProfessions)) {
    const yearly = Math.round(n(state.professionConfig[code]?.retire5y, 0) / Math.max(1, y.length));
    for (const year of y) {
      state.movements[code][year].retire = yearly;
    }
  }
  renderSupplyTable();
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resultTableRowsHtml() {
  return state.results.map((row) => `
    <tr>
      <td>${row.year}</td><td>${escapeHtml(row.professionLabel)}</td>
      <td>${row.actualNeedFte.toFixed(2)}</td><td>${row.targetNeedFte.toFixed(2)}</td>
      <td>${row.needFte.toFixed(2)}</td><td>${row.supplyFte.toFixed(2)}</td>
      <td>${row.gapFte.toFixed(2)}</td><td>${fmtRatio(row.wisnRatio)}</td>
      <td>${fmtRatio(row.pressureIndex)}</td><td>${fmtRatio(row.trendIndex)}</td>
      <td>${row.coverageGap.toFixed(0)}</td><td>${row.workloadGap.toFixed(0)}</td>
      <td>${row.suggestedAdd}</td><td>${row.reallocate.toFixed(2)}</td>
      <td>${row.risk}</td><td>${escapeHtml(row.recommendation)}</td>
    </tr>
  `).join("");
}

function exportExcel() {
  if (!state.results.length) runProjection();
  const html = `\ufeff<html><head><meta charset="UTF-8"></head><body>
    <h1>HR Blueprint WISN Projection</h1>
    <p>${escapeHtml($("scenarioName").value)} | ${escapeHtml(state.provinceRow?.province || "")}</p>
    <h2>Results</h2>
    <table border="1">
      <thead><tr><th>Year</th><th>Profession</th><th>Actual FTE</th><th>Target FTE</th><th>Planning FTE</th><th>Supply FTE</th><th>HR GAP</th><th>WISN Ratio</th><th>Pressure</th><th>Trend</th><th>Coverage Gap</th><th>Workload Gap</th><th>Suggested Add</th><th>Reallocate</th><th>Risk</th><th>Recommendation</th></tr></thead>
      <tbody>${resultTableRowsHtml()}</tbody>
    </table>
    <h2>Formula</h2>
    <pre>${escapeHtml($("formulaText").textContent)}</pre>
    <h2>Source / Assumption</h2>
    <pre>${escapeHtml($("sourceText").textContent)}</pre>
  </body></html>`;
  downloadBlob(html, "HR_Blueprint_WISN_Projection.xls", "application/vnd.ms-excel;charset=utf-8");
}

function exportReport() {
  if (!state.results.length) runProjection();
  downloadBlob(buildReportText(), "report.txt", "text/plain;charset=utf-8");
}

function exportJson() {
  if (!state.results.length) runProjection();
  const payload = {
    scenario: $("scenarioName").value,
    scope: {
      province: state.provinceRow?.province,
      province_code: state.provinceRow?.province_code,
      amphur: $("amphurName").value,
      unit: $("unitName").value,
      mode: $("scopeMode").value,
    },
    baseline: {
      population: n($("populationBase").value),
      vacancy_all: n($("vacancyAll").value),
      retire_5y_all: n($("retireAll").value),
      confidence: $("confidenceLevel").value,
    },
    wisn_inputs: {
      activity_definitions: ACTIVITY_DEFS.map(({ code, label }) => ({ code, label })),
      need_rows: state.needRows,
      target_need_definitions: TARGET_NEED_DEFS.map(({ code, label, placement, activityMix }) => ({ code, label, placement, activityMix })),
      target_need_rows: state.targetNeedRows,
      standards_by_profession: Object.fromEntries(Array.from(state.selectedProfessions).map((code) => [code, state.professionConfig[code]])),
    },
    target_summary: state.targetSummary,
    movements: state.movements,
    results: state.results,
  };
  downloadBlob(JSON.stringify(payload, null, 2), "HR_Blueprint_WISN_Projection.json", "application/json;charset=utf-8");
}

function buildReportText() {
  const lines = [
    "HR Blueprint WISN Projection Report",
    `Scenario: ${$("scenarioName").value}`,
    `Scope: ${state.provinceRow?.province || "-"} / ${$("amphurName").value || "-"} / ${$("unitName").value || "-"} / ${$("scopeMode").value}`,
    `Year range: ${years().join(", ")}`,
    `Confidence: ${$("confidenceLevel").value}`,
    "",
    "Summary",
    `Total positive GAP: ${$("summaryGap").textContent}`,
    `High risk rows: ${$("summaryRisk").textContent}`,
    `Replacement out: ${$("summaryReplacement").textContent}`,
    `Net outflow: ${$("summaryNetOutflow").textContent}`,
    "",
    "Results",
    "Year | Profession | Actual FTE | Target FTE | Planning FTE | Supply FTE | HR GAP | WISN Ratio | Pressure | Trend | Coverage Gap | Workload Gap | Suggested Add | Risk | Recommendation",
  ];
  for (const row of state.results) {
    lines.push(`${row.year} | ${row.professionLabel} | ${row.actualNeedFte.toFixed(1)} | ${row.targetNeedFte.toFixed(1)} | ${row.needFte.toFixed(1)} | ${row.supplyFte.toFixed(1)} | ${row.gapFte.toFixed(1)} | ${fmtRatio(row.wisnRatio)} | ${fmtRatio(row.pressureIndex)} | ${fmtRatio(row.trendIndex)} | ${row.coverageGap.toFixed(0)} | ${row.workloadGap.toFixed(0)} | ${row.suggestedAdd} | ${row.risk} | ${row.recommendation}`);
  }
  lines.push("", "Formula", $("formulaText").textContent, "", "Source / Assumption", $("sourceText").textContent);
  return lines.join("\n");
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bindEvents() {
  $("btnLoadBaseline").addEventListener("click", loadBaseline);
  $("btnRun").addEventListener("click", runProjection);
  $("provinceSelect").addEventListener("change", applyProvinceBaseline);
  $("targetMode").addEventListener("change", applyTargetMode);
  $("btnSelectCore").addEventListener("click", () => {
    state.selectedProfessions = new Set(["doctor", "nurse", "pharmacist"]);
    renderProfessions();
    renderStandardTable();
    renderSupplyFilter();
    renderSupplyTable();
  });
  $("btnClearProfessions").addEventListener("click", () => {
    state.selectedProfessions.clear();
    renderProfessions();
    renderStandardTable();
    renderSupplyFilter();
    renderSupplyTable();
  });
  $("btnAutoRetire").addEventListener("click", autoRetire);
  $("btnExportExcel").addEventListener("click", exportExcel);
  $("btnExportReport").addEventListener("click", exportReport);
  $("btnExportJson").addEventListener("click", exportJson);
  $("professionGrid").addEventListener("input", handleProfessionChange);
  $("professionGrid").addEventListener("change", handleProfessionChange);
  $("standardTable").addEventListener("input", (event) => {
    if (!event.target.matches("[data-standard]")) return;
    const [code, activityCode] = event.target.dataset.standard.split(":");
    state.professionConfig[code].activityMinutes[activityCode] = n(event.target.value, 0);
  });
  $("needTable").addEventListener("input", (event) => {
    if (!event.target.matches("[data-need]")) return;
    const [index, field] = event.target.dataset.need.split(":");
    state.needRows[index][field] = n(event.target.value, 0);
  });
  $("targetNeedTable").addEventListener("input", (event) => {
    if (!event.target.matches("[data-target]")) return;
    const [index, field] = event.target.dataset.target.split(":");
    if (!state.targetNeedRows[index]) return;
    state.targetNeedRows[index][field] = field === "placement" ? event.target.value : n(event.target.value, 0);
  });
  $("supplyTable").addEventListener("change", (event) => {
    if (!event.target.matches("[data-move]")) return;
    const [code, year, field] = event.target.dataset.move.split(":");
    state.movements[code][year][field] = n(event.target.value, 0);
    renderSupplyTable();
  });
  $("supplyProfessionFilter").addEventListener("change", renderSupplyTable);
  ["scenarioName", "amphurName", "unitName", "scopeMode", "confidenceLevel"].forEach((id) => {
    $(id).addEventListener("input", () => {
      updateSideInfo();
      renderTrace();
      renderBaselineCards();
    });
  });
  ["startYear", "yearCount", "populationBase"].forEach((id) => {
    $(id).addEventListener("change", () => {
      syncInputsFromDom();
      initNeedRows(true);
      initTargetNeedRows(true);
      initMovementDefaults(true);
      renderNeedTable();
      renderTargetNeedTable();
      renderSupplyFilter();
      renderSupplyTable();
      renderBaselineCards();
    });
  });
  document.querySelectorAll(".step-link").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".step-link").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      $(button.dataset.section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function boot() {
  bindEvents();
  loadBaseline().then(() => {
    renderResults();
  });
}

document.addEventListener("DOMContentLoaded", boot);
