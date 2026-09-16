// Historical actual-data mode for Simulator_HR_blueprint.html
// Policy: the 5-year window is retrospective. Do not fabricate historical observations.

// Compatibility bridge: the legacy binder still looks up btnAutoRetire.
// Keep that legacy control hidden so boot can bind safely while the visible UI disables auto-distribution.
if (!document.getElementById("btnAutoRetire")) {
  const legacyAutoRetireButton = document.createElement("button");
  legacyAutoRetireButton.id = "btnAutoRetire";
  legacyAutoRetireButton.type = "button";
  legacyAutoRetireButton.hidden = true;
  document.body.appendChild(legacyAutoRetireButton);
}

state.districtBaseline = state.districtBaseline || { rows: [], sources: {} };
state.districtRow = state.districtRow || null;

function years() {
  const start = n($("startYear").value, 2569);
  const count = Math.max(1, Math.min(10, n($("yearCount").value, 5)));
  return Array.from({ length: count }, (_, i) => start - i);
}

async function loadDistrictBaseline() {
  try {
    const response = await fetch("output/hr_blueprint_district_baseline_region1.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`district baseline HTTP ${response.status}`);
    const payload = await response.json();
    state.districtBaseline = payload && Array.isArray(payload.rows)
      ? payload
      : { rows: [], sources: {} };
  } catch (error) {
    state.districtBaseline = { rows: [], sources: {}, error: String(error) };
  }
  return state.districtBaseline;
}

async function loadBaseline() {
  try {
    const response = await fetch("output/hr_blueprint_provincial_baseline_region1.json", { cache: "no-store" });
    if (response.ok) state.baseline = await response.json();
  } catch (error) {
    state.baseline = FALLBACK_BASELINE;
  }
  await loadDistrictBaseline();
  renderProvinceSelect();
  applyProvinceBaseline();
}

function renderAmphurSelect() {
  const select = $("amphurSelect");
  if (!select) return;
  const provinceCode = String($("provinceSelect").value || state.provinceRow?.province_code || "");
  const rows = (state.districtBaseline.rows || [])
    .filter((row) => String(row.province_code) === provinceCode)
    .sort((a, b) => String(a.amphur_code).localeCompare(String(b.amphur_code), "th"));

  select.innerHTML = `<option value="">— เลือกอำเภอ (${rows.length}) —</option>` + rows
    .map((row) => `<option value="${escapeHtml(row.amphur_code)}">${escapeHtml(row.amphur_name || row.amphur_code)}</option>`)
    .join("");
  select.value = "";
  state.districtRow = null;
  $("amphurName").value = "";

  const status = $("districtDataStatus");
  if (!status) return;
  if (!rows.length) {
    status.textContent = "ข้อมูลอำเภอ: ยังไม่มี static district baseline ของจังหวัดนี้ — กรอกชื่ออำเภอและข้อมูลจริงเองได้";
    return;
  }
  const populationSource = state.districtBaseline.sources?.population || {};
  const refYear = populationSource.reference_year_be || "ไม่ระบุปี";
  status.textContent = `ข้อมูลอำเภอ: พบ ${rows.length} อำเภอ | ประชากรอ้างอิงจริง พ.ศ. ${refYear} | เลือกแล้วแก้ไขค่าทวนสอบเองได้`;
}

function applyProvinceBaseline() {
  const code = $("provinceSelect").value || state.baseline.rows?.[0]?.province_code;
  state.provinceRow = (state.baseline.rows || []).find((row) => String(row.province_code) === String(code)) || state.baseline.rows?.[0];
  if (!state.provinceRow) return;

  $("populationBase").value = Math.round(state.provinceRow.population || 0);
  $("vacancyAll").value = Math.round(state.provinceRow.vacant_all || 0);
  $("retireAll").value = Math.round(state.provinceRow.retire_5y_all || 0);
  syncProfessionConfigFromProvince();
  renderAmphurSelect();
  initNeedRows(true);
  initTargetNeedRows(true);
  initMovementDefaults(true);
  renderAll();
  $("districtDataStatus").textContent += " | ขณะนี้แสดง baseline ระดับจังหวัดจนกว่าจะเลือกอำเภอ";
}

function applyDistrictPopulationHistory(districtRow = state.districtRow) {
  if (!districtRow) return;
  const populationByYear = districtRow.population_by_year || {};
  for (const row of state.needRows) {
    const yearKey = String(row.year);
    if (Object.prototype.hasOwnProperty.call(populationByYear, yearKey)) {
      row.population = Math.max(0, n(populationByYear[yearKey], 0));
    }
  }
}

function applyDistrictBaseline() {
  const select = $("amphurSelect");
  const amphurCode = String(select?.value || "");
  if (!amphurCode) {
    applyProvinceBaseline();
    return;
  }

  const provinceCode = String($("provinceSelect").value || "");
  const districtRow = (state.districtBaseline.rows || []).find(
    (row) => String(row.province_code) === provinceCode && String(row.amphur_code) === amphurCode,
  );
  if (!districtRow) return;

  state.districtRow = districtRow;
  $("amphurName").value = districtRow.amphur_name || "";
  $("scopeMode").value = "district";

  // Never carry province workforce into a district. Unknown district HR starts at 0
  // and remains fully editable by the local user who verifies the real figures.
  for (const prof of PROFESSION_DEFS) {
    const cfg = state.professionConfig[prof.code] || getDefaultWisn(prof);
    cfg.current = 0;
    cfg.vacant = 0;
    cfg.retire5y = 0;
    state.professionConfig[prof.code] = cfg;
  }
  $("vacancyAll").value = 0;
  $("retireAll").value = 0;

  if (districtRow.hr_available) {
    const districtCore = {
      doctor: {
        current: n(districtRow.doctor, 0),
        vacant: n(districtRow.vacant_doctor, 0),
        retire5y: n(districtRow.retire_5y_doctor, 0),
      },
      nurse: {
        current: n(districtRow.nurse, 0),
        vacant: n(districtRow.vacant_nurse, 0),
        retire5y: n(districtRow.retire_5y_nurse, 0),
      },
      pharmacist: {
        current: n(districtRow.pharmacist, 0),
        vacant: n(districtRow.vacant_pharmacist, 0),
        retire5y: n(districtRow.retire_5y_pharmacist, 0),
      },
    };
    for (const [code, values] of Object.entries(districtCore)) {
      Object.assign(state.professionConfig[code], values);
    }
    $("vacancyAll").value = Math.round(n(districtRow.vacant_all, 0));
    $("retireAll").value = Math.round(n(districtRow.retire_5y_all, 0));
  }

  const latestYear = String(years()[0]);
  const latestPopulation = Object.prototype.hasOwnProperty.call(districtRow.population_by_year || {}, latestYear)
    ? n(districtRow.population_by_year[latestYear], 0)
    : 0;
  $("populationBase").value = Math.round(latestPopulation);

  initNeedRows(true);
  applyDistrictPopulationHistory(districtRow);
  initTargetNeedRows(true);
  initMovementDefaults(true);
  $("confidenceLevel").value = districtRow.hr_available ? "B" : "C";
  renderAll();

  const populationYears = Object.keys(districtRow.population_by_year || {}).sort().reverse();
  const populationLabel = populationYears.length ? `ประชากรจริง: ${populationYears.join(", ")}` : "ประชากร: ยังไม่มีข้อมูล";
  const hrLabel = districtRow.hr_available
    ? "HR: มี district snapshot จาก hr_blueprint.db"
    : "HR: ยังไม่มี district snapshot ในไฟล์ public — ช่องกำลังคนตั้งต้นเป็น 0 และแก้ไขเองได้";
  $("districtDataStatus").textContent = `อำเภอ ${districtRow.amphur_name || amphurCode} | ${populationLabel} | ${hrLabel}`;
  updateSideInfo();
  renderTrace();
}

function initNeedRows(force = false) {
  if (!force && state.needRows.length === years().length) return;
  const basePop = n($("populationBase").value, 0);
  state.needRows = years().map((year, index) => ({
    year,
    // Only a documented latest-year baseline may populate this row automatically.
    // Other historical years stay zero until a real observation is loaded/entered.
    population: index === 0 ? Math.round(basePop) : 0,
    opdVisits: 0,
    ipdAdmissions: 0,
    erVisits: 0,
    procedures: 0,
    deliveries: 0,
    chronicVisits: 0,
    mentalVisits: 0,
    outreachVisits: 0,
    complexityIndex: 1,
  }));
}

function initTargetNeedRows(force = false) {
  const expectedRows = years().length * TARGET_NEED_DEFS.length;
  if (!force && state.targetNeedRows.length === expectedRows) return;
  state.targetNeedRows = [];
  for (const needRow of state.needRows) {
    for (const def of TARGET_NEED_DEFS) {
      state.targetNeedRows.push({
        year: needRow.year,
        groupCode: def.code,
        groupLabel: def.label,
        // Historical target population/cases and actual served must come from real records.
        targetPopulation: 0,
        actualServed: 0,
        coveragePct: def.coveragePct,
        frequency: def.frequency,
        complexityIndex: def.complexity,
        placement: def.placement,
      });
    }
  }
}

function initMovementDefaults(reset = false) {
  const y = years();
  for (const prof of PROFESSION_DEFS) {
    if (!reset && state.movements[prof.code]) continue;
    state.movements[prof.code] = {};
    for (const [index, year] of y.entries()) {
      state.movements[prof.code][year] = {
        // The current baseline supplies only the latest-year headcount.
        // Earlier years are intentionally blank/zero until real annual data is entered.
        actualHeadcount: index === 0 ? n(state.professionConfig[prof.code]?.current, 0) : 0,
        recruit: 0,
        transferIn: 0,
        returnIn: 0,
        retire: 0,
        resign: 0,
        transferOut: 0,
        studyLeave: 0,
        fteFactor: n(state.professionConfig[prof.code]?.fteFactor, 1),
      };
    }
  }
}

function calculateSupplyTimeline(code) {
  const cfg = state.professionConfig[code] || {};
  return years().map((year, index) => {
    const m = state.movements[code]?.[year] || {};
    const defaultHeadcount = index === 0 ? n(cfg.current, 0) : 0;
    const actualHeadcount = Math.max(0, n(m.actualHeadcount, defaultHeadcount));
    const fteFactor = n(m.fteFactor, 1);
    const net = n(m.recruit) + n(m.transferIn) + n(m.returnIn)
      - n(m.retire) - n(m.resign) - n(m.transferOut) - n(m.studyLeave);
    return {
      year,
      current: actualHeadcount,
      actualHeadcount,
      net,
      projected: actualHeadcount,
      supplyFte: actualHeadcount * fteFactor,
      outflow: n(m.retire) + n(m.resign) + n(m.transferOut) + n(m.studyLeave),
    };
  });
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
          <td><input type="number" min="0" data-move="${code}:${item.year}:actualHeadcount" value="${m.actualHeadcount}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:recruit" value="${m.recruit}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:transferIn" value="${m.transferIn}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:returnIn" value="${m.returnIn}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:retire" value="${m.retire}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:resign" value="${m.resign}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:transferOut" value="${m.transferOut}"></td>
          <td><input type="number" min="0" data-move="${code}:${item.year}:studyLeave" value="${m.studyLeave}"></td>
          <td><input type="number" min="0" step="0.01" data-move="${code}:${item.year}:fteFactor" value="${m.fteFactor}"></td>
          <td><strong>${fmt(item.supplyFte, 1)}</strong></td>
        </tr>
      `);
    }
  }
  body.innerHTML = rows.join("") || `<tr><td colspan="12">ยังไม่ได้เลือกวิชาชีพ</td></tr>`;
}

// Historical mode deliberately refuses to spread a 5-year retirement total across years.
function autoRetire() {
  syncInputsFromDom();
  for (const code of Array.from(state.selectedProfessions)) {
    for (const year of years()) {
      if (state.movements[code]?.[year]) state.movements[code][year].retire = 0;
    }
  }
  renderSupplyTable();
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
  `).join("") || `<tr><td colspan="16">กรอก/โหลดข้อมูลจริงย้อนหลัง แล้วกดวิเคราะห์ข้อมูลย้อนหลัง</td></tr>`;

  const totalGap = state.results.reduce((sum, row) => sum + Math.max(0, row.gapFte), 0);
  const highRisk = state.results.filter((row) => row.risk === "red").length;
  $("summaryGap").textContent = `${fmt(totalGap, 1)} FTE`;
  $("summaryRisk").textContent = fmt(highRisk, 0);
  $("summaryReplacement").textContent = `${fmt(state.targetSummary.totalCoverageGap, 0)} คน`;
  $("summaryNetOutflow").textContent = `${fmt(state.targetSummary.totalWorkloadGap, 0)} visits`;
}

