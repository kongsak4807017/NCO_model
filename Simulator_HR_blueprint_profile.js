// Collaborative Data Profile adapter for the historical HR Blueprint simulator.
// One schema is shared by Excel and Google Sheets. Missing historical facts stay null.

const NCO_PROFILE_SCHEMA = "nco-hr-profile-v1";
const NCO_PROFILE_SHEETS = [
  "Profile",
  "Section_Metadata",
  "Workload_History",
  "TargetNeed_History",
  "Workforce_History",
  "Profession_Config",
];
const PROFILE_SECTIONS = ["Population", "Workload", "Workforce", "TargetNeed", "WISN"];
const PROFILE_FACT_FIELDS = [
  "population",
  "opdVisits",
  "ipdAdmissions",
  "erVisits",
  "procedures",
  "deliveries",
  "chronicVisits",
  "mentalVisits",
  "outreachVisits",
];
const PROFILE_WORKLOAD_FIELDS = PROFILE_FACT_FIELDS.filter((field) => field !== "population");
const PROFILE_MOVEMENT_FIELDS = [
  "actualHeadcount",
  "recruit",
  "transferIn",
  "returnIn",
  "retire",
  "resign",
  "transferOut",
  "studyLeave",
];
const PROFILE_STORAGE_KEY = "nco_hr_collaborative_profile_settings_v1";

state.profileMetadata = state.profileMetadata || {};
state.profileObserved = state.profileObserved || {
  workload: {},
  workforce: {},
  targetNeed: {},
};

function blankSectionMetadata() {
  return {
    owner: "",
    source: "",
    status: "Draft",
    updated_at: "",
    note: "",
  };
}

function ensureProfileMetadata() {
  for (const section of PROFILE_SECTIONS) {
    state.profileMetadata[section] = {
      ...blankSectionMetadata(),
      ...(state.profileMetadata[section] || {}),
    };
  }
  return state.profileMetadata;
}

function cleanProfileToken(value, fallback = "NA") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || fallback;
}

function buildProfileId() {
  const provinceCode = String($("provinceSelect")?.value || state.provinceRow?.province_code || "NA");
  const amphurCode = String($("amphurSelect")?.value || "");
  const scopeMode = $("scopeMode")?.value || "province";
  const latestYear = n($("startYear")?.value, 2569);
  const areaToken = amphurCode || (scopeMode === "province" ? "PROV" : cleanProfileToken($("amphurName")?.value, "AREA"));
  const unitName = String($("unitName")?.value || "").trim();
  const unitSuffix = unitName ? `-${cleanProfileToken(unitName, "UNIT")}` : "";
  return `HR1-${cleanProfileToken(provinceCode)}-${cleanProfileToken(areaToken)}-${latestYear}${unitSuffix}`;
}

function nullableNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseProfileBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "selected", "ใช่"].includes(text);
}

function isExplicitObserved(bucket, key, value) {
  if (state.profileObserved?.[bucket]?.[key]) return true;
  const numeric = nullableNumber(value);
  return numeric !== null && numeric !== 0;
}

function observedFact(bucket, key, value) {
  return isExplicitObserved(bucket, key, value) ? nullableNumber(value) : null;
}

function markObserved(bucket, key) {
  state.profileObserved[bucket] ||= {};
  state.profileObserved[bucket][key] = true;
}

function touchProfileSection(section) {
  ensureProfileMetadata();
  const meta = state.profileMetadata[section];
  meta.updated_at = new Date().toISOString();
  if (meta.status === "Verified") meta.status = "Draft";
  renderProfileMetadata();
  renderProfileCompleteness();
}

function selectedProfessionRows() {
  return Array.from(state.selectedProfessions).map((code) => getProfession(code)).filter(Boolean);
}

