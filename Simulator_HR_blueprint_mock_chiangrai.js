// Embedded complete demo profile for HR Blueprint v2.
// Purpose: presentation/regression only. Mixed ACTUAL + REFERENCE + MOCK data must never be presented as a verified provincial staffing conclusion.
(() => {
  "use strict";

  const MOCK_ID = "HR1-57-PROV-2569-MOCK";
  const MOCK_NAME = "เชียงราย(mock up)";
  const MOCK_SOURCE = "MOCK:CHIANGRAI_DEMO_V1";
  const YEARS = [2569, 2568, 2567, 2566, 2565];
  const SCALE = { 2569: 1, 2568: 0.98, 2567: 0.96, 2566: 0.93, 2565: 0.90 };
  const POPULATION = { 2569: 884137, 2568: 886700, 2567: 888900, 2566: 890800, 2565: 892500 };

  // Repository actual provincial baseline facts from output/hr_blueprint_provincial_baseline_region1.json.
  const ACTUAL_PROVINCIAL = Object.freeze({
    population: 884137,
    doctor: 546,
    nurse: 2222,
    pharmacist: 231,
    vacancy_all: 656,
    vacant_doctor: 31,
    vacant_nurse: 189,
    vacant_pharmacist: 11,
    retire_5y_all: 508,
    retire_5y_doctor: 14,
    retire_5y_nurse: 127,
    retire_5y_pharmacist: 6,
  });

  const WORKFORCE = Object.freeze({
    doctor: { 2569: 546, 2568: 541, 2567: 535, 2566: 528, 2565: 520 },
    nurse: { 2569: 2222, 2568: 2200, 2567: 2175, 2566: 2140, 2565: 2110 },
    pharmacist: { 2569: 231, 2568: 228, 2567: 224, 2566: 220, 2565: 216 },
  });

  const LATEST_WORKLOAD = Object.freeze({
    doctor: {
      opdVisits: 1650000,       // Doctor OPD encounters — physician visits/year
      ipdAdmissions: 85000,
      erVisits: 180000,
      procedures: 55000,
      deliveries: 8500,
      chronicVisits: 280000,
      mentalVisits: 30000,
      outreachVisits: 30000,
    },
    nurse: {
      opdVisits: 1800000,
      ipdAdmissions: 450000,    // IPD nursing patient-days — patient-days/year
      erVisits: 220000,
      procedures: 100000,
      deliveries: 9000,
      chronicVisits: 450000,
      mentalVisits: 60000,
      outreachVisits: 300000,
    },
    pharmacist: {
      opdVisits: 1500000,       // OPD prescriptions/dispensing episodes — prescriptions/year
      ipdAdmissions: 300000,
      erVisits: 180000,
      chronicVisits: 400000,
    },
  });

  // Demo activity standards are synthetic expert-consensus values chosen to exercise the WISN pipeline.
  // They are NOT official standards and must be replaced by local verified time-motion/service standards.
  const DEMO_STANDARDS = Object.freeze({
    doctor: { opdVisits:15, ipdAdmissions:45, erVisits:25, procedures:75, deliveries:60, chronicVisits:15, mentalVisits:25, outreachVisits:20 },
    nurse: { opdVisits:20, ipdAdmissions:205, erVisits:35, procedures:45, deliveries:180, chronicVisits:20, mentalVisits:30, outreachVisits:45 },
    pharmacist: { opdVisits:7, ipdAdmissions:10, erVisits:5, chronicVisits:13 },
  });

  const FACILITY_REFERENCE_2569 = Object.freeze({
    opdVisits: 1950000,
    ipdAdmissions: 85000,
    erVisits: 220000,
    procedures: 100000,
    deliveries: 9000,
    chronicVisits: 500000,
    mentalVisits: 70000,
    outreachVisits: 350000,
  });

  // Two values are actual hospital-level outcome context in the repository, not province-wide outcomes.
  const KPI_2569 = Object.freeze({
    A01: 3.29,
    A04: 7.2,
    A09: 18.4,
    B01: 22.6,
    C02: 1.72,
    D01: 84.0,
    F10: 12.5,
    DH0101: 10.81,
    DH0102: 7.8,
    DN0101: 13.2,
    DN0142D: 0.8,
    CI0101: 18.4,
    PE0102: 1.9,
    CM0203: 7.4,
    CM0101: 22.6,
    DC0401: 12.8,
    DG0201: 24.0,
    PS0001: 6.2,
    RH0101: 58.0,
  });
  const ACTUAL_HOSPITAL_CONTEXT = new Set(["A01", "DH0101"]);

  const movementSeed = Object.freeze({
    doctor: {
      2569:{recruit:22,transferIn:10,returnIn:4,retire:7,resign:4,transferOut:8,studyLeave:6},
      2568:{recruit:20,transferIn:9,returnIn:3,retire:6,resign:4,transferOut:7,studyLeave:6},
      2567:{recruit:18,transferIn:9,returnIn:3,retire:6,resign:4,transferOut:7,studyLeave:5},
      2566:{recruit:17,transferIn:8,returnIn:3,retire:5,resign:4,transferOut:6,studyLeave:5},
      2565:{recruit:16,transferIn:8,returnIn:3,retire:5,resign:4,transferOut:6,studyLeave:5},
    },
    nurse: {
      2569:{recruit:105,transferIn:36,returnIn:18,retire:42,resign:22,transferOut:31,studyLeave:28},
      2568:{recruit:96,transferIn:34,returnIn:17,retire:39,resign:21,transferOut:30,studyLeave:26},
      2567:{recruit:92,transferIn:32,returnIn:16,retire:38,resign:20,transferOut:29,studyLeave:25},
      2566:{recruit:88,transferIn:30,returnIn:15,retire:36,resign:19,transferOut:28,studyLeave:24},
      2565:{recruit:84,transferIn:29,returnIn:14,retire:34,resign:18,transferOut:27,studyLeave:23},
    },
    pharmacist: {
      2569:{recruit:12,transferIn:5,returnIn:2,retire:3,resign:2,transferOut:4,studyLeave:3},
      2568:{recruit:11,transferIn:5,returnIn:2,retire:3,resign:2,transferOut:4,studyLeave:3},
      2567:{recruit:10,transferIn:4,returnIn:2,retire:3,resign:2,transferOut:3,studyLeave:3},
      2566:{recruit:10,transferIn:4,returnIn:2,retire:2,resign:2,transferOut:3,studyLeave:2},
      2565:{recruit:9,transferIn:4,returnIn:2,retire:2,resign:2,transferOut:3,studyLeave:2},
    },
  });

  function round(value) {
    return Math.round(Number(value) || 0);
  }

  function classificationForHistoricalYear(year) {
    return Number(year) === 2569 ? "MIXED_ACTUAL_AND_MOCK" : "MOCK";
  }

  function scaledLatest(value, year) {
    return round(value * (SCALE[year] ?? 1));
  }

  function kpiHistoricalValue(code, year, catalog) {
    const latest = Number(KPI_2569[code]);
    if (!Number.isFinite(latest)) return null;
    if (Number(year) === 2569) return latest;
    const age = 2569 - Number(year);
    const direction = String(catalog?.direction || "low");
    if (direction === "high") return Number((latest * (1 - age * 0.02)).toFixed(2));
    if (direction === "range") return Number((latest + Math.min(2, age * 0.5)).toFixed(2));
    return Number((latest * (1 + age * 0.02)).toFixed(2));
  }

  function sectionMeta(source, note) {
    return {
      owner: "NCO HR Blueprint Demo",
      source,
      status: "Verified",
      updated_at: "2026-09-18T08:37:00+07:00",
      note,
    };
  }

  function buildWorkloadHistory() {
    return YEARS.map((year) => ({
      year,
      population: POPULATION[year],
      opdVisits: scaledLatest(FACILITY_REFERENCE_2569.opdVisits, year),
      ipdAdmissions: scaledLatest(FACILITY_REFERENCE_2569.ipdAdmissions, year),
      erVisits: scaledLatest(FACILITY_REFERENCE_2569.erVisits, year),
      procedures: scaledLatest(FACILITY_REFERENCE_2569.procedures, year),
      deliveries: scaledLatest(FACILITY_REFERENCE_2569.deliveries, year),
      chronicVisits: scaledLatest(FACILITY_REFERENCE_2569.chronicVisits, year),
      mentalVisits: scaledLatest(FACILITY_REFERENCE_2569.mentalVisits, year),
      outreachVisits: scaledLatest(FACILITY_REFERENCE_2569.outreachVisits, year),
      complexityIndex: 1,
      data_classification: classificationForHistoricalYear(year),
      source: Number(year) === 2569
        ? "Population ACTUAL:HDC 2569; facility service totals are MOCK reference-only"
        : `${MOCK_SOURCE}: synthetic historical facility reference`,
      note: "Facility totals are reference/reconciliation only and are not used as profession-specific WISN numerators.",
    }));
  }

  function buildTargetNeedHistory() {
    const rows = [];
    for (const year of YEARS) {
      const population = POPULATION[year];
      for (const def of TARGET_NEED_DEFS) {
        rows.push({
          year,
          groupCode: def.code,
          groupLabel: def.label,
          targetPopulation: round(population * Number(def.ratePct || 0) / 100),
          actualServed: round(population * Number(def.actualRatePct || 0) / 100),
          coveragePct: Number(def.coveragePct || 0),
          frequency: Number(def.frequency || 0),
          complexityIndex: Number(def.complexity || 1),
          placement: def.placement || "",
          data_classification: "MOCK",
          source: `${MOCK_SOURCE}: synthetic target-need demo`,
        });
      }
    }
    return rows;
  }

  function buildWorkforceHistory() {
    const rows = [];
    for (const code of ["doctor","nurse","pharmacist"]) {
      const prof = getProfession(code);
      for (const year of YEARS) {
        const movement = movementSeed[code][year];
        rows.push({
          profession_code: code,
          profession_label: prof?.label || code,
          year,
          actualHeadcount: WORKFORCE[code][year],
          recruit: movement.recruit,
          transferIn: movement.transferIn,
          returnIn: movement.returnIn,
          retire: movement.retire,
          resign: movement.resign,
          transferOut: movement.transferOut,
          studyLeave: movement.studyLeave,
          fteFactor: 1,
          data_classification: Number(year) === 2569 ? "ACTUAL_HEADCOUNT_WITH_MOCK_MOVEMENTS" : "MOCK",
          source: Number(year) === 2569
            ? "ACTUAL: output/hr_blueprint_provincial_baseline_region1.json ← hr_blueprint.db; movements MOCK"
            : `${MOCK_SOURCE}: synthetic workforce history`,
        });
      }
    }
    return rows;
  }

  function professionConfigRow(prof) {
    const selected = ["doctor","nurse","pharmacist"].includes(prof.code);
    const cfg = getDefaultWisn(prof);
    const row = {
      profession_code: prof.code,
      profession_label: prof.label,
      selected,
      current: selected ? ACTUAL_PROVINCIAL[prof.code] : null,
      vacant: selected ? ACTUAL_PROVINCIAL[`vacant_${prof.code}`] : null,
      retire5y: selected ? ACTUAL_PROVINCIAL[`retire_5y_${prof.code}`] : null,
      fteFactor: 1,
      awtMinutes: cfg.awtMinutes,
      casPct: cfg.casPct,
      iasHours: cfg.iasHours,
      data_classification: selected ? "MIXED_ACTUAL_AND_MOCK_STANDARD" : "REFERENCE_ONLY",
      source: selected
        ? "Headcount/vacancy/retirement ACTUAL from provincial baseline; AWT/CAS/IAS are model reference assumptions"
        : "REFERENCE: profession catalog only",
    };
    for (const activity of ACTIVITY_DEFS) {
      row[`activity_${activity.code}`] = selected
        ? (DEMO_STANDARDS[prof.code]?.[activity.code] ?? 0)
        : (cfg.activityMinutes?.[activity.code] ?? 0);
    }
    return row;
  }

  function buildProfessionWorkload() {
    const PD = window.NCO_HR_PROFESSION_DICTIONARY || { workloadDefinitions:{} };
    const rows = [];
    for (const code of ["doctor","nurse","pharmacist"]) {
      const prof = getProfession(code);
      const definitions = PD.workloadDefinitions?.[code] || [];
      for (const year of YEARS) {
        for (const def of definitions) {
          const latest = LATEST_WORKLOAD[code]?.[def.activity_code];
          if (!Number.isFinite(Number(latest))) continue;
          const minutes = DEMO_STANDARDS[code]?.[def.activity_code];
          rows.push({
            profession_code: code,
            profession_label: prof?.label || code,
            year,
            activity_code: def.activity_code,
            workload_label: def.workload_label,
            volume: scaledLatest(latest, year),
            volume_unit: def.volume_unit,
            definition: def.definition,
            inclusion_criteria: def.inclusion_criteria,
            exclusion_criteria: def.exclusion_criteria,
            source: `${MOCK_SOURCE}: synthetic profession-specific volume for workflow demonstration`,
            verification_status: "Verified",
            overlap_policy: def.overlap_sensitive ? "deduplicated" : (def.overlap_policy_default || "independent"),
            complexity_index: 1,
            activity_standard_minutes: Number(minutes),
            activity_standard_unit: `minutes/${String(def.volume_unit || "").replace(/\/year$/i,"")}`,
            standard_source: "MOCK:expert-consensus-demo-v1 — NOT official standard",
            standard_status: "Verified",
            related_kpi_codes: (def.related_kpi_codes || []).join(","),
            data_classification: "MOCK",
            note: "Verified here means the demo row is internally complete for Data Fitness testing; it is not field-verified service data.",
          });
        }
      }
    }
    return rows;
  }

  function buildHealthKpiHistory() {
    const PD = window.NCO_HR_PROFESSION_DICTIONARY || { healthKpis:{} };
    const rows = [];
    for (const year of YEARS) {
      for (const kpi of Object.values(PD.healthKpis || {})) {
        const value = kpiHistoricalValue(kpi.code, year, kpi);
        const isActualHospital = Number(year) === 2569 && ACTUAL_HOSPITAL_CONTEXT.has(kpi.code);
        rows.push({
          year,
          indicator_code: kpi.code,
          indicator_name: kpi.name,
          value,
          unit: kpi.unit || "",
          direction: kpi.direction || "",
          threshold: kpi.threshold ?? "",
          source: isActualHospital
            ? `ACTUAL_HOSPITAL_CONTEXT: รพศ.เชียงรายประชานุเคราะห์; health_metrics_analysis_report.md; ไม่ใช่ค่า outcome รวมทั้งจังหวัด`
            : `${MOCK_SOURCE}: synthetic KPI trend for demonstration`,
          verification_status: "Verified",
          data_classification: isActualHospital ? "ACTUAL_HOSPITAL_CONTEXT" : "MOCK",
          scope_note: isActualHospital ? "Hospital context only — not provincial outcome" : "Synthetic provincial demo context",
          note: "Health KPI is outcome context only and does not prove a causal staffing effect.",
        });
      }
    }
    return rows;
  }

  function buildChiangraiMockProfile() {
    return {
      schema_version: window.NCO_HR_PROFILE_SCHEMA_V2 || "nco-hr-profile-v2",
      profile_id: MOCK_ID,
      generated_at: new Date().toISOString(),
      profile_owner: "NCO HR Blueprint Demo",
      scenario: MOCK_NAME,
      profile_type: "DEMO_MOCK",
      demo_data_classification: "mixed actual + reference + mock",
      demo_warning: "MOCK PROFILE — FOR DEMONSTRATION ONLY",
      source_legend: "ACTUAL / REFERENCE / MOCK",
      scope: {
        province_code: "57",
        province: "เชียงราย",
        amphur_code: "",
        amphur: "",
        unit: "",
        mode: "province",
        latest_year: 2569,
        year_count: 5,
      },
      baseline: {
        population: ACTUAL_PROVINCIAL.population,
        vacancy_all: ACTUAL_PROVINCIAL.vacancy_all,
        retire_5y_all: ACTUAL_PROVINCIAL.retire_5y_all,
        confidence: "C",
      },
      section_metadata: {
        Population: sectionMeta("ACTUAL:HDC 2569 + MOCK 2565-2568", "2569 เป็นข้อมูลจริงจาก HDC; 2565-2568 เป็น synthetic demo เพื่อให้ historical profile ครบ"),
        Workload: sectionMeta(MOCK_SOURCE, "Facility workload เป็น MOCK reference/reconciliation only และไม่ใช้เป็น WISN numerator"),
        Workforce: sectionMeta("ACTUAL:hr_blueprint.db provincial baseline + MOCK history/movements", "ปี 2569 headcount/vacancy/retire5y เป็น actual provincial baseline; ปีก่อนและ movements เป็น mock"),
        TargetNeed: sectionMeta(MOCK_SOURCE, "Target need ทั้งชุดเป็น synthetic demo จาก population × model rates"),
        WISN: sectionMeta("REFERENCE:model AWT/CAS/IAS + MOCK activity standards", "Activity standards ใน mock นี้ไม่ใช่มาตรฐานทางการ"),
        ProfessionWorkload: sectionMeta(MOCK_SOURCE, "Profession-specific workload ทั้งหมดเป็น synthetic demo ที่หน่วยตรง dictionary และ overlap ถูกกำหนดเพื่อทดสอบ Data Fitness"),
        HealthKPI: sectionMeta("ACTUAL hospital context A01/DH0101 + MOCK other KPI", "A01=3.29 และ DH0101=10.81 เป็น actual เฉพาะ รพศ.เชียงรายประชานุเคราะห์ ไม่ใช่ provincial outcome"),
      },
      workload_history: buildWorkloadHistory(),
      target_need_history: buildTargetNeedHistory(),
      workforce_history: buildWorkforceHistory(),
      profession_config: PROFESSION_DEFS.map(professionConfigRow),
      profession_workload: buildProfessionWorkload(),
      health_kpi_history: buildHealthKpiHistory(),
      profile_version_note: "Profession-specific workload drives WISN; facility Workload_History is reference only.",
    };
  }
  window.NCO_BUILD_CHIANGRAI_MOCK_PROFILE = buildChiangraiMockProfile;

  const baseApplyProfilePayload = applyProfilePayload;
  applyProfilePayload = function applyProfilePayloadWithMockIdentity(payload) {
    const isMock = String(payload?.profile_id || "") === MOCK_ID || String(payload?.profile_type || "") === "DEMO_MOCK";
    state.mockProfile = isMock ? {
      id: MOCK_ID,
      name: MOCK_NAME,
      classification: "mixed actual + reference + mock",
    } : null;
    baseApplyProfilePayload(payload);
    if ($("profileId") && isMock) $("profileId").dataset.auto = "false";
    renderMockProfileBanner();
  };

  const baseCollectProfilePayload = collectProfilePayload;
  collectProfilePayload = function collectProfilePayloadWithMockProvenance() {
    const payload = baseCollectProfilePayload();
    if (state.mockProfile?.id !== MOCK_ID) return payload;
    payload.profile_type = "DEMO_MOCK";
    payload.demo_data_classification = "mixed actual + reference + mock";
    payload.demo_warning = "MOCK PROFILE — FOR DEMONSTRATION ONLY";
    payload.source_legend = "ACTUAL / REFERENCE / MOCK";
    for (const row of payload.workload_history || []) {
      row.data_classification = classificationForHistoricalYear(row.year);
      row.source = Number(row.year) === 2569
        ? "Population ACTUAL:HDC 2569; facility service totals MOCK reference-only"
        : `${MOCK_SOURCE}: synthetic historical facility reference`;
    }
    for (const row of payload.target_need_history || []) {
      row.data_classification = "MOCK";
      row.source = `${MOCK_SOURCE}: synthetic target-need demo`;
    }
    for (const row of payload.workforce_history || []) {
      row.data_classification = Number(row.year) === 2569 ? "ACTUAL_HEADCOUNT_WITH_MOCK_MOVEMENTS" : "MOCK";
      row.source = Number(row.year) === 2569
        ? "ACTUAL provincial headcount from hr_blueprint.db baseline; movements MOCK"
        : `${MOCK_SOURCE}: synthetic workforce history`;
    }
    for (const row of payload.profession_config || []) {
      row.data_classification = row.selected ? "MIXED_ACTUAL_AND_MOCK_STANDARD" : "REFERENCE_ONLY";
    }
    return payload;
  };

  const baseProfileRowsFromPayload = profileRowsFromPayload;
  profileRowsFromPayload = function profileRowsFromPayloadWithMockLegend(payload) {
    const rows = baseProfileRowsFromPayload(payload);
    const isMock = String(payload?.profile_id || "") === MOCK_ID || String(payload?.profile_type || "") === "DEMO_MOCK";
    if (isMock && Array.isArray(rows.Profile)) {
      rows.Profile.push(
        { key:"profile_type", value:"DEMO_MOCK" },
        { key:"demo_data_classification", value:"mixed actual + reference + mock" },
        { key:"source_legend", value:"ACTUAL / REFERENCE / MOCK" },
        { key:"demo_warning", value:"MOCK PROFILE — FOR DEMONSTRATION ONLY" },
        { key:"actual_sources", value:"HDC 2569 population; provincial HR baseline from hr_blueprint.db; A01/DH0101 hospital context from health_metrics_analysis_report.md" },
      );
    }
    return rows;
  };

  function installMockExcelLabels() {
    if (typeof excelFieldGuide !== "function" || excelFieldGuide.__mockClassification) return;
    const base = excelFieldGuide;
    excelFieldGuide = function excelFieldGuideMockAware(key) {
      if (key === "data_classification") return {
        label:"ชั้นข้อมูล",
        description:"ระบุว่าเป็น ACTUAL, REFERENCE หรือ MOCK เพื่อไม่ให้ข้อมูลสาธิตปะปนกับข้อมูลจริง",
        unit:"สถานะ",
        source:"ระบบ/ผู้จัดทำ Profile",
        formula:"Provenance only — ไม่เข้า WISN โดยตรง",
      };
      if (key === "scope_note") return {
        label:"หมายเหตุขอบเขตข้อมูล",
        description:"ระบุระดับพื้นที่ของข้อมูล เช่น hospital context หรือ province context",
        unit:"ข้อความ",
        source:"ผู้ดูแลข้อมูล",
        formula:"Interpretation context",
      };
      return base(key);
    };
    excelFieldGuide.__mockClassification = true;
  }

  function renderMockProfileBanner() {
    const banner = $("mockProfileBanner");
    if (!banner) return;
    const active = state.mockProfile?.id === MOCK_ID;
    banner.hidden = !active;
    if (!active) return;
    banner.innerHTML = `
      <strong>MOCK PROFILE — FOR DEMONSTRATION ONLY</strong>
      <span>เชียงราย(mock up) เป็นชุด <b>ACTUAL / REFERENCE / MOCK</b> ผสมกัน: ใช้สาธิต workflow, Data Fitness, WISN และ KPI เท่านั้น ห้ามนำตัวเลขขาด/เกินไปใช้ตัดสินใจเชิงนโยบายโดยไม่แทนค่าด้วยข้อมูลจริงที่ทวนสอบแล้ว</span>
      <small>หมายเหตุ: Verified ใน mock หมายถึงแถวสาธิตมีโครงสร้างครบเพื่อทดสอบระบบ ไม่ใช่การรับรองข้อมูลภาคสนาม</small>`;
  }

  function installMockProfileUi() {
    const panel = $("profile");
    const actions = panel?.querySelector(".profile-actions");
    if (!panel || !actions || $("btnLoadChiangraiMock")) return;

    const banner = document.createElement("div");
    banner.id = "mockProfileBanner";
    banner.className = "mock-profile-banner";
    banner.hidden = true;
    panel.querySelector(".panel-header")?.insertAdjacentElement("afterend", banner);

    const button = document.createElement("button");
    button.className = "btn secondary";
    button.id = "btnLoadChiangraiMock";
    button.type = "button";
    button.textContent = "โหลด เชียงราย(mock up)";
    actions.prepend(button);

    const style = document.createElement("style");
    style.textContent = `
      .mock-profile-banner{margin:0 0 16px;padding:14px 16px;border:2px solid #b45309;border-radius:10px;background:#fff7ed;display:grid;gap:5px}
      .mock-profile-banner[hidden]{display:none}
      .mock-profile-banner strong{font-size:15px;color:#9a3412}
      .mock-profile-banner span{line-height:1.55;color:#7c2d12}
      .mock-profile-banner small{color:#92400e}
      #btnLoadChiangraiMock{font-weight:700}
    `;
    document.head.appendChild(style);

    button.addEventListener("click", () => {
      try {
        const payload = buildChiangraiMockProfile();
        applyProfilePayload(payload);
        if ($("profileId")) {
          $("profileId").value = MOCK_ID;
          $("profileId").dataset.auto = "false";
        }
        if ($("confidenceLevel")) $("confidenceLevel").value = "C";
        persistProfileSettings?.();
        renderMockProfileBanner();
        setProfileStatus("โหลด เชียงราย(mock up) แล้ว — Mixed ACTUAL / REFERENCE / MOCK; สำหรับสาธิตเท่านั้น", "warning");
        setTimeout(() => {
          window.renderProfessionWorkloadTable?.();
          window.renderDataFitnessSummary?.();
          window.renderHealthKpiTable?.();
          renderProfileCompleteness?.();
          if (typeof runProjection === "function") runProjection();
          renderMockProfileBanner();
        }, 0);
      } catch (error) {
        setProfileStatus(`โหลด เชียงราย(mock up) ไม่สำเร็จ: ${error.message || error}`, "error");
      }
    });

    renderMockProfileBanner();
  }

  const baseRenderTrace = window.renderTrace;
  if (typeof baseRenderTrace === "function") {
    window.renderTrace = function renderTraceWithMockWarning() {
      baseRenderTrace();
      if (state.mockProfile?.id !== MOCK_ID || !$("sourceText")) return;
      $("sourceText").textContent =
        "MOCK PROFILE — FOR DEMONSTRATION ONLY\nData classification: ACTUAL / REFERENCE / MOCK\n" +
        $("sourceText").textContent +
        "\nPolicy warning: WISN shortage/surplus from this profile is a synthetic demonstration and must not be used as an actual Chiang Rai staffing conclusion.";
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    installMockProfileUi();
    installMockExcelLabels();
  });
})();
