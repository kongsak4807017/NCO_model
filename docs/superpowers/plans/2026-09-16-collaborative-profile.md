# Collaborative HR Data Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม Google Sheets Collaborative Profile + Excel Import/Export ให้ HR Blueprint Simulator โดยใช้ Data Profile เดียวเป็นศูนย์กลางและไม่สร้างข้อมูลที่ไม่มีหลักฐาน

**Architecture:** เพิ่มโมดูล `Simulator_HR_blueprint_profile.js` แยกจาก calculation engine เดิม เพื่อ serialize/deserialize state เป็น schema กลางเดียวกันสำหรับ Excel และ Google Sheets. Google Sheets ใช้ Apps Script JSON endpoint อ่าน workbook schema เดียวกับ Excel; Simulator ยังเป็น static GitHub Pages และไม่ต้องมี account/backend ใหม่.

**Tech Stack:** Vanilla HTML/CSS/JS, SheetJS CE 0.20.3 browser build, Google Apps Script ContentService, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-collaborative-profile.md`

## Global Constraints
- ปี 2569–2565 เป็น actual historical data เท่านั้น
- Missing data ห้ามถูก infer/interpolate/grow/back-cast
- ผู้ใช้แก้ค่าที่ import แล้วได้
- ห้ามใช้ยอดจังหวัดแทนค่าระดับอำเภอเมื่อ district snapshot ไม่มี
- Profile สาธารณะห้ามมีข้อมูลบุคคล

---

### Task 1: Regression contract for collaborative profile

**Files:**
- Create: `tests/collaborative_profile.test.mjs`
- Modify: `.github/workflows/historical-hr-blueprint.yml`

**Interfaces:**
- Produces: DOM ids `profileId`, `profileSheetUrl`, `profileEndpoint`, `profileMetadataBody`, `profileExcelInput`; JS functions `buildProfileId`, `collectProfilePayload`, `applyProfilePayload`, `exportProfileTemplate`, `exportProfileWorkbook`, `importProfileWorkbook`, `syncGoogleProfile`, `calculateProfileCompleteness`.

- [ ] **Step 1:** Write failing Node source-contract tests for profile UI, Excel library pin, profile module functions, provenance fields, Google sync endpoint, and missing-data rule.
- [ ] **Step 2:** Run GitHub Actions and confirm RED because production files do not exist yet.
- [ ] **Step 3:** Extend workflow path filters to include profile JS/CSS and Apps Script integration files.
- [ ] **Step 4:** Re-run after implementation and require GREEN.

### Task 2: Profile UI and state adapter

**Files:**
- Create: `Simulator_HR_blueprint_profile.js`
- Create: `Simulator_HR_blueprint_profile.css`
- Modify: `Simulator_HR_blueprint.html`

**Interfaces:**
- Consumes: existing globals `state`, `years`, `syncInputsFromDom`, `renderAll`, `applyProvinceBaseline`, `applyDistrictBaseline`, `PROFESSION_DEFS`, `ACTIVITY_DEFS`, `TARGET_NEED_DEFS`.
- Produces: profile payload schema `nco-hr-profile-v1`, Profile ID, section metadata, completeness cards, Excel/Google sync actions.

- [ ] **Step 1:** Add profile panel with Profile ID, owner, Google Sheet URL, Apps Script endpoint, Excel import/export buttons and metadata table.
- [ ] **Step 2:** Add SheetJS CE 0.20.3 pinned standalone script and profile JS/CSS includes.
- [ ] **Step 3:** Implement `buildProfileId()` using current scope without PII.
- [ ] **Step 4:** Implement `collectProfilePayload()` serializing scope/baseline/workload/target/workforce/profession config/provenance.
- [ ] **Step 5:** Implement `applyProfilePayload()` so only explicit imported fields overwrite state and then render current analysis.
- [ ] **Step 6:** Implement completeness scoring and UI status; zero/missing remains missing rather than inferred.

### Task 3: Excel interchange

**Files:**
- Modify: `Simulator_HR_blueprint_profile.js`

**Interfaces:**
- Produces workbook sheets exactly named `Profile`, `Section_Metadata`, `Workload_History`, `TargetNeed_History`, `Workforce_History`, `Profession_Config`.

- [ ] **Step 1:** Implement workbook row adapters from profile payload.
- [ ] **Step 2:** Implement `exportProfileTemplate()` with years/scope/schema and blank historical factual cells where data is absent.
- [ ] **Step 3:** Implement `exportProfileWorkbook()` from current edited Simulator state.
- [ ] **Step 4:** Implement `.xlsx/.xls` import using SheetJS and schema validation.
- [ ] **Step 5:** Make import update province/district context, selected professions, historical workload/target/workforce and metadata without generating missing values.

### Task 4: Google Sheets collaborative bridge

**Files:**
- Create: `integrations/google_apps_script/Code.gs`
- Create: `GOOGLE_SHEETS_PROFILE_GUIDE.md`
- Modify: `Simulator_HR_blueprint_profile.js`

**Interfaces:**
- Apps Script GET returns `{schema_version:"nco-hr-profile-v1", sheets:{...}}` where sheet arrays use workbook headers.
- Simulator converts `sheets` to the same profile payload used by Excel import.

- [ ] **Step 1:** Add Apps Script `doGet()` that reads the six named sheets and emits JSON via ContentService.
- [ ] **Step 2:** Implement `syncGoogleProfile()` to fetch the endpoint, validate schema, convert rows, and call `applyProfilePayload()`.
- [ ] **Step 3:** Add Open Google Sheet action and persist only Sheet/endpoint URLs + profile metadata in localStorage (no personal records).
- [ ] **Step 4:** Document setup: export template → import to Google Sheets → share editors → paste Code.gs → deploy web app → copy endpoint → sync.
- [ ] **Step 5:** Document privacy rule: aggregate workforce/workload only; no person-level HR data in a public Sheet/Web App.

### Task 5: Verification and deployment

**Files:**
- Verify all changed files and GitHub Pages.

- [ ] **Step 1:** Run `node --test tests/*.test.mjs` and Python district baseline tests in GitHub Actions.
- [ ] **Step 2:** Confirm profile regression workflow success on final commit.
- [ ] **Step 3:** Confirm GitHub Pages build and deployment success.
- [ ] **Step 4:** Inspect deployed source references for Profile panel, SheetJS 0.20.3, profile module and district baseline compatibility.
