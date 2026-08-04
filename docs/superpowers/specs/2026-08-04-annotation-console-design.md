# CogAR Annotation Console Design

## Purpose

Build a post-task annotation platform for CogAR study recordings. After a participant finishes a real-world task while wearing Meta Project Aria glasses, the researcher can load the processed RGB-view recording, replay it, mark the beginning and end of each task step, and label the participant's reliance and cognitive state for that step.

This is a companion workflow to the existing Wizard-of-Oz control console. It should reuse the current warm research-console visual style, plan structure, and step language, but its primary mode is post-hoc video annotation rather than live instruction delivery.

## Scope

The first version includes:

- A session loader that can query backend-provided processed Project Aria sessions.
- A manual upload fallback for RGB video files when a backend session is unavailable.
- RGB video playback with current-time-based annotation controls.
- One annotation row per task step in the selected CogAR task plan.
- Per-step start and end timestamps.
- Per-step reliance amount, reliance type, confidence, and one cognitive or intentional state.
- Local draft persistence in the browser.
- CSV and JSON export of annotations.

The first version does not include:

- In-browser `.vrs` processing.
- Multi-reviewer adjudication.
- Dense frame-level or sub-step cognitive-state segmentation.
- Authentication or role management.
- Server-side annotation persistence, unless the backend contract is ready during implementation.

## Recording Pipeline Assumption

Meta Project Aria `.vrs` files are processed outside the browser. The processing pipeline extracts an RGB-view MP4 and session metadata. The web app works with those processed assets.

The current workspace already contains raw `.vrs` files and metadata JSON under `data/raw`, plus scripts that expect Project Aria CLI tools such as `vrs_to_mp4`. The annotation console should treat `sourceVrsName` and quality metadata as session context, but the annotator should interact with an ordinary browser-playable RGB video.

## Backend Contract

The initial backend API should be simple and replaceable.

### Query Sessions

`GET /api/sessions?participantId=<id>&taskPlanId=<plan>`

Returns:

```json
{
  "sessions": [
    {
      "id": "session-001",
      "participantId": "P01",
      "taskPlanId": "sandwich",
      "recordedAt": "2026-08-04T14:00:00.000Z",
      "sourceVrsName": "CogAR_Test1.vrs",
      "rgbVideoUrl": "/recordings/session-001/rgb.mp4",
      "durationSeconds": 128,
      "quality": {
        "rgbCameraScore": 100,
        "rgbFramesProcessed": 269,
        "rgbFramesExpected": 269
      }
    }
  ]
}
```

### Upload RGB Video

`POST /api/uploads`

Accepts a browser-uploaded RGB video and minimal metadata such as participant ID and task plan. Returns a session-like object with a usable `rgbVideoUrl`.

If no upload backend is available yet, the UI can support browser-local video preview with `URL.createObjectURL(file)` and mark the session source as `manual-upload`.

### Persist Annotations

`POST /api/annotations` is optional for the first implementation. The UI should keep annotation state in a shape that can be sent to this endpoint later without changing the controls.

## Annotation Data Model

Each annotation belongs to one session and one task step.

```ts
type PlanId = "sandwich" | "shelf" | "boba" | "table";

type CognitiveState =
  | "thinking-verifying-suggestion"
  | "deferring-thinking-for-later"
  | "thinking-about-new-action"
  | "waiting-for-suggestion"
  | "not-thinking"
  | "deferring-action-for-later"
  | "taking-actions"
  | "not-understand-or-forget-suggestion";

type RelianceType =
  | "appropriate-reliance"
  | "appropriate-rejection"
  | "overreliance"
  | "under-reliance";

type StepAnnotation = {
  sessionId: string;
  participantId: string;
  taskPlanId: PlanId;
  stepNumber: number;
  stepName: string;
  startSeconds?: number;
  endSeconds?: number;
  relianceAmount?: number;
  relianceType?: RelianceType;
  confidence?: number;
  cognitiveState?: CognitiveState;
  notes?: string;
  updatedAt: string;
};
```

Reliance amount and confidence are integers from `0` to `7`.

## Interface Design

The annotation console should preserve the existing CogAR identity: ivory background, dark ink typography, coral accents, blue action highlights, circular task marks, and structured research-console panels.

The page is organized into four zones:

1. Header: CogAR brand, session source status, save/export actions.
2. Session loader: participant ID field, task plan selector, backend query button, returned session list, and upload fallback.
3. Video workspace: RGB video player, current timestamp, playback controls, selected session metadata, and quality summary.
4. Annotation matrix: one row per task step with controls to set start/end from current video time, sliders or segmented controls for `0-7` values, reliance type buttons, cognitive-state selector, notes, and completion state.

The existing live Wizard-of-Oz audio controls should not dominate this workflow. Task-plan step names and cue text can remain useful context, but the annotator's primary actions are video playback and step labeling.

## Interaction Flow

1. Researcher selects a task plan.
2. Researcher enters or selects a participant ID.
3. Researcher queries backend sessions.
4. If sessions are returned, researcher selects one. If not, researcher uploads an RGB video.
5. The RGB video loads in the player.
6. Researcher scrubs or plays the video.
7. For each step, researcher clicks "mark start" and "mark end" using the current video time.
8. Researcher selects reliance amount, reliance type, confidence, and one cognitive state.
9. Draft state saves locally.
10. Researcher exports CSV/JSON or, later, saves to the backend.

## Export Fields

CSV and JSON exports use the same field names:

- `session_id`
- `participant_id`
- `task_plan_id`
- `step_number`
- `step_name`
- `start_seconds`
- `start_timecode`
- `end_seconds`
- `end_timecode`
- `duration_seconds`
- `reliance_amount`
- `reliance_type`
- `confidence`
- `cognitive_state`
- `notes`
- `source_vrs_name`
- `rgb_video_url`
- `updated_at`

## Validation and Error Handling

The UI should clearly handle:

- Backend query loading, empty results, and failed requests.
- Uploaded files that are not browser-playable videos.
- Missing video URLs.
- Incomplete annotation rows.
- End timestamps earlier than start timestamps.
- Export attempts with no selected session.

Rows should indicate completeness without blocking partial work. Export should include blank values for incomplete fields so researchers can continue analysis outside the tool.

## Testing Strategy

Use test-first development for behavior helpers before production changes.

Initial tests should cover:

- Formatting seconds as `MM:SS` and preserving numeric seconds in exports.
- Normalizing backend session responses into UI session records.
- Creating local upload session records from file metadata.
- Determining whether a step annotation is complete.
- Preventing an end timestamp earlier than the start timestamp.
- Producing CSV and JSON export rows with the agreed field names.

UI implementation can then consume these tested helpers. A build test should verify the app compiles after integration.

## Implementation Notes

The current app is concentrated in `app/page.tsx` and `app/globals.css`. During implementation, split annotation-specific constants and helpers into focused modules before adding large UI sections. This keeps the annotation data model, export logic, and UI controls understandable and testable.

The existing task plan definitions can be reused, but descriptions should be updated for annotation mode. Existing audio assets and live session controls should remain available only if they still serve the study workflow; otherwise, they should not be central to the annotation page.