function renderTrace() {
  $("formulaText").textContent = [
    "WISN historical analysis",
    "Historical workload = actual annual service volume entered/loaded for that year",
    "Historical target need = target/cases documented for that year (no future projection)",
    "AWT = available working time minutes per worker per year",
    "Demand minutes = Σ(actual/planning activity volume x activity standard minutes)",
    "A = staff for health service activities = Demand minutes / AWT",
    "CAF = 1 / (1 - CAS support % / 100)",
    "IAF = IAS hours per year x 60 / AWT",
    "Required FTE = (A x CAF) + IAF",
    "Actual supply FTE = actual annual headcount x FTE factor",
    "GAP FTE = Required FTE - Actual supply FTE",
    "WISN ratio = Actual supply FTE / Required FTE",
    "Pressure index = Required FTE / Actual supply FTE",
    "Suggested Add = ceil(max(GAP FTE, 0))",
  ].join("\n");

  const province = state.provinceRow?.province || "-";
  const firstRow = state.results[0];
  const demandNote = firstRow
    ? `First result demand minutes: ${fmt(firstRow.demandMinutes, 0)} | AWT: ${fmt(firstRow.awtMinutes, 0)} | CAF: ${fmtRatio(firstRow.caf)} | IAF: ${fmtRatio(firstRow.iaf)}`
    : "No historical calculation yet";
  const districtSource = state.districtRow
    ? `District baseline: ${state.districtRow.amphur_code || "-"} ${state.districtRow.amphur_name || "-"}; HR available=${Boolean(state.districtRow.hr_available)}`
    : "District baseline: not selected";
  $("sourceText").textContent = [
    `Scenario: ${$("scenarioName").value}`,
    `Historical years: ${years().join(", ")}`,
    `Scope: ${province} / ${$("amphurName").value || "-"} / ${$("unitName").value || "-"} / ${$("scopeMode").value}`,
    districtSource,
    "Historical-mode policy: no synthetic population, workload, retirement, target population, actual served, or annual headcount is generated for prior years.",
    "District source values are starting references only. Every input remains editable so the area can replace them with verified local data.",
    "Unknown district HR must not inherit province totals. It starts at 0 until a verified district snapshot is exported or entered.",
    "Workload statistics: use actual OPD, IPD, ER, OR/procedure, delivery, chronic, mental, and outreach annual volumes from HIS/HDC/verified source.",
    "Target need: use targets/cases and actual served documented for each historical year; default observed values are intentionally 0.",
    "Annual supply: enter actual headcount for each year. Recruit/transfer/retire/resign fields are retrospective movement records and do not back-calculate headcount.",
    "WISN reference: WHO Workload Indicators of Staffing Need user manual 2nd ed. (9789240070066) and software manual 2nd ed. (9789240107687)",
    `Confidence: ${$("confidenceLevel").value}`,
    demandNote,
  ].join("\n");
}

