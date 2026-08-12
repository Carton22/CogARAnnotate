"use client";

import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  deriveAnalysisStepRangesFromCsv,
  deriveStreamStartIsoFromVrsTimingFiles,
  isValidIsoRange,
  replaceAnalysisVideoStream,
  secondsBetweenIso,
  type AnalysisStreamKey,
  type AnalysisVideoStream,
  type StepRange,
} from "../analysis-model";
import { formatTimecode } from "../annotation-model";
import { planForParticipant, plans, type PlanId } from "../task-plans";

type StreamKey = AnalysisStreamKey;
type AnalysisPlanId = Exclude<PlanId, "training">;

type VideoStream = AnalysisVideoStream;
type StreamLoadStatus = {
  state: "idle" | "loading" | "ready" | "error";
  message: string;
};

type AnalysisState = {
  activePlanId: PlanId;
  participantId: string;
  streamStartIso?: Record<StreamKey, string>;
  rangesByPlan: Record<string, Record<number, StepRange>>;
  timingFileName?: string;
  vrsTimingFileName?: string;
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

const mediaErrorMessages: Record<number, string> = {
  1: "Video loading was aborted.",
  2: "The browser lost access to this video while loading it.",
  3: "The browser cannot decode this video. Export it as H.264 MP4, then upload again.",
  4: "This video format is not supported by the browser. Export it as H.264 MP4, then upload again.",
};

function emptyStreamStartIso(): Record<StreamKey, string> {
  return { rgb: "", eye: "", gaze: "" };
}

function emptyStreamStatus(): Record<StreamKey, StreamLoadStatus> {
  return {
    rgb: { state: "idle", message: "" },
    eye: { state: "idle", message: "" },
    gaze: { state: "idle", message: "" },
  };
}

function storageKeyFor(planId: PlanId, participantId: string) {
  return `${participantId}:${planId}`;
}

function useObjectUrlCleanup(streams: Record<StreamKey, VideoStream | null>) {
  const streamsRef = useRef(streams);
  useEffect(() => {
    streamsRef.current = streams;
  }, [streams]);
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
  const [streamStatus, setStreamStatus] =
    useState<Record<StreamKey, StreamLoadStatus>>(emptyStreamStatus);
  const [streamStartIso, setStreamStartIso] =
    useState<Record<StreamKey, string>>(emptyStreamStartIso);
  const [timingFileName, setTimingFileName] = useState("");
  const [vrsTimingFileName, setVrsTimingFileName] = useState("");
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

  useObjectUrlCleanup(streams);

  const activePlan = planForParticipant(activePlanId, participantId);
  const rangeKey = storageKeyFor(activePlanId, participantId);
  const ranges = rangesByPlan[rangeKey] ?? {};

  const readySteps = activePlan.tasks.filter((_, index) => {
    const range = ranges[index + 1];
    return range && isValidIsoRange(range.startIso, range.endIso);
  }).length;

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
          setVrsTimingFileName(parsed.vrsTimingFileName ?? "");
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
        vrsTimingFileName,
      }),
    );
  }, [
    activePlanId,
    hydrated,
    participantId,
    rangesByPlan,
    streamStartIso,
    timingFileName,
    vrsTimingFileName,
  ]);

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

  const handleVrsTimingUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    Promise.all(
      files.map(async (file) => ({
        fileName: file.name,
        content: await file.text(),
      })),
    )
      .then((loadedFiles) => {
        const vrsJson = loadedFiles.find((file) =>
          file.fileName.toLowerCase().endsWith(".vrs.json"),
        );
        const rgbTimingCsv = loadedFiles.find(
          (file) => file.fileName.toLowerCase() === "mp4_to_vrs_time_ns.csv",
        );
        const eyeTimingCsv = loadedFiles.find(
          (file) =>
            file.fileName.toLowerCase() === "eye_camera_mp4_to_vrs_time_ns.csv",
        );

        if (!vrsJson || !rgbTimingCsv) {
          setStatusMessage(
            "Choose the .vrs.json file plus mp4_to_vrs_time_ns.csv to auto-fill stream starts.",
          );
          return;
        }

        const inferredStarts = deriveStreamStartIsoFromVrsTimingFiles({
          vrsJson: vrsJson.content,
          rgbTimingCsv: rgbTimingCsv.content,
          eyeTimingCsv: eyeTimingCsv?.content,
        });
        setStreamStartIso(inferredStarts);
        setVrsTimingFileName(
          `${vrsJson.fileName}, ${rgbTimingCsv.fileName}${eyeTimingCsv ? `, ${eyeTimingCsv.fileName}` : ""}`,
        );
        setStatusMessage(
          eyeTimingCsv
            ? "Auto-filled RGB, eye, and gaze ISO starts from VRS timing files."
            : "Auto-filled RGB and gaze ISO starts from VRS timing files; eye uses the same start.",
        );
      })
      .catch(() => {
        setStatusMessage("Could not read the selected VRS timing files.");
      });
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
      const nextStream = {
        fileName: file.name,
        objectUrl: URL.createObjectURL(file),
      };
      let replacedObjectUrl: string | null = null;
      setStreams((current) => {
        const replacement = replaceAnalysisVideoStream(current, key, nextStream);
        replacedObjectUrl = replacement.replacedObjectUrl;
        return replacement.streams;
      });
      setStreamStatus((current) => ({
        ...current,
        [key]: { state: "loading", message: "Loading video metadata..." },
      }));
      if (replacedObjectUrl) URL.revokeObjectURL(replacedObjectUrl);
      setStatusMessage(`${streamLabels[key]} loaded.`);
    };

  const handleVideoMetadataLoaded = (key: StreamKey) => {
    const video = videoRefs[key].current;
    const dimensions =
      video && video.videoWidth > 0 && video.videoHeight > 0
        ? `${video.videoWidth} x ${video.videoHeight}`
        : "metadata";
    setStreamStatus((current) => ({
      ...current,
      [key]: { state: "ready", message: `${dimensions} ready.` },
    }));
  };

  const handleVideoError = (key: StreamKey) => {
    const video = videoRefs[key].current;
    const code = video?.error?.code ?? 0;
    const message =
      mediaErrorMessages[code] ??
      "This video could not be loaded. Export it as H.264 MP4, then upload again.";
    setStreamStatus((current) => ({
      ...current,
      [key]: { state: "error", message },
    }));
    setStatusMessage(`${streamLabels[key]} could not load. ${message}`);
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
              the matching interval across RGB, eye camera, and gaze.
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
        <div className="analysis-source analysis-source-wide">
          <label className="upload-button">
            Import VRS timing files
            <input
              multiple
              accept=".json,.csv,application/json,text/csv"
              type="file"
              onChange={handleVrsTimingUpload}
            />
          </label>
          <div>
            <strong>Auto-fill stream starts</strong>
            <span>{vrsTimingFileName || "No VRS timing files imported"}</span>
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
              <div className="analysis-video-shell">
                <video
                  controls
                  key={streams[key]?.objectUrl}
                  onError={() => handleVideoError(key)}
                  onLoadedMetadata={() => handleVideoMetadataLoaded(key)}
                  onTimeUpdate={() => stopAtSegmentEnd(key)}
                  preload="metadata"
                  ref={videoRefs[key]}
                  src={streams[key]?.objectUrl}
                />
                {streamStatus[key].state === "error" ? (
                  <div className="analysis-video-message" role="status">
                    {streamStatus[key].message}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="analysis-empty">Upload this view to include it in step playback.</div>
            )}
          </article>
        ))}
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
