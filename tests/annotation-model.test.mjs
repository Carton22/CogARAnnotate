import assert from "node:assert/strict";
import test from "node:test";

const model = await import("../app/annotation-model.ts");
const taskPlans = await import("../app/task-plans.ts");

const canonicalPlanInstructionText = {
  training: [
    "Put a long piece on the ground",
    "Put a square piece at slot 1",
    "Put a square piece at slot 2",
    "Put a long piece on the top",
    "Put a square piece at slot 3",
    "Put a square piece at slot 4",
    "Put a long piece on the top",
  ],
  sandwich: [
    "Take a plate",
    "Put a bread into the plate",
    "Add a piece of cheese",
    "Add a piece of ham",
    "Add ketchup",
    "Add a bread on top",
    "Put into microwave",
    "Add peppers",
    "Add the green celery",
    "Add water into a cup",
  ],
  shelf: [
    "Classify the pieces based on color",
    "Insert side A of a green into slot 1 of the yellow",
    "Insert a pink piece at slot 2 of the yellow",
    "Insert another 2 pink at slot 3 and 4 of the yellow",
    "Insert side A of a green into slot 5 of the yellow",
    "Connect No.2 yellow piece with the greens and pinks",
    "Connect the blue piece with side B of 2 green pieces",
    "Insert side A of a purple piece into slot 3 of the yellow",
    "Insert a brown piece at slot 5",
    "Connect the black piece with side B of 2 green pieces",
  ],
  boba: [
    "Add strawberry sugar syrup into a cup",
    "Add boba",
    "Add strawberry yogurt as the bottom layer",
    "Pour matcha latte into the cup",
    "Pour coconut milk into the cup",
    "Add milk cream on the top",
    "Put a lid on the cup",
    "grab the left bottle to add white sugar",
    "use a fork to add matcha powder",
    "Insert a white straw",
  ],
  table: [
    "Insert a No.4 at slot 1 of a No.3",
    "Connect another No.3 with the No.4",
    "Insert a No.4 at slot 2 of the No.3",
    "Connect a No.1 on top of the 2 No.3",
    "Connect a No.2 with the No.1",
    "Connect 2 No.5 with a No.6",
    "Connect another No.6 with the No.5",
    "Take a cutting knife",
    "Connect a No.5 with a No.9",
    "Connect a No.6 with a No.8",
  ],
};

function mainInstructionText(task) {
  return task.mainKind === "correct"
    ? task.correctOptions[0]?.text
    : task.incorrectOptions?.[0]?.text;
}

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

function misleadingSequenceNumbers(planId) {
  return Array.from({ length: 36 }, (_, index) => {
    const participantId = `P${String(index + 1).padStart(2, "0")}`;
    return taskPlans
      .planForParticipant(planId, participantId)
      .tasks.flatMap((task, taskIndex) =>
        task.mainKind === "incorrect" ? [taskIndex + 1] : [],
      );
  });
}

function misleadingPositionCounts(planId) {
  const counts = {
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
    10: 0,
  };
  for (const sequenceNumbers of misleadingSequenceNumbers(planId)) {
    for (const sequenceNumber of sequenceNumbers) {
      counts[sequenceNumber] += 1;
    }
  }
  return counts;
}

test("includes the Reliance training plan before the four 7-correct-step study plans", () => {
  assert.deepEqual(
    taskPlans.plans.map((plan) => plan.id),
    ["training", "sandwich", "shelf", "boba", "table"],
  );
  assert.equal(taskPlans.plans[0].tasks.length, 7);
  for (const plan of taskPlans.plans.slice(1)) {
    assert.equal(plan.tasks.length, 7);
    assert.equal(plan.tasks.filter((task) => task.mainKind === "correct").length, 7);
  }
});

