import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadScript() {
  const source = await readFile(
    new URL("../scripts/google-sheets-annotation-sync.gs", import.meta.url),
    "utf8",
  );
  const appendedRows = [];
  const headerWrites = [];
  const sheets = new Map();
  const context = {
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(value) {
        return {
          value,
          mimeType: "",
          setMimeType(mimeType) {
            this.mimeType = mimeType;
            return this;
          },
        };
      },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getSheetByName(name) {
            return sheets.get(name) || null;
          },
          insertSheet(name) {
            const sheet = {
              getRange() {
                return {
                  getValues: () => [Array(20).fill("")],
                  setValues: (rows) => headerWrites.push({ sheet: name, rows }),
                };
              },
              appendRow: (row) => appendedRows.push({ sheet: name, row }),
            };
            sheets.set(name, sheet);
            return sheet;
          },
        };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, appendedRows, headerWrites };
}

test("appends annotation rows to participant sheets", async () => {
  const { context, appendedRows, headerWrites } = await loadScript();
  const response = context.doPost({
    postData: {
      contents: JSON.stringify({
        type: "annotations",
        rows: [
          {
            session_id: "draft-P01-sandwich",
            participant_id: "P01",
            task_plan_id: "sandwich",
            step_number: 1,
            step_name: "Take a slice of bread",
            start_seconds: 3,
            start_timecode: "00:03",
            end_seconds: 9,
            end_timecode: "00:09",
            duration_seconds: 6,
            reliance_amount: 5,
            confidence: 6,
            final_action_confidence: 7,
            cognitive_engagement: 4,
            task_planning_engagement: 5,
            trust_in_ai: 6,
            task_planning_score: 5,
            cognitive_state: "taking-actions",
            notes: "checked the recommendation",
            source_vrs_name: "No RGB recording loaded",
            rgb_video_url: "",
            updated_at: "2026-08-05T14:05:00.000Z",
          },
        ],
      }),
    },
  });

  assert.equal(response.mimeType, "application/json");
  assert.deepEqual(JSON.parse(response.value), { ok: true, appended: 1 });
  assert.equal(headerWrites.length, 1);
  assert.equal(headerWrites[0].sheet, "P01");
  const headers = Array.from(headerWrites[0].rows[0]);
  assert.deepEqual(headers, [
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
    "reliance_amount",
    "trust_in_ai",
    "final_action_confidence",
    "cognitive_engagement",
    "task_planning_score",
    "cognitive_state",
    "notes",
    "source_vrs_name",
    "rgb_video_url",
    "updated_at",
  ]);
  assert.equal(appendedRows.length, 1);
  assert.equal(appendedRows[0].sheet, "P01");
  assert.equal(appendedRows[0].row.length, 20);
  assert.equal(appendedRows[0].row[0], "draft-P01-sandwich");
  assert.equal(appendedRows[0].row[1], "P01");
  assert.deepEqual(
    Object.fromEntries(headers.map((header, index) => [header, appendedRows[0].row[index]])),
    {
      session_id: "draft-P01-sandwich",
      participant_id: "P01",
      task_plan_id: "sandwich",
      step_number: 1,
      step_name: "Take a slice of bread",
      start_seconds: 3,
      start_timecode: "00:03",
      end_seconds: 9,
      end_timecode: "00:09",
      duration_seconds: 6,
      reliance_amount: 5,
      trust_in_ai: 6,
      final_action_confidence: 7,
      cognitive_engagement: 4,
      task_planning_score: 5,
      cognitive_state: "taking-actions",
      notes: "checked the recommendation",
      source_vrs_name: "No RGB recording loaded",
      rgb_video_url: "",
      updated_at: "2026-08-05T14:05:00.000Z",
    },
  );
  assert.equal(appendedRows[0].row[12], 7);
  assert.equal(appendedRows[0].row[14], 5);
  assert.equal(appendedRows[0].row[15], "taking-actions");
  assert.equal(appendedRows[0].row[16], "checked the recommendation");
  assert.equal(appendedRows[0].row[17], "No RGB recording loaded");
  assert.equal(appendedRows[0].row[18], "");
  assert.equal(appendedRows[0].row[19], "2026-08-05T14:05:00.000Z");
});

test("rejects annotation posts without rows", async () => {
  const { context, appendedRows } = await loadScript();
  const response = context.doPost({
    postData: {
      contents: JSON.stringify({
        type: "annotations",
        rows: [],
      }),
    },
  });

  assert.deepEqual(JSON.parse(response.value), {
    ok: false,
    error: "missing_rows",
  });
  assert.equal(appendedRows.length, 0);
});
