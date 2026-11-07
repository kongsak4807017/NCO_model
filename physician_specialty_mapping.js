// NCO physician-specialty workload mapping. This is a separate decision-support
// layer: it does not overwrite the profession-level WISN model or HR baseline.
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.NCOPhysicianSpecialtyMapping = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HEADERS = Object.freeze({
    supply: ["hospital_code","year","physician_key","specialty_name","specialty_code","fte","source","verification_status"],
    workload: ["hospital_code","year","specialty_name","specialty_code","activity_code","volume","volume_unit","minutes_per_unit","standard_unit","awt_minutes","cas_percent","ias_hours","source","workload_verification_status","standard_source","standard_verification_status","overlap_policy"],
    crosswalk: ["raw_specialty_name","specialty_code","verification_status","approved_by","source"],
  });
  const KEY = (hospital, year, specialty) => [hospital,year,specialty].join("|");
  const FINITE = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const NORMAL = (text) => String(text || "").normalize("NFKC").replace(/^(อนุสาขา|สาขา)\s*/u,"").replace(/[\s\u200b._-]+/g,"").toLocaleLowerCase();
  const status = (text) => String(text || "").trim().toLowerCase();

  function parseCsv(input) {
    const text = String(input || "").replace(/^\uFEFF/, "");
    if (!text.trim()) return [];
    const cells = [], lines = [];
    let value = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { value += '"'; i++; }
        else if (!quoted && value === "") quoted = true;
        else if (quoted) quoted = false;
        else throw new Error("Invalid CSV quote at character " + (i + 1));
      } else if (char === "," && !quoted) { cells.push(value); value = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        cells.push(value); value = "";
        if (cells.some((item) => item.trim())) lines.push(cells.splice(0));
        else cells.length = 0;
      } else value += char;
    }
    if (quoted) throw new Error("Unterminated CSV quoted field");
    cells.push(value);
    if (cells.some((item) => item.trim())) lines.push(cells);
    if (!lines.length) return [];
    const header = lines.shift().map((item) => item.trim().replace(/^\uFEFF/, ""));
    if (new Set(header).size !== header.length) throw new Error("Duplicate CSV headers");
    return lines.map((row, i) => {
      if (row.length !== header.length) throw new Error("CSV row " + (i + 2) + " has " + row.length + " fields (expected " + header.length + ")");
      return Object.fromEntries(header.map((h, j) => [h, row[j].trim()]));
    });
  }

  function csvCell(value) {
    if (value === null || value === undefined) return "";
    let text = String(value);
    // Do not turn user-provided names/IDs into spreadsheet formulas on download.
    if (typeof value === "string" && /^[=+@-]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }
  function toCsv(rows, columns) {
    return [columns.join(","), ...rows.map((row) => columns.map((col) => csvCell(row[col])).join(","))].join("\r\n") + "\r\n";
  }

  function normalizeCatalog(catalog) {
    const records = catalog?.specialties;
    if (!Array.isArray(records) || records.length === 0) throw new Error("Specialty catalog unavailable");
    const byCode = new Map(), byLabel = new Map(), ambiguous = new Set();
    for (const row of records) {
      if (!row.code || !row.name_th || byCode.has(row.code)) throw new Error("Invalid or duplicated specialty catalog code");
      byCode.set(row.code, row);
      for (const label of [row.name_th, row.name_en]) {
        const key = NORMAL(label);
        if (!key) continue;
        if (byLabel.has(key) && byLabel.get(key) !== row.code) ambiguous.add(key);
        else byLabel.set(key, row.code);
      }
    }
    for (const key of ambiguous) byLabel.delete(key);
    return { byCode, byLabel, count: records.length };
  }

  function compute({ catalog, supply = [], workload = [], crosswalk = [] }) {
    const ref = normalizeCatalog(catalog);
    const issues = [], groups = new Map(), physicianFte = new Map(), physicianGroups = new Map();
    const approvedCrosswalk = new Map();
    const addIssue = (kind, index, detail) => issues.push({ kind, row: index + 2, detail });
    const groupFor = (hospital, year, code) => {
      const key = KEY(hospital, year, code);
      if (!groups.has(key)) groups.set(key, { key, hospital_code:hospital, year:Number(year),
        specialty_code:code, specialty_name:ref.byCode.get(code).name_th,
        supply:[], workload:[], errors:[] });
      return groups.get(key);
    };
    const codeFor = (row) => {
      const direct = String(row.specialty_code || "").trim();
      if (direct) return ref.byCode.has(direct) ? direct : null;
      const raw = String(row.specialty_name || row.position_specialist_name || "").trim();
      const normal = NORMAL(raw);
      return approvedCrosswalk.get(normal) || ref.byLabel.get(normal) || null;
    };
    const context = (row) => {
      const hospital = String(row.hospital_code || "").trim(), year = String(row.year || "").trim();
      return /^\d{5}$/.test(hospital) && /^\d{4}$/.test(year) && Number(year) >= 2400 && Number(year) <= 2700 ? [hospital,year] : null;
    };
    const codeConflictsWithLabel = (row, code) => {
      const label = NORMAL(row.specialty_name || "");
      return Boolean(label && ref.byLabel.has(label) && ref.byLabel.get(label) !== code);
    };

    for (const [i, row] of crosswalk.entries()) {
      const raw = NORMAL(row.raw_specialty_name), code = String(row.specialty_code || "").trim();
      if (!raw || !ref.byCode.has(code) || status(row.verification_status) !== "verified" || !row.approved_by || !row.source) {
        addIssue("crosswalk", i, "Crosswalk requires known code, verified status, approver and source");
      } else if (approvedCrosswalk.has(raw) && approvedCrosswalk.get(raw) !== code) {
        addIssue("crosswalk", i, "Conflicting approved mappings for the same raw specialty");
        approvedCrosswalk.delete(raw);
      } else if (ref.byLabel.has(raw) && ref.byLabel.get(raw) !== code) {
        addIssue("crosswalk", i, "Crosswalk contradicts exact Medical Council catalog label");
      } else approvedCrosswalk.set(raw, code);
    }

    for (const [i, row] of supply.entries()) {
      const loc = context(row), code = codeFor(row);
      if (!loc) { addIssue("supply", i, "Hospital must be a 5-digit code and Buddhist year must be 2400–2700"); continue; }
      if (!code) { addIssue("supply", i, "Unmapped/unknown specialty: " + (row.specialty_name || row.position_specialist_name || row.specialty_code)); continue; }
      const group = groupFor(...loc, code);
      if (codeConflictsWithLabel(row, code)) group.errors.push("Specialty code contradicts an exact catalog specialty name");
      if (!row.physician_key || !FINITE(row.fte) || Number(row.fte) <= 0 || Number(row.fte) > 1) {
        group.errors.push("Missing anonymous physician_key or invalid FTE (expected >0 and <=1)");
        addIssue("supply", i, "Invalid physician identity or FTE"); continue;
      }
      if (!row.source) group.errors.push("Missing supply source");
      const id = loc[1] + "|" + String(row.physician_key).trim();
      const prev = physicianFte.get(id) || 0;
      physicianFte.set(id, prev + Number(row.fte));
      (physicianGroups.get(id) || physicianGroups.set(id, new Set()).get(id)).add(group.key);
      if (group.supply.some((item) => item.physician_key === row.physician_key)) {
        group.errors.push("Repeated physician in the same specialty/year/hospital");
        addIssue("supply", i, "Duplicate physician-specialty assignment"); continue;
      }
      group.supply.push({ ...row, fte:Number(row.fte) });
    }
    for (const [id, value] of physicianFte) {
      if (value <= 1.000001) continue;
      for (const key of physicianGroups.get(id) || []) groups.get(key).errors.push("Physician allocated >1.0 FTE across specialties/facilities");
      issues.push({ kind:"supply", row:"—", detail:"Physician " + id.split("|")[1] + " exceeds 1.0 FTE in one year" });
    }

    for (const [i, row] of workload.entries()) {
      const loc = context(row), code = codeFor(row);
      if (!loc) { addIssue("workload", i, "Hospital must be 5-digit and Buddhist year 2400–2700"); continue; }
      if (!code) { addIssue("workload", i, "Unmapped/unknown specialty: " + (row.specialty_name || row.specialty_code)); continue; }
      const group = groupFor(...loc, code);
      if (codeConflictsWithLabel(row, code)) group.errors.push("Specialty code contradicts an exact catalog specialty name");
      if (!row.activity_code || !FINITE(row.volume) || Number(row.volume) < 0 || !FINITE(row.minutes_per_unit) || Number(row.minutes_per_unit) <= 0 ||
        !FINITE(row.awt_minutes) || Number(row.awt_minutes) <= 0 || !FINITE(row.cas_percent) || Number(row.cas_percent) < 0 || Number(row.cas_percent) >= 100 ||
        !FINITE(row.ias_hours) || Number(row.ias_hours) < 0) {
        group.errors.push("Invalid or missing workload, Activity Standard, AWT, CAS or IAS");
        addIssue("workload", i, "Invalid numeric parameters"); continue;
      }
      const unit = String(row.volume_unit || "").trim().toLowerCase();
      const normUnit = (text) => String(text || "").toLowerCase().replace(/s$/, "");
      if (!unit || normUnit(String(row.standard_unit || "").replace(/^minutes\//i,"")) !== normUnit(unit) ||
        !/^minutes\//i.test(String(row.standard_unit || ""))) group.errors.push("Workload and Activity Standard units do not match");
      if (!row.source || !row.standard_source) group.errors.push("Missing workload/standard provenance");
      if (!["independent","exclusive","deduplicated"].includes(status(row.overlap_policy))) group.errors.push("Unknown overlapping workload");
      if (group.workload.some((item) => item.activity_code === row.activity_code)) group.errors.push("Duplicate activity_code in specialty/year");
      group.workload.push({ ...row, volume:Number(row.volume), minutes_per_unit:Number(row.minutes_per_unit),
        awt_minutes:Number(row.awt_minutes), cas_percent:Number(row.cas_percent), ias_hours:Number(row.ias_hours) });
    }

    return { catalog_count:ref.count, issues, results:[...groups.values()].map((group) => {
      const reasons = [...new Set(group.errors)], supplyFte = group.supply.reduce((sum,row) => sum + row.fte, 0);
      const assumptions = new Set(group.workload.map((row) => [row.awt_minutes,row.cas_percent,row.ias_hours].join("|")));
      if (!group.supply.length) reasons.push("Missing observed specialty supply; missing is not zero");
      if (!group.workload.length) reasons.push("Missing specialty workload; facility OPD cannot substitute");
      if (assumptions.size > 1) reasons.push("Inconsistent AWT/CAS/IAS within specialty-year");
      const blocked = reasons.length > 0;
      const input = group.workload[0];
      const minutes = group.workload.reduce((sum,row) => sum + row.volume * row.minutes_per_unit, 0);
      const need = !blocked ? minutes / input.awt_minutes / (1 - input.cas_percent / 100) + (input.ias_hours * 60 / input.awt_minutes) : null;
      const fullyVerified = group.supply.every((row) => status(row.verification_status) === "verified") &&
        group.workload.every((row) => status(row.workload_verification_status) === "verified" &&
          status(row.standard_verification_status) === "verified");
      const fitness = blocked ? "BLOCKED" : fullyVerified ? "VERIFIED" : "PROVISIONAL";
      return { hospital_code:group.hospital_code, year:group.year, specialty_code:group.specialty_code,
        specialty_name:group.specialty_name, headcount:blocked?null:group.supply.length,
        actual_fte:blocked?null:Number(supplyFte.toFixed(3)),
        required_fte:need===null?null:Number(need.toFixed(3)),
        gap_fte:need===null?null:Number((need-supplyFte).toFixed(3)),
        data_fitness:fitness, reasons:reasons.join("; ") || (fitness==="PROVISIONAL"?"At least one input is not verified":""),
        source_count:group.supply.length+group.workload.length };
    }).sort((a,b) => a.hospital_code.localeCompare(b.hospital_code) || a.year-b.year || a.specialty_name.localeCompare(b.specialty_name,"th")) };
  }

  return Object.freeze({ HEADERS, parseCsv, toCsv, normalizeCatalog, compute });
});