function collectProfilePayload() {
  if (typeof syncInputsFromDom === "function") syncInputsFromDom();
  ensureProfileMetadata();

  const profileId = $("profileId")?.value.trim() || buildProfileId();
  const owner = $("profileOwner")?.value.trim() || "";
  const workloadHistory = state.needRows.map((row) => {
    const item = {
      year: row.year,
      complexityIndex: nullableNumber(row.complexityIndex) ?? 1,
    };
    for (const field of PROFILE_FACT_FIELDS) {
      item[field] = observedFact("workload", `${row.year}:${field}`, row[field]);
    }
    return item;
  });

  const targetNeedHistory = state.targetNeedRows.map((row) => ({
    year: row.year,
    groupCode: row.groupCode,
    groupLabel: row.groupLabel,
    targetPopulation: observedFact("targetNeed", `${row.year}:${row.groupCode}:targetPopulation`, row.targetPopulation),
    actualServed: observedFact("targetNeed", `${row.year}:${row.groupCode}:actualServed`, row.actualServed),
    coveragePct: nullableNumber(row.coveragePct),
    frequency: nullableNumber(row.frequency),
    complexityIndex: nullableNumber(row.complexityIndex),
    placement: row.placement || "",
  }));

  const workforceHistory = [];
  for (const prof of selectedProfessionRows()) {
    for (const year of years()) {
      const movement = state.movements?.[prof.code]?.[year] || {};
      const row = {
        profession_code: prof.code,
        profession_label: prof.label,
        year,
        fteFactor: nullableNumber(movement.fteFactor) ?? nullableNumber(state.professionConfig?.[prof.code]?.fteFactor) ?? 1,
      };
      for (const field of PROFILE_MOVEMENT_FIELDS) {
        row[field] = observedFact("workforce", `${prof.code}:${year}:${field}`, movement[field]);
      }
      workforceHistory.push(row);
    }
  }

  const professionConfig = PROFESSION_DEFS.map((prof) => {
    const cfg = state.professionConfig?.[prof.code] || getDefaultWisn(prof);
    const row = {
      profession_code: prof.code,
      profession_label: prof.label,
      selected: state.selectedProfessions.has(prof.code),
      current: nullableNumber(cfg.current) || null,
      vacant: nullableNumber(cfg.vacant) || null,
      retire5y: nullableNumber(cfg.retire5y) || null,
      fteFactor: nullableNumber(cfg.fteFactor) ?? 1,
      awtMinutes: nullableNumber(cfg.awtMinutes),
      casPct: nullableNumber(cfg.casPct),
      iasHours: nullableNumber(cfg.iasHours),
    };
    for (const activity of ACTIVITY_DEFS) {
      row[`activity_${activity.code}`] = nullableNumber(cfg.activityMinutes?.[activity.code]);
    }
    return row;
  });

  return {
    schema_version: NCO_PROFILE_SCHEMA,
    profile_id: profileId,
    generated_at: new Date().toISOString(),
    profile_owner: owner,
    scenario: $("scenarioName")?.value || "",
    scope: {
      province_code: String($("provinceSelect")?.value || state.provinceRow?.province_code || ""),
      province: state.provinceRow?.province || "",
      amphur_code: String($("amphurSelect")?.value || ""),
      amphur: $("amphurName")?.value || "",
      unit: $("unitName")?.value || "",
      mode: $("scopeMode")?.value || "province",
      latest_year: n($("startYear")?.value, 2569),
      year_count: 5,
    },
    baseline: {
      population: observedFact("workload", `${n($("startYear")?.value, 2569)}:population`, $("populationBase")?.value),
      vacancy_all: nullableNumber($("vacancyAll")?.value) || null,
      retire_5y_all: nullableNumber($("retireAll")?.value) || null,
      confidence: $("confidenceLevel")?.value || "C",
    },
    section_metadata: JSON.parse(JSON.stringify(state.profileMetadata)),
    workload_history: workloadHistory,
    target_need_history: targetNeedHistory,
    workforce_history: workforceHistory,
    profession_config: professionConfig,
  };
}

function explicitCopy(target, source, fields, observedBucket, observedKeyPrefix = "") {
  if (!source || !target) return;
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) continue;
    const value = source[field];
    if (value === null || value === undefined || value === "") continue;
    target[field] = field === "placement" || field === "groupLabel" ? String(value) : nullableNumber(value);
    if (observedBucket) markObserved(observedBucket, `${observedKeyPrefix}${field}`);
  }
}

function resetProfileObserved() {
  state.profileObserved = { workload: {}, workforce: {}, targetNeed: {} };
}