function exportExcel() {
  if (!state.results.length) runProjection();
  const html = `\ufeff<html><head><meta charset="UTF-8"></head><body>
    <h1>HR Blueprint WISN Historical Analysis</h1>
    <p>${escapeHtml($("scenarioName").value)} | ${escapeHtml(state.provinceRow?.province || "")} | ${escapeHtml($("amphurName").value || "")}</p>
    <h2>Results</h2>
    <table border="1">
      <thead><tr><th>Year</th><th>Profession</th><th>Actual FTE</th><th>Target FTE</th><th>Planning FTE</th><th>Supply FTE</th><th>HR GAP</th><th>WISN Ratio</th><th>Pressure</th><th>Trend</th><th>Coverage Gap</th><th>Workload Gap</th><th>Suggested Add</th><th>Reallocate</th><th>Risk</th><th>Recommendation</th></tr></thead>
      <tbody>${resultTableRowsHtml()}</tbody>
    </table>
    <h2>Formula</h2><pre>${escapeHtml($("formulaText").textContent)}</pre>
    <h2>Source / Assumption</h2><pre>${escapeHtml($("sourceText").textContent)}</pre>
  </body></html>`;
  downloadBlob(html, "HR_Blueprint_WISN_Historical.xls", "application/vnd.ms-excel;charset=utf-8");
}

