// Formula/label copy overrides for historical mode.
// Keeps Trace + exported reports aligned with the same definitions used by the UI and Excel template.

(() => {
  "use strict";

  const formulas = window.NCO_HR_DATA_DICTIONARY?.formulas || {};

  window.renderTrace = function renderTraceFormulaAware() {
    $("formulaText").textContent = [
      "WISN historical analysis — formula trace",
      "Historical workload = actual annual service volume entered/loaded for that year",
      "Actual demand minutes = Σ(actual workload volume x activity standard minutes x actual complexity index)",
      "Target cases = target population/cases x target coverage %",
      "Target equivalent activity volume = target cases x service frequency x activity mix x target complexity",
      "Planning activity volume = max(complexity-adjusted actual volume, target-need equivalent volume) by activity",
      "Planning demand minutes = Σ(planning activity volume x activity standard minutes)",
      "AWT = available working time minutes per worker per year",
      "Service FTE = Demand minutes / AWT",
      "CAF = 1 / (1 - CAS support % / 100)",
      "IAF = IAS hours per year x 60 / AWT",
      "Required FTE = (Service FTE x CAF) + IAF",
      "Actual supply FTE = actual annual headcount x FTE factor",
      "HR GAP = Planning Required FTE - Actual Supply FTE",
      "WISN ratio = Actual Supply FTE / Planning Required FTE",
      "Pressure index = Planning Required FTE / Actual Supply FTE",
      "Coverage gap = max(Target cases - Actual served, 0)",
      "Workload gap = Coverage gap x Service frequency",
      "Suggested Add = ceil(max(HR GAP, 0))",
      "Reallocate = max(0, -HR GAP)",
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
      "Historical observations: population/workload/target population/actual served/annual headcount must come from real records. Missing data is not synthesized.",
      "Formula assumptions: AWT, CAS, IAS, Activity Standards, Coverage, Frequency and Complexity must be reviewed and their sources documented before policy use.",
      "Activity Standard means minutes used by one worker in that profession per one service unit; it is not annual workload volume.",
      "IPD Activity Standard in this model is minutes per admission, not nursing minutes per bed-day.",
      "Annual supply uses Actual Headcount for each year directly. Recruit/transfer/retire/resign/study-leave are retrospective movement records and do not back-calculate headcount.",
      "District values are starting references only; unknown district HR must not inherit province totals.",
      `Core formula: ${formulas.actualDemand || "Demand Minutes = Σ(Workload Volume × Activity Standard × Complexity Index)"}`,
      `Required FTE: ${formulas.requiredFte || "Required FTE = (Service FTE × CAF) + IAF"}`,
      "WISN reference: WHO Workload Indicators of Staffing Need user manual 2nd ed. (9789240070066) and software manual 2nd ed. (9789240107687)",
      `Confidence: ${$("confidenceLevel").value}`,
      demandNote,
    ].join("\n");
  };

  window.exportExcel = function exportExcelFormulaAware() {
    if (!state.results.length) runProjection();
    const html = `\ufeff<html><head><meta charset="UTF-8"></head><body>
      <h1>HR Blueprint WISN Historical Analysis</h1>
      <p>${escapeHtml($("scenarioName").value)} | ${escapeHtml(state.provinceRow?.province || "")} | ${escapeHtml($("amphurName").value || "")}</p>
      <h2>Results</h2>
      <table border="1">
        <thead><tr><th>Year</th><th>Profession</th><th>Actual Workload FTE</th><th>Target Need FTE</th><th>Planning Required FTE</th><th>Actual Supply FTE</th><th>HR GAP</th><th>WISN Ratio</th><th>Pressure</th><th>Trend</th><th>Coverage Gap</th><th>Workload Gap</th><th>Suggested Add</th><th>Reallocate</th><th>Risk</th><th>Recommendation</th></tr></thead>
        <tbody>${resultTableRowsHtml()}</tbody>
      </table>
      <h2>Formula</h2><pre>${escapeHtml($("formulaText").textContent)}</pre>
      <h2>Source / Assumption</h2><pre>${escapeHtml($("sourceText").textContent)}</pre>
    </body></html>`;
    downloadBlob(html, "HR_Blueprint_WISN_Historical.xls", "application/vnd.ms-excel;charset=utf-8");
  };

  window.buildReportText = function buildReportTextFormulaAware() {
    const lines = [
      "HR Blueprint WISN Historical Analysis Report",
      `Scenario: ${$("scenarioName").value}`,
      `Scope: ${state.provinceRow?.province || "-"} / ${$("amphurName").value || "-"} / ${$("unitName").value || "-"} / ${$("scopeMode").value}`,
      `Historical years: ${years().join(", ")}`,
      `Confidence: ${$("confidenceLevel").value}`,
      "",
      "Policy: actual historical observations only; no synthetic historical observations.",
      `District data status: ${$("districtDataStatus")?.textContent || "-"}`,
      "",
      "Summary",
      `Total positive GAP: ${$("summaryGap").textContent}`,
      `High risk rows: ${$("summaryRisk").textContent}`,
      `Coverage gap: ${$("summaryReplacement").textContent}`,
      `Workload gap: ${$("summaryNetOutflow").textContent}`,
      "",
      "Results",
      "Year | Profession | Actual Workload FTE | Target Need FTE | Planning Required FTE | Actual Supply FTE | HR GAP | WISN Ratio | Pressure | Trend | Coverage Gap | Workload Gap | Suggested Add | Risk | Recommendation",
    ];
    for (const row of state.results) {
      lines.push(`${row.year} | ${row.professionLabel} | ${(row.actualNeedFte ?? 0).toFixed(1)} | ${(row.targetNeedFte ?? 0).toFixed(1)} | ${(row.needFte ?? 0).toFixed(1)} | ${(row.supplyFte ?? 0).toFixed(1)} | ${(row.gapFte ?? 0).toFixed(1)} | ${fmtRatio(row.wisnRatio)} | ${fmtRatio(row.pressureIndex)} | ${fmtRatio(row.trendIndex)} | ${row.coverageGap == null ? "N/A" : row.coverageGap.toFixed(0)} | ${row.workloadGap == null ? "N/A" : row.workloadGap.toFixed(0)} | ${row.suggestedAdd ?? "—"} | ${row.risk} | ${row.recommendation}`);
    }
    lines.push("", "Formula", $("formulaText").textContent, "", "Source / Assumption", $("sourceText").textContent);
    return lines.join("\n");
  };
})();

// Parser-inserted loader keeps v2 layers ahead of the Excel/help scripts without changing the large HTML document.
document.write('<script src="Simulator_HR_blueprint_profession_dictionary.js"><\/script>');
document.write('<script src="Simulator_HR_blueprint_profession_workload.js"><\/script>');
document.write('<script src="Simulator_HR_blueprint_health_kpi.js"><\/script>');
document.write('<script src="Simulator_HR_blueprint_mock_chiangrai.js"><\/script>');
