import assert from "node:assert/strict";
import test from "node:test";

const model = await import("../app/annotation-model.ts");

test("formats video seconds as compact timecodes", () => {
  assert.equal(model.formatTimecode(0), "00:00");
  assert.equal(model.formatTimecode(75.4), "01:15");
  assert.equal(model.formatTimecode(3671), "1:01:11");
});

test("normalizes backend session responses", () => {
  const normalized = model.normalizeSessionResponse({
    sessions: [
      {
        id: "s1",
        participantId: "P01",
        taskPlanId: "sandwich",
        recordedAt: "2026-08-04T14:00:00.000Z",
        sourceVrsName: "CogAR_Test1.vrs",
        rgbVideoUrl: "/recordings/s1/rgb.mp4",
        durationSeconds: 128,
        quality: {
          rgbCameraScore: 100,
          rgbFramesProcessed: 269,
          rgbFramesExpected: 269,
        },
      },
    ],
  });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, "s1");
  assert.equal(normalized[0].participantId, "P01");
  assert.equal(normalized[0].source, "backend");
  assert.equal(normalized[0].quality?.rgbCameraScore, 100);
});

test("normalizes selectable Gen 1 device recordings", () => {
  assert.deepEqual(
    model.normalizeDeviceSessionResponse({
      sessions: [{ name: "P01_sandwich.vrs" }, { name: "" }, { name: "notes.txt" }],
    }),
    [{ name: "P01_sandwich.vrs" }],
  );
});

test("creates browser-local upload sessions", () => {
  const upload = model.createUploadSession({
    fileName: "rgb-view.mp4",
    objectUrl: "blob:test",
    participantId: "P02",
    taskPlanId: "boba",
  });

  assert.equal(upload.source, "manual-upload");
  assert.equal(upload.rgbVideoUrl, "blob:test");
  assert.equal(upload.sourceVrsName, "rgb-view.mp4");
  assert.equal(upload.taskPlanId, "boba");
});

test("creates local draft sessions for annotation before video upload", () => {
  const draft = model.createDraftSession({
    participantId: "P03",
    taskPlanId: "table",
  });

  assert.equal(draft.source, "draft");
  assert.equal(draft.id, "draft-P03-table");
  assert.equal(draft.participantId, "P03");
  assert.equal(draft.taskPlanId, "table");
  assert.equal(draft.rgbVideoUrl, "");
  assert.equal(draft.sourceVrsName, "No RGB recording loaded");
});

test("detects complete step annotations and validates end time", () => {
  const completeAnnotation = {
    sessionId: "s1",
    participantId: "P01",
    taskPlanId: "sandwich",
    stepNumber: 1,
    stepName: "Bread",
    startSeconds: 1,
    endSeconds: 5,
    relianceAmount: 4,
    relianceType: "appropriate-reliance",
    confidence: 6,
    cognitiveState: "taking-actions",
    notes: "",
    updatedAt: "2026-08-04T14:05:00.000Z",
  };

  assert.equal(model.isStepComplete(completeAnnotation), true);
  assert.equal(
    model.isStepComplete({ ...completeAnnotation, cognitiveState: undefined }),
    false,
  );
  assert.throws(
    () =>
      model.setStepEnd(
        { ...completeAnnotation, startSeconds: 10 },
        9,
        "2026-08-04T14:05:00.000Z",
      ),
    /End time/,
  );
});

test("builds export rows and CSV with stable field names", () => {
  const session = {
    id: "s1",
    participantId: "P01",
    taskPlanId: "sandwich",
    recordedAt: "2026-08-04T14:00:00.000Z",
    sourceVrsName: "CogAR_Test1.vrs",
    rgbVideoUrl: "/recordings/s1/rgb.mp4",
    durationSeconds: 128,
    quality: {
      rgbCameraScore: 100,
      rgbFramesProcessed: 269,
      rgbFramesExpected: 269,
    },
    source: "backend",
  };
  const completeAnnotation = {
    sessionId: "s1",
    participantId: "P01",
    taskPlanId: "sandwich",
    stepNumber: 1,
    stepName: "Bread",
    startSeconds: 1,
    endSeconds: 5,
    relianceAmount: 4,
    relianceType: "appropriate-reliance",
    confidence: 6,
    cognitiveState: "taking-actions",
    notes: "participant checked the plate",
    updatedAt: "2026-08-04T14:05:00.000Z",
  };

  const rows = model.buildExportRows([completeAnnotation], session);
  assert.deepEqual(Object.keys(rows[0]), [
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
    "reliance_type",
    "confidence",
    "cognitive_state",
    "notes",
    "source_vrs_name",
    "rgb_video_url",
    "updated_at",
  ]);
  assert.equal(rows[0].duration_seconds, 4);
  assert.equal(rows[0].start_timecode, "00:01");

  const csv = model.buildCsv(rows);
  assert.match(csv, /^"session_id","participant_id","task_plan_id"/);
  assert.match(csv, /"participant checked the plate"/);
});
