import assert from "node:assert/strict";
import test from "node:test";

const model = await import("../app/annotation-model.ts");
const taskPlans = await import("../app/task-plans.ts");

const distractorWindows = [
  { label: "A", allowed: new Set([1, 2, 3]) },
  { label: "B", allowed: new Set([3, 4, 5]) },
  { label: "C", allowed: new Set([5, 6, 7]) },
];

function distractorPositions(tasks) {
  let correctSeen = 0;
  let distractorSeen = 0;
  return tasks.flatMap((task, index) => {
    if (task.mainKind === "correct") {
      correctSeen += 1;
      return [];
    }
    const window = distractorWindows[distractorSeen++];
    return [{ ...window, correctSeen, index }];
  });
}

function assertDistractorWindows(tasks) {
  const positions = distractorPositions(tasks);
  assert.equal(positions.length, 3);
  for (const position of positions) {
    assert.ok(
      position.allowed.has(position.correctSeen),
      `${position.label} inserted after correct ${position.correctSeen}`,
    );
  }
  assert.ok(positions[0].index < positions[1].index, "A should appear before B");
  assert.ok(positions[1].index < positions[2].index, "B should appear before C");
}

test("includes a 5-step training plan before the four 7-correct-step study plans", () => {
  assert.deepEqual(
    taskPlans.plans.map((plan) => plan.id),
    ["training", "sandwich", "shelf", "boba", "table"],
  );
  assert.equal(taskPlans.plans[0].tasks.length, 5);
  for (const plan of taskPlans.plans.slice(1)) {
    assert.equal(plan.tasks.length, 7);
    assert.equal(plan.tasks.filter((task) => task.mainKind === "correct").length, 7);
  }
});

test("uses the same participant-stable Sandwich sequence as CogARReliance", () => {
  const p1 = taskPlans.planForParticipant("sandwich", "P01");
  const p1Again = taskPlans.planForParticipant("sandwich", "1");
  const p2 = taskPlans.planForParticipant("sandwich", "P02");

  assert.equal(p1.tasks.length, 10);
  assert.deepEqual(p1.tasks, p1Again.tasks);
  assert.notDeepEqual(p1.tasks, p2.tasks);
  assert.equal(p1.tasks.filter((task) => task.mainKind === "correct").length, 7);
  assert.equal(p1.tasks.filter((task) => task.mainKind === "incorrect").length, 3);
  assertDistractorWindows(p1.tasks);
});

test("uses the same participant-stable Shelf sequence as CogARReliance", () => {
  const p1 = taskPlans.planForParticipant("shelf", "P01");
  const p1Again = taskPlans.planForParticipant("shelf", "1");
  const p2 = taskPlans.planForParticipant("shelf", "P02");

  assert.equal(p1.tasks.length, 10);
  assert.deepEqual(p1.tasks, p1Again.tasks);
  assert.notDeepEqual(p1.tasks, p2.tasks);
  assert.equal(p1.tasks.filter((task) => task.mainKind === "correct").length, 7);
  assert.equal(p1.tasks.filter((task) => task.mainKind === "incorrect").length, 3);
  assertDistractorWindows(p1.tasks);
});

test("uses the same participant-stable Boba sequence as CogARReliance", () => {
  const p1 = taskPlans.planForParticipant("boba", "P01");
  const p1Again = taskPlans.planForParticipant("boba", "1");
  const p2 = taskPlans.planForParticipant("boba", "P02");

  assert.equal(p1.tasks.length, 10);
  assert.deepEqual(p1.tasks, p1Again.tasks);
  assert.notDeepEqual(p1.tasks, p2.tasks);
  assert.equal(p1.tasks.filter((task) => task.mainKind === "correct").length, 7);
  assert.equal(p1.tasks.filter((task) => task.mainKind === "incorrect").length, 3);
  assertDistractorWindows(p1.tasks);
});

test("uses the same participant-stable Table sequence as CogARReliance", () => {
  const p1 = taskPlans.planForParticipant("table", "P01");
  const p1Again = taskPlans.planForParticipant("table", "1");
  const p2 = taskPlans.planForParticipant("table", "P02");

  assert.equal(p1.tasks.length, 10);
  assert.deepEqual(p1.tasks, p1Again.tasks);
  assert.notDeepEqual(p1.tasks, p2.tasks);
  assert.equal(p1.tasks.filter((task) => task.mainKind === "correct").length, 7);
  assert.equal(p1.tasks.filter((task) => task.mainKind === "incorrect").length, 3);
  assertDistractorWindows(p1.tasks);
});

