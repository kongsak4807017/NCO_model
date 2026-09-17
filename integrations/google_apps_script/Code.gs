const NCO_PROFILE_SCHEMA = 'nco-hr-profile-v1';
const NCO_PROFILE_SHEETS = [
  'Profile',
  'Section_Metadata',
  'Workload_History',
  'TargetNeed_History',
  'Workforce_History',
  'Profession_Config',
  'Profession_Workload_History',
  'Health_KPI_History',
];

function sheetRows_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  if (!headers.some(Boolean)) return [];

  // Friendly Excel/Google Sheet templates keep the technical headers in row 1,
  // followed by explanation rows. Skip those helper rows before returning JSON.
  const rows = values.slice(1).filter(function (row) {
    return row.some(function (value) { return String(value || '').trim() !== ''; });
  });
  const dataRows = rows.filter(function (row) {
    const first = String(row[0] || '').trim();
    return !/^คำอธิบาย:|^หน่วย\/รูปแบบ:|^แหล่งข้อมูลแนะนำ:|^ใช้ในสูตร:/.test(first)
      && first !== 'รายการ' && first !== 'หมวดข้อมูล' && first !== 'ปี (พ.ศ.)' && first !== 'รหัสกิจกรรม';
  });

  return dataRows.map(function (row) {
    const item = {};
    headers.forEach(function (header, index) {
      if (header) item[header] = row[index] === '' ? null : row[index];
    });
    return item;
  });
}

function doGet() {
  const sheets = {};
  NCO_PROFILE_SHEETS.forEach(function (sheetName) {
    sheets[sheetName] = sheetRows_(sheetName);
  });

  const payload = {
    schema_version: NCO_PROFILE_SCHEMA,
    generated_at: new Date().toISOString(),
    spreadsheet_id: SpreadsheetApp.getActiveSpreadsheet().getId(),
    sheets: sheets,
  };

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
