export type StepRange = {
  stepNumber: number;
  startIso: string;
  endIso: string;
  decisionTimestampIso?: string;
};

export type AnalysisStreamKey = "rgb" | "eye" | "gaze";

export type AnalysisVideoStream = {
  fileName: string;
  objectUrl: string;
};

type VrsTimingFiles = {
  vrsJson: string;
  rgbTimingCsv: string;
  eyeTimingCsv?: string;
};

const stepCompletionActions = new Set(["complete"]);

function parseIso(value: string) {
  const timestamp = Date.parse(value.trim());
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];
    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeParticipantId(participantId: string) {
  const numeric = Number(String(participantId).replace(/\D/g, ""));
  if (Number.isFinite(numeric) && numeric > 0) {
    return `P${String(numeric).padStart(2, "0")}`;
  }
  return participantId.trim().toUpperCase();
}

function parseCsvRows(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, cells[index]?.trim() ?? ""]),
    );
  });
}

function firstVrsDeviceTimeNs(csv: string) {
  const firstRow = parseCsvRows(csv)[0];
  const value = Number(firstRow?.vrs_device_time_ns);
  return Number.isFinite(value) ? value : null;
}

function timestampIsoFromUnixSeconds(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "";
  return new Date(seconds * 1000).toISOString();
}

export function secondsBetweenIso(baseIso: string, targetIso: string) {
  const base = parseIso(baseIso);
  const target = parseIso(targetIso);
  if (base === null || target === null) return null;
  return (target - base) / 1000;
}

export function isValidIsoRange(startIso: string, endIso: string) {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  return start !== null && end !== null && end > start;
}

export function deriveAnalysisStepRangesFromCsv(
  csv: string,
  options: { participantId: string; taskPlanId: string },
): StepRange[] {
  const targetParticipantId = normalizeParticipantId(options.participantId);
  const latestByStep = new Map<number, string>();
  let firstEventIso = "";

  for (const row of parseCsvRows(csv)) {
    const participantMatches =
      normalizeParticipantId(row.participant_id ?? "") === targetParticipantId;
    const planMatches = (row.plan_id ?? "").trim() === options.taskPlanId;
    const actionMatches = stepCompletionActions.has(
      (row.action ?? "").trim().toLowerCase(),
    );
    const stepNumber = Number(row.step);
    const timestampIso = row.event_timestamp_iso ?? "";
    const timestamp = parseIso(timestampIso);

    if (participantMatches && planMatches && timestamp !== null) {
      if (!firstEventIso || timestamp < (parseIso(firstEventIso) ?? Infinity)) {
        firstEventIso = new Date(timestamp).toISOString();
      }
    }

    if (
      !participantMatches ||
      !planMatches ||
      !actionMatches ||
      !Number.isInteger(stepNumber) ||
      stepNumber < 1 ||
      timestamp === null
    ) {
      continue;
    }

    const existing = latestByStep.get(stepNumber);
    if (!existing || timestamp >= (parseIso(existing) ?? 0)) {
      latestByStep.set(stepNumber, new Date(timestamp).toISOString());
    }
  }

  let previousEndIso = "";
  return Array.from(latestByStep.entries())
    .sort(([left], [right]) => left - right)
    .map(([stepNumber, decisionTimestampIso], index) => {
      const endIso = decisionTimestampIso;
      const startIso = index === 0 ? (firstEventIso || decisionTimestampIso) : previousEndIso;
      previousEndIso = endIso;
      return {
        stepNumber,
        startIso,
        endIso,
        decisionTimestampIso,
      };
    });
}

export function deriveStreamStartIsoFromVrsTimingFiles(files: VrsTimingFiles) {
  const parsed = JSON.parse(files.vrsJson) as { start_time?: unknown };
  const baseIso = timestampIsoFromUnixSeconds(parsed.start_time);
  if (!baseIso) {
    throw new Error("VRS JSON does not include a numeric start_time.");
  }

  const rgbFirstNs = firstVrsDeviceTimeNs(files.rgbTimingCsv);
  const eyeFirstNs = files.eyeTimingCsv
    ? firstVrsDeviceTimeNs(files.eyeTimingCsv)
    : null;
  const eyeOffsetMs =
    rgbFirstNs !== null && eyeFirstNs !== null
      ? Math.round((rgbFirstNs - eyeFirstNs) / 1_000_000)
      : 0;
  const baseMs = Date.parse(baseIso);

  return {
    rgb: baseIso,
    eye: new Date(baseMs - eyeOffsetMs).toISOString(),
    gaze: baseIso,
  };
}

export function replaceAnalysisVideoStream(
  streams: Record<AnalysisStreamKey, AnalysisVideoStream | null>,
  key: AnalysisStreamKey,
  nextStream: AnalysisVideoStream,
) {
  return {
    streams: {
      ...streams,
      [key]: nextStream,
    },
    replacedObjectUrl: streams[key]?.objectUrl ?? null,
  };
}
