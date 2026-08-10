"use client";

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  deriveAnalysisStepRangesFromCsv,
  filterHeartRateRows,
  isValidIsoRange,
  parseHeartRateCsv,
  secondsBetweenIso,
  type HeartRateRow,
  type StepRange,
} from "../analysis-model";
import { formatTimecode } from "../annotation-model";
import { planForParticipant, plans, type PlanId } from "../task-plans";

type StreamKey = "rgb" | "eye" | "gaze";
type AnalysisPlanId = Exclude<PlanId, "training">;

type VideoStream = {
  fileName: string;
  objectUrl: string;
};

type AnalysisState = {
  activePlanId: PlanId;
  participantId: string;
  streamStartIso?: Record<StreamKey, string>;
  rangesByPlan: Record<string, Record<number, StepRange>>;
  timingFileName?: string;
};

const STORAGE_KEY = "cogar-analysis-platform-v1";
const analysisPlans = plans.filter(
  (plan): plan is (typeof plans)[number] & { id: AnalysisPlanId } =>
    plan.id !== "training",
);

const streamLabels: Record<StreamKey, string> = {
  rgb: "RGB third-person view",
  eye: "Eye camera view",
  gaze: "Estimated eye gaze view",
};

function emptyStreamStartIso(): Record<StreamKey, string> {
  return { rgb: "", eye: "", gaze: "" };
}

function storageKeyFor(planId: PlanId, participantId: string) {
  return `${participantId}:${planId}`;
}

function useObjectUrlCleanup(streams: Record<StreamKey, VideoStream | null>) {
  const streamsRef = useRef(streams);
  streamsRef.current = streams;
  useEffect(() => {
    return () => {
      Object.values(streamsRef.current).forEach((stream) => {
        if (stream) URL.revokeObjectURL(stream.objectUrl);
      });
    };
  }, []);
}

