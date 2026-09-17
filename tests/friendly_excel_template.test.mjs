import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../Simulator_HR_blueprint.html', import.meta.url), 'utf8');
const friendly = readFileSync(new URL('../Simulator_HR_blueprint_excel_guide.js', import.meta.url), 'utf8');
const dictionary = readFileSync(new URL('../Simulator_HR_blueprint_dictionary.js', import.meta.url), 'utf8');
const presentation = `${friendly}\n${dictionary}`;

test('friendly Excel layer loads after the profile adapter', () => {
  const profileIndex = html.indexOf('Simulator_HR_blueprint_profile.js');
  const friendlyIndex = html.indexOf('Simulator_HR_blueprint_excel_guide.js');
  assert.ok(profileIndex >= 0 && friendlyIndex > profileIndex);
});

test('exported workbook includes an embedded Thai instruction sheet', () => {
  assert.match(friendly, /คำแนะนำการกรอก/);
  assert.match(friendly, /ช่องที่ไม่มีข้อมูลจริงให้เว้นว่าง/);
  assert.match(friendly, /อย่าเปลี่ยนชื่อ Sheet/);
  assert.match(friendly, /Draft/);
  assert.match(friendly, /Reviewed/);
  assert.match(friendly, /Verified/);
});

test('technical field names are mapped to user-friendly Thai labels and descriptions', () => {
  for (const text of [
    'ประชากรที่รับผิดชอบ',
    'จำนวนครั้งรับบริการผู้ป่วยนอก',
    'จำนวนผู้ป่วยในรับใหม่',
    'จำนวนครั้งรับบริการห้องฉุกเฉิน',
    'จำนวนบุคลากรที่ปฏิบัติงานจริง',
    'จำนวนเกษียณ',
    'แหล่งข้อมูล',
    'ผู้รับผิดชอบข้อมูล',
  ]) assert.match(presentation, new RegExp(text));
  assert.match(friendly, /technical key/i);
});

test('friendly template keeps a hidden technical-key row and helper rows before data', () => {
  assert.match(friendly, /!rows/);
  assert.match(friendly, /hidden:\s*true/);
  assert.match(friendly, /คำอธิบาย/);
  assert.match(friendly, /หน่วย\/รูปแบบ/);
  assert.match(friendly, /แหล่งข้อมูลแนะนำ/);
  assert.match(friendly, /ใช้ในสูตร/);
});

test('friendly importer reads technical keys, skips helper rows, and remains compatible with older five-row templates', () => {
  assert.match(friendly, /function importProfileWorkbook/);
  assert.match(friendly, /dataStartRow/);
  assert.match(friendly, /\?\s*6\s*:\s*5/);
  assert.match(friendly, /range:\s*dataStartRow/);
  assert.match(friendly, /profilePayloadFromSheetRows/);
  assert.doesNotMatch(friendly, /Math\.pow\s*\(/);
  assert.doesNotMatch(friendly, /seedRate/);
});
