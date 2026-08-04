# CogAR Annotation Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a post-task CogAR annotation console that loads backend or uploaded RGB recordings and records one step-level reliance/cognitive annotation per task step.

**Architecture:** Extract task plans and annotation behavior into focused TypeScript modules, then replace the single-page live Wizard-of-Oz console with an annotation-first React client. Keep local persistence and exports client-side, and use a small mockable backend query contract until a real processed-Aria service exists.

**Tech Stack:** Next/Vinext, React 19, TypeScript, CSS, Node test runner.

---

## Files

- Create: `app/task-plans.ts` for CogAR plan data and task-plan types.
- Create: `app/annotation-model.ts` for session, annotation, validation, formatting, persistence, and export helpers.
- Modify: `app/page.tsx` to render the annotation console.
- Modify: `app/globals.css` to style the annotation workflow using the existing CogAR visual language.
- Modify: `app/layout.tsx` to update page metadata.
- Modify: `tests/rendered-html.test.mjs` to test the actual CogAR annotation app instead of the removed starter skeleton.
- Create: `tests/annotation-model.test.mjs` to exercise compiled helper behavior after build.

## Baseline Note

`npm test` currently builds successfully but fails because `tests/rendered-html.test.mjs` still expects the old starter loading skeleton and `app/_sites-preview/SkeletonPreview.tsx`, which no longer exist. Updating those tests is part of this implementation.

### Task 1: Annotation Helpers

**Files:**
- Create: `app/annotation-model.ts`
- Test: `tests/annotation-model.test.mjs`

- [ ] **Step 1: Write failing helper tests**

Create tests that import `dist/server/chunks/annotation-model*.js` after `npm run build` and verify:

```js
assert.equal(formatTimecode(0), "00:00");
assert.equal(formatTimecode(75.4), "01:15");
assert.equal(formatTimecode(3671), "1:01:11");

const normalized = normalizeSessionResponse({
  sessions: [{
    id: "s1",
    participantId: "P01",
    taskPlanId: "sandwich",
    recordedAt: "2026-08-04T14:00:00.000Z",
    sourceVrsName: "CogAR_Test1.vrs",
    rgbVideoUrl: "/recordings/s1/rgb.mp4",
    durationSeconds: 128,
    quality: { rgbCameraScore: 100, rgbFramesProcessed: 269, rgbFramesExpected: 269 }
  }]
});
assert.equal(normalized[0].id, "s1");

const upload = createUploadSession({
  fileName: "rgb-view.mp4",
  objectUrl: "blob:test",
  participantId: "P02",
  taskPlanId: "boba",
});
assert.equal(upload.source, "manual-upload");

assert.equal(isStepComplete({
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
  updatedAt: "2026-08-04T14:05:00.000Z",
}), true);

assert.throws(() => setStepEnd(annotationWithStart10, 9, "2026-08-04T14:05:00.000Z"), /End time/);

const rows = buildExportRows([completeAnnotation], session);
assert.deepEqual(Object.keys(rows[0]), [
  "session_id", "participant_id", "task_plan_id", "step_number", "step_name",
  "start_seconds", "start_timecode", "end_seconds", "end_timecode",
  "duration_seconds", "reliance_amount", "reliance_type", "confidence",
  "cognitive_state", "notes", "source_vrs_name", "rgb_video_url", "updated_at"
]);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run build && node --test tests/annotation-model.test.mjs`

Expected: FAIL because `app/annotation-model.ts` does not exist or exports are missing.

- [ ] **Step 3: Implement helpers**

Add exported types and functions:

```ts
export function formatTimecode(totalSeconds: number): string;
export function normalizeSessionResponse(payload: unknown): RecordingSession[];
export function createUploadSession(input: UploadSessionInput): RecordingSession;
export function createEmptyAnnotations(session, plan): Record<number, StepAnnotation>;
export function setStepStart(annotation, seconds, updatedAt): StepAnnotation;
export function setStepEnd(annotation, seconds, updatedAt): StepAnnotation;
export function isStepComplete(annotation): boolean;
export function buildExportRows(annotations, session): AnnotationExportRow[];
export function buildCsv(rows): string;
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run build && node --test tests/annotation-model.test.mjs`

Expected: PASS.

### Task 2: Task Plan Module

**Files:**
- Create: `app/task-plans.ts`
- Modify: `app/page.tsx`

- [ ] **Step 1: Move plan data**

Move the `PlanId`, `Task`, `Plan`, `InstructionOption`, `CueKind`, and `plans` definitions from `app/page.tsx` to `app/task-plans.ts`.

- [ ] **Step 2: Import plan data**

Update `app/page.tsx` to import the plan data. At this point, the page should still render the existing console.

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: exit 0.

### Task 3: Annotation Page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace live-control state with annotation state**

Use React state for active plan, participant ID, session query status, sessions, selected session, video time, annotations, and local draft hydration.

- [ ] **Step 2: Add session loading**

Implement `GET /api/sessions?participantId=<id>&taskPlanId=<plan>` query handling. On failure or empty results, show a concise status while keeping upload available.

- [ ] **Step 3: Add upload fallback**

Accept browser-playable video files, create object URLs with `URL.createObjectURL`, and select the resulting manual-upload session.

- [ ] **Step 4: Add RGB video workspace**

Render a `<video controls>` player, current timestamp, session metadata, and quality summary.

- [ ] **Step 5: Add annotation matrix**

For each selected task step, render start/end marking buttons, reliance amount `0-7`, confidence `0-7`, reliance type selector, cognitive-state selector, notes, and row completion state.

- [ ] **Step 6: Add local persistence and exports**

Persist selected workflow state in `localStorage`. Add JSON and CSV downloads using the helper module.

- [ ] **Step 7: Update metadata**

Set title and descriptions to "CogAR · Annotation Console".

- [ ] **Step 8: Verify build**

Run: `npm run build`

Expected: exit 0.

### Task 4: Styling

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace live matrix styling with annotation layout styling**

Keep existing variables and brand language, then add responsive styles for the session loader, video workspace, annotation rows, segmented options, numeric controls, and exports.

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: exit 0.

### Task 5: Rendered App Tests

**Files:**
- Modify: `tests/rendered-html.test.mjs`

- [ ] **Step 1: Replace stale starter assertions**

Assert that server-rendered HTML includes "CogAR", "Annotation Console", "Session loader", "RGB view", "Step annotations", "Export CSV", and no starter skeleton assertions.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: build exits 0 and all Node tests pass.

### Task 6: Final Verification

**Files:**
- All changed implementation and test files.

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: exit 0.

- [ ] **Step 3: Review diff**

Run: `git diff --stat && git diff --check`

Expected: no whitespace errors, and changed files match this plan.
