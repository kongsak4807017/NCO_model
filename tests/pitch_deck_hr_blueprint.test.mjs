import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const slideCount = (html.match(/<section class="slide/g) || []).length;

test('root pitch deck is dedicated to HR Blueprint Simulator for a 5-minute briefing', () => {
  assert.match(html, /HR Blueprint Simulator/i);
  assert.match(html, /5\s*นาที/);
  assert.equal(slideCount, 6);
});

test('pitch deck explains the workforce management problem the simulator solves', () => {
  for (const phrase of [
    'อัตรากำลัง',
    'ประเภทการจ้างงาน',
    'ประเภทวิชาชีพ',
    'ตำแหน่งว่าง',
    'ตำแหน่งที่ต้องยุบ',
    'หลายกลุ่มงาน',
  ]) {
    assert.match(html, new RegExp(phrase));
  }
});

test('pitch deck explains the operating workflow and evidence trail', () => {
  for (const phrase of [
    'Excel Template',
    'Google Sheets',
    'Import Excel',
    'Completeness',
    'Draft → Reviewed → Verified',
    'Trace & Export',
    'ข้อมูลจริงย้อนหลัง 5 ปี',
    'Simulator_HR_blueprint.html',
  ]) {
    assert.match(html, new RegExp(phrase));
  }
});
