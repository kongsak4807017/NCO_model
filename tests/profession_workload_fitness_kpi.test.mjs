import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const extPath = new URL('../Simulator_HR_blueprint_data_fitness.js', import.meta.url);
const unitUiPath = new URL('../Simulator_HR_blueprint_activity_units.js', import.meta.url);
const excel = readFileSync(new URL('../Simulator_HR_blueprint_excel_guide.js', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../GOOGLE_SHEETS_PROFILE_GUIDE.md', import.meta.url), 'utf8');
const appScript = readFileSync(new URL('../integrations/google_apps_script/Code.gs', import.meta.url), 'utf8');

function extensionSource() {
  assert.equal(existsSync(extPath), true, 'data-fitness extension file must exist');
  return readFileSync(extPath, 'utf8');
}

function activityUnitSource() {
  assert.equal(existsSync(unitUiPath), true, 'activity-unit UI module must exist');
  return readFileSync(unitUiPath, 'utf8');
}

test('profession-specific workload extension is loaded by the existing Excel/profile layer', () => {
  assert.match(excel, /Simulator_HR_blueprint_data_fitness\.js/);
  assert.match(excel, /Simulator_HR_blueprint_activity_units\.js/);
  const source = extensionSource();
  assert.match(source, /Profession_Workload_History/);
  assert.match(source, /Health_KPI_History/);
  assert.match(source, /profession_workload_history/);
  assert.match(source, /health_kpi_history/);
});

test('profession workload rows define exact profession, unit, inclusion, exclusion, source, overlap and verification', () => {
  const source = extensionSource();
  for (const key of ['profession_code', 'activity_code', 'volume', 'unit', 'definition', 'include_rule', 'exclude_rule', 'source', 'overlap_rule', 'status']) {
    assert.match(source, new RegExp(key));
  }
  assert.match(source, /physician OPD/i);
  assert.match(source, /provider profession/i);
  assert.match(source, /ไม่ใช่ Total OPD|ไม่ใช่ยอด OPD รวม/);
});

test('data fitness gate blocks shortage or surplus conclusions until decision inputs are verified', () => {
  const source = extensionSource();
  assert.match(source, /evaluateDataFitness/);
  assert.match(source, /decisionEligible/);
  assert.match(source, /DATA NOT FIT/);
  assert.match(source, /ยังสรุปขาด\/เกินไม่ได้/);
  assert.match(source, /suggestedAdd:\s*decisionEligible\s*\?/);
  assert.match(source, /reallocate:\s*decisionEligible\s*\?/);
});

test('WISN uses profession-specific actual workload when verified instead of generic facility totals', () => {
  const source = extensionSource();
  assert.match(source, /buildProfessionActivityRow/);
  assert.match(source, /professionWorkloadRowsFor/);
  assert.match(source, /calculateWisnNeed\(actualRow, code\)/);
  assert.match(source, /buildPlanningActivityRow\(actualRow, targetModel\.row\)/);
});

test('missing Actual Served remains unknown and is not silently treated as zero for coverage gap', () => {
  const source = extensionSource();
  assert.match(source, /actualServedKnown/);
  assert.match(source, /coverageGap:\s*actualServedKnown\s*\?/);
  assert.match(source, /null/);
});

test('health KPI linkage is contextual and never changes required FTE', () => {
  const source = extensionSource();
  assert.match(source, /HEALTH_KPI_CATALOG/);
  assert.match(source, /Clinical outcome|Health Outcome KPI/);
  assert.match(source, /ไม่ได้ใช้เพิ่มหรือลด Required FTE|ไม่ใช้.*Required FTE/);
  assert.doesNotMatch(source, /needFte\s*[+\-]=\s*.*kpi/i);
});

test('KPI catalog reuses documented NCO outcome indicators and service-plan indicators', () => {
  const source = extensionSource();
  for (const code of ['A04', 'A09', 'B01', 'F10', 'DH0101', 'DN0101', 'DN0142D', 'CI0101', 'CM0101', 'CM0203', 'PS0001', 'RH0101']) {
    assert.match(source, new RegExp(code));
  }
});

test('Excel template and Google Sheets bridge expose the new profession workload and KPI sheets', () => {
  assert.match(excel, /data_fitness/);
  assert.match(appScript, /Profession_Workload_History/);
  assert.match(appScript, /Health_KPI_History/);
  assert.match(guide, /Profession_Workload_History/);
  assert.match(guide, /Health_KPI_History/);
  assert.match(guide, /Data Fitness|DATA NOT FIT/);
});

test('legacy facility Workload_History is explicitly contextual and not sufficient for a profession WISN conclusion', () => {
  const source = extensionSource();
  assert.match(source, /Workload_History/);
  assert.match(source, /บริบทระดับหน่วยบริการ|facility context/i);
  assert.match(source, /ไม่ใช้.*สรุป.*วิชาชีพ|not sufficient.*profession/i);
});

test('activity-standard UI shows the denominator unit per profession instead of one generic column unit', () => {
  const source = activityUnitSource();
  assert.match(source, /renderStandardTable\s*=\s*function/);
  assert.match(source, /activityUnits/);
  assert.match(source, /standard-unit|df-unit/);
  assert.match(source, /patient_day/);
  assert.match(source, /prescription/);
  assert.match(source, /session/);
});

test('Excel activity-standard description points to each profession row activity_unit instead of a universal unit', () => {
  const source = activityUnitSource();
  assert.match(source, /excelFieldGuide\s*=\s*function/);
  assert.match(source, /String\(key\)\.startsWith\("activity_"\)/);
  assert.match(source, /activity_unit_/);
  assert.match(source, /denominator|หน่วยนับ/);
});
