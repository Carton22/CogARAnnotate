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
  assert.match(html, /Session loader/);
  assert.match(html, /Backend endpoint/);
  assert.match(html, /http:\/\/localhost:8765\/api\/sessions/);
  assert.match(html, /RGB VIEW/);
  assert.match(html, /Step annotations/);
  assert.match(html, /Export CSV/);
  assert.match(html, /Upload RGB/);
});

test("rendered console does not include the removed starter skeleton", async () => {
  const response = await render();
  const html = await response.text();

  assert.doesNotMatch(html, /Your site is taking shape/i);
  assert.doesNotMatch(html, /Building your site/i);
  assert.doesNotMatch(html, /react-loading-skeleton/i);
  assert.doesNotMatch(html, /sites-skeleton/i);
});
