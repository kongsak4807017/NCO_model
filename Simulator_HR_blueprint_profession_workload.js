// HR Blueprint v2: profession-specific workload, profile compatibility and Data Fitness gating.
// Facility totals remain reference only. No generic facility OPD/IPD fallback is allowed for profession WISN.
(() => {
  const V2_SCHEMA = "nco-hr-profile-v2";
  const V1_SCHEMA = "nco-hr-profile-v1";
  const PD = window.NCO_HR_PROFESSION_DICTIONARY || { workloadDefinitions: {}, healthKpis: {}, overlapOptions: [] };

  if (!NCO_PROFILE_SHEETS.includes("Profession_Workload")) NCO_PROFILE_SHEETS.push("Profession_Workload");
  if (!NCO_PROFILE_SHEETS.includes("Health_KPI_History")) NCO_PROFILE_SHEETS.push("Health_KPI_History");
  if (!PROFILE_SECTIONS.includes("ProfessionWorkload")) PROFILE_SECTIONS.push("ProfessionWorkload");
  if (!PROFILE_SECTIONS.includes("HealthKPI")) PROFILE_SECTIONS.push("HealthKPI");

  state.professionWorkloadRows ||= [];
  state.healthKpiRows ||= [];
  state.profileObserved.professionWorkload ||= {};
  state.profileObserved.healthKpi ||= {};

  function canonicalDefinitions(code) {
    return PD.workloadDefinitions?.[code] || [];
  }

  function definitionFor(code, activityCode) {
    return canonicalDefinitions(code).find((item) => item.activity_code === activityCode) || null;
  }

  function selectedCodesForV2() {
    return Array.from(state.selectedProfessions || []);
  }

  function workloadKey(code, year, activityCode) {
    return `${code}:${year}:${activityCode}`;
  }

  function professionWorkloadRow(professionCode, year, activityCode) {
    return (state.professionWorkloadRows || []).find((row) =>
      String(row.profession_code) === String(professionCode)
      && Number(row.year) === Number(year)
      && String(row.activity_code) === String(activityCode));
  }
  window.professionWorkloadRow = professionWorkloadRow;

  function defaultStandardSource() {
    return "Illustrative template default — replace with local time-motion/service standard";
  }

  function seedProfessionWorkloadRows({ blank = true } = {}) {
    const existing = new Map((state.professionWorkloadRows || []).map((row) => [workloadKey(row.profession_code, row.year, row.activity_code), row]));
    const rows = [];
    for (const code of selectedCodesForV2()) {
      const prof = getProfession(code);
      const cfg = state.professionConfig?.[code] || {};
      for (const year of years()) {
        for (const def of canonicalDefinitions(code)) {
          const key = workloadKey(code, year, def.activity_code);
          const prior = existing.get(key);
          rows.push(prior || {
            profession_code: code,
            profession_label: prof?.label || code,
            year,
            activity_code: def.activity_code,
            workload_label: def.workload_label,
            volume: blank ? null : null,
            volume_unit: def.volume_unit,
            definition: def.definition,
            inclusion_criteria: def.inclusion_criteria,
            exclusion_criteria: def.exclusion_criteria,
            source: "",
            verification_status: "Draft",
            overlap_policy: def.overlap_policy_default || "unknown",
            complexity_index: 1,
            activity_standard_minutes: nullableNumber(cfg.activityMinutes?.[def.activity_code]),
            activity_standard_unit: `minutes/${def.volume_unit.replace(/\/year$/i, "")}`,
            standard_source: defaultStandardSource(),
            standard_status: "Draft",
            related_kpi_codes: (def.related_kpi_codes || []).join(","),
            note: "",
          });
        }
      }
    }
    return rows;
  }

  function seedHealthKpiRows({ blank = true } = {}) {
    const existing = new Map((state.healthKpiRows || []).map((row) => [`${row.year}:${row.indicator_code}`, row]));
    const rows = [];
    for (const year of years()) {
      for (const kpi of Object.values(PD.healthKpis || {})) {
        const key = `${year}:${kpi.code}`;
        rows.push(existing.get(key) || {
          year,
          indicator_code: kpi.code,
          indicator_name: kpi.name,
          value: blank ? null : null,
          unit: kpi.unit || "",
          direction: kpi.direction || "",
          threshold: kpi.threshold ?? "",
          source: "",
          verification_status: "Draft",
          note: "",
        });
      }
    }
    return rows;
  }

  // ---- Profile v2 compatibility layer ----
  const baseCollectProfilePayload = collectProfilePayload;
  const baseApplyProfilePayload = applyProfilePayload;
  const baseProfileRowsFromPayload = profileRowsFromPayload;
  const baseBlankTemplatePayload = blankTemplatePayload;
  const baseProfilePayloadFromSheetRows = profilePayloadFromSheetRows;
  const baseCalculateProfileCompleteness = calculateProfileCompleteness;
  const baseResetProfileObserved = resetProfileObserved;

  resetProfileObserved = function resetProfileObservedV2() {
    baseResetProfileObserved();
    state.profileObserved.professionWorkload = {};
    state.profileObserved.healthKpi = {};
  };

  collectProfilePayload = function collectProfilePayloadV2() {
    const payload = baseCollectProfilePayload();
    payload.schema_version = V2_SCHEMA;
    payload.profession_workload = JSON.parse(JSON.stringify(state.professionWorkloadRows || []));
    payload.health_kpi_history = JSON.parse(JSON.stringify(state.healthKpiRows || []));
    payload.profile_version_note = "Profession-specific workload drives WISN; facility Workload_History is reference only.";
    return payload;
  };

  profileRowsFromPayload = function profileRowsFromPayloadV2(payload) {
    const legacyCompatible = { ...payload, schema_version: V1_SCHEMA };
    const rows = baseProfileRowsFromPayload(legacyCompatible);
    const schemaRow = rows.Profile?.find((row) => row.key === "schema_version");
    if (schemaRow) schemaRow.value = V2_SCHEMA;
    rows.Profession_Workload = payload.profession_workload || [];
    rows.Health_KPI_History = payload.health_kpi_history || [];
    return rows;
  };

  blankTemplatePayload = function blankTemplatePayloadV2(payload) {
    const copy = baseBlankTemplatePayload({ ...payload, schema_version: V1_SCHEMA });
    copy.schema_version = V2_SCHEMA;
    copy.profession_workload = seedProfessionWorkloadRows({ blank: true }).map((row) => ({ ...row, volume: null, source: "", verification_status: "Draft", standard_status: "Draft" }));
    copy.health_kpi_history = seedHealthKpiRows({ blank: true }).map((row) => ({ ...row, value: null, source: "", verification_status: "Draft" }));
    // Legacy facility totals are intentionally blank reference fields. They are not converted into profession workload.
    return copy;
  };

  workbookSheetsFromXlsx = function workbookSheetsFromXlsxV2(workbook) {
    const sheets = {};
    const core = ["Profile", "Section_Metadata", "Workload_History", "TargetNeed_History", "Workforce_History", "Profession_Config"];
    for (const sheetName of core) {
      const ws = workbook.Sheets[sheetName];
      if (!ws) throw new Error(`ไม่พบ worksheet: ${sheetName}`);
      sheets[sheetName] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
    }
    for (const sheetName of ["Profession_Workload", "Health_KPI_History"]) {
      const ws = workbook.Sheets[sheetName];
      sheets[sheetName] = ws ? XLSX.utils.sheet_to_json(ws, { defval: null, raw: false }) : [];
    }
    return sheets;
  };

  function normalizedProfileRowsForV1(sheets) {
    const clone = { ...sheets, Profile: (sheets.Profile || []).map((row) => ({ ...row })) };
    const schema = clone.Profile.find((row) => String(row.key || "").trim() === "schema_version");
    if (schema) schema.value = V1_SCHEMA;
    return clone;
  }

  function numberOrNull(value) {
    return nullableNumber(value);
  }

  profilePayloadFromSheetRows = function profilePayloadFromSheetRowsV2(sheets) {
    const profileObject = keyValueRowsToObject(sheets.Profile || []);
    const sourceSchema = String(profileObject.schema_version || V1_SCHEMA);
    if (![V1_SCHEMA, V2_SCHEMA].includes(sourceSchema)) throw new Error(`Unsupported schema_version: ${sourceSchema}`);
    const base = baseProfilePayloadFromSheetRows(normalizedProfileRowsForV1(sheets));
    const workloadRows = (sheets.Profession_Workload || []).map((row) => ({
      ...row,
      year: numberOrNull(row.year),
      volume: numberOrNull(row.volume),
      complexity_index: numberOrNull(row.complexity_index) ?? 1,
      activity_standard_minutes: numberOrNull(row.activity_standard_minutes),
    }));
    const kpiRows = (sheets.Health_KPI_History || []).map((row) => ({ ...row, year: numberOrNull(row.year), value: numberOrNull(row.value) }));
    return {
      ...base,
      schema_version: V2_SCHEMA,
      source_schema_version: sourceSchema,
      profession_workload: sourceSchema === V2_SCHEMA ? workloadRows : [],
      health_kpi_history: sourceSchema === V2_SCHEMA ? kpiRows : [],
      migrated_from_legacy: sourceSchema === V1_SCHEMA,
    };
  };

  applyProfilePayload = function applyProfilePayloadV2(payload) {
    if (!payload || ![V1_SCHEMA, V2_SCHEMA].includes(String(payload.schema_version || ""))) {
      throw new Error(`Unsupported profile schema: ${payload?.schema_version || "missing"}`);
    }
    const legacyCompatible = { ...payload, schema_version: V1_SCHEMA };
    baseApplyProfilePayload(legacyCompatible);
    state.professionWorkloadRows = (payload.profession_workload || []).map((row) => ({ ...row }));
    state.healthKpiRows = (payload.health_kpi_history || []).map((row) => ({ ...row }));
    for (const row of state.professionWorkloadRows) {
      if (row.volume !== null && row.volume !== undefined && String(row.volume).trim() !== "") {
        markObserved("professionWorkload", workloadKey(row.profession_code, row.year, row.activity_code));
      }
      if (row.activity_standard_minutes !== null && row.activity_standard_minutes !== undefined) {
        const cfg = state.professionConfig?.[row.profession_code];
        if (cfg) {
          cfg.activityMinutes ||= {};
          cfg.activityMinutes[row.activity_code] = numberOrNull(row.activity_standard_minutes) ?? cfg.activityMinutes[row.activity_code] ?? 0;
        }
      }
    }
    for (const row of state.healthKpiRows) {
      if (row.value !== null && row.value !== undefined && String(row.value).trim() !== "") markObserved("healthKpi", `${row.year}:${row.indicator_code}`);
    }
    if (!state.professionWorkloadRows.length) {
      setProfileStatus("นำเข้า Profile รุ่นเดิมแล้ว: facility workload ไม่ถูกแปลงเป็น workload ของวิชาชีพอัตโนมัติ กรุณากรอก Profession_Workload", "warning");
    }
    renderProfessionWorkloadTable();
    renderDataFitnessSummary();
    window.renderHealthKpiTable?.();
    renderProfileCompleteness();
  };

  syncGoogleProfile = async function syncGoogleProfileV2() {
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
      if (![V1_SCHEMA, V2_SCHEMA].includes(String(data.schema_version || ""))) throw new Error("Google endpoint ใช้ schema ที่ Simulator ไม่รองรับ");
      const payload = data.sheets ? profilePayloadFromSheetRows(data.sheets) : data;
      applyProfilePayload(payload);
      persistProfileSettings();
      setProfileStatus(`Sync Google Sheets สำเร็จ: ${payload.profile_id || buildProfileId()}`, "success");
    } catch (error) {
      setProfileStatus(`Sync Google Sheets ไม่สำเร็จ: ${error.message || error}`, "error");
    }
  };

  calculateProfileCompleteness = function calculateProfileCompletenessV2(payload = collectProfilePayload()) {
    const base = baseCalculateProfileCompleteness({ ...payload, schema_version: V1_SCHEMA });
    const selected = new Set((payload.profession_config || []).filter((row) => row.selected).map((row) => row.profession_code));
    const rows = (payload.profession_workload || []).filter((row) => selected.has(row.profession_code));
    const expected = rows.length;
    const complete = rows.filter((row) => row.volume !== null && row.volume !== undefined && row.source && row.verification_status !== "Draft").length;
    const professionWorkloadScore = expected ? complete / expected : 0;
    const scores = { ...base, Workload: professionWorkloadScore };
    const items = [scores.Population, scores.Workload, scores.Workforce, scores.TargetNeed, scores.Provenance];
    scores.overall = items.reduce((sum, value) => sum + (Number(value) || 0), 0) / items.length;
    return scores;
  };

  // ---- Data fitness and profession-specific WISN ----
  function workforceObserved(code, year) {
    const movement = state.movements?.[code]?.[year];
    const value = movement?.actualHeadcount;
    return Boolean(state.profileObserved?.workforce?.[`${code}:${year}:actualHeadcount`]) || (value !== null && value !== undefined && String(value).trim() !== "" && Number(value) > 0);
  }

  function unitMatches(row, def) {
    return String(row?.volume_unit || "").trim().toLowerCase() === String(def?.volume_unit || "").trim().toLowerCase();
  }

  function evaluateDataFitness(professionCode, year) {
    const failures = [];
    const warnings = [];
    const rows = canonicalDefinitions(professionCode)
      .map((def) => ({ def, row: professionWorkloadRow(professionCode, year, def.activity_code) }))
      .filter(({ row }) => row && row.volume !== null && row.volume !== undefined && String(row.volume).trim() !== "");

    if (!workforceObserved(professionCode, year)) failures.push("missing-actual-workforce");
    if (!rows.length) failures.push("no-profession-workload: ต้องใช้ profession-specific workload ไม่ใช่ facility totals");

    for (const { def, row } of rows) {
      if (!unitMatches(row, def)) failures.push(`unit-mismatch:${def.activity_code}`);
      if (def.overlap_sensitive && ["", "unknown"].includes(String(row.overlap_policy || "unknown"))) failures.push(`overlap-unknown:${def.activity_code}`);
      if (!row.source) warnings.push(`workload-source-missing:${def.activity_code}`);
      if (row.verification_status !== "Verified") warnings.push(`workload-not-verified:${def.activity_code}`);
      if (!(Number(row.activity_standard_minutes) > 0)) failures.push(`standard-missing:${def.activity_code}`);
      if (!row.standard_source || String(row.standard_source).startsWith("Illustrative template default")) warnings.push(`standard-source-unvalidated:${def.activity_code}`);
      if (row.standard_status !== "Verified") warnings.push(`standard-not-verified:${def.activity_code}`);
    }

    if (state.profileMetadata?.Workforce?.status !== "Verified") warnings.push("workforce-section-not-verified");
    if (state.profileMetadata?.ProfessionWorkload?.status !== "Verified") warnings.push("profession-workload-section-not-verified");
    if (state.profileMetadata?.WISN?.status !== "Verified") warnings.push("wisn-section-not-verified");

    const level = failures.length ? "Blocked" : (warnings.length ? "Provisional" : "Verified");
    return { level, failures, warnings, rows: rows.map(({ row }) => row) };
  }
  window.evaluateDataFitness = evaluateDataFitness;

  function calculateProfessionWisn(professionCode, year) {
    const prof = getProfession(professionCode);
    const cfg = state.professionConfig?.[professionCode] || getDefaultWisn(prof);
    const rows = canonicalDefinitions(professionCode)
      .map((def) => ({ def, row: professionWorkloadRow(professionCode, year, def.activity_code) }))
      .filter(({ row }) => row && row.volume !== null && row.volume !== undefined && String(row.volume).trim() !== "");
    const activityLines = [];
    let demandMinutes = 0;
    for (const { def, row } of rows) {
      const volume = numberOrNull(row.volume);
      const standardMinutes = numberOrNull(row.activity_standard_minutes) ?? numberOrNull(cfg.activityMinutes?.[def.activity_code]);
      const complexityIndex = Math.max(0.1, numberOrNull(row.complexity_index) ?? 1);
      if (volume === null || !(standardMinutes > 0)) continue;
      const minutes = volume * standardMinutes * complexityIndex;
      demandMinutes += minutes;
      activityLines.push({ code:def.activity_code, label:def.workload_label, volume, unit:def.volume_unit, standardMinutes, complexityIndex, minutes });
    }
    if (!activityLines.length) return null;
    const awtMinutes = Math.max(1, numberOrNull(cfg.awtMinutes) ?? DEFAULT_AWT_MINUTES);
    const casPct = clamp(numberOrNull(cfg.casPct) ?? 0, 0, 80);
    const caf = 1 / (1 - casPct / 100);
    const iaf = ((numberOrNull(cfg.iasHours) ?? 0) * 60) / awtMinutes;
    const serviceFte = demandMinutes / awtMinutes;
    const needFte = (serviceFte * caf) + iaf;
    return { demandMinutes, awtMinutes, casPct, caf, iaf, serviceFte, needFte, activityLines };
  }

  function isTargetObserved(row, field) {
    return Boolean(state.profileObserved?.targetNeed?.[`${row.year}:${row.groupCode}:${field}`]);
  }
  window.isTargetObserved = isTargetObserved;

  function targetContextByYear(year) {
    const groups = [];
    for (const row of (state.targetNeedRows || []).filter((item) => Number(item.year) === Number(year))) {
      const targetObserved = isTargetObserved(row, "targetPopulation");
      const actualServedObserved = isTargetObserved(row, "actualServed");
      const targetPopulation = targetObserved ? numberOrNull(row.targetPopulation) : null;
      const actualServed = actualServedObserved ? numberOrNull(row.actualServed) : null;
      const coveragePct = numberOrNull(row.coveragePct);
      const frequency = numberOrNull(row.frequency);
      const targetCases = targetPopulation !== null && coveragePct !== null ? targetPopulation * coveragePct / 100 : null;
      const coverageGap = targetCases !== null && actualServed !== null ? Math.max(0, targetCases - actualServed) : null;
      const workloadGap = coverageGap !== null && frequency !== null ? coverageGap * frequency : null;
      groups.push({ ...row, targetPopulation, actualServed, targetCases, coverageGap, workloadGap, actualServedObserved });
    }
    const knownCoverage = groups.map((g) => g.coverageGap).filter((v) => Number.isFinite(v));
    const knownWorkload = groups.map((g) => g.workloadGap).filter((v) => Number.isFinite(v));
    return {
      groups,
      coverageGap: knownCoverage.length ? knownCoverage.reduce((a,b)=>a+b,0) : null,
      workloadGap: knownWorkload.length ? knownWorkload.reduce((a,b)=>a+b,0) : null,
    };
  }

  const baseRunProjection = runProjection;
  runProjection = function runProjectionProfessionSpecific() {
    syncInputsFromDom();
    const selected = selectedCodesForV2();
    const results = [];
    const targetByYear = {};
    for (const year of years()) targetByYear[year] = targetContextByYear(year);
    state.targetSummary = {
      byYear: targetByYear,
      totalCoverageGap: Object.values(targetByYear).map((x)=>x.coverageGap).filter(Number.isFinite).reduce((a,b)=>a+b,0),
      totalWorkloadGap: Object.values(targetByYear).map((x)=>x.workloadGap).filter(Number.isFinite).reduce((a,b)=>a+b,0),
    };

    for (const code of selected) {
      const prof = getProfession(code);
      const supply = calculateSupplyTimeline(code);
      const baseNeeds = [];
      for (const year of years()) {
        const fitness = evaluateDataFitness(code, year);
        const actualWisn = calculateProfessionWisn(code, year);
        const supplyRow = supply.find((item) => Number(item.year) === Number(year));
        const supplyFte = numberOrNull(supplyRow?.supplyFte);
        const needFte = actualWisn?.needFte ?? null;
        const gapFte = needFte !== null && supplyFte !== null ? needFte - supplyFte : null;
        const verified = fitness.level === "Verified";
        const wisnRatio = needFte > 0 && supplyFte !== null ? supplyFte / needFte : null;
        const pressureIndex = supplyFte > 0 && needFte !== null ? needFte / supplyFte : null;
        baseNeeds.push(needFte);
        const firstValid = baseNeeds.find((v) => Number.isFinite(v) && v > 0) || null;
        const trendIndex = needFte !== null && firstValid ? needFte / firstValid : null;
        let risk = fitness.level;
        if (verified && gapFte !== null) risk = riskLevel({ gapFte, needFte, wisnRatio, pressureIndex });
        const gateReasons = [...fitness.failures, ...fitness.warnings];
        const recommendation = verified
          ? recommendationText({ gapFte, risk, supplyRow, code, wisnRatio, pressureIndex, coverageGap: targetByYear[year].coverageGap, professionWorkloadGap: 0 })
          : `ยังสรุปขาด/เกินไม่ได้: ${gateReasons.join(", ") || "ข้อมูลยังไม่ผ่าน Data Fitness Gate"}`;
        results.push({
          year,
          professionCode: code,
          professionLabel: prof?.label || code,
          actualNeedFte: needFte,
          targetNeedFte: null,
          needFte,
          supplyFte,
          gapFte,
          suggestedAdd: verified && gapFte !== null ? Math.ceil(Math.max(0, gapFte)) : null,
          reallocate: verified && gapFte !== null ? Math.max(0, -gapFte) : null,
          risk,
          dataFitness: fitness.level,
          fitnessFailures: fitness.failures,
          fitnessWarnings: fitness.warnings,
          outflow: numberOrNull(supplyRow?.outflow) ?? 0,
          netChange: numberOrNull(supplyRow?.net) ?? 0,
          wisnRatio,
          pressureIndex,
          trendIndex,
          coverageGap: targetByYear[year].coverageGap,
          workloadGap: targetByYear[year].workloadGap,
          professionWorkloadGap: 0,
          demandMinutes: actualWisn?.demandMinutes ?? null,
          actualDemandMinutes: actualWisn?.demandMinutes ?? null,
          targetDemandMinutes: null,
          serviceFte: actualWisn?.serviceFte ?? null,
          awtMinutes: actualWisn?.awtMinutes ?? null,
          casPct: actualWisn?.casPct ?? null,
          caf: actualWisn?.caf ?? null,
          iaf: actualWisn?.iaf ?? null,
          complexityIndex: 1,
          activityLines: actualWisn?.activityLines || [],
          targetGroups: targetByYear[year].groups,
          recommendation,
        });
      }
    }
    state.results = results;
    renderResults();
    renderDataFitnessSummary();
    renderTrace();
    $("sideStatus").textContent = "Calculated — profession-specific workload";
  };
  window.NCO_HR_BASE_RUN_PROJECTION = baseRunProjection;

  function valueText(value, digits = 1) {
    return value === null || value === undefined || !Number.isFinite(Number(value)) ? "—" : fmt(Number(value), digits);
  }

  renderResults = function renderResultsV2() {
    const table = $("resultTable");
    const head = table?.querySelector("thead tr");
    if (head && !head.querySelector('[data-v2-fitness-head]')) {
      const th = document.createElement("th");
      th.dataset.v2FitnessHead = "true";
      th.textContent = "Data Fitness";
      head.insertBefore(th, head.children[14] || null);
      if (head.children[2]) head.children[2].textContent = "Profession Workload Required FTE";
      if (head.children[3]) head.children[3].textContent = "Target Need FTE (context)";
      if (head.children[4]) head.children[4].textContent = "Required FTE ใช้ตัดสินใจ";
    }
    const body = table?.querySelector("tbody");
    if (!body) return;
    body.innerHTML = (state.results || []).map((row) => `
      <tr>
        <td>${row.year}</td><td>${profileEscape(row.professionLabel)}</td>
        <td>${valueText(row.actualNeedFte)}</td><td>—</td><td>${valueText(row.needFte)}</td><td>${valueText(row.supplyFte)}</td>
        <td>${row.dataFitness === "Verified" ? valueText(row.gapFte) : "—"}</td>
        <td>${row.dataFitness === "Verified" ? fmtRatio(row.wisnRatio) : "—"}</td>
        <td>${row.dataFitness === "Verified" ? fmtRatio(row.pressureIndex) : "—"}</td>
        <td>${row.trendIndex ? fmtRatio(row.trendIndex) : "—"}</td>
        <td>${row.coverageGap === null ? "N/A" : valueText(row.coverageGap,0)}</td>
        <td>${row.workloadGap === null ? "N/A" : valueText(row.workloadGap,0)}</td>
        <td>${row.suggestedAdd === null ? "—" : (row.suggestedAdd > 0 ? `+${row.suggestedAdd}` : "0")}</td>
        <td>${row.reallocate === null ? "—" : valueText(row.reallocate)}</td>
        <td><span class="risk ${String(row.dataFitness).toLowerCase()}">${row.dataFitness}</span></td>
        <td><span class="risk ${String(row.risk).toLowerCase()}">${row.risk}</span></td>
        <td>${profileEscape(row.recommendation)}</td>
      </tr>`).join("") || `<tr><td colspan="17">กรอก Profession-specific workload และกดคำนวณ</td></tr>`;

    const verifiedRows = (state.results || []).filter((row) => row.dataFitness === "Verified");
    const totalGap = verifiedRows.reduce((sum,row)=>sum+Math.max(0, Number(row.gapFte)||0),0);
    const highRisk = verifiedRows.filter((row)=>row.risk === "red").length;
    $("summaryGap").textContent = `${fmt(totalGap,1)} FTE (Verified only)`;
    $("summaryRisk").textContent = `${highRisk} (Verified only)`;
    $("summaryReplacement").textContent = state.targetSummary.totalCoverageGap ? `${fmt(state.targetSummary.totalCoverageGap,0)} คน` : "N/A";
    $("summaryNetOutflow").textContent = state.targetSummary.totalWorkloadGap ? `${fmt(state.targetSummary.totalWorkloadGap,0)} service units` : "N/A";
  };

  function renderProfessionWorkloadTable() {
    const body = $("professionWorkloadBody");
    if (!body) return;
    const filter = $("professionWorkloadFilter")?.value || "all";
    const rows = (state.professionWorkloadRows || []).filter((row) => filter === "all" || row.profession_code === filter);
    body.innerHTML = rows.map((row, index) => {
      const def = definitionFor(row.profession_code, row.activity_code) || {};
      return `<tr data-pw-index="${index}" title="${profileEscape(def.definition || row.definition || "")}">
        <td>${profileEscape(row.profession_label)}</td>
        <td>${row.year}</td>
        <td><strong>${profileEscape(row.workload_label)}</strong><br><small>${profileEscape(row.definition || "")}</small></td>
        <td><input data-pw-field="volume" data-pw-key="${profileEscape(workloadKey(row.profession_code,row.year,row.activity_code))}" type="number" min="0" step="any" value="${row.volume ?? ""}"></td>
        <td>${profileEscape(row.volume_unit)}</td>
        <td><input data-pw-field="source" data-pw-key="${profileEscape(workloadKey(row.profession_code,row.year,row.activity_code))}" value="${profileEscape(row.source || "")}" placeholder="HIS table/report"></td>
        <td><select data-pw-field="verification_status" data-pw-key="${profileEscape(workloadKey(row.profession_code,row.year,row.activity_code))}"><option>Draft</option><option${row.verification_status === "Reviewed" ? " selected" : ""}>Reviewed</option><option${row.verification_status === "Verified" ? " selected" : ""}>Verified</option></select></td>
        <td><select data-pw-field="overlap_policy" data-pw-key="${profileEscape(workloadKey(row.profession_code,row.year,row.activity_code))}">${(PD.overlapOptions || []).map((x)=>`<option${row.overlap_policy===x?" selected":""}>${x}</option>`).join("")}</select></td>
        <td><input data-pw-field="activity_standard_minutes" data-pw-key="${profileEscape(workloadKey(row.profession_code,row.year,row.activity_code))}" type="number" min="0" step="any" value="${row.activity_standard_minutes ?? ""}"><br><small>${profileEscape(row.activity_standard_unit || "")}</small></td>
        <td><input data-pw-field="standard_source" data-pw-key="${profileEscape(workloadKey(row.profession_code,row.year,row.activity_code))}" value="${profileEscape(row.standard_source || "")}" placeholder="time-motion / standard"></td>
        <td><select data-pw-field="standard_status" data-pw-key="${profileEscape(workloadKey(row.profession_code,row.year,row.activity_code))}"><option>Draft</option><option${row.standard_status === "Reviewed" ? " selected" : ""}>Reviewed</option><option${row.standard_status === "Verified" ? " selected" : ""}>Verified</option></select></td>
        <td><small>${profileEscape(row.related_kpi_codes || "")}</small></td>
      </tr>`;
    }).join("") || `<tr><td colspan="12">เลือกวิชาชีพก่อน แล้วกด Refresh workload rows</td></tr>`;
  }
  window.renderProfessionWorkloadTable = renderProfessionWorkloadTable;

  function renderDataFitnessSummary() {
    const node = $("dataFitnessSummary");
    if (!node) return;
    const checks = [];
    for (const code of selectedCodesForV2()) for (const year of years()) checks.push(evaluateDataFitness(code, year));
    const counts = { Verified:0, Provisional:0, Blocked:0 };
    checks.forEach((item)=>counts[item.level]++);
    node.innerHTML = `<strong>Data Fitness:</strong> Verified ${counts.Verified} | Provisional ${counts.Provisional} | Blocked ${counts.Blocked} <span>— ระบบจะสรุปขาด/เกินและ Suggested Add เฉพาะแถว Verified</span>`;
  }
  window.renderDataFitnessSummary = renderDataFitnessSummary;

  function refreshProfessionRowsFromSelection() {
    state.professionWorkloadRows = seedProfessionWorkloadRows({ blank: true });
    renderProfessionWorkloadFilter();
    renderProfessionWorkloadTable();
    renderDataFitnessSummary();
  }

  function renderProfessionWorkloadFilter() {
    const select = $("professionWorkloadFilter");
    if (!select) return;
    const current = select.value || "all";
    select.innerHTML = `<option value="all">ทุกวิชาชีพที่เลือก</option>` + selectedCodesForV2().map((code)=>`<option value="${code}">${profileEscape(getProfession(code)?.label || code)}</option>`).join("");
    select.value = Array.from(select.options).some((o)=>o.value===current) ? current : "all";
  }

  function updateProfessionWorkloadField(target) {
    const key = target.dataset.pwKey;
    if (!key) return;
    const [code, year, activityCode] = key.split(":");
    const row = professionWorkloadRow(code, year, activityCode);
    if (!row) return;
    const field = target.dataset.pwField;
    if (["volume", "activity_standard_minutes"].includes(field)) row[field] = numberOrNull(target.value);
    else row[field] = target.value;
    markObserved("professionWorkload", key);
    if (state.profileMetadata?.ProfessionWorkload?.status === "Verified") state.profileMetadata.ProfessionWorkload.status = "Draft";
    renderDataFitnessSummary();
    renderProfileCompleteness();
  }

  function installProfessionSpecificUi() {
    const mode = $("targetMode")?.querySelector('option[value="wisn-default"]');
    if (mode) mode.textContent = "Illustrative defaults — NOT VALIDATED";

    const needPanel = $("need");
    if (!needPanel || $("professionWorkloadTable")) return;
    const header = needPanel.querySelector(".panel-header h3");
    const headerP = needPanel.querySelector(".panel-header p");
    if (header) header.textContent = "Profession-specific Historical Workload";
    if (headerP) headerP.textContent = "WISN ใช้เฉพาะ workload ที่เป็นงานของวิชาชีพนั้นจริงและหน่วยตรงกับ Activity Standard; facility totals ใช้เพื่ออ้างอิง/reconcile เท่านั้น";

    const legacyShell = $("needTable")?.closest(".table-shell");
    if (legacyShell) {
      const details = document.createElement("details");
      details.className = "legacy-workload-reference";
      details.innerHTML = `<summary><strong>Facility totals / Population — ข้อมูลอ้างอิงเท่านั้น (reference only)</strong></summary><p>ตารางเดิมช่วย reconcile จำนวนบริการรวม แต่ <strong>ไม่ถูกใช้เป็น profession WISN numerator</strong> ใน Profile v2 และไม่ถูกนำไปเหมารวมว่าเป็นงานของแพทย์/พยาบาล/วิชาชีพอื่น</p>`;
      legacyShell.parentNode.insertBefore(details, legacyShell);
      details.appendChild(legacyShell);
    }

    const block = document.createElement("div");
    block.className = "v2-workload-block";
    block.innerHTML = `
      <div class="validation-banner"><strong>หลักสำคัญ:</strong> เช่น Doctor OPD ต้องเป็นจำนวนครั้งที่แพทย์ตรวจจริง ไม่ใช่ Total OPD ของโรงพยาบาล หากไม่มีข้อมูลตรง ให้เว้นว่าง — ระบบจะ Block การสรุปขาด/เกินแทนการใช้ proxy อัตโนมัติ</div>
      <div class="tool-row"><label class="field inline"><span>แสดงวิชาชีพ</span><select id="professionWorkloadFilter"></select></label><button class="btn secondary" id="btnRefreshProfessionWorkload" type="button">Refresh workload rows</button></div>
      <p id="dataFitnessSummary" class="profile-status"></p>
      <div class="table-shell tall"><table class="data-table" id="professionWorkloadTable"><thead><tr><th>วิชาชีพ</th><th>ปี</th><th>งานตัวแทนที่ใช้คำนวณ</th><th>ปริมาณจริง</th><th>หน่วย</th><th>Source</th><th>Workload Verify</th><th>Overlap</th><th>Activity Standard</th><th>Standard Source</th><th>Standard Verify</th><th>Related KPI</th></tr></thead><tbody id="professionWorkloadBody"></tbody></table></div>`;
    const firstDetails = needPanel.querySelector("details.legacy-workload-reference");
    needPanel.insertBefore(block, firstDetails || needPanel.children[1]);

    $("professionWorkloadFilter")?.addEventListener("change", renderProfessionWorkloadTable);
    $("btnRefreshProfessionWorkload")?.addEventListener("click", refreshProfessionRowsFromSelection);
    $("professionWorkloadBody")?.addEventListener("input", (event)=>{ if (event.target.dataset.pwField) updateProfessionWorkloadField(event.target); });
    $("professionWorkloadBody")?.addEventListener("change", (event)=>{ if (event.target.dataset.pwField) updateProfessionWorkloadField(event.target); });
    $("professionGrid")?.addEventListener("change", ()=>setTimeout(refreshProfessionRowsFromSelection,0));

    const scoreLabel = $("profileScoreWorkload")?.previousElementSibling;
    if (scoreLabel) scoreLabel.textContent = "Profession Workload";

    if (!state.professionWorkloadRows.length) state.professionWorkloadRows = seedProfessionWorkloadRows({ blank:true });
    if (!state.healthKpiRows.length) state.healthKpiRows = seedHealthKpiRows({ blank:true });
    renderProfessionWorkloadFilter();
    renderProfessionWorkloadTable();
    renderDataFitnessSummary();
  }

  // Excel guide extension is installed after the existing friendly layer has loaded.
  function installExcelV2Guide() {
    if (typeof excelFieldGuide !== "function" || excelFieldGuide.__v2) return;
    const baseGuide = excelFieldGuide;
    const fields = {
      activity_code:{label:"รหัสกิจกรรมภายใน",description:"technical slot ที่เชื่อม workload กับ standard; ใช้นิยามที่แสดงใน workload_label เป็นหลัก",unit:"รหัส",source:"ระบบ",formula:"เชื่อม profession workload กับ Activity Standard"},
      workload_label:{label:"งานตัวแทนของวิชาชีพ",description:"ชื่อ workload ที่ต้องเป็นงานของวิชาชีพนั้นจริง",unit:"ข้อความ",source:"Profession workload dictionary",formula:"เป็น numerator ของ WISN รายวิชาชีพ"},
      volume:{label:"ปริมาณงานจริง",description:"จำนวนหน่วยบริการจริงของวิชาชีพนั้นตามนิยาม ห้ามใช้ facility total แทนอัตโนมัติ",unit:"ตาม volume_unit",source:"HIS/registry ที่ระบุ provider",formula:"Volume × Activity Standard × Complexity"},
      volume_unit:{label:"หน่วยของปริมาณงาน",description:"ต้องตรงกับนิยามและ Activity Standard เช่น physician visits/year, patient-days/year, prescriptions/year",unit:"ข้อความ",source:"Dictionary",formula:"Data Fitness ตรวจ unit match"},
      definition:{label:"นิยามข้อมูล",description:"นิยาม operational definition ของ numerator ที่ใช้คำนวณ",unit:"ข้อความ",source:"Dictionary",formula:"กำหนดความหมายของ Volume"},
      inclusion_criteria:{label:"เกณฑ์รวม",description:"รายการที่นับเข้าตัวตั้ง",unit:"ข้อความ",source:"Dictionary/ข้อตกลงพื้นที่",formula:"ป้องกันการนับผิด scope"},
      exclusion_criteria:{label:"เกณฑ์ไม่รวม",description:"รายการที่ต้องตัดออก เช่น non-physician-only OPD สำหรับ Doctor OPD",unit:"ข้อความ",source:"Dictionary/ข้อตกลงพื้นที่",formula:"ป้องกัน over-count"},
      verification_status:{label:"สถานะทวนสอบข้อมูล",description:"Draft/Reviewed/Verified; shortage/surplus เชิงบริหารใช้เฉพาะ Verified",unit:"สถานะ",source:"ผู้ทวนสอบ",formula:"Data Fitness Gate"},
      overlap_policy:{label:"การจัดการข้อมูลซ้ำ",description:"independent/exclusive/deduplicated/unknown; workload ที่มีโอกาสซ้ำต้องไม่เป็น unknown ก่อนสรุป",unit:"สถานะ",source:"ผู้ดูแลข้อมูล",formula:"ป้องกัน double counting"},
      activity_standard_minutes:{label:"เวลามาตรฐานของวิชาชีพ",description:"นาทีที่วิชาชีพนั้นใช้ต่อ 1 หน่วย workload ตาม volume_unit",unit:"นาที/หน่วย",source:"time-motion/service standard",formula:"Volume × minutes/unit"},
      activity_standard_unit:{label:"หน่วยของเวลามาตรฐาน",description:"ต้องเป็นนาทีต่อหน่วย workload เดียวกัน",unit:"ข้อความ",source:"Dictionary",formula:"Data Fitness unit match"},
      standard_source:{label:"แหล่งที่มาของเวลามาตรฐาน",description:"time-motion study, official service standard หรือ expert consensus ที่ระบุได้",unit:"ข้อความ",source:"ทีมวิชาชีพ",formula:"Data Fitness Gate"},
      standard_status:{label:"สถานะทวนสอบเวลามาตรฐาน",description:"Draft/Reviewed/Verified",unit:"สถานะ",source:"ทีมวิชาชีพ/ผู้ทวนสอบ",formula:"Data Fitness Gate"},
      related_kpi_codes:{label:"Health KPI ที่เกี่ยวข้อง",description:"KPI ใช้เป็น outcome context ไม่ใช่หลักฐานเชิงสาเหตุของ staffing",unit:"รหัส KPI",source:"NCO indicator catalog",formula:"Context only"},
      indicator_code:{label:"รหัส Health KPI",description:"รหัสตัวชี้วัดจาก NCO/Service Plan catalog",unit:"รหัส",source:"NCO_INDICATOR_STANDARD/API",formula:"Outcome context"},
      indicator_name:{label:"ชื่อ Health KPI",description:"ชื่อตัวชี้วัดผลลัพธ์/คุณภาพที่เกี่ยวข้อง",unit:"ข้อความ",source:"NCO_INDICATOR_STANDARD/API",formula:"Outcome context"},
      value:{label:"ค่าตัวชี้วัดจริง",description:"ค่าจริงของปีนั้น; ถ้าไม่มีข้อมูลให้เว้นว่าง",unit:"ตาม KPI",source:"ระบบตัวชี้วัดที่ทวนสอบ",formula:"ไม่เข้า WISN FTE โดยตรง"},
      direction:{label:"ทิศทางที่พึงประสงค์",description:"low/high/range ตาม catalog",unit:"ข้อความ",source:"Indicator catalog",formula:"Outcome interpretation"},
      threshold:{label:"เกณฑ์อ้างอิง",description:"ใช้เฉพาะเกณฑ์ที่มีใน canonical standard; ไม่สร้างเกณฑ์ใหม่เมื่อไม่มี",unit:"ตาม KPI",source:"NCO_INDICATOR_STANDARD",formula:"Outcome interpretation"},
    };
    excelFieldGuide = function excelFieldGuideV2(key) { return fields[key] || baseGuide(key); };
    excelFieldGuide.__v2 = true;

    if (typeof buildExcelInstructionRows === "function") {
      const baseInstructions = buildExcelInstructionRows;
      buildExcelInstructionRows = function buildExcelInstructionRowsV2() {
        const rows = baseInstructions();
        rows.splice(5,0,
          ["Profession-specific workload", "Workload_History = facility/population reference only. WISN ใช้ Profession_Workload เท่านั้น เช่น Doctor OPD = physician OPD encounters ไม่ใช่ Total OPD"],
          ["Data Fitness Gate", "ระบบสรุปขาด/เกินและ Suggested Add เฉพาะข้อมูลที่ผ่าน workforce + workload definition/unit + overlap + standard verification"],
          ["Health KPI", "Health_KPI_History ใช้เชื่อมผลลัพธ์สุขภาพ/บริการกับ capacity เพื่อประกอบการวิเคราะห์ แต่ไม่ใช่หลักฐานว่า staffing เป็นสาเหตุโดยลำพัง"]
        );
        const idx = rows.findIndex((row)=>row?.[0] === "Workload_History");
        if (idx >= 0) rows[idx][2] = "ประชากรและ facility totals เพื่อ reference/reconcile เท่านั้น ไม่ใช้เป็น profession WISN numerator";
        rows.push(["Profession_Workload", "ทีมวิชาชีพ + HIS/เวชระเบียน", "ปริมาณงานจริงเฉพาะวิชาชีพ นิยาม หน่วย source verification overlap และเวลามาตรฐาน"]);
        rows.push(["Health_KPI_History", "ยุทธศาสตร์/คุณภาพ/Service Plan", "ค่าตัวชี้วัด outcome/service KPI จริงรายปี พร้อม source/status"]);
        return rows;
      };
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Profile's own DOMContentLoaded listener runs first. Apply v2 UI immediately after.
    installProfessionSpecificUi();
    installExcelV2Guide();
    setTimeout(() => {
      renderProfessionWorkloadTable();
      renderDataFitnessSummary();
      renderProfileCompleteness();
    }, 0);
  });

  window.NCO_HR_PROFILE_SCHEMA_V2 = V2_SCHEMA;
  window.NCO_HR_SEED_PROFESSION_WORKLOAD = seedProfessionWorkloadRows;
  window.NCO_HR_SEED_HEALTH_KPI = seedHealthKpiRows;
})();
