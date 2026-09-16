import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../Simulator_HR_blueprint.html', import.meta.url), 'utf8');
const historical = readFileSync(new URL('../Simulator_HR_blueprint_historical.js', import.meta.url), 'utf8');
const generator = readFileSync(new URL('../scripts/generate_region1_district_hr_baseline.py', import.meta.url), 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('scope UI provides database-backed district selector while preserving editable district name', () => {
  assert.match(html, /id="amphurSelect"/);
  assert.match(html, /id="amphurName"/);
  assert.doesNotMatch(html, /id="amphurName"[^>]*(?:readonly|disabled)/);
  assert.match(html, /id="districtDataStatus"/);
});

test('historical simulator loads a static district baseline for GitHub Pages', () => {
  assert.match(historical, /output\/hr_blueprint_district_baseline_region1\.json/);
  assert.match(historical, /districtBaseline/);
  assert.match(historical, /function loadDistrictBaseline\s*\(/);
});

test('province change rebuilds district selector and district selection applies district baseline', () => {
  assert.match(historical, /function renderAmphurSelect\s*\(/);
  assert.match(historical, /function applyDistrictBaseline\s*\(/);
  assert.match(historical, /amphurSelect/);
  assert.match(historical, /province_code/);
});

test('district mode refuses to reuse province workforce as district workforce when HR snapshot is unavailable', () => {
  const body = functionBody(historical, 'applyDistrictBaseline');
  assert.match(body, /hr_available/);
  assert.match(body, /current\s*=\s*0/);
  assert.match(body, /vacant\s*=\s*0/);
  assert.match(body, /retire5y\s*=\s*0/);
});

test('district historical population is assigned only to its documented reference year', () => {
  const body = functionBody(historical, 'applyDistrictPopulationHistory');
  assert.match(body, /population_by_year/);
  assert.match(body, /row\.year/);
  assert.doesNotMatch(body, /Math\.pow\s*\(/);
  assert.doesNotMatch(body, /growth/);
});

test('district baseline can carry local HR counts when an exported database snapshot exists', () => {
  const body = functionBody(historical, 'applyDistrictBaseline');
  assert.match(body, /districtRow\.doctor/);
  assert.match(body, /districtRow\.nurse/);
  assert.match(body, /districtRow\.pharmacist/);
  assert.match(body, /vacant_doctor/);
});

test('district generator can import repository API modules when run as a script', () => {
  assert.match(generator, /import sys/);
  assert.match(generator, /sys\.path\.insert\(0,\s*str\(ROOT\)\)/);
});