function applyProfilePayload(payload) {
  if (!payload || payload.schema_version !== NCO_PROFILE_SCHEMA) {
    throw new Error(`Unsupported profile schema: ${payload?.schema_version || "missing"}`);
  }

  resetProfileObserved();
  const scope = payload.scope || {};
  if (payload.scenario && $("scenarioName")) $("scenarioName").value = payload.scenario;
  if (scope.latest_year && $("startYear")) $("startYear").value = scope.latest_year;
  if ($("yearCount")) $("yearCount").value = 5;

  if (scope.province_code && $("provinceSelect")) {
    $("provinceSelect").value = String(scope.province_code);
    if (typeof applyProvinceBaseline === "function") applyProvinceBaseline();
  }

  if (scope.amphur_code && $("amphurSelect")) {
    const optionExists = Array.from($("amphurSelect").options).some((option) => String(option.value) === String(scope.amphur_code));
    if (optionExists) {
      $("amphurSelect").value = String(scope.amphur_code);
      if (typeof applyDistrictBaseline === "function") applyDistrictBaseline();
    }
  }

  if ($("amphurName") && Object.prototype.hasOwnProperty.call(scope, "amphur")) $("amphurName").value = scope.amphur || "";
  if ($("unitName") && Object.prototype.hasOwnProperty.call(scope, "unit")) $("unitName").value = scope.unit || "";
  if ($("scopeMode") && scope.mode) $("scopeMode").value = scope.mode;

  if (payload.baseline) {
    if (payload.baseline.population !== null && payload.baseline.population !== undefined && $("populationBase")) {
      $("populationBase").value = payload.baseline.population;
      markObserved("workload", `${n($("startYear")?.value, 2569)}:population`);
    }
    if (payload.baseline.vacancy_all !== null && payload.baseline.vacancy_all !== undefined && $("vacancyAll")) {
      $("vacancyAll").value = payload.baseline.vacancy_all;
    }
    if (payload.baseline.retire_5y_all !== null && payload.baseline.retire_5y_all !== undefined && $("retireAll")) {
      $("retireAll").value = payload.baseline.retire_5y_all;
    }
    if (payload.baseline.confidence && $("confidenceLevel")) $("confidenceLevel").value = payload.baseline.confidence;
  }

  if (typeof initNeedRows === "function") initNeedRows(true);
  for (const source of payload.workload_history || []) {
    const target = state.needRows.find((row) => Number(row.year) === Number(source.year));
    if (!target) continue;
    explicitCopy(target, source, PROFILE_FACT_FIELDS, "workload", `${target.year}:`);
    if (source.complexityIndex !== null && source.complexityIndex !== undefined && source.complexityIndex !== "") {
      target.complexityIndex = nullableNumber(source.complexityIndex) ?? 1;
    }
  }

  if (typeof initTargetNeedRows === "function") initTargetNeedRows(true);
  for (const source of payload.target_need_history || []) {
    const target = state.targetNeedRows.find((row) => Number(row.year) === Number(source.year) && String(row.groupCode) === String(source.groupCode));
    if (!target) continue;
    explicitCopy(target, source, ["targetPopulation", "actualServed"], "targetNeed", `${target.year}:${target.groupCode}:`);
    explicitCopy(target, source, ["coveragePct", "frequency", "complexityIndex", "placement"], null);
  }

  const configRows = payload.profession_config || [];
  const selected = new Set();
  for (const source of configRows) {
    const prof = getProfession(source.profession_code);
    if (!prof) continue;
    const cfg = state.professionConfig[prof.code] || getDefaultWisn(prof);
    if (parseProfileBoolean(source.selected)) selected.add(prof.code);
    for (const field of ["current", "vacant", "retire5y", "fteFactor", "awtMinutes", "casPct", "iasHours"]) {
      const value = source[field];
      if (value === null || value === undefined || value === "") continue;
      cfg[field] = nullableNumber(value);
    }
    cfg.activityMinutes ||= {};
    for (const activity of ACTIVITY_DEFS) {
      const key = `activity_${activity.code}`;
      if (source[key] === null || source[key] === undefined || source[key] === "") continue;
      cfg.activityMinutes[activity.code] = nullableNumber(source[key]) ?? 0;
    }
    state.professionConfig[prof.code] = cfg;
  }
  if (configRows.length) state.selectedProfessions = selected;

  if (typeof initMovementDefaults === "function") initMovementDefaults(true);
  for (const source of payload.workforce_history || []) {
    const code = String(source.profession_code || "");
    const year = Number(source.year);
    if (!code || !year) continue;
    state.movements[code] ||= {};
    state.movements[code][year] ||= { fteFactor: 1 };
    explicitCopy(state.movements[code][year], source, PROFILE_MOVEMENT_FIELDS, "workforce", `${code}:${year}:`);
    if (source.fteFactor !== null && source.fteFactor !== undefined && source.fteFactor !== "") {
      state.movements[code][year].fteFactor = nullableNumber(source.fteFactor) ?? 1;
    }
  }

  state.profileMetadata = {};
  ensureProfileMetadata();
  for (const section of PROFILE_SECTIONS) {
    if (!payload.section_metadata?.[section]) continue;
    state.profileMetadata[section] = {
      ...blankSectionMetadata(),
      ...payload.section_metadata[section],
    };
  }

  if ($("profileId")) $("profileId").value = payload.profile_id || buildProfileId();
  if ($("profileOwner")) $("profileOwner").value = payload.profile_owner || "";

  if (typeof renderAll === "function") renderAll();
  renderProfileMetadata();
  renderProfileCompleteness();
  refreshProfileIdentity(false);
  setProfileStatus(`นำเข้า Profile ${payload.profile_id || buildProfileId()} แล้ว — กรุณาทวนสอบค่าก่อนวิเคราะห์`, "success");
}

