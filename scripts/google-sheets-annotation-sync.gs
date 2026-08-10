const HEADERS = [
  "session_id",
  "participant_id",
  "task_plan_id",
  "step_number",
  "step_name",
  "start_seconds",
  "start_timecode",
  "end_seconds",
  "end_timecode",
  "duration_seconds",
  "reliance",
  "confidence",
  "cognitive_engagement",
  "task_planning_engagement",
  "cognitive_state",
  "notes",
];

function participantSheetName(participantId) {
  const match = String(participantId || "").match(/\d+/);
  const numericId = match ? Number(match[0]) : 0;
  return `P${String(numericId).padStart(2, "0")}`;
}

function sheetForParticipant(spreadsheet, participantId) {
  const name = participantSheetName(participantId);
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const currentHeaders = headerRange.getValues()[0];
  const needsHeaders = currentHeaders.some((cell, index) => cell !== HEADERS[index]);

  if (needsHeaders) {
    headerRange.setValues([HEADERS]);
  }
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowValue(row, field) {
  const value = row && row[field];
  return value === undefined || value === null ? "" : value;
}

function appendAnnotationRow(spreadsheet, row) {
  const sheet = sheetForParticipant(spreadsheet, row.participant_id);
  ensureHeaders(sheet);
  sheet.appendRow(HEADERS.map((field) => (
    field === "reliance" ? rowValue(row, "reliance_amount") : rowValue(row, field)
  )));
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || "{}");
  const rows = payload.rows;
  if (payload.type !== "annotations" || !Array.isArray(rows) || rows.length === 0) {
    return jsonResponse({ ok: false, error: "missing_rows" });
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  rows.forEach((row) => appendAnnotationRow(spreadsheet, row || {}));
  return jsonResponse({ ok: true, appended: rows.length });
}

function doGet() {
  return jsonResponse({ ok: true, service: "cogar-annotation-sync" });
}
