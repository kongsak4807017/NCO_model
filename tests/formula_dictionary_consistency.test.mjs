import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../Simulator_HR_blueprint.html', import.meta.url), 'utf8');
const base = readFileSync(new URL('../Simulator_HR_blueprint.js', import.meta.url), 'utf8');
const formulaCopy = readFileSync(new URL('../Simulator_HR_blueprint_formula_copy.js', import.meta.url), 'utf8');
const dictionary = readFileSync(new URL('../Simulator_HR_blueprint_dictionary.js', import.meta.url), 'utf8');
const excel = readFileSync(new URL('../Simulator_HR_blueprint_excel_guide.js', import.meta.url), 'utf8');
const help = readFileSync(new URL('../Simulator_HR_blueprint_help.js', import.meta.url), 'utf8');

const ACTIVITY_KEYS = [
  'opdVisits',
  'ipdAdmissions',
  'erVisits',
  'procedures',
  'deliveries',
  'chronicVisits',
  'mentalVisits',
  'outreachVisits',
];

test('shared formula dictionary is loaded before formula copy, Excel and help layers', () => {
  const profileIndex = html.indexOf('Simulator_HR_blueprint_profile.js');
  const dictionaryIndex = html.indexOf('Simulator_HR_blueprint_dictionary.js');
  const formulaCopyIndex = html.indexOf('Simulator_HR_blueprint_formula_copy.js');
  const excelIndex = html.indexOf('Simulator_HR_blueprint_excel_guide.js');
  const helpIndex = html.indexOf('Simulator_HR_blueprint_help.js');
  assert.ok(profileIndex >= 0);
  assert.ok(dictionaryIndex > profileIndex);
  assert.ok(formulaCopyIndex > dictionaryIndex);
  assert.ok(excelIndex > formulaCopyIndex);
  assert.ok(helpIndex > dictionaryIndex);
});

test('activity standards are distinct from annual workload volumes for every activity', () => {
  for (const key of ACTIVITY_KEYS) assert.match(dictionary, new RegExp(`${key}: \[`));
  assert.match(dictionary, /helpKey:\s*`activity-\$\{code\}`/);
  assert.match(dictionary, /excelKey:\s*`activity_\$\{code\}`/);
  assert.match(dictionary, /นาที\/OPD visit/);
  assert.match(dictionary, /นาที\/IPD admission/);
  assert.match(dictionary, /นาที\/ER visit/);
  assert.match(dictionary, /นาที\/procedure/);
  assert.match(dictionary, /นาที\/delivery/);
  assert.match(dictionary, /นาที\/chronic visit/);
  assert.match(dictionary, /นาที\/mental visit/);
  assert.match(dictionary, /นาที\/กิจกรรม Outreach\/PP/);
  assert.match(dictionary, /ไม่ใช่จำนวนครั้งบริการต่อปี/);
});

test('Activity Standards table headers use explicit help keys instead of ambiguous text aliases', () => {
  for (const key of ACTIVITY_KEYS) assert.match(html, new RegExp(`data-help-key="activity-${key}"`));
  assert.match(html, /OPD[\s\S]*นาที\/visit/);
  assert.match(html, /IPD Admit[\s\S]*นาที\/admission/);
  assert.match(html, /OR\/Procedure[\s\S]*นาที\/procedure/);
});

test('help layer prioritizes explicit data-help-key and consumes the shared dictionary', () => {
  assert.match(help, /NCO_HR_DATA_DICTIONARY/);
  assert.match(help, /dataset\.helpKey/);
  assert.match(help, /activity-opdVisits/);
});

test('Excel activity-standard columns consume the same shared dictionary and expose formula meaning', () => {
  assert.match(excel, /NCO_HR_DATA_DICTIONARY/);
  assert.match(excel, /activity_/);
  assert.match(excel, /ใช้ในสูตร/);
  assert.match(excel, /formula/);
  assert.match(excel, /dataStartRow/);
  assert.match(excel, /range:\s*dataStartRow/);
});

test('formula explanations match the implemented WISN calculation', () => {
  assert.match(base, /const minutes = volume \* standardMinutes \* complexityIndex/);
  assert.match(base, /const serviceFte = demandMinutes \/ awtMinutes/);
  assert.match(base, /const caf = 1 \/ \(1 - \(casPct \/ 100\)\)/);
  assert.match(base, /const iaf = \(n\(cfg\.iasHours, 0\) \* 60\) \/ awtMinutes/);
  assert.match(base, /const needFte = \(serviceFte \* caf\) \+ iaf/);
  assert.match(dictionary, /Demand Minutes = Σ\(Workload Volume × Activity Standard × Complexity Index\)/);
  assert.match(dictionary, /Service FTE = Demand Minutes ÷ AWT/);
  assert.match(dictionary, /CAF = 1 ÷ \(1 − CAS\/100\)/);
  assert.match(dictionary, /IAF = IAS × 60 ÷ AWT/);
  assert.match(dictionary, /Required FTE = \(Service FTE × CAF\) \+ IAF/);
});

test('historical trace explicitly describes actual, target, planning and supply formulas', () => {
  assert.match(formulaCopy, /Actual demand minutes = Σ\(actual workload volume x activity standard minutes x actual complexity index\)/);
  assert.match(formulaCopy, /Target equivalent activity volume = target cases x service frequency x activity mix x target complexity/);
  assert.match(formulaCopy, /Planning activity volume = max\(complexity-adjusted actual volume, target-need equivalent volume\) by activity/);
  assert.match(formulaCopy, /Planning demand minutes = Σ\(planning activity volume x activity standard minutes\)/);
  assert.match(formulaCopy, /Actual supply FTE = actual annual headcount x FTE factor/);
});

test('result labels distinguish demand-side required FTE from supply FTE', () => {
  assert.match(html, /Actual Workload FTE/);
  assert.match(html, /Target Need FTE/);
  assert.match(html, /Planning Required FTE/);
  assert.match(html, /Actual Supply FTE/);
  assert.match(formulaCopy, /Actual Workload FTE/);
  assert.match(formulaCopy, /Planning Required FTE/);
  assert.match(formulaCopy, /Actual Supply FTE/);
});
