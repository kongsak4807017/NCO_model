// Import values from Excel/HTML exports downloaded from the public CMI / Service Plan site.
// This is the reliable browser-side path because the source currently rejects server-to-server
// requests from GitHub-hosted runners with HTTP 403.
(() => {
  "use strict";

  const PD = window.NCO_HR_PROFESSION_DICTIONARY || { healthKpis:{}, kpiAliases:{} };

  function canonicalCode(code) {
    return PD.kpiAliases?.[String(code || "")] || String(code || "");
  }

  function normalizeToken(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/โรงพยาบาล/g, "")
      .replace(/\s+/g, "")
      .replace(/[^0-9a-zก-๙]/gi, "");
  }

  function numeric(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).replace(/,/g, "").replace(/%/g, "").trim();
    if (!text || text === "-" || text === "—") return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }

  function knownCodes() {
    return [...Object.keys(PD.healthKpis || {}), ...Object.keys(PD.kpiAliases || {})]
      .sort((a,b) => b.length - a.length);
  }

  function detectCode(matrix, fileName) {
    const cells = (matrix || []).slice(0, 40).flat().map((v) => String(v ?? ""));
    const haystack = [String(fileName || ""), ...cells].join(" ");
    const upper = haystack.toUpperCase();
    for (const code of knownCodes()) {
      const re = new RegExp("(^|[^A-Z0-9])" + code.replace(/[.*+?^$()|[\]\\]/g, "\\$&") + "([^A-Z0-9]|$)", "i");
      if (re.test(upper)) return canonicalCode(code);
    }
    const lower = haystack.toLowerCase();
    const byName = Object.values(PD.healthKpis || {}).filter((k) => k.name && lower.includes(String(k.name).toLowerCase()));
    return byName.length === 1 ? byName[0].code : "";
  }

  function detectYear(matrix, fileName) {
    const cells = (matrix || []).slice(0, 40).flat().map((v) => String(v ?? ""));
    const haystack = [String(fileName || ""), ...cells].join(" ");
    const m = haystack.match(/\b(25\d{2})\b/);
    return m ? Number(m[1]) : null;
  }

  function findStateRow(year, code) {
    return (state.healthKpiRows || []).find((r) =>
      Number(r.year) === Number(year) && String(r.indicator_code) === String(code));
  }

  function findValue(matrix, kpi) {
    const province = normalizeToken(state.provinceRow?.province || "");
    const unit = normalizeToken($("unitName")?.value || "");
    const mode = $("scopeMode")?.value || "hospital";
    const rows = (matrix || []).filter((row) => Array.isArray(row) && row.some((v) => String(v ?? "").trim() !== ""));

    if (mode === "hospital" && unit) {
      for (const row of rows) {
        const rowText = normalizeToken(row.join(" "));
        if (!rowText.includes(unit)) continue;
        const nums = row.map(numeric).filter((x) => x !== null);
        if (nums.length) return { value: nums[nums.length - 1], method: "hospital-row" };
      }
    }

    if (mode === "province" && province) {
      for (const row of rows) {
        const rowText = normalizeToken(row.join(" "));
        if (!rowText.includes(province)) continue;
        const hasHospitalCode = row.some((v) => /^\s*\d{5}\s+/.test(String(v ?? "")));
        if (hasHospitalCode) continue;
        const nums = row.map(numeric).filter((x) => x !== null);
        if (nums.length) return { value: nums[nums.length - 1], method: "province-summary-row" };
      }

      let numerator = 0;
      let denominator = 0;
      let count = 0;
      for (const row of rows) {
        const rowText = normalizeToken(row.join(" "));
        if (!rowText.includes(province)) continue;
        const hospitalIndex = row.findIndex((v) => /^\s*\d{5}\s+/.test(String(v ?? "")));
        if (hospitalIndex < 0) continue;
        const nums = row.slice(hospitalIndex + 1).map(numeric).filter((x) => x !== null);
        if (nums.length >= 3) {
          numerator += nums[0];
          denominator += nums[1];
          count += 1;
        }
      }
      if (count && denominator > 0) {
        const unitText = String(kpi?.unit || "");
        const scale = unitText.includes("1000") ? 1000 : unitText.includes("100k") ? 100000 : 100;
        return { value: numerator / denominator * scale, method: "province-aggregate" };
      }
    }

    return null;
  }

  async function importFiles(files) {
    const status = $("cmiImportStatus");
    if (!files?.length) return;
    if (typeof XLSX === "undefined") {
      if (status) status.textContent = "อ่านไฟล์ไม่ได้: SheetJS ยังไม่พร้อม";
      return;
    }

    let imported = 0;
    const messages = [];

    for (const file of Array.from(files)) {
      try {
        const wb = XLSX.read(await file.arrayBuffer(), { type:"array", raw:true });
        let matched = false;

        for (const sheetName of wb.SheetNames) {
          const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header:1, defval:null, raw:true });
          const code = detectCode(matrix, file.name);
          const year = detectYear(matrix, file.name);
          if (!code || !year) continue;

          const kpi = PD.healthKpis?.[code];
          if (!kpi) continue;
          const found = findValue(matrix, kpi);
          if (!found) continue;

          const row = findStateRow(year, code);
          if (!row) {
            messages.push(file.name + ": พบ " + code + "/" + year + " แต่ template ไม่มีปีนี้");
            continue;
          }

          row.value = found.value;
          row.source = kpi.sourceUrl || "CMI export";
          row.source_system = kpi.sourceSystem || "CMI";
          row.source_url = kpi.sourceUrl || "";
          row.verification_status = "Reviewed";
          row.note = [row.note, "Imported from CMI export: " + file.name + "; " + found.method].filter(Boolean).join(" | ");
          if (typeof markObserved === "function") markObserved("healthKpi", String(year) + ":" + code);
          imported += 1;
          matched = true;
          break;
        }

        if (!matched) messages.push(file.name + ": หา KPI code/ปี/แถวที่ตรงกับ scope ปัจจุบันไม่พบ");
      } catch (error) {
        messages.push(file.name + ": " + (error?.message || error));
      }
    }

    window.renderHealthKpiTable?.();
    window.renderProfileCompleteness?.();
    if (status) {
      status.textContent = imported
        ? "นำเข้าจาก CMI ได้ " + imported + " ค่า — ตั้งสถานะ Reviewed; โปรดทวนสอบก่อน Verified" + (messages.length ? " | " + messages.join(" ; ") : "")
        : "ยังนำเข้าค่าไม่ได้ — " + (messages.join(" ; ") || "ตรวจไฟล์ Export จาก CMI");
    }
  }

  function install() {
    const panel = $("healthKpiPanel");
    const toolRow = panel?.querySelector(".tool-row");
    if (!panel || !toolRow || $("cmiKpiImport")) return;

    const label = document.createElement("label");
    label.className = "btn secondary";
    label.style.cursor = "pointer";
    label.innerHTML = 'นำเข้า Excel จาก CMI<input id="cmiKpiImport" type="file" accept=".xlsx,.xls,.html,.htm" multiple hidden>';
    toolRow.appendChild(label);

    const status = document.createElement("p");
    status.id = "cmiImportStatus";
    status.className = "profile-status";
    status.textContent = "CMI direct source: ดาวน์โหลด “Save as Excel / Export Page Data” จากหน้า CMI แล้วเลือกไฟล์นี้ ระบบจะ map KPI/ปี/scope ให้โดยไม่ต้องคีย์ค่าใหม่";
    toolRow.insertAdjacentElement("afterend", status);

    $("cmiKpiImport")?.addEventListener("change", (event) => importFiles(event.target.files));
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(install, 50));
  window.importCmiKpiExportFiles = importFiles;
})();