function profileRowsFromPayload(payload) {
  const profileRows = [
    { key: "schema_version", value: payload.schema_version },
    { key: "profile_id", value: payload.profile_id },
    { key: "scenario", value: payload.scenario },
    { key: "profile_owner", value: payload.profile_owner },
    { key: "province_code", value: payload.scope?.province_code || "" },
    { key: "province", value: payload.scope?.province || "" },
    { key: "amphur_code", value: payload.scope?.amphur_code || "" },
    { key: "amphur", value: payload.scope?.amphur || "" },
    { key: "unit", value: payload.scope?.unit || "" },
    { key: "scope_mode", value: payload.scope?.mode || "" },
    { key: "latest_year", value: payload.scope?.latest_year || 2569 },
    { key: "year_count", value: 5 },
    { key: "confidence", value: payload.baseline?.confidence || "C" },
    { key: "vacancy_all", value: payload.baseline?.vacancy_all ?? "" },
    { key: "retire_5y_all", value: payload.baseline?.retire_5y_all ?? "" },
    { key: "generated_at", value: payload.generated_at || "" },
  ];
  const metadataRows = PROFILE_SECTIONS.map((section) => ({
    section,
    owner: payload.section_metadata?.[section]?.owner || "",
    source: payload.section_metadata?.[section]?.source || "",
    status: payload.section_metadata?.[section]?.status || "Draft",
    updated_at: payload.section_metadata?.[section]?.updated_at || "",
    note: payload.section_metadata?.[section]?.note || "",
  }));
  return {
    Profile: profileRows,
    Section_Metadata: metadataRows,
    Workload_History: payload.workload_history || [],
    TargetNeed_History: payload.target_need_history || [],
    Workforce_History: payload.workforce_history || [],
    Profession_Config: payload.profession_config || [],
  };
}

function blankTemplatePayload(payload) {
  const copy = JSON.parse(JSON.stringify(payload));
  copy.generated_at = new Date().toISOString();
  copy.baseline.population = null;
  copy.baseline.vacancy_all = null;
  copy.baseline.retire_5y_all = null;
  for (const section of PROFILE_SECTIONS) {
    copy.section_metadata[section] = {
      owner: payload.profile_owner || "",
      source: "",
      status: "Draft",
      updated_at: "",
      note: "",
    };
  }
  copy.workload_history = years().map((year) => ({
    year,
    population: null,
    opdVisits: null,
    ipdAdmissions: null,
    erVisits: null,
    procedures: null,
    deliveries: null,
    chronicVisits: null,
    mentalVisits: null,
    outreachVisits: null,
    complexityIndex: 1,
  }));
  copy.target_need_history = state.targetNeedRows.map((row) => ({
    year: row.year,
    groupCode: row.groupCode,
    groupLabel: row.groupLabel,
    targetPopulation: null,
    actualServed: null,
    coveragePct: row.coveragePct,
    frequency: row.frequency,
    complexityIndex: row.complexityIndex,
    placement: row.placement,
  }));
  copy.workforce_history = [];
  for (const prof of selectedProfessionRows()) {
    for (const year of years()) {
      copy.workforce_history.push({
        profession_code: prof.code,
        profession_label: prof.label,
        year,
        actualHeadcount: null,
        recruit: null,
        transferIn: null,
        returnIn: null,
        retire: null,
        resign: null,
        transferOut: null,
        studyLeave: null,
        fteFactor: 1,
      });
    }
  }
  copy.profession_config = copy.profession_config.map((row) => ({
    ...row,
    current: null,
    vacant: null,
    retire5y: null,
  }));
  return copy;
}

