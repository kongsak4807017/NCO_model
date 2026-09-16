const NCO_PROFILE_SCHEMA = 'nco-hr-profile-v1';
const NCO_PROFILE_SHEETS = [
  'Profile',
  'Section_Metadata',
  'Workload_History',
  'TargetNeed_History',
  'Workforce_History',
  'Profession_Config',
];

function sheetRows_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  if (!headers.some(Boolean)) return [];

  return values.slice(1)
    .filter(function (row) {
      return row.some(function (value) { return String(value || '').trim() !== ''; });
    })
    .map(function (row) {
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
