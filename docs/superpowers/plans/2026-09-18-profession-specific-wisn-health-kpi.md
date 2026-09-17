# Profession-specific WISN + Health KPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HR Blueprint WISN calculations use verified profession-specific workload definitions/units, block misleading shortage conclusions when data are not fit, and add related Health KPI context across UI, Excel and Google Sheets.

**Architecture:** Add a canonical profession-workload/KPI dictionary and a validation/calculation adapter layered onto the historical simulator. Profile schema v2 adds long-form `Profession_Workload` and `Health_KPI_History`, while v1 import remains compatible. Existing facility workload stays as reconciliation/reference data only.

**Tech Stack:** Static HTML/CSS/JavaScript, SheetJS CE 0.20.3, Google Apps Script, Node `node:test`, Python unittest, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-18-profession-specific-wisn-health-kpi-design.md`

## Global Constraints
- Historical years remain actual observations only; blank/null is not zero.
- Do not synthesize profession workload from facility totals, population, growth or ratios.
- Preserve current public static hosting and browser-only Excel import/export.
- Existing `nco-hr-profile-v1` files must remain importable.
- Health KPI relationships are contextual/validation signals, not proof that staffing caused the KPI.
- Do not invent KPI thresholds absent from `NCO_INDICATOR_STANDARD.md`.

---

### Task 1: Regression tests for profession-specific workload and gates

**Files:**
- Create: `tests/profession_workload_fitness.test.mjs`
- Modify: `.github/workflows/historical-hr-blueprint.yml`

**Interfaces:**
- Consumes current HTML/base/profile sources.
- Produces contract tests for dictionary, v2 sheets, Data Fitness, target missing handling, KPI catalog.

- [ ] **Step 1: Write failing tests** asserting v2 schema, two new sheets, doctor physician-encounter wording, nurse IPD patient-day wording, no facility workload fallback, no blank actualServed→zero, and risk gating.
- [ ] **Step 2: Run `node --test tests/profession_workload_fitness.test.mjs` and confirm RED** because v2/dictionary/gates do not exist yet.
- [ ] **Step 3: Add syntax checks for new modules to workflow.**
- [ ] **Step 4: Commit tests only.**

### Task 2: Canonical profession workload and KPI dictionary

**Files:**
- Create: `Simulator_HR_blueprint_profession_dictionary.js`
- Modify: `Simulator_HR_blueprint.html`

**Interfaces:**
- Produces `window.NCO_HR_PROFESSION_DICTIONARY = { workloadDefinitions, healthKpis, professionKpiMap, overlapOptions }`.
- Downstream profile, UI, help and Excel layers read this object.

- [ ] **Step 1: Add dictionary entries** for all current professions and activity slots with visible workload label, exact unit, definition, inclusion, exclusion, overlap rule guidance and related KPI codes.
- [ ] **Step 2: Add KPI catalog** from `NCO_INDICATOR_STANDARD.md` and `API/district_baseline_store.py`; threshold remains null where not canonically defined.
- [ ] **Step 3: Load dictionary before profile/calculation adapter.**
- [ ] **Step 4: Run focused test and make it GREEN.**
- [ ] **Step 5: Commit.**

### Task 3: Profile v2 + Excel/Google interchange

**Files:**
- Modify: `Simulator_HR_blueprint_profile.js`
- Modify: `Simulator_HR_blueprint_excel_guide.js`
- Modify: `integrations/google_apps_script/Code.gs`
- Modify: `GOOGLE_SHEETS_PROFILE_GUIDE.md`

**Interfaces:**
- `NCO_PROFILE_SCHEMA = "nco-hr-profile-v2"`
- v2 payload adds `profession_workload` and `health_kpi_history`.
- `profilePayloadFromSheetRows()` accepts v1 and migrates it without using legacy facility workload for profession WISN.

- [ ] **Step 1: Extend profile state** with profession workload and health KPI observed rows.
- [ ] **Step 2: Add v2 sheet serialization/parser** for `Profession_Workload` and `Health_KPI_History`.
- [ ] **Step 3: Seed blank template rows** for selected professions × years × relevant workload definitions; seed KPI catalog × years with blank values.
- [ ] **Step 4: Preserve v1 import compatibility** by accepting six old sheets and marking profession workload absent/unfit rather than deriving it.
- [ ] **Step 5: Update Excel friendly guide** with Thai labels, definition, unit, inclusion/exclusion, overlap, source, status and KPI explanation.
- [ ] **Step 6: Update Apps Script and guide to 8 sheets/v2.**
- [ ] **Step 7: Run profile/friendly Excel tests and commit.**

### Task 4: Profession-specific workload UI and calculation adapter

**Files:**
- Create: `Simulator_HR_blueprint_profession_workload.js`
- Modify: `Simulator_HR_blueprint.html`
- Modify: `Simulator_HR_blueprint_profile.css`

**Interfaces:**
- `professionWorkloadRow(professionCode, year, activityCode)` returns one observed row or null.
- `evaluateDataFitness(professionCode, year)` returns `{level, failures, warnings}`.
- `runProjection()` is overridden to build actual demand from profession-specific rows only.

- [ ] **Step 1: Add profession workload table UI** with profession/year/activity, volume/unit, source, verification and overlap policy.
- [ ] **Step 2: Keep facility Workload_History as reference only** and label it clearly.
- [ ] **Step 3: Build profession-specific calculation rows** from observed workload records; never fall back to facility totals.
- [ ] **Step 4: Validate expected unit and overlap policy.**
- [ ] **Step 5: Gate result risk/Suggested Add** so only Verified rows get shortage/surplus colors and numeric action recommendations.
- [ ] **Step 6: Rename standard mode** to `Illustrative defaults — NOT VALIDATED` and mark default standards provisional until WISN metadata is Verified.
- [ ] **Step 7: Run focused tests and commit.**

### Task 5: Missing Target Need handling

**Files:**
- Modify: `Simulator_HR_blueprint_profession_workload.js` (target model override)
- Modify: `Simulator_HR_blueprint_formula_copy.js`

**Interfaces:**
- Coverage gap is numeric only when target population and actual served are explicitly observed.
- Blank actual served yields `coverageGap = null` for that group; no zero substitution.

- [ ] **Step 1: Add failing assertion** for blank actual served.
- [ ] **Step 2: Override target summary builder** to preserve unknown values and sum only known gaps.
- [ ] **Step 3: Update formula trace wording** to state missing coverage data is `N/A`.
- [ ] **Step 4: Run tests and commit.**

### Task 6: Health KPI panel and contextual links

**Files:**
- Create: `Simulator_HR_blueprint_health_kpi.js`
- Modify: `Simulator_HR_blueprint.html`
- Modify: `Simulator_HR_blueprint_profile.css`

**Interfaces:**
- `state.healthKpiRows` contains year/code/value/source/status/note.
- `relatedKpisForProfession(code)` returns catalog entries referenced by that profession workload dictionary.

- [ ] **Step 1: Add Health Outcome KPI panel** showing year, KPI code/name, actual value, unit, canonical target/direction if present, source/status and linked professions/services.
- [ ] **Step 2: Add clear non-causality note** that KPI is outcome context, not proof staffing caused the result.
- [ ] **Step 3: Display KPI context in recommendations/trace only when observed.**
- [ ] **Step 4: Run tests and commit.**

### Task 7: Help/data dictionary/documentation alignment

**Files:**
- Modify: `Simulator_HR_blueprint_dictionary.js`
- Modify: `Simulator_HR_blueprint_help.js`
- Modify: `GOOGLE_SHEETS_PROFILE_GUIDE.md`
- Modify: `NCO_INDICATOR_STANDARD.md`

**Interfaces:**
- All visible explanations use canonical profession dictionary and existing KPI catalog.

- [ ] **Step 1: Remove wording implying facility OPD/IPD totals are direct profession WISN workload.**
- [ ] **Step 2: Add definitions for Data Fitness levels, overlap policy and profession-specific numerator.**
- [ ] **Step 3: Document KPI catalog extension** for codes already present in district baseline store; do not add thresholds where unknown.
- [ ] **Step 4: Run consistency tests and commit.**

### Task 8: Full verification + GitHub Pages

**Files:** no new production files unless fixes are required.

- [ ] **Step 1: Run syntax checks for all simulator modules.**
- [ ] **Step 2: Run `node --test tests/*.test.mjs`; expect 0 failures.**
- [ ] **Step 3: Run `python -m unittest tests.test_generate_region1_district_hr_baseline`; expect OK.**
- [ ] **Step 4: Verify latest GitHub Actions regression run success.**
- [ ] **Step 5: Verify GitHub Pages deployment success and artifact contains new dictionary/modules.**
- [ ] **Step 6: Report commit SHA and cache-busting live URL.**