function writeProfileWorkbook(payload, filename) {
  if (typeof XLSX === "undefined") throw new Error("SheetJS ยังไม่พร้อมใช้งาน");
  const wb = XLSX.utils.book_new();
  const sheetRows = profileRowsFromPayload(payload);
  for (const sheetName of NCO_PROFILE_SHEETS) {
    const rows = sheetRows[sheetName] || [];
    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  XLSX.writeFile(wb, filename);
}

function exportProfileTemplate() {
  try {
    const payload = blankTemplatePayload(collectProfilePayload());
    writeProfileWorkbook(payload, `${payload.profile_id || "HR_Profile"}_TEMPLATE.xlsx`);
    setProfileStatus("สร้าง Excel Template แล้ว — ช่องข้อมูลจริงที่ยังไม่มีถูกเว้นว่าง", "success");
  } catch (error) {
    setProfileStatus(`สร้าง Template ไม่สำเร็จ: ${error.message || error}`, "error");
  }
}

function exportProfileWorkbook() {
  try {
    const payload = collectProfilePayload();
    writeProfileWorkbook(payload, `${payload.profile_id || "HR_Profile"}_DATA.xlsx`);
    setProfileStatus("ส่งออก Excel Profile จากค่าปัจจุบันแล้ว", "success");
  } catch (error) {
    setProfileStatus(`ส่งออก Excel ไม่สำเร็จ: ${error.message || error}`, "error");
  }
}

function workbookSheetsFromXlsx(workbook) {
  const sheets = {};
  for (const sheetName of NCO_PROFILE_SHEETS) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) throw new Error(`ไม่พบ worksheet: ${sheetName}`);
    sheets[sheetName] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
  }
  return sheets;
}

function keyValueRowsToObject(rows) {
  return Object.fromEntries((rows || [])
    .filter((row) => row && row.key !== null && row.key !== undefined && String(row.key).trim())
    .map((row) => [String(row.key).trim(), row.value]));
}

function profilePayloadFromSheetRows(sheets) {
  const profile = keyValueRowsToObject(sheets.Profile || []);
  if (String(profile.schema_version || "") !== NCO_PROFILE_SCHEMA) {
    throw new Error(`schema_version ต้องเป็น ${NCO_PROFILE_SCHEMA}`);
  }

  const sectionMetadata = {};
  for (const row of sheets.Section_Metadata || []) {
    const section = String(row.section || "").trim();
    if (!section) continue;
    sectionMetadata[section] = {
      owner: row.owner || "",
      source: row.source || "",
      status: row.status || "Draft",
      updated_at: row.updated_at || "",
      note: row.note || "",
    };
  }

  const numericFields = new Set([
    ...PROFILE_FACT_FIELDS,
    "complexityIndex",
    "targetPopulation",
    "actualServed",
    "coveragePct",
    "frequency",
    ...PROFILE_MOVEMENT_FIELDS,
    "fteFactor",
    "current",
    "vacant",
    "retire5y",
    "awtMinutes",
    "casPct",
    "iasHours",
    ...ACTIVITY_DEFS.map((activity) => `activity_${activity.code}`),
  ]);
  const convertRows = (rows) => (rows || []).map((row) => {
    const next = { ...row };
    for (const [key, value] of Object.entries(next)) {
      if (numericFields.has(key)) next[key] = nullableNumber(value);
    }
    if (Object.prototype.hasOwnProperty.call(next, "year")) next.year = nullableNumber(next.year);
    if (Object.prototype.hasOwnProperty.call(next, "selected")) next.selected = parseProfileBoolean(next.selected);
    return next;
  });

  const workloadRows = convertRows(sheets.Workload_History);
  const targetRows = convertRows(sheets.TargetNeed_History);
  const workforceRows = convertRows(sheets.Workforce_History);
  const professionRows = convertRows(sheets.Profession_Config);
  const latestYear = nullableNumber(profile.latest_year) ?? 2569;

  return {
    schema_version: NCO_PROFILE_SCHEMA,
    profile_id: profile.profile_id || "",
    generated_at: profile.generated_at || "",
    profile_owner: profile.profile_owner || "",
    scenario: profile.scenario || "",
    scope: {
      province_code: String(profile.province_code || ""),
      province: profile.province || "",
      amphur_code: String(profile.amphur_code || ""),
      amphur: profile.amphur || "",
      unit: profile.unit || "",
      mode: profile.scope_mode || "district",
      latest_year: latestYear,
      year_count: 5,
    },
    baseline: {
      population: workloadRows.find((row) => Number(row.year) === Number(latestYear))?.population ?? null,
      vacancy_all: nullableNumber(profile.vacancy_all),
      retire_5y_all: nullableNumber(profile.retire_5y_all),
      confidence: profile.confidence || "C",
    },
    section_metadata: sectionMetadata,
    workload_history: workloadRows,
    target_need_history: targetRows,
    workforce_history: workforceRows,
    profession_config: professionRows,
  };
}

