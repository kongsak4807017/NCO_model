import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const mock = read('Simulator_HR_blueprint_mock_chiangrai.js');
const formula = read('Simulator_HR_blueprint_formula_copy.js');

test('embedded Chiang Rai demo profile is explicitly marked as mock and mixed-source', () => {
  assert.match(mock, /เชียงราย\(mock up\)/);
  assert.match(mock, /HR1-57-PROV-2569-MOCK/);
  assert.match(mock, /MOCK PROFILE — FOR DEMONSTRATION ONLY/);
  assert.match(mock, /ACTUAL \/ REFERENCE \/ MOCK/);
  assert.match(mock, /mixed actual \+ reference \+ mock/i);
});

test('Chiang Rai demo pins repository actual provincial baseline facts', () => {
  assert.match(mock, /884137/);
  assert.match(mock, /doctor:\s*546/);
  assert.match(mock, /nurse:\s*2222/);
  assert.match(mock, /pharmacist:\s*231/);
  assert.match(mock, /vacancy_all:\s*656/);
  assert.match(mock, /retire_5y_all:\s*508/);
});

test('Chiang Rai demo keeps hospital outcome context scoped and labeled', () => {
  assert.match(mock, /A01:\s*3\.29/);
  assert.match(mock, /DH0101:\s*10\.81/);
  assert.match(mock, /ACTUAL_HOSPITAL_CONTEXT/);
  assert.match(mock, /รพศ\.เชียงรายประชานุเคราะห์/);
  assert.match(mock, /ไม่ใช่ค่า outcome รวมทั้งจังหวัด/);
});

test('profession-specific demo workload does not reuse facility totals as WISN numerator', () => {
  assert.match(mock, /Doctor OPD encounters|physician visits\/year/);
  assert.match(mock, /IPD nursing patient-days|patient-days\/year/);
  assert.match(mock, /OPD prescriptions\/dispensing episodes|prescriptions\/year/);
  assert.match(mock, /MOCK:CHIANGRAI_DEMO_V1/);
  assert.doesNotMatch(mock, /profession_workload\s*:\s*workload_history/i);
});

test('embedded demo loader is part of the v2 parser chain', () => {
  assert.match(formula, /Simulator_HR_blueprint_mock_chiangrai\.js/);
  const workload = formula.indexOf('Simulator_HR_blueprint_profession_workload.js');
  const kpi = formula.indexOf('Simulator_HR_blueprint_health_kpi.js');
  const mockIndex = formula.indexOf('Simulator_HR_blueprint_mock_chiangrai.js');
  assert.ok(workload >= 0 && kpi > workload && mockIndex > kpi);
});