test("formats video seconds as compact timecodes", () => {
  assert.equal(model.formatTimecode(0), "00:00");
  assert.equal(model.formatTimecode(75.4), "01:15");
  assert.equal(model.formatTimecode(3671), "1:01:11");
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
    confidence: 6,
    cognitiveEngagement: 5,
    cognitiveState: "taking-actions",
    notes: "",
    updatedAt: "2026-08-04T14:05:00.000Z",
  };

  assert.equal(model.isStepComplete(completeAnnotation), true);
  assert.equal(
    model.isStepComplete({ ...completeAnnotation, cognitiveState: undefined }),
    false,
  );
  assert.equal(
    model.isStepComplete({ ...completeAnnotation, cognitiveEngagement: undefined }),
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
    confidence: 6,
    cognitiveEngagement: 5,
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
    "confidence",
    "cognitive_engagement",
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

test("derives step ranges from the last AI audio timestamp per step", () => {
  const csv = [
    "participant_id,plan_id,plan,step,step_name,action,detail,event_timestamp_iso",
    "2,boba,Boba tea plan,1,Take a cup,AI audio,Take a cup,2026-08-05T21:51:11.000Z",
    "2,boba,Boba tea plan,1,Take a cup,AI audio,Take a cup again,2026-08-05T21:51:14.500Z",
    "2,boba,Boba tea plan,1,Take a cup,AI accepted,AI instruction,2026-08-05T21:51:20.000Z",
    "2,boba,Boba tea plan,2,Add syrup,AI audio,Add syrup,2026-08-05T21:51:32.250Z",
    "2,shelf,Shelf assembly plan,1,Classify,AI audio,Classify,2026-08-05T21:52:00.000Z",
    "3,boba,Boba tea plan,1,Take a cup,AI audio,Take a cup,2026-08-05T21:53:00.000Z",
  ].join("\n");

  const ranges = model.deriveStepTimingRangesFromCsv(csv, {
    participantId: "P02",
    taskPlanId: "boba",
    videoStartIso: "2026-08-05T21:51:00.000Z",
  });

  assert.deepEqual(ranges, [
    {
      stepNumber: 1,
      stepName: "Take a cup",
      startSeconds: 0,
      endSeconds: 16,
      endTimestampIso: "2026-08-05T21:51:14.500Z",
    },
    {
      stepNumber: 2,
      stepName: "Add syrup",
      startSeconds: 16,
      endSeconds: 34,
      endTimestampIso: "2026-08-05T21:51:32.250Z",
    },
  ]);
});

test("applies derived step ranges to existing annotations", () => {
  const session = {
    id: "upload-1",
    participantId: "P02",
    taskPlanId: "boba",
    recordedAt: "2026-08-05T21:51:00.000Z",
    sourceVrsName: "pilot2_boba.MP4",
    rgbVideoUrl: "blob:test",
    source: "manual-upload",
  };
  const plan = taskPlans.planForParticipant("boba", "P02");
  const annotations = model.createEmptyAnnotations(session, plan);

  const updated = model.applyStepTimingRanges(annotations, [
    {
      stepNumber: 1,
      stepName: "Take a cup",
      startSeconds: 0,
      endSeconds: 14,
      endTimestampIso: "2026-08-05T21:51:14.500Z",
    },
  ], "2026-08-06T14:00:00.000Z");

  assert.equal(updated[1].startSeconds, 0);
  assert.equal(updated[1].endSeconds, 14);
  assert.equal(updated[1].updatedAt, "2026-08-06T14:00:00.000Z");
  assert.equal(updated[2].startSeconds, undefined);
});

test("extracts QuickTime video start ISO from mvhd creation time metadata", () => {
  const quickTimeEpochOffsetSeconds = 2082844800;
  const unixSeconds = Date.parse("2026-08-06T15:06:38.000Z") / 1000;
  const creationSeconds = unixSeconds + quickTimeEpochOffsetSeconds;
  const mvhdPayload = new Uint8Array(24);
  const view = new DataView(mvhdPayload.buffer);
  view.setUint8(0, 0);
  view.setUint32(4, creationSeconds);
  const atom = new Uint8Array(8 + mvhdPayload.length);
  const atomView = new DataView(atom.buffer);
  atomView.setUint32(0, atom.length);
  atom.set(Buffer.from("mvhd"), 4);
  atom.set(mvhdPayload, 8);

  assert.equal(
    model.extractQuickTimeStartIso(atom.buffer),
    "2026-08-06T15:06:38.000Z",
  );
});