test("aligns main AI audio instruction text with CogARReliance for all participants", () => {
  for (const [planId, expectedText] of Object.entries(canonicalPlanInstructionText)) {
    const participantIds =
      planId === "training"
        ? ["P01"]
        : Array.from({ length: 36 }, (_, index) => `P${String(index + 1).padStart(2, "0")}`);

    for (const participantId of participantIds) {
      const plan = taskPlans.planForParticipant(planId, participantId);
      const actualText = plan.tasks.map(mainInstructionText);

      assert.deepEqual(
        [...actualText].sort(),
        [...expectedText].sort(),
        `${planId} ${participantId} should use CogARReliance main AI audio text`,
      );
    }
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

test("counterbalances Shelf and Boba misleading positions like CogARReliance", () => {
  assert.deepEqual(misleadingSequenceNumbers("shelf").slice(0, 3), [
    [4, 6, 9],
    [3, 7, 9],
    [3, 5, 8],
  ]);
  assert.deepEqual(misleadingSequenceNumbers("boba").slice(0, 3), [
    [3, 6, 10],
    [4, 6, 8],
    [3, 5, 9],
  ]);

  for (const planId of ["shelf", "boba"]) {
    assert.deepEqual(misleadingPositionCounts(planId), {
      2: 12,
      3: 12,
      4: 12,
      5: 12,
      6: 12,
      7: 12,
      8: 12,
      9: 12,
      10: 12,
    });
  }
});

test("keeps CogARReliance recovery cue text on misleading annotation steps", () => {
  const shelf = taskPlans.planForParticipant("shelf", "P01");
  assert.deepEqual(
    shelf
      .tasks
      .filter((task) => task.mainKind === "incorrect")
      .map((task) => task.recoveryOptions?.[0]?.text),
    [
      "remove the purple piece at slot 3, because the size doesn't match",
      "remove the brown piece at slot 5, because the shape doesn't match",
      "Remove the black piece, because the size doesn't match",
    ],
  );

  const boba = taskPlans.planForParticipant("boba", "P01");
  assert.deepEqual(
    boba
      .tasks
      .filter((task) => task.mainKind === "incorrect")
      .map((task) => task.recoveryOptions?.[0]?.text),
    [
      "grab the right bottle to add white sugar",
      "Use a spoon to add matcha powder",
      "Oh, replace the straw with a bigger black straw for boba",
    ],
  );
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
    finalActionConfidence: 7,
    cognitiveEngagement: 5,
    taskPlanningEngagement: 6,
    cognitiveStateOrder: ["not-thinking", "taking-actions"],
    notes: "",
    updatedAt: "2026-08-04T14:05:00.000Z",
  };

  assert.equal(model.isStepComplete(completeAnnotation), true);
  assert.equal(
    model.isStepComplete({ ...completeAnnotation, cognitiveStateOrder: [] }),
    true,
  );
  assert.equal(
    model.isStepComplete({ ...completeAnnotation, finalActionConfidence: undefined }),
    false,
  );
  assert.equal(
    model.isStepComplete({ ...completeAnnotation, cognitiveEngagement: undefined }),
    false,
  );
  assert.equal(
    model.isStepComplete({ ...completeAnnotation, taskPlanningEngagement: undefined }),
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

test("normalizes legacy single cognitive state into an ordered state list", () => {
  assert.deepEqual(
    model.cognitiveStateOrderFromAnnotation({
      cognitiveState: "taking-actions",
    }),
    ["taking-actions"],
  );
  assert.deepEqual(
    model.cognitiveStateOrderFromAnnotation({
      cognitiveState: "taking-actions",
      cognitiveStateOrder: ["not-thinking", "taking-actions"],
    }),
    ["not-thinking", "taking-actions"],
  );
});

test("randomizes cognitive state appearance by participant task and step", () => {
  const first = model.randomizeCognitiveStatesForStep("P01", "sandwich", 1);
  const firstAgain = model.randomizeCognitiveStatesForStep("P01", "sandwich", 1);
  const secondStep = model.randomizeCognitiveStatesForStep("P01", "sandwich", 2);

  assert.deepEqual(first, firstAgain);
  assert.notDeepEqual(first, secondStep);
  assert.deepEqual([...first].sort(), [...model.cognitiveStateValues].sort());
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
    finalActionConfidence: 7,
    cognitiveEngagement: 5,
    taskPlanningEngagement: 6,
    cognitiveStateOrder: ["not-thinking", "taking-actions"],
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
    "final_action_confidence",
    "cognitive_engagement",
    "task_planning_engagement",
    "cognitive_state",
    "notes",
    "source_vrs_name",
    "rgb_video_url",
    "updated_at",
  ]);
  assert.equal(rows[0].duration_seconds, 4);
  assert.equal(rows[0].start_timecode, "00:01");
  assert.equal(rows[0].final_action_confidence, 7);
  assert.equal(rows[0].task_planning_engagement, 6);
  assert.equal(rows[0].cognitive_state, "not-thinking > taking-actions");

  const csv = model.buildCsv(rows);
  assert.match(csv, /^"session_id","participant_id","task_plan_id"/);
  assert.match(csv, /"participant checked the plate"/);
});

test("derives step ranges from the complete action timestamp per step", () => {
  const csv = [
    "participant_id,plan_id,plan,step,step_name,action,detail,event_timestamp_iso",
    "2,boba,Boba tea plan,1,Take a cup,AI audio,Take a cup,2026-08-05T21:51:11.000Z",
    "2,boba,Boba tea plan,1,Take a cup,AI accepted,AI instruction,2026-08-05T21:51:20.000Z",
    "2,boba,Boba tea plan,1,Take a cup,AI rejected,AI instruction,2026-08-05T21:51:24.500Z",
    "2,boba,Boba tea plan,1,Take a cup,complete,Step complete,2026-08-05T21:51:26.000Z",
    "2,boba,Boba tea plan,2,Add syrup,AI audio,Add syrup,2026-08-05T21:51:32.250Z",
    "2,boba,Boba tea plan,2,Add syrup,AI rejected,AI instruction,2026-08-05T21:51:40.250Z",
    "2,boba,Boba tea plan,2,Add syrup,complete,Step complete,2026-08-05T21:51:41.000Z",
    "2,shelf,Shelf assembly plan,1,Classify,AI audio,Classify,2026-08-05T21:52:00.000Z",
    "3,boba,Boba tea plan,1,Take a cup,AI audio,Take a cup,2026-08-05T21:53:00.000Z",
    "3,boba,Boba tea plan,1,Take a cup,complete,Step complete,2026-08-05T21:53:05.000Z",
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
      endSeconds: 26,
      endTimestampIso: "2026-08-05T21:51:26.000Z",
    },
    {
      stepNumber: 2,
      stepName: "Add syrup",
      startSeconds: 26,
      endSeconds: 41,
      endTimestampIso: "2026-08-05T21:51:41.000Z",
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
