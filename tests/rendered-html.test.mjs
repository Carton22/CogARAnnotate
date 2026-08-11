import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the CogAR annotation console shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>CogAR · Annotation Console<\/title>/i);
  assert.match(html, /RESEARCH CONSOLE/);
  assert.match(html, /Cog<span>AR<\/span>/);
  assert.match(html, /Annotation Console/);
  assert.match(html, /RGB upload/);
  assert.match(html, /RGB VIEW/);
  assert.match(html, /Step annotations/);
  assert.match(html, /Export CSV/);
  assert.match(html, /Sync Sheet/);
  assert.match(html, /Google Sheets sync/);
  assert.match(html, /Paste deployed Google Apps Script web app URL/);
  assert.match(html, /Upload RGB/);
  assert.match(html, /Detected video start ISO/);
  assert.match(html, /Play step/);
  assert.doesNotMatch(html, /Mark start/);
  assert.match(html, /To what extent did you rely on the AI during this step/);
  assert.match(html, /To what extent did you trust the AI/);
  assert.match(html, /To what extent did you critically evaluate the AI/);
  assert.match(html, /How much did you actively think through how to complete this task/);
  assert.doesNotMatch(html, /Cognitive state/);
  assert.doesNotMatch(html, /Tick every state you experienced/);
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.match(html, /What&#x27;s your thinking process at that step/);
  assert.match(html, /Start speech input/);
  assert.match(html, /annotation-sync-footer/);
  assert.match(html, /Sync all answers to Google Sheets/);
  assert.doesNotMatch(html, /App Rely/);
  assert.doesNotMatch(html, /App Reject/);
  assert.doesNotMatch(html, /Overreliance/);
  assert.doesNotMatch(html, /Under reliance/);
  assert.doesNotMatch(html, /Backend endpoint/);
  assert.doesNotMatch(html, /Query sessions/);
  assert.doesNotMatch(html, /Device recordings/);
  assert.doesNotMatch(html, /Download selected/);
  assert.doesNotMatch(html, /Task plan<\/span><select/);
  assert.doesNotMatch(html, /Step annotations<\/span><strong>0/);
  assert.match(html, /<option value="P01"/);
  assert.match(html, /<option value="P36"/);
});

test("analysis page omits training and keeps uploads in review panels", async () => {
  const response = await render("/analysis");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /ANALYSIS PLATFORM/);
  assert.doesNotMatch(html, /Training plan/);
  assert.match(html, /Sandwich plan/);
  assert.match(html, /Shelf assembly plan/);
  assert.match(html, /Boba tea plan/);
  assert.match(html, /Table assembly plan/);
  assert.match(html, /Import AI timing CSV/);
  assert.match(html, /RGB third-person view/);
  assert.match(html, /Eye camera view/);
  assert.match(html, /Estimated eye gaze view/);
  assert.match(html, /ISO start timestamp/);
  assert.match(html, /heart rate/i);
});

test("rendered console does not include the removed starter skeleton", async () => {
  const response = await render();
  const html = await response.text();

  assert.doesNotMatch(html, /Your site is taking shape/i);
  assert.doesNotMatch(html, /Building your site/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
  assert.doesNotMatch(html, /sites-skeleton/i);
});

test("boba distractors align with CogARReliance wording", async () => {
  const { planForParticipant } = await import("../app/task-plans.ts");
  const taskNames = planForParticipant("boba", "P01").tasks.map((task) => task.name);

  assert.ok(taskNames.includes("Grab a fork"));
  assert.ok(!taskNames.includes("Mix up the current cup"));
});
