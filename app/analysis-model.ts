export type StepRange = {
  stepNumber: number;
  startIso: string;
  endIso: string;
  decisionTimestampIso?: string;
};

export type HeartRateRow = {
  iso: string;
  bpm: number;
};

const timestampColumns = [
  "timestamp",
  "time",
  "iso",
  "datetime",
  "date_time",
  "created_at",
];
const bpmColumns = ["heart_rate", "heartrate", "hr", "bpm", "pulse"];
const aiDecisionActions = new Set(["ai accepted", "ai rejected"]);
const aiDecisionEndOffsetSeconds = 5;

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

function findColumn(headers: string[], candidates: string[]) {
  const normalized = headers.map((header) =>
    header.trim().toLowerCase().replace(/\s+/g, "_"),
  );
  return normalized.findIndex((header) => candidates.includes(header));
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

export function parseHeartRateCsv(csv: string): HeartRateRow[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const timestampIndex = findColumn(headers, timestampColumns);
  const bpmIndex = findColumn(headers, bpmColumns);
  if (timestampIndex === -1 || bpmIndex === -1) return [];

  return lines
    .slice(1)
    .map((line) => {
      const cells = parseCsvLine(line);
      const timestamp = parseIso(cells[timestampIndex] ?? "");
      const bpm = Number(cells[bpmIndex]);
      if (timestamp === null || !Number.isFinite(bpm)) return null;
      return { iso: new Date(timestamp).toISOString(), bpm };
    })
    .filter((row): row is HeartRateRow => row !== null);
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
    const actionMatches = aiDecisionActions.has(
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
      const endIso = new Date(
        Date.parse(decisionTimestampIso) + aiDecisionEndOffsetSeconds * 1000,
      ).toISOString();
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

export function filterHeartRateRows(
  rows: HeartRateRow[],
  startIso: string,
  endIso: string,
) {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  if (start === null || end === null || end < start) return [];
  return rows.filter((row) => {
    const timestamp = parseIso(row.iso);
    return timestamp !== null && timestamp >= start && timestamp <= end;
  });
}
