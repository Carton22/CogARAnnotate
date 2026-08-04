import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryRoot = new URL("../", import.meta.url);

test("GitHub Pages targets the Carton22/CogARAnnotate repository", async () => {
  const [nextConfig, workflow] = await Promise.all([
    readFile(new URL("next.config.ts", repositoryRoot), "utf8"),
    readFile(new URL(".github/workflows/pages.yml", repositoryRoot), "utf8"),
  ]);

  assert.match(nextConfig, /repositoryBasePath\s*=.*"\/CogARAnnotate"/);
  assert.match(workflow, /NEXT_PUBLIC_BASE_PATH:\s*\/CogARAnnotate/);
  assert.match(
    workflow,
    /NEXT_PUBLIC_SITE_ORIGIN:\s*https:\/\/carton22\.github\.io/,
  );
});