async function importProfileWorkbook(file) {
  if (!file) return;
  if (typeof XLSX === "undefined") throw new Error("SheetJS ยังไม่พร้อมใช้งาน");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const payload = profilePayloadFromSheetRows(workbookSheetsFromXlsx(workbook));
  applyProfilePayload(payload);
  return payload;
}

async function syncGoogleProfile() {
  const endpoint = $("profileEndpoint")?.value.trim();
  if (!endpoint) {
    setProfileStatus("กรุณาใส่ Apps Script Web App endpoint ก่อน Sync", "warning");
    return;
  }
  try {
    setProfileStatus("กำลังดึงข้อมูลจาก Google Sheets…", "warning");
    const response = await fetch(endpoint, { cache: "no-store", redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== NCO_PROFILE_SCHEMA) throw new Error("Google endpoint ใช้ schema ไม่ตรงกับ Simulator");
    const payload = data.sheets ? profilePayloadFromSheetRows(data.sheets) : data;
    applyProfilePayload(payload);
    persistProfileSettings();
    setProfileStatus(`Sync Google Sheets สำเร็จ: ${payload.profile_id || buildProfileId()}`, "success");
  } catch (error) {
    setProfileStatus(`Sync Google Sheets ไม่สำเร็จ: ${error.message || error}`, "error");
  }
}

function calculateProfileCompleteness(payload = collectProfilePayload()) {
  const workloadRows = payload.workload_history || [];
  const selectedCodes = new Set((payload.profession_config || []).filter((row) => row.selected).map((row) => row.profession_code));
  const workforceRows = (payload.workforce_history || []).filter((row) => selectedCodes.has(row.profession_code));
  const targetRows = payload.target_need_history || [];

  const populationPresent = workloadRows.filter((row) => row.population !== null && row.population !== undefined).length;
  const populationScore = workloadRows.length ? populationPresent / workloadRows.length : 0;

  let workloadPresent = 0;
  let workloadTotal = 0;
  for (const row of workloadRows) {
    for (const field of PROFILE_WORKLOAD_FIELDS) {
      workloadTotal += 1;
      if (row[field] !== null && row[field] !== undefined) workloadPresent += 1;
    }
  }
  const workloadScore = workloadTotal ? workloadPresent / workloadTotal : 0;

  const workforcePresent = workforceRows.filter((row) => row.actualHeadcount !== null && row.actualHeadcount !== undefined).length;
  const workforceScore = workforceRows.length ? workforcePresent / workforceRows.length : 0;

  let targetPresent = 0;
  let targetTotal = 0;
  for (const row of targetRows) {
    for (const field of ["targetPopulation", "actualServed"]) {
      targetTotal += 1;
      if (row[field] !== null && row[field] !== undefined) targetPresent += 1;
    }
  }
  const targetScore = targetTotal ? targetPresent / targetTotal : 0;

  let provenancePresent = 0;
  for (const section of PROFILE_SECTIONS) {
    const meta = payload.section_metadata?.[section] || {};
    if (meta.owner && meta.source && meta.status && meta.status !== "Draft") provenancePresent += 1;
  }
  const provenanceScore = provenancePresent / PROFILE_SECTIONS.length;
  const scores = {
    Population: populationScore,
    Workload: workloadScore,
    Workforce: workforceScore,
    TargetNeed: targetScore,
    Provenance: provenanceScore,
  };
  const overall = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;
  return { ...scores, overall };
}

function percentText(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function renderProfileCompleteness() {
  if (!$("profileCompletenessOverall")) return;
  const scores = calculateProfileCompleteness();
  $("profileCompletenessOverall").textContent = percentText(scores.overall);
  $("profileScorePopulation").textContent = percentText(scores.Population);
  $("profileScoreWorkload").textContent = percentText(scores.Workload);
  $("profileScoreWorkforce").textContent = percentText(scores.Workforce);
  $("profileScoreTargetNeed").textContent = percentText(scores.TargetNeed);
  $("profileScoreProvenance").textContent = percentText(scores.Provenance);
}

function profileEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderProfileMetadata() {
  const body = $("profileMetadataBody");
  if (!body) return;
  ensureProfileMetadata();
  body.innerHTML = PROFILE_SECTIONS.map((section) => {
    const meta = state.profileMetadata[section];
    return `<tr data-profile-section="${section}">
      <td>${section}</td>
      <td><input data-profile-meta="owner" value="${profileEscape(meta.owner)}" placeholder="กลุ่มงาน/ผู้รับผิดชอบ"></td>
      <td><input data-profile-meta="source" value="${profileEscape(meta.source)}" placeholder="HDC / HIS / HROPS / ทะเบียนพื้นที่"></td>
      <td><select data-profile-meta="status">
        <option value="Draft"${meta.status === "Draft" ? " selected" : ""}>Draft</option>
        <option value="Reviewed"${meta.status === "Reviewed" ? " selected" : ""}>Reviewed</option>
        <option value="Verified"${meta.status === "Verified" ? " selected" : ""}>Verified</option>
      </select></td>
      <td><input data-profile-meta="updated_at" value="${profileEscape(meta.updated_at)}" placeholder="ISO date/time"></td>
      <td><input data-profile-meta="note" value="${profileEscape(meta.note)}" placeholder="หมายเหตุการทวนสอบ"></td>
    </tr>`;
  }).join("");
}

function setProfileStatus(message, tone = "") {
  const node = $("profileSyncStatus");
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}

function refreshProfileIdentity(force = false) {
  const field = $("profileId");
  if (!field) return;
  const generated = buildProfileId();
  if (force || !field.value.trim() || field.dataset.auto === "true") {
    field.value = generated;
    field.dataset.auto = "true";
  }
  renderProfileCompleteness();
}

function persistProfileSettings() {
  try {
    const safeSettings = {
      profile_id: $("profileId")?.value || "",
      profile_owner: $("profileOwner")?.value || "",
      sheet_url: $("profileSheetUrl")?.value || "",
      endpoint: $("profileEndpoint")?.value || "",
      section_metadata: ensureProfileMetadata(),
    };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(safeSettings));
  } catch (error) {
    // localStorage may be disabled; collaboration still works without persistence.
  }
}

function restoreProfileSettings() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if ($("profileId") && saved.profile_id) {
      $("profileId").value = saved.profile_id;
      $("profileId").dataset.auto = "false";
    }
    if ($("profileOwner")) $("profileOwner").value = saved.profile_owner || "";
    if ($("profileSheetUrl")) $("profileSheetUrl").value = saved.sheet_url || "";
    if ($("profileEndpoint")) $("profileEndpoint").value = saved.endpoint || "";
    if (saved.section_metadata) state.profileMetadata = saved.section_metadata;
  } catch (error) {
    // Ignore malformed local settings instead of blocking the simulator.
  }
}

