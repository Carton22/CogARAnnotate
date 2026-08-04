import type { Plan, PlanId } from "./task-plans";

export type CognitiveState =
  | "thinking-verifying-suggestion"
  | "deferring-thinking-for-later"
  | "thinking-about-new-action"
  | "waiting-for-suggestion"
  | "not-thinking"
  | "deferring-action-for-later"
  | "taking-actions"
  | "not-understand-or-forget-suggestion";

export type RelianceType =
  | "appropriate-reliance"
  | "appropriate-rejection"
  | "overreliance"
  | "under-reliance";

export type SessionQuality = {
  rgbCameraScore?: number;
  rgbFramesProcessed?: number;
  rgbFramesExpected?: number;
};

export type RecordingSession = {
  id: string;
  participantId: string;
  taskPlanId: PlanId;
  recordedAt: string;
  sourceVrsName: string;
  rgbVideoUrl: string;
  durationSeconds?: number;
  quality?: SessionQuality;
  source: "backend" | "manual-upload" | "draft";
};

export type UploadSessionInput = {
  fileName: string;
  objectUrl: string;
  participantId: string;
  taskPlanId: PlanId;
};

export type DraftSessionInput = {
  participantId: string;
  taskPlanId: PlanId;
};

export type StepAnnotation = {
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

export type AnnotationExportRow = {
  session_id: string;
  participant_id: string;
  task_plan_id: string;
  step_number: number;
  step_name: string;
  start_seconds: number | "";
  start_timecode: string;
  end_seconds: number | "";
  end_timecode: string;
  duration_seconds: number | "";
  reliance_amount: number | "";
  reliance_type: string;
  confidence: number | "";
  cognitive_state: string;
  notes: string;
  source_vrs_name: string;
  rgb_video_url: string;
  updated_at: string;
};

const exportFields: (keyof AnnotationExportRow)[] = [
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
  "reliance_type",
  "confidence",
  "cognitive_state",
  "notes",
  "source_vrs_name",
  "rgb_video_url",
  "updated_at",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function formatTimecode(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function normalizeSessionResponse(payload: unknown): RecordingSession[] {
  if (!isRecord(payload) || !Array.isArray(payload.sessions)) return [];

  return payload.sessions
    .filter(isRecord)
    .map((item) => {
      const quality = isRecord(item.quality) ? item.quality : {};
      return {
        id: stringValue(item.id),
        participantId: stringValue(item.participantId),
        taskPlanId: stringValue(item.taskPlanId, "sandwich") as PlanId,
        recordedAt: stringValue(item.recordedAt, new Date().toISOString()),
        sourceVrsName: stringValue(item.sourceVrsName),
        rgbVideoUrl: stringValue(item.rgbVideoUrl),
        durationSeconds: numberValue(item.durationSeconds),
        quality: {
          rgbCameraScore: numberValue(quality.rgbCameraScore),
          rgbFramesProcessed: numberValue(quality.rgbFramesProcessed),
          rgbFramesExpected: numberValue(quality.rgbFramesExpected),
        },
        source: "backend" as const,
      };
    })
    .filter((item) => item.id && item.rgbVideoUrl);
}

export function createUploadSession(
  input: UploadSessionInput,
): RecordingSession {
  return {
    id: `upload-${Date.now()}`,
    participantId: input.participantId,
    taskPlanId: input.taskPlanId,
    recordedAt: new Date().toISOString(),
    sourceVrsName: input.fileName,
    rgbVideoUrl: input.objectUrl,
    source: "manual-upload",
  };
}

export function createDraftSession(input: DraftSessionInput): RecordingSession {
  return {
    id: `draft-${input.participantId}-${input.taskPlanId}`,
    participantId: input.participantId,
    taskPlanId: input.taskPlanId,
    recordedAt: new Date().toISOString(),
    sourceVrsName: "No RGB recording loaded",
    rgbVideoUrl: "",
    source: "draft",
  };
}

export function createEmptyAnnotations(
  session: RecordingSession,
  plan: Plan,
): Record<number, StepAnnotation> {
  return Object.fromEntries(
    plan.tasks.map((task, index) => [
      index + 1,
      {
        sessionId: session.id,
        participantId: session.participantId,
        taskPlanId: plan.id,
        stepNumber: index + 1,
        stepName: task.name,
        notes: "",
        updatedAt: new Date().toISOString(),
      },
    ]),
  );
}

export function setStepStart(
  annotation: StepAnnotation,
  seconds: number,
  updatedAt: string,
): StepAnnotation {
  return {
    ...annotation,
    startSeconds: Math.max(0, Math.floor(seconds)),
    updatedAt,
  };
}

export function setStepEnd(
  annotation: StepAnnotation,
  seconds: number,
  updatedAt: string,
): StepAnnotation {
  const endSeconds = Math.max(0, Math.floor(seconds));
  if (
    typeof annotation.startSeconds === "number" &&
    endSeconds < annotation.startSeconds
  ) {
    throw new Error("End time cannot be earlier than start time.");
  }

  return {
    ...annotation,
    endSeconds,
    updatedAt,
  };
}

export function isStepComplete(annotation: StepAnnotation): boolean {
  return (
    typeof annotation.startSeconds === "number" &&
    typeof annotation.endSeconds === "number" &&
    typeof annotation.relianceAmount === "number" &&
    Boolean(annotation.relianceType) &&
    typeof annotation.confidence === "number" &&
    Boolean(annotation.cognitiveState)
  );
}

export function buildExportRows(
  annotations: StepAnnotation[],
  session: RecordingSession,
): AnnotationExportRow[] {
  return annotations.map((annotation) => {
    const hasStart = typeof annotation.startSeconds === "number";
    const hasEnd = typeof annotation.endSeconds === "number";
    const duration =
      hasStart && hasEnd
        ? Math.max(0, annotation.endSeconds! - annotation.startSeconds!)
        : "";

    return {
      session_id: annotation.sessionId,
      participant_id: annotation.participantId,
      task_plan_id: annotation.taskPlanId,
      step_number: annotation.stepNumber,
      step_name: annotation.stepName,
      start_seconds: hasStart ? annotation.startSeconds! : "",
      start_timecode: hasStart ? formatTimecode(annotation.startSeconds!) : "",
      end_seconds: hasEnd ? annotation.endSeconds! : "",
      end_timecode: hasEnd ? formatTimecode(annotation.endSeconds!) : "",
      duration_seconds: duration,
      reliance_amount:
        typeof annotation.relianceAmount === "number"
          ? annotation.relianceAmount
          : "",
      reliance_type: annotation.relianceType ?? "",
      confidence:
        typeof annotation.confidence === "number" ? annotation.confidence : "",
      cognitive_state: annotation.cognitiveState ?? "",
      notes: annotation.notes ?? "",
      source_vrs_name: session.sourceVrsName,
      rgb_video_url: session.rgbVideoUrl,
      updated_at: annotation.updatedAt,
    };
  });
}

export function buildCsv(rows: AnnotationExportRow[]): string {
  return [
    exportFields,
    ...rows.map((row) => exportFields.map((field) => row[field])),
  ]
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
}