function exportJson() {
  if (!state.results.length) runProjection();
  const payload = {
    mode: "historical_actual",
    scenario: $("scenarioName").value,
    historical_years: years(),
    scope: {
      province: state.provinceRow?.province,
      province_code: state.provinceRow?.province_code,
      amphur: $("amphurName").value,
      amphur_code: state.districtRow?.amphur_code || $("amphurSelect")?.value || null,
      unit: $("unitName").value,
      mode: $("scopeMode").value,
    },
    district_reference: state.districtRow || null,
    baseline: {
      population_latest: n($("populationBase").value),
      vacancy_all: n($("vacancyAll").value),
      retire_5y_all: n($("retireAll").value),
      confidence: $("confidenceLevel").value,
    },
    wisn_inputs: {
      need_rows: state.needRows,
      target_need_rows: state.targetNeedRows,
      standards_by_profession: Object.fromEntries(Array.from(state.selectedProfessions).map((code) => [code, state.professionConfig[code]])),
    },
    movements: state.movements,
    target_summary: state.targetSummary,
    results: state.results,
  };
  downloadBlob(JSON.stringify(payload, null, 2), "HR_Blueprint_WISN_Historical.json", "application/json;charset=utf-8");
}

function buildReportText() {
  const lines = [
    "HR Blueprint WISN Historical Analysis Report",
    `Scenario: ${$("scenarioName").value}`,
    `Scope: ${state.provinceRow?.province || "-"} / ${$("amphurName").value || "-"} / ${$("unitName").value || "-"} / ${$("scopeMode").value}`,
    `Historical years: ${years().join(", ")}`,
    `Confidence: ${$("confidenceLevel").value}`,
    "",
    "Policy: actual historical data only; no synthetic historical observations.",
    `District data status: ${$("districtDataStatus")?.textContent || "-"}`,
    "",
    "Summary",
    `Total positive GAP: ${$("summaryGap").textContent}`,
    `High risk rows: ${$("summaryRisk").textContent}`,
    `Coverage gap: ${$("summaryReplacement").textContent}`,
    `Workload gap: ${$("summaryNetOutflow").textContent}`,
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

document.addEventListener("DOMContentLoaded", () => {
  $("amphurSelect")?.addEventListener("change", applyDistrictBaseline);
});