function openProfileSheet() {
  const url = $("profileSheetUrl")?.value.trim();
  if (!url) {
    setProfileStatus("กรุณาใส่ Google Sheet URL ก่อน", "warning");
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function bindProfileObservationEvents() {
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target.matches("[data-need]")) {
      const [index, field] = target.dataset.need.split(":");
      const year = state.needRows?.[index]?.year;
      if (year) markObserved("workload", `${year}:${field}`);
      touchProfileSection(field === "population" ? "Population" : "Workload");
      return;
    }
    if (target.matches("[data-target]")) {
      const [index, field] = target.dataset.target.split(":");
      const row = state.targetNeedRows?.[index];
      if (row) markObserved("targetNeed", `${row.year}:${row.groupCode}:${field}`);
      touchProfileSection("TargetNeed");
      return;
    }
    if (target.matches("[data-move]")) {
      const [code, year, field] = target.dataset.move.split(":");
      markObserved("workforce", `${code}:${year}:${field}`);
      touchProfileSection("Workforce");
      return;
    }
    if (target.matches("[data-standard], [data-prof-awt], [data-prof-cas], [data-prof-ias]")) {
      touchProfileSection("WISN");
      return;
    }
    if (target.id === "populationBase") {
      markObserved("workload", `${n($("startYear")?.value, 2569)}:population`);
      touchProfileSection("Population");
    }
  });
}

