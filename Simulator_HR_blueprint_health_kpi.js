// Health KPI context for HR Blueprint v2.
// KPI associations are contextual validation signals and are not causal claims about staffing.
(() => {
  "use strict";
  const PD = window.NCO_HR_PROFESSION_DICTIONARY || { healthKpis:{}, workloadDefinitions:{} };
  const KPI_CODES = ["A01","A04","A09","B01","C02","D01","F10","DH0101","DH0102","DN0101","DN0142D","CI0101","PE0102","CM0203","CM0101","DC0401","DG0201","PS0001","RH0101"];

  function relatedKpisForProfession(code) {
    const codes = new Set();
    for (const def of PD.workloadDefinitions?.[code] || []) for (const kpi of def.related_kpi_codes || []) codes.add(kpi);
    return Array.from(codes).map((kpi)=>PD.healthKpis?.[kpi]).filter(Boolean);
  }
  window.relatedKpisForProfession = relatedKpisForProfession;

  function linkedProfessionLabels(kpiCode) {
    const labels = [];
    for (const code of Array.from(state.selectedProfessions || [])) {
      const linked = (PD.workloadDefinitions?.[code] || []).some((def)=>(def.related_kpi_codes || []).includes(kpiCode));
      if (linked) labels.push(getProfession(code)?.label || code);
    }
    return labels.join(", ");
  }

  function kpiRow(year, code) {
    return (state.healthKpiRows || []).find((row)=>Number(row.year)===Number(year) && String(row.indicator_code)===String(code));
  }

  function healthKpiValueStatus(row, catalog) {
    if (!row || row.value === null || row.value === undefined || String(row.value).trim() === "") return "ยังไม่มีข้อมูล";
    if (!catalog?.threshold) return "มีข้อมูล — ไม่มี threshold canonical ใน repo";
    return row.verification_status === "Verified" ? "Verified" : "Provisional";
  }

  function renderHealthKpiTable() {
    const body = $("healthKpiBody");
    if (!body) return;
    const professionFilter = $("healthKpiProfessionFilter")?.value || "all";
    let allowed = new Set(KPI_CODES);
    if (professionFilter !== "all") allowed = new Set(relatedKpisForProfession(professionFilter).map((kpi)=>kpi.code));
    const rows = (state.healthKpiRows || []).filter((row)=>allowed.has(row.indicator_code));
    body.innerHTML = rows.map((row)=>{
      const kpi = PD.healthKpis?.[row.indicator_code] || { name:row.indicator_name, unit:row.unit, threshold:row.threshold, direction:row.direction };
      const key = `${row.year}:${row.indicator_code}`;
      return `<tr>
        <td>${row.year}</td>
        <td><strong>${profileEscape(row.indicator_code)}</strong></td>
        <td>${profileEscape(kpi.name || row.indicator_name || "")}</td>
        <td><input type="number" step="any" data-kpi-field="value" data-kpi-key="${key}" value="${row.value ?? ""}"></td>
        <td>${profileEscape(kpi.unit || row.unit || "")}</td>
        <td>${profileEscape(kpi.direction || row.direction || "")}</td>
        <td>${profileEscape(kpi.threshold ?? row.threshold ?? "—")}</td>
        <td><input data-kpi-field="source" data-kpi-key="${key}" value="${profileEscape(row.source || "")}" placeholder="HDC / Service Plan / registry"></td>
        <td><select data-kpi-field="verification_status" data-kpi-key="${key}"><option>Draft</option><option${row.verification_status === "Reviewed" ? " selected" : ""}>Reviewed</option><option${row.verification_status === "Verified" ? " selected" : ""}>Verified</option></select></td>
        <td>${profileEscape(linkedProfessionLabels(row.indicator_code) || "—")}</td>
        <td>${profileEscape(healthKpiValueStatus(row,kpi))}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="11">ยังไม่มี KPI row สำหรับตัวกรองนี้</td></tr>`;
  }
  window.renderHealthKpiTable = renderHealthKpiTable;

  function updateKpiField(target) {
    const [year, code] = String(target.dataset.kpiKey || "").split(":");
    const row = kpiRow(year, code);
    if (!row) return;
    const field = target.dataset.kpiField;
    row[field] = field === "value" ? nullableNumber(target.value) : target.value;
    if (field === "value") markObserved("healthKpi", `${year}:${code}`);
    if (state.profileMetadata?.HealthKPI?.status === "Verified") state.profileMetadata.HealthKPI.status = "Draft";
    renderProfileCompleteness();
  }

  function renderKpiProfessionFilter() {
    const select = $("healthKpiProfessionFilter");
    if (!select) return;
    const current = select.value || "all";
    select.innerHTML = `<option value="all">KPI ที่เกี่ยวข้องทั้งหมด</option>` + Array.from(state.selectedProfessions || []).map((code)=>`<option value="${code}">${profileEscape(getProfession(code)?.label || code)}</option>`).join("");
    select.value = Array.from(select.options).some((o)=>o.value===current) ? current : "all";
  }

  function installHealthKpiPanel() {
    if ($("healthKpiPanel")) return;
    const needPanel = $("need");
    if (!needPanel) return;
    const section = document.createElement("section");
    section.className = "panel";
    section.id = "healthKpiPanel";
    section.innerHTML = `
      <div class="panel-header"><div><span class="section-num">5B</span><h3>Health Outcome KPI Context</h3></div><p>เชื่อม capacity ของวิชาชีพกับ outcome/service KPI ที่เกี่ยวข้องเพื่อประกอบการวิเคราะห์ — <strong>ไม่ใช่หลักฐานเชิงสาเหตุว่ากำลังคนเป็นเหตุของ KPI</strong></p></div>
      <div class="validation-banner"><strong>หลักการ:</strong> KPI ช่วยตอบว่า “ผลลัพธ์บริการ/สุขภาพเป็นอย่างไรในช่วงที่ capacity เป็นแบบนี้” แต่การเปลี่ยน KPI อาจเกิดจาก case mix, referral, technology, process, access และปัจจัยอื่นร่วมด้วย</div>
      <div class="tool-row"><label class="field inline"><span>กรองตามวิชาชีพ</span><select id="healthKpiProfessionFilter"></select></label></div>
      <div class="table-shell tall"><table class="data-table"><thead><tr><th>ปี</th><th>KPI</th><th>ชื่อ</th><th>ค่าจริง</th><th>หน่วย</th><th>Direction</th><th>Canonical threshold</th><th>Source</th><th>Verify</th><th>Related professions</th><th>Status</th></tr></thead><tbody id="healthKpiBody"></tbody></table></div>`;
    needPanel.parentNode.insertBefore(section, needPanel.nextSibling);
    $("healthKpiProfessionFilter")?.addEventListener("change", renderHealthKpiTable);
    $("healthKpiBody")?.addEventListener("input", (event)=>{ if (event.target.dataset.kpiField) updateKpiField(event.target); });
    $("healthKpiBody")?.addEventListener("change", (event)=>{ if (event.target.dataset.kpiField) updateKpiField(event.target); });
    $("professionGrid")?.addEventListener("change", ()=>setTimeout(()=>{ renderKpiProfessionFilter(); renderHealthKpiTable(); },0));
    renderKpiProfessionFilter();
    renderHealthKpiTable();
  }

  const baseRenderTrace = renderTrace;
  renderTrace = function renderTraceWithKpiContext() {
    baseRenderTrace();
    const observed = (state.healthKpiRows || []).filter((row)=>row.value !== null && row.value !== undefined && row.verification_status !== "Draft");
    const note = observed.length
      ? `\nHealth KPI context observed: ${observed.slice(0,12).map((row)=>`${row.year} ${row.indicator_code}=${row.value}${row.unit ? ` ${row.unit}` : ""} (${row.verification_status})`).join(" | ")}`
      : "\nHealth KPI context: ยังไม่มีค่าที่ Reviewed/Verified";
    $("sourceText").textContent += `${note}\nKPI association is contextual only and does not prove causal effect of staffing.`;
  };

  document.addEventListener("DOMContentLoaded", () => setTimeout(installHealthKpiPanel, 0));
})();

// Load the final interpretation layer before Excel/help scripts execute.
document.write('<script src="Simulator_HR_blueprint_v2_trace.js"><\/script>');
