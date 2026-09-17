import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../Simulator_HR_blueprint.html', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../Simulator_HR_blueprint_profile.js', import.meta.url), 'utf8');
const appsScript = readFileSync(new URL('../integrations/google_apps_script/Code.gs', import.meta.url), 'utf8');

function functionBody(source, name) {
  const patterns = [`function ${name}(`, `async function ${name}(`];
  const start = patterns.map((pattern) => source.indexOf(pattern)).find((index) => index >= 0) ?? -1;
  assert.notEqual(start, -1, `missing function ${name}`);
  const nextFunction = source.indexOf('\nfunction ', start + 1);
  const nextAsync = source.indexOf('\nasync function ', start + 1);
  const candidates = [nextFunction, nextAsync].filter((index) => index >= 0);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

test('profile panel exposes collaboration and Excel controls', () => {
  for (const id of [
    'profileId',
    'profileOwner',
    'profileSheetUrl',
    'profileEndpoint',
    'profileMetadataBody',
    'profileExcelInput',
    'btnProfileTemplate',
    'btnProfileExport',
    'btnProfileImport',
    'btnProfileSync',
    'btnProfileOpenSheet',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
});

test('HTML pins SheetJS CE 0.20.3 and loads profile module after historical mode', () => {
  assert.match(html, /cdn\.sheetjs\.com\/xlsx-0\.20\.3\/package\/dist\/xlsx\.full\.min\.js/);
  const historicalIndex = html.indexOf('Simulator_HR_blueprint_historical.js');
  const profileIndex = html.indexOf('Simulator_HR_blueprint_profile.js');
  assert.ok(historicalIndex >= 0 && profileIndex > historicalIndex);
});

test('profile module defines stable profile and interchange functions', () => {
  for (const name of [
    'buildProfileId',
    'collectProfilePayload',
    'applyProfilePayload',
    'exportProfileTemplate',
    'exportProfileWorkbook',
    'importProfileWorkbook',
    'syncGoogleProfile',
    'calculateProfileCompleteness',
  ]) {
    functionBody(profile, name);
  }
  assert.match(profile, /nco-hr-profile-v1/);
});

test('legacy profile module retains the six base collaboration sheets', () => {
  for (const sheet of [
    'Profile',
    'Section_Metadata',
    'Workload_History',
    'TargetNeed_History',
    'Workforce_History',
    'Profession_Config',
  ]) {
    assert.match(profile, new RegExp(sheet));
  }
});

test('provenance captures owner source status updated_at and note', () => {
  for (const field of ['owner', 'source', 'status', 'updated_at', 'note']) {
    assert.match(profile, new RegExp(field));
  }
  for (const section of ['Population', 'Workload', 'Workforce', 'TargetNeed', 'WISN']) {
    assert.match(profile, new RegExp(section));
  }
});

test('profile importer does not synthesize historical observations', () => {
  const body = functionBody(profile, 'applyProfilePayload');
  assert.doesNotMatch(body, /Math\.pow\s*\(/);
  assert.doesNotMatch(body, /seedRate/);
  assert.doesNotMatch(body, /growth/i);
});

test('Google sync applies the same profile payload path used by Excel', () => {
  const body = functionBody(profile, 'syncGoogleProfile');
  assert.match(body, /fetch\s*\(/);
  assert.match(body, /applyProfilePayload\s*\(/);
  assert.match(body, /profileEndpoint/);
});

test('Apps Script exposes profile v2 workbook sheets as JSON snapshot', () => {
  assert.match(appsScript, /function doGet\s*\(/);
  assert.match(appsScript, /ContentService/);
  assert.match(appsScript, /\.createTextOutput\s*\(/);
  assert.match(appsScript, /\.setMimeType\s*\(ContentService\.MimeType\.JSON\)/);
  assert.match(appsScript, /nco-hr-profile-v2/);
  for (const sheet of ['Profile', 'Section_Metadata', 'Workload_History', 'Profession_Workload', 'TargetNeed_History', 'Workforce_History', 'Profession_Config', 'Health_KPI_History']) {
    assert.match(appsScript, new RegExp(sheet));
  }
});
