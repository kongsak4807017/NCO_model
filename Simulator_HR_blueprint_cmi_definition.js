// CMI definition registry: definition/formula/source are usable even when observed values are missing.
(() => {
  "use strict";
  const DEF_URL = "data/cmi/catalog/definitions.json";
  let definitionCache = null;

  if (!NCO_PROFILE_SHEETS.includes("CMI_KPI_Definitions")) NCO_PROFILE_SHEETS.push("CMI_KPI_Definitions");
  state.cmiDefinitionRows ||= [];

  const baseCollectProfilePayloadCmiDef = collectProfilePayload;
  const baseProfileRowsFromPayloadCmiDef = profileRowsFromPayload;
  const baseBlankTemplatePayloadCmiDef = blankTemplatePayload;
  const baseWorkbookSheetsFromXlsxCmiDef = workbookSheetsFromXlsx;
  const baseProfilePayloadFromSheetRowsCmiDef = profilePayloadFromSheetRows;
  const baseApplyProfilePayloadCmiDef = applyProfilePayload;

  collectProfilePayload = function collectProfilePayloadWithCmiDefinitions() {
    const payload = baseCollectProfilePayloadCmiDef();
    payload.cmi_kpi_definitions = JSON.parse(JSON.stringify(state.cmiDefinitionRows || []));
    return payload;
  };

  profileRowsFromPayload = function profileRowsFromPayloadWithCmiDefinitions(payload) {
    const rows = baseProfileRowsFromPayloadCmiDef(payload);
    rows.CMI_KPI_Definitions = payload.cmi_kpi_definitions || state.cmiDefinitionRows || [];
    return rows;
  };

  blankTemplatePayload = function blankTemplatePayloadWithCmiDefinitions(payload) {
    const copy = baseBlankTemplatePayloadCmiDef(payload);
    copy.cmi_kpi_definitions = JSON.parse(JSON.stringify(state.cmiDefinitionRows || []));
    return copy;
  };

  workbookSheetsFromXlsx = function workbookSheetsFromXlsxWithCmiDefinitions(workbook) {
    const sheets = baseWorkbookSheetsFromXlsxCmiDef(workbook);
    const ws = workbook.Sheets.CMI_KPI_Definitions;
    sheets.CMI_KPI_Definitions = ws ? XLSX.utils.sheet_to_json(ws, { defval:null, raw:false }) : [];
    return sheets;
  };

  profilePayloadFromSheetRows = function profilePayloadFromSheetRowsWithCmiDefinitions(sheets) {
    const payload = baseProfilePayloadFromSheetRowsCmiDef(sheets);
    payload.cmi_kpi_definitions = (sheets.CMI_KPI_Definitions || []).map((row) => ({ ...row }));
    return payload;
  };

  applyProfilePayload = function applyProfilePayloadWithCmiDefinitions(payload) {
    baseApplyProfilePayloadCmiDef(payload);
    if (Array.isArray(payload.cmi_kpi_definitions) && payload.cmi_kpi_definitions.length) {
      state.cmiDefinitionRows = payload.cmi_kpi_definitions.map((row) => ({ ...row }));
    }
  };

  async function loadDefinitions(force = false) {
    if (definitionCache && !force) return definitionCache;
    const res = await fetch(DEF_URL, { cache: force ? "reload" : "no-cache" });
    if (!res.ok) throw new Error("CMI definition registry HTTP " + res.status);
    const doc = await res.json();
    if (doc?.schema_version !== "nco-cmi-definition-registry-v1") throw new Error("CMI definition registry schema ไม่ถูกต้อง");
    definitionCache = doc;
    window.NCO_CMI_DEFINITIONS = doc;
    state.cmiDefinitionRows = (doc.indicators || []).map((row) => ({ ...row }));
    return doc;
  }

  function escape(value) {
    return typeof profileEscape === "function" ? profileEscape(value ?? "") : String(value ?? "");
  }

  function valueStatusByCode(code) {
    const rows = (state.healthKpiRows || []).filter((r) => String(r.indicator_code) === String(code));
    const available = rows.filter((r) => r.value !== null && r.value !== undefined && String(r.value).trim() !== "").length;
    return available ? "มีค่าจริง " + available + " ปี" : "ยังไม่มีค่าจริง";
  }

  function visibleCodes() {
    const rows = state.healthKpiRows || [];
    const codes = new Set(rows.map((r) => String(r.indicator_code || "")).filter(Boolean));
    for (const kpi of Object.values(window.NCO_HR_PROFESSION_DICTIONARY?.healthKpis || {})) {
      if (kpi.display !== false) codes.add(String(kpi.code));
    }
    return codes;
  }

  function renderDefinitionTable(doc) {
    const body = $("cmiDefinitionBody");
    if (!body) return;
    const codes = visibleCodes();
    const rows = (doc.indicators || []).filter((d) => codes.has(String(d.indicator_code)));
    body.innerHTML = rows.map((d) => {
      const logical = Array.isArray(d.hosxp_logical_source) ? d.hosxp_logical_source.join(", ") : (d.hosxp_logical_source || "");
      const ready = String(d.definition_status || "").startsWith("verified_") || d.definition_status === "source_page_metadata_derived";
      return `<tr>
        <td><strong>${escape(d.indicator_code)}</strong></td>
        <td>${escape(d.indicator_name)}</td>
        <td>${escape(d.numerator_label || "—")}</td>
        <td>${escape(d.denominator_label || "—")}</td>
        <td><code>${escape(d.formula || "รอ source definition")}</code></td>
        <td>${escape(d.unit || "—")}</td>
        <td><small>${escape(logical || "รอ mapping จากนิยาม CMI")}</small></td>
        <td>${escape(d.hosxp_mapping_status || "pending")}</td>
        <td>${escape(valueStatusByCode(d.indicator_code))}</td>
        <td><span class="risk ${ready ? "verified" : "provisional"}">${escape(d.definition_status || "pending")}</span></td>
        <td>${d.source_url ? `<a href="${escape(d.source_url)}" target="_blank" rel="noopener">CMI</a>` : "—"}</td>
      </tr>`;
    }).join("") || '<tr><td colspan="11">ยังไม่มีนิยามใน registry</td></tr>';

    const status = $("cmiDefinitionStatus");
    if (status) {
      const readyCount = (doc.indicators || []).filter((d) => String(d.definition_status || "") !== "pending_source_page").length;
      status.textContent = "Definition Registry: พร้อม " + readyCount + "/" + (doc.indicators || []).length +
        " ตัวชี้วัด — นิยามและสูตรใช้ได้แยกจากสถานะค่าจริงย้อนหลัง";
    }
  }

  async function refreshDefinitions() {
    const status = $("cmiDefinitionStatus");
    try {
      if (status) status.textContent = "กำลังอ่าน CMI Definition Registry…";
      renderDefinitionTable(await loadDefinitions(true));
    } catch (error) {
      if (status) status.textContent = "อ่านนิยาม CMI ไม่สำเร็จ: " + (error?.message || error);
    }
  }

  function install() {
    const panel = $("healthKpiPanel");
    if (!panel || $("cmiDefinitionGuide")) return;

    const details = document.createElement("details");
    details.id = "cmiDefinitionGuide";
    details.className = "legacy-workload-reference";
    details.innerHTML = `
      <summary><strong>CMI Definition Registry / วิธีคิด / HOSxP logical source</strong></summary>
      <div class="validation-banner">
        <strong>แยก Definition ออกจาก Value:</strong>
        ตัวชี้วัดที่ค่าจริงย้อนหลังยังไม่ครบสามารถมีนิยามพร้อมใช้ได้ หาก CMI ระบุตัวตั้ง/ตัวหาร/สูตรแล้ว
        HOSxP mapping ระบุเป็น logical fields ก่อน เพื่อให้ทุก รพ.ใช้หลักเกณฑ์เดียวกันโดยไม่ผูกกับ physical table ของ HOSxP รุ่นใดรุ่นหนึ่ง
      </div>
      <div class="tool-row"><button type="button" class="btn secondary" id="btnRefreshCmiDefinitions">Reload definitions</button></div>
      <p id="cmiDefinitionStatus" class="profile-status"></p>
      <div class="table-shell tall">
        <table class="data-table">
          <thead><tr>
            <th>KPI</th><th>ชื่อตัวชี้วัด</th><th>ตัวตั้ง</th><th>ตัวหาร</th><th>สูตร</th><th>หน่วย</th>
            <th>ข้อมูลที่ต้องหาใน HOSxP</th><th>HOSxP Mapping</th><th>ค่าจริง 5 ปี</th><th>Definition Status</th><th>Source</th>
          </tr></thead>
          <tbody id="cmiDefinitionBody"></tbody>
        </table>
      </div>`;
    panel.appendChild(details);

    $("btnRefreshCmiDefinitions")?.addEventListener("click", refreshDefinitions);
    loadDefinitions().then(renderDefinitionTable).catch((error) => {
      const status = $("cmiDefinitionStatus");
      if (status) status.textContent = "อ่านนิยาม CMI ไม่สำเร็จ: " + (error?.message || error);
    });
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(install, 80));
  window.loadCmiDefinitions = loadDefinitions;
  window.refreshCmiDefinitions = refreshDefinitions;
})();