export default function AnalysisPage() {
  const [activePlanId, setActivePlanId] = useState<AnalysisPlanId>("shelf");
  const [participantId, setParticipantId] = useState("P01");
  const [hydrated, setHydrated] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Upload synchronized streams and import the AI timing CSV.",
  );
  const [streams, setStreams] = useState<Record<StreamKey, VideoStream | null>>({
    rgb: null,
    eye: null,
    gaze: null,
  });
  const [streamStartIso, setStreamStartIso] =
    useState<Record<StreamKey, string>>(emptyStreamStartIso);
  const [heartRows, setHeartRows] = useState<HeartRateRow[]>([]);
  const [heartFileName, setHeartFileName] = useState("");
  const [timingFileName, setTimingFileName] = useState("");
  const [rangesByPlan, setRangesByPlan] = useState<
    Record<string, Record<number, StepRange>>
  >({});
  const [activeStepNumber, setActiveStepNumber] = useState<number | null>(null);
  const [segmentEndByStream, setSegmentEndByStream] = useState<
    Record<StreamKey, number | null>
  >({ rgb: null, eye: null, gaze: null });
  const videoRefs = {
    rgb: useRef<HTMLVideoElement | null>(null),
    eye: useRef<HTMLVideoElement | null>(null),
    gaze: useRef<HTMLVideoElement | null>(null),
  };
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useObjectUrlCleanup(streams);

  const activePlan = planForParticipant(activePlanId, participantId);
  const rangeKey = storageKeyFor(activePlanId, participantId);
  const ranges = rangesByPlan[rangeKey] ?? {};
  const activeRange = activeStepNumber ? ranges[activeStepNumber] : undefined;
  const activeHeartRows =
    activeRange && isValidIsoRange(activeRange.startIso, activeRange.endIso)
      ? filterHeartRateRows(heartRows, activeRange.startIso, activeRange.endIso)
      : [];

  const readySteps = useMemo(
    () =>
      activePlan.tasks.filter((_, index) => {
        const range = ranges[index + 1];
        return range && isValidIsoRange(range.startIso, range.endIso);
      }).length,
    [activePlan.tasks, ranges],
  );

  useEffect(() => {
    queueMicrotask(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as AnalysisState;
          const savedPlanId =
            parsed.activePlanId && parsed.activePlanId !== "training"
              ? parsed.activePlanId
              : "shelf";
          setActivePlanId(savedPlanId);
          setParticipantId(parsed.participantId ?? "P01");
          setStreamStartIso({
            ...emptyStreamStartIso(),
            ...(parsed.streamStartIso ?? {}),
          });
          setRangesByPlan(parsed.rangesByPlan ?? {});
          setTimingFileName(parsed.timingFileName ?? "");
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activePlanId,
        participantId,
        streamStartIso,
        rangesByPlan,
        timingFileName,
      }),
    );
  }, [
    activePlanId,
    hydrated,
    participantId,
    rangesByPlan,
    streamStartIso,
    timingFileName,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#fffdf9";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#eadfd3";
    context.lineWidth = 1;
    for (let line = 1; line < 4; line += 1) {
      const y = (height / 4) * line;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    if (activeHeartRows.length === 0) {
      context.fillStyle = "#73808d";
      context.font = "16px Arial";
      context.fillText("No heart-rate samples in this step", 30, height / 2);
      return;
    }

    const minBpm = Math.min(...activeHeartRows.map((row) => row.bpm));
    const maxBpm = Math.max(...activeHeartRows.map((row) => row.bpm));
    const minTime = Date.parse(activeHeartRows[0].iso);
    const maxTime = Date.parse(activeHeartRows[activeHeartRows.length - 1].iso);
    const bpmSpread = Math.max(1, maxBpm - minBpm);
    const timeSpread = Math.max(1, maxTime - minTime);

    context.strokeStyle = "#f06449";
    context.lineWidth = 3;
    context.beginPath();
    activeHeartRows.forEach((row, index) => {
      const x = 20 + ((Date.parse(row.iso) - minTime) / timeSpread) * (width - 40);
      const y = height - 24 - ((row.bpm - minBpm) / bpmSpread) * (height - 48);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.fillStyle = "#172638";
    context.font = "14px Arial";
    context.fillText(`${Math.round(minBpm)}-${Math.round(maxBpm)} bpm`, 20, 24);
  }, [activeHeartRows]);

  const handleTimingUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const stepRanges = deriveAnalysisStepRangesFromCsv(String(reader.result ?? ""), {
        participantId,
        taskPlanId: activePlan.id,
      });
      if (stepRanges.length === 0) {
        setStatusMessage("No matching AI accepted or rejected rows found for this participant and plan.");
        return;
      }
      setRangesByPlan((current) => ({
        ...current,
        [rangeKey]: Object.fromEntries(
          stepRanges.map((range) => [range.stepNumber, range]),
        ),
      }));
      setTimingFileName(file.name);
      setActiveStepNumber(null);
      setStatusMessage(`Imported ${stepRanges.length} step segments from ${file.name}.`);
    };
    reader.onerror = () => setStatusMessage("Could not read the AI timing CSV.");
    reader.readAsText(file);
  };

  const handleVideoUpload =
    (key: StreamKey) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("video/")) {
        setStatusMessage(`Choose a browser-playable video for ${streamLabels[key]}.`);
        return;
      }
      setStreams((current) => {
        if (current[key]) URL.revokeObjectURL(current[key].objectUrl);
        return {
          ...current,
          [key]: {
            fileName: file.name,
            objectUrl: URL.createObjectURL(file),
          },
        };
      });
      setStatusMessage(`${streamLabels[key]} loaded.`);
    };

  const handleHeartUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseHeartRateCsv(String(reader.result ?? ""));
      setHeartRows(rows);
      setHeartFileName(file.name);
      setStatusMessage(
        rows.length > 0
          ? `Loaded ${rows.length} heart-rate samples.`
          : "No timestamp and bpm columns were found in the heart-rate CSV.",
      );
    };
    reader.onerror = () => setStatusMessage("Could not read the heart-rate CSV.");
    reader.readAsText(file);
  };

  const playStep = (stepNumber: number) => {
    const range = ranges[stepNumber];
    if (!range || !isValidIsoRange(range.startIso, range.endIso)) {
      setStatusMessage("Import a matching AI timing CSV before playing this step.");
      return;
    }

    const nextEnds: Record<StreamKey, number | null> = {
      rgb: null,
      eye: null,
      gaze: null,
    };
    const skippedStreams: string[] = [];
    (Object.keys(streamLabels) as StreamKey[]).forEach((key) => {
      const video = videoRefs[key].current;
      const sourceStartIso = streamStartIso[key].trim();
      const streamOffset = secondsBetweenIso(sourceStartIso, range.startIso);
      const streamEnd = secondsBetweenIso(sourceStartIso, range.endIso);
      if (!video) return;
      if (!sourceStartIso || streamOffset === null || streamEnd === null) {
        skippedStreams.push(streamLabels[key]);
        return;
      }
      video.currentTime = Math.max(0, streamOffset);
      nextEnds[key] = Math.max(0, streamEnd);
      video.play().catch(() => {
        setStatusMessage("Playback was blocked. Use the video controls once, then play the step again.");
      });
    });
    setSegmentEndByStream(nextEnds);
    setActiveStepNumber(stepNumber);
    setStatusMessage(
      skippedStreams.length > 0
        ? `Playing step ${String(stepNumber).padStart(2, "0")}; add ISO start for ${skippedStreams.join(", ")}.`
        : `Playing step ${String(stepNumber).padStart(2, "0")} across available views.`,
    );
  };

  const stopAtSegmentEnd = (key: StreamKey) => {
    const video = videoRefs[key].current;
    const end = segmentEndByStream[key];
    if (!video || end === null) return;
    if (video.currentTime >= end) {
      video.pause();
      setSegmentEndByStream((current) => ({ ...current, [key]: null }));
    }
  };

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            C
          </div>
          <div>
            <p className="eyebrow">ANALYSIS PLATFORM</p>
            <h1>
              Cog<span>AR</span>
            </h1>
          </div>
        </div>
        <div className="session-tools">
          <label className="participant-control">
            <span>Participant ID</span>
            <select
              value={participantId}
              onChange={(event) => setParticipantId(event.target.value)}
            >
              {Array.from({ length: 36 }, (_, index) => {
                const id = `P${String(index + 1).padStart(2, "0")}`;
                return (
                  <option value={id} key={id}>
                    Participant {String(index + 1).padStart(2, "0")}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="timer">
            <small>READY STEPS</small>
            <strong>
              {readySteps}/{activePlan.tasks.length}
            </strong>
          </div>
        </div>
      </header>

      <nav className="plan-tabs analysis-plan-tabs" aria-label="Task plans">
        {analysisPlans.map((plan) => (
          <button
            className={plan.id === activePlanId ? "is-active" : ""}
            key={plan.id}
            type="button"
            onClick={() => setActivePlanId(plan.id)}
          >
            <span>{plan.code}</span>
            {plan.title}
          </button>
        ))}
        <p>{activePlan.code} / {String(analysisPlans.findIndex((plan) => plan.id === activePlan.id) + 1).padStart(2, "0")}</p>
      </nav>

      <section className="analysis-intro">
        <div className="plan-heading">
          <div className="plan-code">{activePlan.code}</div>
          <div>
            <p className="eyebrow">{activePlan.eyebrow.replace("POST-TASK ANNOTATION", "SEGMENT ANALYSIS")}</p>
            <h2>Analysis Console</h2>
            <p className="intro-copy">
              Segment the existing task plan with ISO timestamps and review only
              the matching interval across RGB, eye camera, gaze, and heart rate.
            </p>
          </div>
        </div>
        <div className="analysis-status">{statusMessage}</div>
      </section>

      <section className="analysis-loader">
        <div className="analysis-source analysis-source-wide">
          <label className="upload-button">
            Import AI timing CSV
            <input accept=".csv,text/csv" type="file" onChange={handleTimingUpload} />
          </label>
          <div>
            <strong>Step segments</strong>
            <span>{timingFileName || "No timing CSV imported"}</span>
          </div>
        </div>
      </section>

      <section className="analysis-grid">
        {(Object.keys(streamLabels) as StreamKey[]).map((key) => (
          <article className="analysis-view" key={key}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{key.toUpperCase()} VIEW</p>
                <h3>{streamLabels[key]}</h3>
                <span className="analysis-file-name">
                  {streams[key]?.fileName ?? "No video loaded"}
                </span>
                <label className="analysis-stream-start">
                  <span>ISO start timestamp</span>
                  <input
                    value={streamStartIso[key]}
                    onChange={(event) =>
                      setStreamStartIso((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder="2026-08-06T21:44:44.274Z"
                  />
                </label>
              </div>
              <div className="analysis-view-tools">
                <strong>{segmentEndByStream[key] ? formatTimecode(segmentEndByStream[key] ?? 0) : "--:--"}</strong>
                <label className="upload-button analysis-upload-button">
                  Upload
                  <input accept="video/*" type="file" onChange={handleVideoUpload(key)} />
                </label>
              </div>
            </div>
            {streams[key] ? (
              <video
                controls
                onTimeUpdate={() => stopAtSegmentEnd(key)}
                ref={videoRefs[key]}
                src={streams[key]?.objectUrl}
              />
            ) : (
              <div className="analysis-empty">Upload this view to include it in step playback.</div>
            )}
          </article>
        ))}
        <article className="analysis-view">
          <div className="section-heading">
            <div>
              <p className="eyebrow">HEART RATE</p>
              <h3>{activeHeartRows.length} samples in active step</h3>
              <span className="analysis-file-name">
                {heartFileName || "No CSV loaded"}
              </span>
            </div>
            <div className="analysis-view-tools">
              <strong>{activeHeartRows.at(-1)?.bpm ? `${Math.round(activeHeartRows.at(-1)?.bpm ?? 0)}` : "--"}</strong>
              <label className="upload-button analysis-upload-button">
                Upload CSV
                <input accept=".csv,text/csv" type="file" onChange={handleHeartUpload} />
              </label>
            </div>
          </div>
          <canvas ref={canvasRef} width="720" height="360" />
        </article>
      </section>

      <section className="analysis-steps">
        <div className="annotation-card">
          <div className="annotation-card-header">
            <div>
              <p className="eyebrow">{activePlan.annotationTitle}</p>
              <h3>Step segments</h3>
            </div>
            <strong>{readySteps}/{activePlan.tasks.length}</strong>
          </div>
          {activePlan.tasks.map((task, index) => {
            const stepNumber = index + 1;
            const range = ranges[stepNumber] ?? {
              stepNumber,
              startIso: "",
              endIso: "",
            };
            const ready = isValidIsoRange(range.startIso, range.endIso);
            return (
              <div
                className={`analysis-step-row ${activeStepNumber === stepNumber ? "is-active" : ""}`}
                key={`${task.name}-${stepNumber}`}
              >
                <div className="step-index">{String(stepNumber).padStart(2, "0")}</div>
                <div className="analysis-step-name">
                  <strong>{task.name}</strong>
                  <span>{task.mainKind === "correct" ? "Plan step" : "Distractor step"}</span>
                </div>
                <div className="analysis-range-readout">
                  <span>Segment start</span>
                  <strong>{range.startIso ? new Date(range.startIso).toLocaleTimeString() : "Waiting for CSV"}</strong>
                </div>
                <div className="analysis-range-readout">
                  <span>Segment end</span>
                  <strong>{range.endIso ? new Date(range.endIso).toLocaleTimeString() : "Waiting for CSV"}</strong>
                </div>
                <button
                  className="task-start-button"
                  disabled={!ready}
                  type="button"
                  onClick={() => playStep(stepNumber)}
                >
                  Play step
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
