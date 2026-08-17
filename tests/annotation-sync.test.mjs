import assert from "node:assert/strict";
import test from "node:test";

const sync = await import("../app/annotation-sync.mjs");

test("posts annotation rows to the configured Apps Script endpoint", async () => {
  const requests = [];
  const rows = [
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
      cognitive_engagement: 4,
      task_planning_engagement: 7,
      cognitive_state: "taking-actions",
      notes: "checked the recommendation",
      source_vrs_name: "No RGB recording loaded",
      rgb_video_url: "",
      updated_at: "2026-08-05T14:05:00.000Z",
    },
  ];

  await sync.publishAnnotations(rows, "https://script.google.com/macros/s/test/exec", async (url, init) => {
    requests.push({ url, init });
    return new Response(null, { status: 204 });
  });

  assert.equal(requests.length, 1);
  assert.equal(String(requests[0].url), "https://script.google.com/macros/s/test/exec");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.mode, "no-cors");
  assert.equal(requests[0].init.credentials, "include");
  assert.equal(requests[0].init.headers["Content-Type"], "text/plain;charset=utf-8");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    source: "cogar-annotation-console",
    type: "annotations",
    rows: [
      {
        ...rows[0],
        trust_in_ai: 6,
        task_planning_score: 7,
      },
    ],
  });
});

test("rejects missing sync URLs and empty row sets", async () => {
  await assert.rejects(
    () => sync.publishAnnotations([], "https://script.google.com/macros/s/test/exec", async () => new Response()),
    /No annotation rows/,
  );
  await assert.rejects(
    () => sync.publishAnnotations([{ participant_id: "P01" }], " ", async () => new Response()),
    /Google Sheets sync URL/,
  );
});
