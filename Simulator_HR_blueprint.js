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

const PROFESSION_DEFS = [
  { code: "doctor", label: "แพทย์", sourceKey: "doctor", targetKey: "doctor_per10k", defaultTarget: 6.38 },
  { code: "nurse", label: "พยาบาลวิชาชีพ", sourceKey: "nurse", targetKey: "nurse_per10k", defaultTarget: 28.16 },
  { code: "pharmacist", label: "เภสัชกร", sourceKey: "pharmacist", targetKey: "pharmacist_per10k", defaultTarget: 2.89 },
  { code: "dentist", label: "ทันตแพทย์", sourceKey: null, targetKey: null, defaultTarget: 1.20 },
  { code: "physio", label: "นักกายภาพบำบัด", sourceKey: null, targetKey: null, defaultTarget: 1.00 },
  { code: "psychologist", label: "นักจิตวิทยา", sourceKey: null, targetKey: null, defaultTarget: 0.40 },
  { code: "public_health", label: "นักวิชาการสาธารณสุข", sourceKey: null, targetKey: null, defaultTarget: 4.00 },
];

const state = {
  baseline: FALLBACK_BASELINE,
  provinceRow: null,
  selectedProfessions: new Set(["doctor", "nurse", "pharmacist"]),
  professionConfig: {},
  needRows: [],
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

function fmt(value, digits = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
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

function getBenchmarkRate(prof, mode) {
  if (!prof.targetKey) return prof.defaultTarget;
  const bench = state.baseline.benchmarks_per10k?.[prof.targetKey] || {};
  if (mode === "p75") return Number(bench.p75 || prof.defaultTarget);
  if (mode === "median") return Number(bench.median || prof.defaultTarget);
  return prof.defaultTarget;
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
  initMovementDefaults(false);
  renderAll();
}

function syncProfessionConfigFromProvince() {
  const mode = $("targetMode").value || "median";
  for (const prof of PROFESSION_DEFS) {
    const current = prof.sourceKey ? n(state.provinceRow?.[prof.sourceKey], 0) : n(state.professionConfig[prof.code]?.current, 0);
    const retire = prof.sourceKey ? n(state.provinceRow?.[`retire_5y_${prof.sourceKey}`], 0) : n(state.professionConfig[prof.code]?.retire5y, 0);
    const vacant = prof.sourceKey ? n(state.provinceRow?.[`vacant_${prof.sourceKey}`], 0) : n(state.professionConfig[prof.code]?.vacant, 0);
    const existing = state.professionConfig[prof.code] || {};
    state.professionConfig[prof.code] = {
      current,
      retire5y: retire,
      vacant,
      targetRate: mode === "custom" ? n(existing.targetRate, prof.defaultTarget) : getBenchmarkRate(prof, mode),
      fteFactor: n(existing.fteFactor, 1),
    };
  }
}

function initNeedRows(force = false) {
  if (!force && state.needRows.length === years().length) return;
  const basePop = n($("populationBase").value, state.provinceRow?.population || 0);
  state.needRows = years().map((year, index) => ({
    year,
    population: Math.round(basePop * Math.pow(1.005, index)),
    elderlyPct: 20 + index * 0.5,
    chronicPct: 12 + index * 0.2,
    mentalRate: 350 + index * 5,
    workloadIndex: Number((1 + index * 0.03).toFixed(2)),
  }));
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
  renderNeedTable();
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
    const cfg = state.professionConfig[prof.code] || {};
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
            <span>Current</span>
            <input type="number" min="0" data-prof-current="${prof.code}" value="${Math.round(n(cfg.current, 0))}">
          </label>
          <label class="field">
            <span>Target /10k</span>
            <input type="number" min="0" step="0.01" data-prof-target="${prof.code}" value="${n(cfg.targetRate, prof.defaultTarget).toFixed(2)}">
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

function renderNeedTable() {
  const body = $("needTable").querySelector("tbody");
  body.innerHTML = state.needRows.map((row, index) => `
    <tr>
      <td>${row.year}</td>
      <td><input type="number" min="0" data-need="${index}:population" value="${Math.round(row.population)}"></td>
      <td><input type="number" min="0" step="0.1" data-need="${index}:elderlyPct" value="${row.elderlyPct.toFixed(1)}"></td>
      <td><input type="number" min="0" step="0.1" data-need="${index}:chronicPct" value="${row.chronicPct.toFixed(1)}"></td>
      <td><input type="number" min="0" step="1" data-need="${index}:mentalRate" value="${Math.round(row.mentalRate)}"></td>
      <td><input type="number" min="0" step="0.01" data-need="${index}:workloadIndex" value="${row.workloadIndex.toFixed(2)}"></td>
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

function burdenMultiplier(row) {
  const elderly = (n(row.elderlyPct, 20) - 20) * 0.01;
  const chronic = (n(row.chronicPct, 12) - 12) * 0.015;
  const mental = ((n(row.mentalRate, 350) - 350) / 1000) * 0.08;
  const workload = (n(row.workloadIndex, 1) - 1) * 0.5;
  return Math.max(0.75, 1 + elderly + chronic + mental + workload);
}

function runProjection() {
  syncInputsFromDom();
  const selected = Array.from(state.selectedProfessions);
  const results = [];
  for (const code of selected) {
    const prof = getProfession(code);
    const cfg = state.professionConfig[code];
    const supply = calculateSupplyTimeline(code);
    for (const needRow of state.needRows) {
      const supplyRow = supply.find((item) => item.year === needRow.year);
      const multiplier = burdenMultiplier(needRow);
      const needFte = n(cfg.targetRate, prof.defaultTarget) * n(needRow.population, 0) / 10000 * multiplier;
      const supplyFte = n(supplyRow?.supplyFte, 0);
      const gapFte = needFte - supplyFte;
      const suggestedAdd = Math.ceil(Math.max(0, gapFte));
      const reallocate = Math.max(0, -gapFte);
      const risk = riskLevel(gapFte, needFte);
      results.push({
        year: needRow.year,
        professionCode: code,
        professionLabel: prof.label,
        targetRate: n(cfg.targetRate, prof.defaultTarget),
        population: n(needRow.population, 0),
        burdenMultiplier: multiplier,
        needFte,
        supplyFte,
        gapFte,
        suggestedAdd,
        reallocate,
        risk,
        outflow: n(supplyRow?.outflow, 0),
        netChange: n(supplyRow?.net, 0),
        recommendation: recommendationText({ gapFte, needFte, risk, supplyRow, code }),
      });
    }
  }
  state.results = results;
  renderResults();
  renderTrace();
  $("sideStatus").textContent = "Calculated";
}

function riskLevel(gapFte, needFte) {
  if (gapFte <= 0) return "green";
  const ratio = needFte > 0 ? gapFte / needFte : 0;
  if (gapFte >= 10 || ratio >= 0.2) return "red";
  return "yellow";
}

function recommendationText({ gapFte, risk, supplyRow, code }) {
  const cfg = state.professionConfig[code] || {};
  const retireShare = n(cfg.current, 0) > 0 ? n(cfg.retire5y, 0) / n(cfg.current, 0) : 0;
  if (risk === "green" && gapFte < -3) return "กำลังคนเกิน need: พิจารณา hub support / rotation";
  if (risk === "green") return "เพียงพอ: ติดตามรายปี";
  if (retireShare >= 0.1) return "ขาด + เกษียณสูง: ทำ replacement pipeline และ retention";
  if (n(supplyRow?.net, 0) < 0) return "ขาด + supply ลด: เพิ่มรับเข้า/ลด outflow";
  if (risk === "red") return "ขาดมาก: เพิ่มคนหรือจัด rotation จาก hub";
  return "ขาดปานกลาง: เพิ่มคนตาม gap หรือปรับ productivity";
}

function renderResults() {
  const body = $("resultTable").querySelector("tbody");
  body.innerHTML = state.results.map((row) => `
    <tr>
      <td>${row.year}</td>
      <td>${row.professionLabel}</td>
      <td>${fmt(row.needFte, 1)}</td>
      <td>${fmt(row.supplyFte, 1)}</td>
      <td>${fmt(row.gapFte, 1)}</td>
      <td>${row.suggestedAdd > 0 ? `+${fmt(row.suggestedAdd, 0)}` : "0"}</td>
      <td>${fmt(row.reallocate, 1)}</td>
      <td><span class="risk ${row.risk}">${row.risk}</span></td>
      <td>${row.recommendation}</td>
    </tr>
  `).join("") || `<tr><td colspan="9">กดคำนวณ Projection เพื่อดูผลลัพธ์</td></tr>`;

  const totalGap = state.results.reduce((sum, row) => sum + Math.max(0, row.gapFte), 0);
  const highRisk = state.results.filter((row) => row.risk === "red").length;
  const replacement = Array.from(state.selectedProfessions).reduce((sum, code) => sum + n(state.professionConfig[code]?.retire5y, 0), 0);
  const netOutflow = state.results.reduce((sum, row) => sum + Math.max(0, -row.netChange), 0);
  $("summaryGap").textContent = `${fmt(totalGap, 1)} FTE`;
  $("summaryRisk").textContent = fmt(highRisk, 0);
  $("summaryReplacement").textContent = `${fmt(replacement, 0)} คน`;
  $("summaryNetOutflow").textContent = `${fmt(netOutflow, 0)} คน`;
}

function renderTrace() {
  $("formulaText").textContent = [
    "Need FTE = Target rate per 10,000 * Population / 10,000 * Burden multiplier",
    "Burden multiplier = 1 + elderly factor + chronic factor + mental factor + workload factor",
    "Net change = recruit + transfer in + return in - retire - resign - transfer out - study leave",
    "Projected headcount = previous projected headcount + net change",
    "Supply FTE = projected headcount * FTE factor",
    "GAP FTE = Need FTE - Supply FTE",
    "Suggested Add = ceil(max(GAP FTE, 0))",
  ].join("\n");

  const province = state.provinceRow?.province || "-";
  $("sourceText").textContent = [
    `Scenario: ${$("scenarioName").value}`,
    `Scope: ${province} / ${$("amphurName").value || "-"} / ${$("unitName").value || "-"}`,
    "Population source: output/hr_blueprint_provincial_baseline_region1.json or embedded Region 1 fallback",
    "Workforce source: province baseline for doctor/nurse/pharmacist; user-editable for other professions",
    `Confidence: ${$("confidenceLevel").value}`,
    "Budget constraint: not included in current MVP",
  ].join("\n");
}

function syncInputsFromDom() {
  renderBaselineCards();
  for (const input of document.querySelectorAll("[data-prof-current]")) {
    const code = input.dataset.profCurrent;
    state.professionConfig[code].current = n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-prof-target]")) {
    const code = input.dataset.profTarget;
    state.professionConfig[code].targetRate = n(input.value, getProfession(code)?.defaultTarget || 0);
  }
  for (const input of document.querySelectorAll("[data-prof-vacant]")) {
    const code = input.dataset.profVacant;
    state.professionConfig[code].vacant = n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-prof-retire]")) {
    const code = input.dataset.profRetire;
    state.professionConfig[code].retire5y = n(input.value, 0);
  }
  for (const input of document.querySelectorAll("[data-need]")) {
    const [index, field] = input.dataset.need.split(":");
    if (state.needRows[index]) state.needRows[index][field] = n(input.value, 0);
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
    renderSupplyFilter();
    renderSupplyTable();
    return;
  }

  const card = event.target.closest("[data-prof-card]");
  if (!card) return;
  const code = card.dataset.profCard;
  state.professionConfig[code] ||= {};
  if (event.target.matches("[data-prof-current]")) state.professionConfig[code].current = n(event.target.value);
  if (event.target.matches("[data-prof-target]")) state.professionConfig[code].targetRate = n(event.target.value);
  if (event.target.matches("[data-prof-vacant]")) state.professionConfig[code].vacant = n(event.target.value);
  if (event.target.matches("[data-prof-retire]")) state.professionConfig[code].retire5y = n(event.target.value);
}

function applyTargetMode() {
  const mode = $("targetMode").value;
  if (mode !== "custom") {
    for (const prof of PROFESSION_DEFS) {
      state.professionConfig[prof.code].targetRate = getBenchmarkRate(prof, mode);
    }
  }
  renderProfessions();
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

function exportExcel() {
  if (!state.results.length) runProjection();
  const resultRows = state.results.map((row) => `
    <tr>
      <td>${row.year}</td><td>${escapeHtml(row.professionLabel)}</td>
      <td>${row.needFte.toFixed(2)}</td><td>${row.supplyFte.toFixed(2)}</td>
      <td>${row.gapFte.toFixed(2)}</td><td>${row.suggestedAdd}</td>
      <td>${row.reallocate.toFixed(2)}</td><td>${row.risk}</td><td>${escapeHtml(row.recommendation)}</td>
    </tr>
  `).join("");
  const html = `\ufeff<html><head><meta charset="UTF-8"></head><body>
    <h1>HR Blueprint Projection</h1>
    <p>${escapeHtml($("scenarioName").value)} | ${escapeHtml(state.provinceRow?.province || "")}</p>
    <table border="1">
      <thead><tr><th>Year</th><th>Profession</th><th>Need FTE</th><th>Supply FTE</th><th>GAP FTE</th><th>Suggested Add</th><th>Reallocate</th><th>Risk</th><th>Recommendation</th></tr></thead>
      <tbody>${resultRows}</tbody>
    </table>
  </body></html>`;
  downloadBlob(html, "HR_Blueprint_Projection.xls", "application/vnd.ms-excel;charset=utf-8");
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
    professions: Object.fromEntries(Array.from(state.selectedProfessions).map((code) => [code, state.professionConfig[code]])),
    need_rows: state.needRows,
    movements: state.movements,
    results: state.results,
  };
  downloadBlob(JSON.stringify(payload, null, 2), "HR_Blueprint_Projection.json", "application/json;charset=utf-8");
}

function buildReportText() {
  const lines = [
    "HR Blueprint Projection Report",
    `Scenario: ${$("scenarioName").value}`,
    `Scope: ${state.provinceRow?.province || "-"} / ${$("amphurName").value || "-"} / ${$("unitName").value || "-"}`,
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
    "Year | Profession | Need FTE | Supply FTE | GAP FTE | Suggested Add | Risk | Recommendation",
  ];
  for (const row of state.results) {
    lines.push(`${row.year} | ${row.professionLabel} | ${row.needFte.toFixed(1)} | ${row.supplyFte.toFixed(1)} | ${row.gapFte.toFixed(1)} | ${row.suggestedAdd} | ${row.risk} | ${row.recommendation}`);
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
    renderSupplyFilter();
    renderSupplyTable();
  });
  $("btnClearProfessions").addEventListener("click", () => {
    state.selectedProfessions.clear();
    renderProfessions();
    renderSupplyFilter();
    renderSupplyTable();
  });
  $("btnAutoRetire").addEventListener("click", autoRetire);
  $("btnExportExcel").addEventListener("click", exportExcel);
  $("btnExportReport").addEventListener("click", exportReport);
  $("btnExportJson").addEventListener("click", exportJson);
  $("professionGrid").addEventListener("input", handleProfessionChange);
  $("professionGrid").addEventListener("change", handleProfessionChange);
  $("needTable").addEventListener("input", (event) => {
    if (!event.target.matches("[data-need]")) return;
    const [index, field] = event.target.dataset.need.split(":");
    state.needRows[index][field] = n(event.target.value, 0);
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
      initMovementDefaults(true);
      renderNeedTable();
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
