// Load the validated five-year CMI snapshot from GitHub Pages into Health KPI History.
(() => {
  "use strict";

  const SNAPSHOT_URL = "output/cmi_5y/health_kpi_records.json";
  const PD = window.NCO_HR_PROFESSION_DICTIONARY || { healthKpis:{} };
  let cache = null;

  function normalizeName(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/โรงพยาบาล|รพ\\.?|hospital/g, "")
      .replace(/\\s+/g, "")
      .replace(/[^0-9a-zก-๙]/gi, "");
  }

  function nullable(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function scaleForUnit(unit) {
    const text = String(unit || "");
    if (text.includes("100k")) return 100000;
    if (text.includes("1000")) return 1000;
    if (text === "%") return 100;
    return null;
  }

  async function loadSnapshot(force = false) {
    if (cache && !force) return cache;
    const response = await fetch(SNAPSHOT_URL, { cache: force ? "reload" : "no-cache" });
    if (!response.ok) throw new Error("CMI snapshot HTTP " + response.status);
    const data = await response.json();
    if (data?.schema_version !== "nco-cmi-kpi-5y-v1") throw new Error("CMI snapshot schema ไม่ถูกต้อง");
    cache = data;
    window.NCO_CMI_5Y_SNAPSHOT = data;
    return data;
  }

  function recordToKpiRow(record, value, sourceMethod) {
    return {
      year: Number(record.year),
      indicator_code: String(record.indicator_code),
      indicator_name: record.indicator_name || record.indicator_code,
      value,
      unit: record.unit || "",
      direction: PD.healthKpis?.[record.indicator_code]?.direction || "",
      threshold: PD.healthKpis?.[record.indicator_code]?.threshold ?? "",
      source_system: "CMI / Service Plan Region 1",
      source_url: record.source_url || "",
      source_indicator_code: record.indicator_code,
      canonical_indicator_code: record.indicator_code,
      source: record.source_url || "CMI 5-year snapshot",
      verification_status: "Reviewed",
      note: [
        "CMI 5Y snapshot: " + sourceMethod,
        record.numerator !== null && record.numerator !== undefined ? "numerator=" + record.numerator : "",
        record.denominator !== null && record.denominator !== undefined ? "denominator=" + record.denominator : "",
        record.source_sha256 ? "source_sha256=" + record.source_sha256 : "",
      ].filter(Boolean).join(" | "),
      cmi_hospital_code: record.hospital_code || "",
      cmi_hospital_name: record.hospital_name || "",
      cmi_numerator: nullable(record.numerator),
      cmi_denominator: nullable(record.denominator),
      cmi_source_sha256: record.source_sha256 || "",
    };
  }

  function upsertRow(row) {
    state.healthKpiRows ||= [];
    const idx = state.healthKpiRows.findIndex((x) =>
      Number(x.year) === Number(row.year) && String(x.indicator_code) === String(row.indicator_code));
    if (idx >= 0) state.healthKpiRows[idx] = { ...state.healthKpiRows[idx], ...row };
    else state.healthKpiRows.push(row);
    if (typeof markObserved === "function") markObserved("healthKpi", String(row.year) + ":" + row.indicator_code);
  }

  function selectedHospitalRecords(data) {
    const code = String($("cmiHospitalCode")?.value || "").trim();
    const unit = normalizeName($("unitName")?.value || "");
    if (!code && !unit) return { records:[], message:"กรุณาระบุรหัส รพ. 5 หลัก หรือชื่อโรงพยาบาลใน Scope" };

    let records = data.records || [];
    if (code) {
      records = records.filter((r) => String(r.hospital_code || "") === code);
      return {
        records,
        message: records.length ? "จับคู่ด้วยรหัส รพ. " + code : "ไม่พบรหัส รพ. " + code + " ใน snapshot",
      };
    }

    const names = [...new Set(records.map((r) => r.hospital_name).filter(Boolean))];
    const matches = names.filter((name) => normalizeName(name) === unit || normalizeName(name).includes(unit) || unit.includes(normalizeName(name)));
    if (matches.length !== 1) {
      return { records:[], message:"ชื่อโรงพยาบาลจับคู่ได้ " + matches.length + " แห่ง — โปรดใช้รหัส รพ. 5 หลักเพื่อความแน่นอน" };
    }
    records = records.filter((r) => r.hospital_name === matches[0]);
    return { records, message:"จับคู่ชื่อ: " + matches[0] + " (แนะนำบันทึกรหัส รพ. 5 หลัก)" };
  }

  function provinceAggregateRows(data) {
    const province = String(state.provinceRow?.province || "").trim();
    if (!province) return { rows:[], message:"ยังไม่ได้เลือกจังหวัด" };

    const records = (data.records || []).filter((r) => String(r.province || "").trim() === province);
    const groups = new Map();
    for (const r of records) {
      if (PD.healthKpis?.[r.indicator_code]?.display === false) continue;
      const key = String(r.year) + ":" + String(r.indicator_code);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    const rows = [];
    for (const group of groups.values()) {
      const ref = group[0];
      const usable = group.filter((r) => nullable(r.numerator) !== null && nullable(r.denominator) !== null);
      const scale = scaleForUnit(ref.unit);
      if (!usable.length || !scale) continue;
      const numerator = usable.reduce((sum,r)=>sum + Number(r.numerator), 0);
      const denominator = usable.reduce((sum,r)=>sum + Number(r.denominator), 0);
      if (!denominator) continue;
      rows.push(recordToKpiRow(
        { ...ref, hospital_code:"PROV", hospital_name:province, numerator, denominator },
        numerator / denominator * scale,
        "province aggregate from " + usable.length + " hospital rows"
      ));
    }
    return { rows, message:"คำนวณระดับจังหวัดจาก numerator/denominator ของ รพ. " + province + " โดยไม่ใช้ค่าเฉลี่ยร้อยละแบบไม่ถ่วงน้ำหนัก" };
  }

  async function applySnapshot() {
    const status = $("cmiSnapshotStatus");
    try {
      if (status) status.textContent = "กำลังอ่านฐาน CMI 5 ปี…";
      const data = await loadSnapshot();
      if (!(data.records || []).length) {
        if (status) status.textContent = "ฐาน CMI 5 ปีถูกเตรียม schema แล้ว แต่ยังไม่มี raw collection ที่ผ่านการ normalize/validate";
        return;
      }

      const mode = $("scopeMode")?.value || "hospital";
      let imported = 0;
      let methodMessage = "";

      if (mode === "province") {
        const result = provinceAggregateRows(data);
        for (const row of result.rows) {
          upsertRow(row);
          imported += 1;
        }
        methodMessage = result.message;
      } else if (mode === "hospital") {
        const result = selectedHospitalRecords(data);
        for (const record of result.records) {
          if (PD.healthKpis?.[record.indicator_code]?.display === false) continue;
          upsertRow(recordToKpiRow(record, nullable(record.value), "hospital " + record.hospital_code));
          imported += 1;
        }
        methodMessage = result.message;
      } else {
        methodMessage = "CMI snapshot รุ่นนี้รองรับ auto-fill ระดับโรงพยาบาลและจังหวัดก่อน; district/network ต้องมี mapping หน่วยบริการ";
      }

      window.renderHealthKpiTable?.();
      window.renderProfileCompleteness?.();
      const comp = data.completeness || {};
      if (status) status.textContent =
        "โหลด " + imported + " KPI-year | " + methodMessage +
        " | snapshot=" + (data.status || "-") +
        " | completeness=" + (comp.parsed ?? comp.indicator_year_available ?? 0) + "/" + (comp.expected ?? comp.indicator_year_expected ?? 0);
    } catch (error) {
      if (status) status.textContent = "โหลด CMI snapshot ไม่สำเร็จ: " + (error?.message || error);
    }
  }

  async function showSnapshotStatus() {
    const status = $("cmiSnapshotStatus");
    try {
      const data = await loadSnapshot();
      const comp = data.completeness || {};
      status.textContent = (data.records || []).length
        ? "CMI snapshot พร้อม: " + (data.records || []).length.toLocaleString() + " rows | " + (data.years || []).join(", ") +
          " | completeness " + (comp.parsed ?? comp.indicator_year_available ?? 0) + "/" + (comp.expected ?? comp.indicator_year_expected ?? 0)
        : "CMI snapshot: รอการเก็บข้อมูลจาก authorised workstation (โครงสร้างพร้อมแล้ว)";
    } catch (error) {
      status.textContent = "CMI snapshot: " + (error?.message || error);
    }
  }

  function install() {
    const panel = $("healthKpiPanel");
    const toolRow = panel?.querySelector(".tool-row");
    if (!panel || !toolRow || $("btnLoadCmiSnapshot")) return;

    const codeField = document.createElement("label");
    codeField.className = "field inline";
    codeField.innerHTML = '<span>รหัส รพ. 5 หลัก (สำหรับจับคู่ CMI)</span><input id="cmiHospitalCode" inputmode="numeric" maxlength="5" placeholder="เช่น 10713">';
    toolRow.appendChild(codeField);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn primary";
    button.id = "btnLoadCmiSnapshot";
    button.textContent = "โหลด CMI 5 ปีย้อนหลัง";
    toolRow.appendChild(button);

    const status = document.createElement("p");
    status.id = "cmiSnapshotStatus";
    status.className = "profile-status";
    status.textContent = "กำลังตรวจฐาน CMI 5 ปี…";
    toolRow.insertAdjacentElement("afterend", status);

    button.addEventListener("click", applySnapshot);
    showSnapshotStatus();
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(install, 60));
  window.loadCmiFiveYearSnapshot = applySnapshot;
})();
