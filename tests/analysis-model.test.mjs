import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveAnalysisStepRangesFromCsv,
  filterHeartRateRows,
  isValidIsoRange,
  parseHeartRateCsv,
  secondsBetweenIso,
} from "../app/analysis-model.ts";

test("secondsBetweenIso returns second offset between ISO timestamps", () => {
  assert.equal(
    secondsBetweenIso("2026-08-07T12:00:00.000Z", "2026-08-07T12:01:12.500Z"),
    72.5,
  );
});

test("isValidIsoRange requires parseable ISO strings with end after start", () => {
  assert.equal(
    isValidIsoRange("2026-08-07T12:00:00.000Z", "2026-08-07T12:00:01.000Z"),
    true,
  );
  assert.equal(
    isValidIsoRange("2026-08-07T12:00:01.000Z", "2026-08-07T12:00:00.000Z"),
    false,
  );
  assert.equal(isValidIsoRange("not-time", "2026-08-07T12:00:00.000Z"), false);
});

test("parseHeartRateCsv reads common timestamp and bpm columns", () => {
  const rows = parseHeartRateCsv(`timestamp,heart_rate\n2026-08-07T12:00:00Z,72\n2026-08-07T12:00:05Z,75`);
  assert.deepEqual(rows, [
    { iso: "2026-08-07T12:00:00.000Z", bpm: 72 },
    { iso: "2026-08-07T12:00:05.000Z", bpm: 75 },
  ]);
});

test("filterHeartRateRows returns rows inside inclusive ISO range", () => {
  const rows = [
    { iso: "2026-08-07T12:00:00.000Z", bpm: 72 },
    { iso: "2026-08-07T12:00:05.000Z", bpm: 75 },
    { iso: "2026-08-07T12:00:10.000Z", bpm: 77 },
  ];
  assert.deepEqual(
    filterHeartRateRows(rows, "2026-08-07T12:00:05.000Z", "2026-08-07T12:00:10.000Z"),
    rows.slice(1),
  );
});

test("deriveAnalysisStepRangesFromCsv uses the latest AI accepted or rejected timestamp per matching step", () => {
  const csv = [
    "participant_id,plan_id,plan,step,step_name,action,detail,event_timestamp_iso",
    "3,boba,Boba tea plan,1,Add strawberry syrup,AI audio,Add strawberry syrup,2026-08-06T21:18:45.610Z",
    "3,boba,Boba tea plan,1,Add strawberry syrup,AI accepted,AI instruction,2026-08-06T21:18:56.360Z",
    "3,boba,Boba tea plan,2,Add boba,AI accepted,AI instruction,2026-08-06T21:19:28.446Z",
    "3,boba,Boba tea plan,2,Add boba,AI rejected,AI instruction,2026-08-06T21:19:30.000Z",
    "3,shelf,Shelf assembly plan,1,Classify,AI accepted,AI instruction,2026-08-06T21:45:06.526Z",
    "4,boba,Boba tea plan,1,Add strawberry syrup,AI accepted,AI instruction,2026-08-06T21:20:00.000Z",
  ].join("\n");

  assert.deepEqual(
    deriveAnalysisStepRangesFromCsv(csv, {
      participantId: "P03",
      taskPlanId: "boba",
    }),
    [
      {
        stepNumber: 1,
        startIso: "2026-08-06T21:18:45.610Z",
        endIso: "2026-08-06T21:19:01.360Z",
        decisionTimestampIso: "2026-08-06T21:18:56.360Z",
      },
      {
        stepNumber: 2,
        startIso: "2026-08-06T21:19:01.360Z",
        endIso: "2026-08-06T21:19:35.000Z",
        decisionTimestampIso: "2026-08-06T21:19:30.000Z",
      },
    ],
  );
});
