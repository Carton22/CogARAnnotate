import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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
  assert.match(html, /Play video/);
  assert.match(html, /To what extent did you rely on the AI to complete this task/);
  assert.match(html, /To what extent did you trust the AI/);
  assert.match(html, /To what extent did you critically evaluate the AI/);
  assert.match(html, /What kind of cognitive states you are in/);
  assert.match(html, /What&#x27;s your thinking process at that step/);
  assert.match(html, /Start speech input/);
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

test("rendered console does not include the removed starter skeleton", async () => {
  const response = await render();
  const html = await response.text();

  assert.doesNotMatch(html, /Your site is taking shape/i);
  assert.doesNotMatch(html, /Building your site/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
  assert.doesNotMatch(html, /sites-skeleton/i);
});
