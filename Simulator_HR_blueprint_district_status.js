// District baseline status wording override.
// Loaded after Simulator_HR_blueprint_historical.js so the province/district logic
// can distinguish an available district directory from an unavailable population snapshot.

renderAmphurSelect = function renderAmphurSelect() {
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
  const directoryLabel = `พบ ${rows.length} อำเภอ`;
  const populationLabel = populationSource.available
    ? `population snapshot จริง พ.ศ. ${populationSource.reference_year_be || "ไม่ระบุปี"}`
    : "ยังไม่มี population snapshot — กรุณากรอก/ทวนสอบเอง";
  status.textContent = `ข้อมูลอำเภอ: ${directoryLabel} | ${populationLabel} | ทุกค่าที่กรอกแก้ไขได้`;
};
