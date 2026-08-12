import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveAnalysisStepRangesFromCsv,
  deriveStreamStartIsoFromVrsTimingFiles,
  isValidIsoRange,
  replaceAnalysisVideoStream,
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

test("replaceAnalysisVideoStream preserves other loaded views and reports only the replaced URL", () => {
  const streams = {
    rgb: { fileName: "rgb.mp4", objectUrl: "blob:rgb-old" },
    eye: { fileName: "eye.mp4", objectUrl: "blob:eye" },
    gaze: { fileName: "gaze.mp4", objectUrl: "blob:gaze" },
  };

  const result = replaceAnalysisVideoStream(streams, "rgb", {
    fileName: "rgb-new.mp4",
    objectUrl: "blob:rgb-new",
  });

  assert.equal(result.replacedObjectUrl, "blob:rgb-old");
  assert.deepEqual(result.streams, {
    rgb: { fileName: "rgb-new.mp4", objectUrl: "blob:rgb-new" },
    eye: streams.eye,
    gaze: streams.gaze,
  });
});

test("deriveStreamStartIsoFromVrsTimingFiles fills RGB, gaze, and eye starts from VRS sidecars", () => {
  assert.deepEqual(
    deriveStreamStartIsoFromVrsTimingFiles({
      vrsJson: JSON.stringify({ start_time: 1786545207 }),
      rgbTimingCsv: "mp4_frame_index,vrs_device_time_ns\n0,483194450646187\n",
      eyeTimingCsv: "mp4_frame_index,vrs_device_time_ns\n0,483194350744487\n",
    }),
    {
      rgb: "2026-08-12T14:33:27.000Z",
      gaze: "2026-08-12T14:33:27.000Z",
      eye: "2026-08-12T14:33:26.900Z",
    },
  );
});

test("deriveAnalysisStepRangesFromCsv uses the complete action timestamp per matching step", () => {
  const csv = [
    "participant_id,plan_id,plan,step,step_name,action,detail,event_timestamp_iso",
    "3,boba,Boba tea plan,1,Add strawberry syrup,AI audio,Add strawberry syrup,2026-08-06T21:18:45.610Z",
    "3,boba,Boba tea plan,1,Add strawberry syrup,AI accepted,AI instruction,2026-08-06T21:18:56.360Z",
    "3,boba,Boba tea plan,1,Add strawberry syrup,complete,Step complete,2026-08-06T21:18:58.000Z",
    "3,boba,Boba tea plan,2,Add boba,AI accepted,AI instruction,2026-08-06T21:19:28.446Z",
    "3,boba,Boba tea plan,2,Add boba,AI rejected,AI instruction,2026-08-06T21:19:30.000Z",
    "3,boba,Boba tea plan,2,Add boba,complete,Step complete,2026-08-06T21:19:32.000Z",
    "3,shelf,Shelf assembly plan,1,Classify,AI accepted,AI instruction,2026-08-06T21:45:06.526Z",
    "4,boba,Boba tea plan,1,Add strawberry syrup,AI accepted,AI instruction,2026-08-06T21:20:00.000Z",
    "4,boba,Boba tea plan,1,Add strawberry syrup,complete,Step complete,2026-08-06T21:20:05.000Z",
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
        endIso: "2026-08-06T21:18:58.000Z",
        decisionTimestampIso: "2026-08-06T21:18:58.000Z",
      },
      {
        stepNumber: 2,
        startIso: "2026-08-06T21:18:58.000Z",
        endIso: "2026-08-06T21:19:32.000Z",
        decisionTimestampIso: "2026-08-06T21:19:32.000Z",
      },
    ],
  );
});
