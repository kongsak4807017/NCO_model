import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../Simulator_HR_blueprint.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../Simulator_HR_blueprint.html', import.meta.url), 'utf8');

function functionBody(name) {
  const start = js.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const next = js.indexOf('\nfunction ', start + 1);
  return js.slice(start, next === -1 ? js.length : next);
}

test('5-year window is historical from 2569 backwards', () => {
  const body = functionBody('years');
  assert.match(body, /start\s*-\s*i/);
  assert.doesNotMatch(body, /start\s*\+\s*i/);
});

test('historical workload rows are not synthesized from growth or seed-rate formulas', () => {
  const body = functionBody('initNeedRows');
  assert.doesNotMatch(body, /Math\.pow\s*\(/);
  assert.doesNotMatch(body, /seedRate\s*\(/);
  assert.match(body, /opdVisits:\s*0/);
  assert.match(body, /ipdAdmissions:\s*0/);
  assert.match(body, /erVisits:\s*0/);
});

test('historical target rows do not fabricate target population or actual served', () => {
  const body = functionBody('initTargetNeedRows');
  assert.doesNotMatch(body, /growthFactor/);
  assert.doesNotMatch(body, /actualRatePct/);
  assert.match(body, /targetPopulation:\s*0/);
  assert.match(body, /actualServed:\s*0/);
});

test('retirement is not auto-distributed across historical years', () => {
  const body = functionBody('initMovementDefaults');
  assert.doesNotMatch(body, /retire5y[\s\S]*\/\s*Math\.max/);
  assert.match(body, /retire:\s*0/);
  assert.doesNotMatch(js, /function\s+autoRetire\s*\(/);
  assert.doesNotMatch(html, /id="btnAutoRetire"/);
});

test('annual supply uses explicitly entered actual headcount', () => {
  const body = functionBody('calculateSupplyTimeline');
  assert.match(body, /actualHeadcount/);
  assert.match(body, /supplyFte:\s*actualHeadcount\s*\*\s*fteFactor/);
  assert.doesNotMatch(body, /current\s*=\s*projected/);
});

test('UI clearly identifies historical actual-data mode', () => {
  assert.match(html, /ข้อมูลจริงย้อนหลัง 5 ปี/);
  assert.match(html, /ปีอ้างอิงล่าสุด \(พ\.ศ\.\)/);
  assert.match(html, /วิเคราะห์ข้อมูลย้อนหลัง/);
  assert.match(html, /Actual Headcount/);
  assert.match(html, /Actual FTE/);
});
