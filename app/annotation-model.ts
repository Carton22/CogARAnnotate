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

export const cognitiveStateValues: CognitiveState[] = [
  "thinking-verifying-suggestion",
  "deferring-thinking-for-later",
  "thinking-about-new-action",
  "waiting-for-suggestion",
  "not-thinking",
  "deferring-action-for-later",
  "taking-actions",
  "not-understand-or-forget-suggestion",
];

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
  cognitiveEngagement?: number;
  taskPlanningEngagement?: number;
  cognitiveStateOrder?: CognitiveState[];
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
  confidence: number | "";
  cognitive_engagement: number | "";
  task_planning_engagement: number | "";
  cognitive_state: string;
  notes: string;
  source_vrs_name: string;
  rgb_video_url: string;
  updated_at: string;
};

export type StepTimingRange = {
  stepNumber: number;
  stepName: string;
  startSeconds: number;
  endSeconds: number;
  endTimestampIso: string;
};

export type StepTimingImportOptions = {
  participantId: string;
  taskPlanId: PlanId;
  videoStartIso: string;
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
  "confidence",
  "cognitive_engagement",
  "task_planning_engagement",
  "cognitive_state",
  "notes",
  "source_vrs_name",
  "rgb_video_url",
  "updated_at",
];

const quickTimeEpochOffsetSeconds = 2082844800;
const stepCompletionActions = new Set(["complete"]);

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let value = seed || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomizeCognitiveStatesForStep(
  participantId: string,
  taskPlanId: string,
  stepNumber: number,
): CognitiveState[] {
  const random = seededRandom(
    hashString(`${participantId.trim()}:${taskPlanId}:${stepNumber}`),
  );
  const states = [...cognitiveStateValues];
  for (let index = states.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [states[index], states[swapIndex]] = [states[swapIndex], states[index]];
  }
  return states;
}

export function cognitiveStateOrderFromAnnotation(
  annotation: Pick<StepAnnotation, "cognitiveState" | "cognitiveStateOrder">,
): CognitiveState[] {
  if (Array.isArray(annotation.cognitiveStateOrder)) {
    return annotation.cognitiveStateOrder.filter((state) =>
      cognitiveStateValues.includes(state),
    );
  }
  return annotation.cognitiveState ? [annotation.cognitiveState] : [];
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

function parseCsvRows(csv: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (quoted) {
      if (character === '"' && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows.filter((values) =>
    values.some((value) => value.trim()),
  );
  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index]?.trim() ?? ""])),
  );
}

function normalizeParticipantId(participantId: string): string {
  const numeric = Number(String(participantId).replace(/\D/g, ""));
  if (Number.isFinite(numeric) && numeric > 0) {
    return `P${String(numeric).padStart(2, "0")}`;
  }
  return participantId.trim().toUpperCase();
}

function secondsBetween(startIso: string, endIso: string): number {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error("Imported timing data includes an invalid ISO timestamp.");
  }
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

export function deriveStepTimingRangesFromCsv(
  csv: string,
  options: StepTimingImportOptions,
): StepTimingRange[] {
  const videoStartMs = Date.parse(options.videoStartIso);
  if (!Number.isFinite(videoStartMs)) {
    throw new Error("Video start time must be a valid ISO timestamp.");
  }

  const targetParticipantId = normalizeParticipantId(options.participantId);
  const latestByStep = new Map<number, { stepName: string; timestampIso: string }>();

  for (const row of parseCsvRows(csv)) {
    const participantMatches =
      normalizeParticipantId(row.participant_id ?? "") === targetParticipantId;
    const planMatches = (row.plan_id ?? "").trim() === options.taskPlanId;
    const actionMatches = stepCompletionActions.has(
      (row.action ?? "").trim().toLowerCase(),
    );
    const stepNumber = Number(row.step);
    const timestampIso = row.event_timestamp_iso ?? "";

    if (
      !participantMatches ||
      !planMatches ||
      !actionMatches ||
      !Number.isInteger(stepNumber) ||
      stepNumber < 1 ||
      !timestampIso
    ) {
      continue;
    }

    const existing = latestByStep.get(stepNumber);
    if (!existing || Date.parse(timestampIso) >= Date.parse(existing.timestampIso)) {
      latestByStep.set(stepNumber, {
        stepName: row.step_name ?? "",
        timestampIso,
      });
    }
  }

  let previousEndIso = options.videoStartIso;
  return Array.from(latestByStep.entries())
    .sort(([left], [right]) => left - right)
    .map(([stepNumber, timing]) => {
      const range = {
        stepNumber,
        stepName: timing.stepName,
        startSeconds: secondsBetween(options.videoStartIso, previousEndIso),
        endSeconds: secondsBetween(options.videoStartIso, timing.timestampIso),
        endTimestampIso: timing.timestampIso,
      };
      previousEndIso = timing.timestampIso;
      return range;
    });
}

export function applyStepTimingRanges(
  annotations: Record<number, StepAnnotation>,
  ranges: StepTimingRange[],
  updatedAt: string,
): Record<number, StepAnnotation> {
  return ranges.reduce(
    (currentAnnotations, range) => {
      const annotation = currentAnnotations[range.stepNumber];
      if (!annotation) return currentAnnotations;
      return {
        ...currentAnnotations,
        [range.stepNumber]: {
          ...annotation,
          startSeconds: range.startSeconds,
          endSeconds: Math.max(range.startSeconds, range.endSeconds),
          updatedAt,
        },
      };
    },
    { ...annotations },
  );
}

export function extractQuickTimeStartIso(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  for (let offset = 0; offset <= bytes.length - 16; offset += 1) {
    const atomType = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    if (atomType !== "mvhd") continue;

    const version = view.getUint8(offset + 8);
    const creationSeconds =
      version === 1
        ? Number(view.getBigUint64(offset + 12))
        : view.getUint32(offset + 12);
    const unixSeconds = creationSeconds - quickTimeEpochOffsetSeconds;
    if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return null;

    return new Date(unixSeconds * 1000).toISOString();
  }

  return null;
}

export function isStepComplete(annotation: StepAnnotation): boolean {
  return (
    typeof annotation.startSeconds === "number" &&
    typeof annotation.endSeconds === "number" &&
    typeof annotation.relianceAmount === "number" &&
    typeof annotation.confidence === "number" &&
    typeof annotation.cognitiveEngagement === "number" &&
    typeof annotation.taskPlanningEngagement === "number"
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
      confidence:
        typeof annotation.confidence === "number" ? annotation.confidence : "",
      cognitive_engagement:
        typeof annotation.cognitiveEngagement === "number"
          ? annotation.cognitiveEngagement
          : "",
      task_planning_engagement:
        typeof annotation.taskPlanningEngagement === "number"
          ? annotation.taskPlanningEngagement
          : "",
      cognitive_state: cognitiveStateOrderFromAnnotation(annotation).join(" > "),
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
