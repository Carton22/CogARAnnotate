import assert from "node:assert/strict";
import test from "node:test";

const route = await import("../app/api/sessions/route.ts");

test("session route filters configured processed RGB sessions", async () => {
  process.env.COGAR_SESSIONS_JSON = JSON.stringify([
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
    {
      id: "s2",
      participantId: "P02",
      taskPlanId: "boba",
      recordedAt: "2026-08-04T15:00:00.000Z",
      sourceVrsName: "demo-test.vrs",
      rgbVideoUrl: "/recordings/s2/rgb.mp4",
    },
  ]);

  const response = await route.GET(
    new Request("http://localhost/api/sessions?participantId=P01&taskPlanId=sandwich"),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.sessions.length, 1);
  assert.equal(payload.sessions[0].id, "s1");
  assert.equal(payload.sessions[0].source, "backend");
});

test("session route returns an empty list when no backend catalog is configured", async () => {
  delete process.env.COGAR_SESSIONS_JSON;

  const response = await route.GET(
    new Request("http://localhost/api/sessions?participantId=P01&taskPlanId=sandwich"),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.sessions, []);
});