function bindProfileUi() {
  $("btnProfileTemplate")?.addEventListener("click", exportProfileTemplate);
  $("btnProfileExport")?.addEventListener("click", exportProfileWorkbook);
  $("btnProfileImport")?.addEventListener("click", () => $("profileExcelInput")?.click());
  $("profileExcelInput")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setProfileStatus(`กำลังนำเข้า ${file.name}…`, "warning");
      await importProfileWorkbook(file);
    } catch (error) {
      setProfileStatus(`นำเข้า Excel ไม่สำเร็จ: ${error.message || error}`, "error");
    } finally {
      event.target.value = "";
    }
  });
  $("btnProfileSync")?.addEventListener("click", syncGoogleProfile);
  $("btnProfileOpenSheet")?.addEventListener("click", openProfileSheet);
  $("btnProfileRefreshId")?.addEventListener("click", () => {
    $("profileId").dataset.auto = "true";
    refreshProfileIdentity(true);
    persistProfileSettings();
  });
  $("profileId")?.addEventListener("input", () => {
    $("profileId").dataset.auto = "false";
    persistProfileSettings();
  });
  for (const id of ["profileOwner", "profileSheetUrl", "profileEndpoint"]) {
    $(id)?.addEventListener("input", persistProfileSettings);
  }
  $("profileMetadataBody")?.addEventListener("input", (event) => {
    const row = event.target.closest("[data-profile-section]");
    if (!row || !event.target.dataset.profileMeta) return;
    const section = row.dataset.profileSection;
    ensureProfileMetadata();
    state.profileMetadata[section][event.target.dataset.profileMeta] = event.target.value;
    persistProfileSettings();
    renderProfileCompleteness();
  });
  $("profileMetadataBody")?.addEventListener("change", (event) => {
    const row = event.target.closest("[data-profile-section]");
    if (!row || !event.target.dataset.profileMeta) return;
    const section = row.dataset.profileSection;
    state.profileMetadata[section][event.target.dataset.profileMeta] = event.target.value;
    persistProfileSettings();
    renderProfileCompleteness();
  });

  for (const id of ["provinceSelect", "amphurSelect", "amphurName", "unitName", "scopeMode", "startYear"]) {
    $(id)?.addEventListener("change", () => {
      refreshProfileIdentity(false);
      persistProfileSettings();
    });
    $(id)?.addEventListener("input", () => refreshProfileIdentity(false));
  }
}

function initCollaborativeProfile() {
  ensureProfileMetadata();
  restoreProfileSettings();
  renderProfileMetadata();
  bindProfileUi();
  bindProfileObservationEvents();
  refreshProfileIdentity(false);
  renderProfileCompleteness();
  setProfileStatus("Profile พร้อมใช้งาน: Excel สำหรับรวบรวม offline และ Google Sheets สำหรับแก้พร้อมกัน", "success");
}

// Refresh the profile after the asynchronous baseline loader finishes.
const profileBaseLoadBaseline = loadBaseline;
loadBaseline = async function loadBaselineWithProfile() {
  const result = await profileBaseLoadBaseline();
  refreshProfileIdentity(false);
  renderProfileCompleteness();
  return result;
};

document.addEventListener("DOMContentLoaded", initCollaborativeProfile);
