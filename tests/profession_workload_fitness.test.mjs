import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const profile = read('Simulator_HR_blueprint_profile.js');
const formula = read('Simulator_HR_blueprint_formula_copy.js');
const appsScript = read('integrations/google_apps_script/Code.gs');
const professionDictionary = read('Simulator_HR_blueprint_profession_dictionary.js');
const workloadAdapter = read('Simulator_HR_blueprint_profession_workload.js');
const healthKpi = read('Simulator_HR_blueprint_health_kpi.js');
const cmiImport = read('Simulator_HR_blueprint_cmi_import.js');

const v2Presentation = `${professionDictionary}\n${workloadAdapter}\n${healthKpi}`;

test('profile v2 adapter adds profession workload and health KPI sheets', () => {
  assert.match(workloadAdapter, /nco-hr-profile-v2/);
  assert.match(workloadAdapter, /Profession_Workload/);
  assert.match(workloadAdapter, /Health_KPI_History/);
  assert.match(appsScript, /nco-hr-profile-v2/);
  assert.match(appsScript, /Profession_Workload/);
  assert.match(appsScript, /Health_KPI_History/);
});

test('v1 files remain importable without converting facility totals into profession workload', () => {
  assert.match(profile, /nco-hr-profile-v1/);
  assert.match(workloadAdapter, /nco-hr-profile-v1/);
  assert.match(workloadAdapter, /migrat|compat|legacy/i);
  assert.doesNotMatch(workloadAdapter, /profession_workload\s*=\s*(payload\.)?workload_history/i);
});

test('canonical profession workload dictionary defines physician OPD and nursing IPD units', () => {
  assert.match(professionDictionary, /physician OPD encounters/i);
  assert.match(professionDictionary, /exclude|ไม่รวม/i);
  assert.match(professionDictionary, /nurse[\s\S]*patient-days/i);
  assert.match(professionDictionary, /prescriptions|dispensing/i);
  assert.match(professionDictionary, /overlap/i);
});

test('profession workload adapter never falls back to generic facility OPD for WISN', () => {
  assert.match(workloadAdapter, /evaluateDataFitness/);
  assert.match(workloadAdapter, /professionWorkloadRow/);
  assert.match(workloadAdapter, /no-profession-workload|profession-specific/i);
  assert.match(workloadAdapter, /facility totals.*reference only/i);
  assert.doesNotMatch(workloadAdapter, /fallback[^\n]*needRow\.(opdVisits|ipdAdmissions|erVisits)/i);
});

test('unverified or blocked data suppresses shortage action recommendation', () => {
  assert.match(workloadAdapter, /Blocked|Provisional/);
  assert.match(workloadAdapter, /Suggested Add|suggestedAdd/);
  assert.match(workloadAdapter, /ยังสรุปขาด\/เกินไม่ได้/);
  assert.match(workloadAdapter, /verified && gapFte/);
});

test('missing actualServed is preserved as unknown rather than zero coverage gap', () => {
  assert.match(workloadAdapter, /actualServedObserved|isTargetObserved/);
  assert.match(workloadAdapter, /coverageGap\s*=.*:\s*null/);
  assert.match(workloadAdapter, /coverageGap === null \? "N\/A"/);
});

test('health KPI catalog uses repository codes and does not claim staffing causality', () => {
  for (const code of ['A01', 'A04', 'A09', 'B01', 'C02', 'D01', 'F10', 'DH0101', 'DN0101', 'CI0101', 'CM0101', 'CM0203', 'PS0001', 'RH0101']) {
    assert.match(v2Presentation, new RegExp(code));
  }
  assert.match(healthKpi, /ไม่ใช่หลักฐานเชิงสาเหตุ|not causal|does not prove caus/i);
  assert.match(professionDictionary, /threshold:null/);
});

test('UI and Excel copy explain facility reference, profession workload, Data Fitness and Health KPI', () => {
  assert.match(workloadAdapter, /Profession-specific Historical Workload/);
  assert.match(workloadAdapter, /reference only|อ้างอิงเท่านั้น/i);
  assert.match(workloadAdapter, /Data Fitness/);
  assert.match(healthKpi, /Health Outcome KPI Context/);
  assert.match(workloadAdapter, /Profession_Workload/);
  assert.match(workloadAdapter, /Health_KPI_History/);
  assert.match(workloadAdapter, /Workload_History[\s\S]*reference|facility totals[\s\S]*reference/i);
});

test('illustrative default standards are visibly not validated', () => {
  assert.match(workloadAdapter, /Illustrative defaults — NOT VALIDATED/);
  assert.match(workloadAdapter, /Illustrative template default/);
});

test('formula layer loads v2 modules before Excel and help execute', () => {
  const dictionary = formula.indexOf('Simulator_HR_blueprint_profession_dictionary.js');
  const workload = formula.indexOf('Simulator_HR_blueprint_profession_workload.js');
  const kpi = formula.indexOf('Simulator_HR_blueprint_health_kpi.js');
  const cmiImportLoader = formula.indexOf('Simulator_HR_blueprint_cmi_import.js');
  assert.ok(dictionary >= 0 && workload > dictionary && kpi > workload && cmiImportLoader > kpi);
});


test('profession workload template explains how each profession is counted from HIS', () => {
  for (const text of [
    'hisExtractionGuide',
    'COUNT DISTINCT visit/VN',
    'patient-days',
    'prescription/dispensing episode',
    'provider_rule',
    'his_fields_hint',
  ]) assert.match(professionDictionary, new RegExp(text, 'i'));
  for (const text of [
    'วิธีดึง/วิธีนับจาก HIS',
    'ตัวตั้งที่ต้องนับ',
    'เงื่อนไขเชื่อมกับวิชาชีพ',
    'Field/ข้อมูลใน HIS ที่ควรมองหา',
    'รหัสระบบ \\(ห้ามแก้\\)',
  ]) assert.match(workloadAdapter, new RegExp(text, 'i'));
});


test('Health KPI History uses canonical CMI Service Plan codes without duplicate outcome rows', () => {
  assert.match(professionDictionary, /A04:\s*"DH0102"/);
  assert.match(professionDictionary, /A09:\s*"CI0101"/);
  assert.match(professionDictionary, /B01:\s*"CM0101"/);
  assert.match(professionDictionary, /co_thip_new/);
  assert.match(workloadAdapter, /canonicalHealthKpiCode/);
  assert.match(workloadAdapter, /normalizeHealthKpiRows/);
  assert.match(healthKpi, /Object\.keys\(PD\.healthKpis/);
  assert.match(healthKpi, /A04 → DH0102/);
});


test('CMI export import layer maps source KPI/year/scope into Health KPI History', () => {
  assert.match(cmiImport, /Save as Excel|Export Page Data/);
  assert.match(cmiImport, /canonicalCode/);
  assert.match(cmiImport, /detectCode/);
  assert.match(cmiImport, /detectYear/);
  assert.match(cmiImport, /hospital-row|province-aggregate/);
  assert.match(cmiImport, /verification_status = "Reviewed"/);
  assert.match(cmiImport, /cmiKpiImport/);
});
