import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("local Aria backend discovers VRS files and materializes RGB sessions", async () => {
  const root = await mkdtemp(join(tmpdir(), "cogar-aria-backend-"));
  const rawDir = join(root, "data", "raw", "P01");
  const outDir = join(root, "data", "processed", "rgb");
  const fakeBin = join(root, "bin");
  await mkdir(rawDir, { recursive: true });
  await mkdir(fakeBin, { recursive: true });
  await writeFile(join(rawDir, "P01_sandwich.vrs"), "fake-vrs");
  await writeFile(
    join(rawDir, "P01_sandwich.vrs.json"),
    JSON.stringify({
      filename: "P01_sandwich.vrs",
      start_time: 1781017970,
      end_time: 1781017980,
      data_quality_stats: {
        rgb_camera: { score: 100, processed: 269, expected: 269 },
      },
    }),
  );
  await writeFile(
    join(fakeBin, "vrs_to_mp4"),
    `#!/usr/bin/env bash
set -euo pipefail
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output_video) out="$2"; shift 2 ;;
    --log_folder) mkdir -p "$2"; shift 2 ;;
    *) shift ;;
  esac
done
mkdir -p "$(dirname "$out")"
printf fake-mp4 > "$out"
`,
    { mode: 0o755 },
  );

  const script = `
import json
from pathlib import Path
import sys
sys.path.insert(0, ${JSON.stringify(new URL("../backend", import.meta.url).pathname)})
import aria_backend

sessions = aria_backend.build_sessions(
    data_root=Path(${JSON.stringify(join(root, "data", "raw"))}),
    output_root=Path(${JSON.stringify(outDir)}),
    request_origin="http://localhost:8765",
    participant_id="P01",
    task_plan_id="sandwich",
    converter="vrs_to_mp4",
)
print(json.dumps([session.to_response() for session in sessions], sort_keys=True))
`;

  const result = spawnSync("python3", ["-c", script], {
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const sessions = JSON.parse(result.stdout);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].participantId, "P01");
  assert.equal(sessions[0].taskPlanId, "sandwich");
  assert.equal(sessions[0].sourceVrsName, "P01_sandwich.vrs");
  assert.equal(sessions[0].rgbVideoUrl, "http://localhost:8765/recordings/P01-sandwich/rgb.mp4");
  assert.equal(sessions[0].quality.rgbCameraScore, 100);
  assert.equal(await readFile(join(outDir, "P01-sandwich", "rgb.mp4"), "utf8"), "fake-mp4");
});

test("local Aria backend can sync recordings from connected glasses", async () => {
  const root = await mkdtemp(join(tmpdir(), "cogar-aria-sync-"));
  const fakeBin = join(root, "bin");
  const rawDir = join(root, "raw");
  await mkdir(fakeBin, { recursive: true });
  await writeFile(
    join(fakeBin, "aria_gen2"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1 $2" != "recording download-all" ]]; then exit 2; fi
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    *) shift ;;
  esac
done
mkdir -p "$out/P04"
printf vrs > "$out/P04/P04_table.vrs"
`,
    { mode: 0o755 },
  );

  const script = `
from pathlib import Path
import sys
sys.path.insert(0, ${JSON.stringify(new URL("../backend", import.meta.url).pathname)})
import aria_backend
aria_backend.sync_from_glasses(Path(${JSON.stringify(rawDir)}), aria_cli="aria_gen2")
print(Path(${JSON.stringify(join(rawDir, "P04", "P04_table.vrs"))}).exists())
`;

  const result = spawnSync("python3", ["-c", script], {
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /True/);
});
