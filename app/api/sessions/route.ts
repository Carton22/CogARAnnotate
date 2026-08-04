type RouteSession = {
  id: string;
  participantId: string;
  taskPlanId: string;
  recordedAt: string;
  sourceVrsName: string;
  rgbVideoUrl: string;
  durationSeconds?: number;
  quality?: {
    rgbCameraScore?: number;
    rgbFramesProcessed?: number;
    rgbFramesExpected?: number;
  };
  source: "backend";
};

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

function normalizeRouteSessions(value: unknown): RouteSession[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => {
      const quality = isRecord(item.quality) ? item.quality : {};
      return {
        id: stringValue(item.id),
        participantId: stringValue(item.participantId),
        taskPlanId: stringValue(item.taskPlanId),
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
    .filter((session) => session.id && session.rgbVideoUrl);
}

function readConfiguredSessions() {
  const raw = process.env.COGAR_SESSIONS_JSON;
  if (!raw) return [];

  try {
    return normalizeRouteSessions(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const participantId = url.searchParams.get("participantId")?.trim() ?? "";
  const taskPlanId = url.searchParams.get("taskPlanId")?.trim() ?? "";

  if (!participantId) {
    return Response.json(
      { error: "participantId is required", sessions: [] },
      { status: 400 },
    );
  }

  const sessions = readConfiguredSessions().filter((session) => {
    const participantMatches = session.participantId === participantId;
    const planMatches = taskPlanId ? session.taskPlanId === taskPlanId : true;
    return participantMatches && planMatches;
  });

  return Response.json({ sessions });
}
