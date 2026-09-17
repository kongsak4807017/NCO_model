import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('Simulator_HR_blueprint.html');
const profile = read('Simulator_HR_blueprint_profile.js');
const excel = read('Simulator_HR_blueprint_excel_guide.js');
const help = read('Simulator_HR_blueprint_help.js');
const formula = read('Simulator_HR_blueprint_formula_copy.js');
const appsScript = read('integrations/google_apps_script/Code.gs');

const professionDictionaryPath = new URL('../Simulator_HR_blueprint_profession_dictionary.js', import.meta.url);
const workloadAdapterPath = new URL('../Simulator_HR_blueprint_profession_workload.js', import.meta.url);
const healthKpiPath = new URL('../Simulator_HR_blueprint_health_kpi.js', import.meta.url);

function optionalRead(url) {
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
}

const professionDictionary = optionalRead(professionDictionaryPath);
const workloadAdapter = optionalRead(workloadAdapterPath);
const healthKpi = optionalRead(healthKpiPath);

test('profile v2 adds profession workload and health KPI sheets', () => {
  assert.match(profile, /nco-hr-profile-v2/);
  assert.match(profile, /Profession_Workload/);
  assert.match(profile, /Health_KPI_History/);
  assert.match(appsScript, /nco-hr-profile-v2/);
  assert.match(appsScript, /Profession_Workload/);
  assert.match(appsScript, /Health_KPI_History/);
});

test('v1 files remain importable without converting facility totals into profession workload', () => {
  assert.match(profile, /nco-hr-profile-v1/);
  assert.match(profile, /migrat|compat|legacy/i);
  assert.doesNotMatch(profile, /profession_workload\s*=\s*workload_history/i);
});

test('canonical profession workload dictionary defines physician OPD and nursing IPD units', () => {
  assert.ok(professionDictionary.length > 0, 'profession dictionary module must exist');
  assert.match(professionDictionary, /physician OPD encounters/i);
  assert.match(professionDictionary, /exclude|ไม่รวม/i);
  assert.match(professionDictionary, /nurse[\s\S]*patient-days/i);
  assert.match(professionDictionary, /prescriptions|dispensing/i);
  assert.match(professionDictionary, /overlap/i);
});

test('profession workload adapter never falls back to generic facility OPD for WISN', () => {
  assert.ok(workloadAdapter.length > 0, 'profession workload adapter must exist');
  assert.match(workloadAdapter, /evaluateDataFitness/);
  assert.match(workloadAdapter, /professionWorkloadRow/);
  assert.match(workloadAdapter, /no-profession-workload|profession-specific/i);
  assert.doesNotMatch(workloadAdapter, /fallback[^\n]*needRow\.(opdVisits|ipdAdmissions|erVisits)/i);
});

test('unverified or blocked data suppresses shortage action recommendation', () => {
  assert.match(workloadAdapter, /Blocked|Provisional/);
  assert.match(workloadAdapter, /Suggested Add|suggestedAdd/);
  assert.match(workloadAdapter, /ยังสรุปขาด\/เกินไม่ได้/);
});

test('missing actualServed is preserved as unknown rather than zero coverage gap', () => {
  assert.match(workloadAdapter, /actualServedObserved|isTargetObserved/);
  assert.match(workloadAdapter, /coverageGap\s*:\s*null|coverageGap\s*=\s*null/);
  assert.match(formula, /missing|ไม่ทราบ|N\/A/i);
});

test('health KPI catalog uses repository codes and does not claim staffing causality', () => {
  assert.ok(healthKpi.length > 0, 'health KPI module must exist');
  for (const code of ['A01', 'A04', 'A09', 'B01', 'C02', 'D01', 'F10', 'DH0101', 'DN0101', 'CI0101', 'CM0101', 'CM0203', 'PS0001', 'RH0101']) {
    assert.match(healthKpi, new RegExp(code));
  }
  assert.match(healthKpi, /ไม่ใช่หลักฐานเชิงสาเหตุ|not causal|does not prove caus/i);
});

test('UI and Excel explain that facility totals are reference only and profession workload drives WISN', () => {
  assert.match(html, /Profession-specific|เฉพาะวิชาชีพ/i);
  assert.match(html, /reference only|อ้างอิงเท่านั้น/i);
  assert.match(html, /Data Fitness/i);
  assert.match(html, /Health Outcome KPI|Health KPI/i);
  assert.match(excel, /Profession_Workload/);
  assert.match(excel, /Health_KPI_History/);
  assert.match(excel, /อ้างอิงเท่านั้น|reference only/i);
  assert.match(help, /profession-specific|เฉพาะวิชาชีพ/i);
});

test('illustrative default standards are visibly not validated', () => {
  assert.match(html, /Illustrative defaults[^<]*NOT VALIDATED/i);
});
