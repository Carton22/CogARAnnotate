"use client";

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildCsv,
  buildExportRows,
  createDraftSession,
  createEmptyAnnotations,
  createUploadSession,
  formatTimecode,
  isStepComplete,
  normalizeDeviceSessionResponse,
  normalizeSessionResponse,
  setStepEnd,
  setStepStart,
  type CognitiveState,
  type DeviceRecording,
  type RecordingSession,
  type RelianceType,
  type StepAnnotation,
} from "./annotation-model";
import { planForParticipant, plans, type PlanId } from "./task-plans";

// v2 clears pre-randomization drafts whose fixed Boba/Shelf step names would
// otherwise override the participant-specific sequence.
const STORAGE_KEY = "cogar-annotation-console-v2";
const DEFAULT_SESSIONS_ENDPOINT =
  process.env.NEXT_PUBLIC_COGAR_SESSIONS_ENDPOINT ??
  "http://localhost:8765/api/sessions";

const relianceTypes: { value: RelianceType; label: string; short: string }[] = [
  {
    value: "appropriate-reliance",
    label: "Appropriate Reliance",
    short: "App Rely",
  },
  {
    value: "appropriate-rejection",
    label: "Appropriate Rejection",
    short: "App Reject",
  },
  { value: "overreliance", label: "Overreliance", short: "Over" },
  { value: "under-reliance", label: "Under reliance", short: "Under" },
];

const cognitiveStates: { value: CognitiveState; label: string }[] = [
  {
    value: "thinking-verifying-suggestion",
    label: "Thinking/Verifying Suggestion",
  },
  {
    value: "deferring-thinking-for-later",
    label: "Deferring Thinking for Later",
  },
  {
    value: "thinking-about-new-action",
    label: "Thinking About New Action",
  },
  { value: "waiting-for-suggestion", label: "Waiting for Suggestion" },
  { value: "not-thinking", label: "Not Thinking" },
  { value: "deferring-action-for-later", label: "Deferring Action for Later" },
  { value: "taking-actions", label: "Taking Actions" },
  {
    value: "not-understand-or-forget-suggestion",
    label: "Not fully understand or forget suggestion",
  },
];

type SavedState = {
  activePlanId: PlanId;
  participantId: string;
  backendEndpoint?: string;
  sessions: RecordingSession[];
  selectedSession?: RecordingSession;
  annotationsBySession: Record<string, Record<number, StepAnnotation>>;
};

function downloadFile(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function nowIso() {
  return new Date().toISOString();
}

export default function Home() {
  const [activePlanId, setActivePlanId] = useState<PlanId>("sandwich");
  const [participantId, setParticipantId] = useState("P01");
  const [backendEndpoint, setBackendEndpoint] = useState(DEFAULT_SESSIONS_ENDPOINT);
  const [queryStatus, setQueryStatus] = useState<
    "idle" | "loading" | "empty" | "error" | "ready"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("Ready to load sessions.");
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [deviceSessions, setDeviceSessions] = useState<DeviceRecording[]>([]);
  const [selectedDeviceSession, setSelectedDeviceSession] =
    useState<DeviceRecording | null>(null);
  const [selectedSession, setSelectedSession] =
    useState<RecordingSession | null>(null);
  const [annotationsBySession, setAnnotationsBySession] = useState<
    Record<string, Record<number, StepAnnotation>>
  >({});
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const activePlan = planForParticipant(activePlanId, participantId);
  const annotations = useMemo(
    () => (selectedSession ? (annotationsBySession[selectedSession.id] ?? {}) : {}),
    [annotationsBySession, selectedSession],
  );
  const annotationRows = useMemo(
    () =>
      activePlan.tasks.map((task, index) => {
        const stepNumber = index + 1;
        return (
          annotations[stepNumber] ?? {
            sessionId: selectedSession?.id ?? "",
            participantId,
            taskPlanId: activePlan.id,
            stepNumber,
            stepName: task.name,
            notes: "",
            updatedAt: nowIso(),
          }
        );
      }),
    [activePlan, annotations, participantId, selectedSession],
  );
  const completeCount = annotationRows.filter(isStepComplete).length;
  const progress = Math.round((completeCount / activePlan.tasks.length) * 100);
  const exportRows = selectedSession
    ? buildExportRows(annotationRows, selectedSession)
    : [];
  const hasVideo = Boolean(selectedSession?.rgbVideoUrl);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as SavedState;
          const restoredSessions = (parsed.sessions ?? []).filter(
            (session) => session.source === "backend",
          );
          const restoredSelected =
            parsed.selectedSession?.source === "backend"
              ? parsed.selectedSession
              : null;
          setActivePlanId(parsed.activePlanId ?? "sandwich");
          setParticipantId(parsed.participantId ?? "P01");
          setBackendEndpoint(parsed.backendEndpoint ?? DEFAULT_SESSIONS_ENDPOINT);
          setSessions(restoredSessions);
          setSelectedSession(restoredSelected);
          setAnnotationsBySession(parsed.annotationsBySession ?? {});
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || selectedSession) return;

    queueMicrotask(() => {
      const draft = createDraftSession({
        participantId: participantId.trim() || "P01",
        taskPlanId: activePlan.id,
      });
      setSelectedSession(draft);
      setCurrentSeconds(0);
      setDurationSeconds(0);
      setAnnotationsBySession((current) => ({
        ...current,
        [draft.id]: current[draft.id] ?? createEmptyAnnotations(draft, activePlan),
      }));
      setStatusMessage("Local annotation draft ready. Upload RGB to use video timestamps.");
    });
  }, [activePlan, hydrated, participantId, selectedSession]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activePlanId,
        participantId,
        backendEndpoint,
        sessions: sessions.filter((session) => session.source === "backend"),
        selectedSession:
          selectedSession?.source === "backend" ? selectedSession : undefined,
        annotationsBySession,
      }),
    );
  }, [
    activePlanId,
    annotationsBySession,
    backendEndpoint,
    hydrated,
    participantId,
    selectedSession,
    sessions,
  ]);

  const selectPlan = (planId: PlanId) => {
    const nextPlan = plans.find((plan) => plan.id === planId) ?? plans[0];
    const draft = createDraftSession({
      participantId: participantId.trim() || "P01",
      taskPlanId: nextPlan.id,
    });
    setActivePlanId(planId);
    setQueryStatus("idle");
    setStatusMessage("Local annotation draft ready. Upload RGB to use video timestamps.");
    setSelectedSession(draft);
    setSessions([]);
    setAnnotationsBySession((current) => ({
      ...current,
      [draft.id]: current[draft.id] ?? createEmptyAnnotations(draft, nextPlan),
    }));
    setCurrentSeconds(0);
    setDurationSeconds(0);
  };

  const selectParticipant = (nextParticipantId: string) => {
    if (nextParticipantId === participantId) return;
    const draft = createDraftSession({
      participantId: nextParticipantId,
      taskPlanId: activePlanId,
    });
    setParticipantId(nextParticipantId);
    setSessions([]);
    setDeviceSessions([]);
    setSelectedDeviceSession(null);
    setSelectedSession(draft);
    setCurrentSeconds(0);
    setDurationSeconds(0);
    setQueryStatus("idle");
    setStatusMessage("Participant changed. A matching annotation draft is ready.");
    setAnnotationsBySession((current) => ({
      ...current,
      [draft.id]: current[draft.id] ?? createEmptyAnnotations(draft, planForParticipant(activePlanId, nextParticipantId)),
    }));
  };

  const selectSession = (session: RecordingSession | null) => {
    setSelectedSession(session);
    setCurrentSeconds(0);
    setDurationSeconds(session?.durationSeconds ?? 0);
    if (!session) return;
    setAnnotationsBySession((current) => ({
      ...current,
      [session.id]: current[session.id] ?? createEmptyAnnotations(session, activePlan),
    }));
  };

  const updateAnnotation = (
    stepNumber: number,
    update: (current: StepAnnotation) => StepAnnotation,
  ) => {
    if (!selectedSession) return;
    setAnnotationsBySession((allSessions) => {
      const current =
        allSessions[selectedSession.id] ??
        createEmptyAnnotations(selectedSession, activePlan);
      const base =
        current[stepNumber] ??
        createEmptyAnnotations(selectedSession, activePlan)[stepNumber];
      return {
        ...allSessions,
        [selectedSession.id]: {
          ...current,
          [stepNumber]: update(base),
        },
      };
    });
  };

  const querySessions = async () => {
    if (!participantId.trim()) {
      setQueryStatus("error");
      setStatusMessage("Enter a participant ID before querying sessions.");
      return;
    }

    setQueryStatus("loading");
    setStatusMessage("Querying Project Aria Gen 1 recordings on the connected glasses...");

    try {
      if (!backendEndpoint.trim()) {
        const draft = createDraftSession({
          participantId: participantId.trim(),
          taskPlanId: activePlan.id,
        });
        setSessions([]);
        selectSession(draft);
        setQueryStatus("empty");
        setStatusMessage(
          "No backend endpoint is configured. Continue annotating locally or upload an RGB view video.",
        );
        return;
      }

      const endpoint = backendEndpoint.trim().replace(/\?$/, "");
      const deviceEndpoint = endpoint.replace(/\/api\/sessions(?:\?.*)?$/, "/api/device-sessions");
      const response = await fetch(deviceEndpoint);
      if (!response.ok) {
        throw new Error(`Session query failed with ${response.status}`);
      }
      const normalized = normalizeDeviceSessionResponse(await response.json());
      setDeviceSessions(normalized);
      setSelectedDeviceSession(normalized[0] ?? null);
      setQueryStatus(normalized.length > 0 ? "ready" : "empty");
      setStatusMessage(
        normalized.length > 0
          ? `${normalized.length} recording${normalized.length === 1 ? "" : "s"} found on the glasses. Select one to download.`
          : "No recordings found on the connected glasses. Upload RGB remains available.",
      );
    } catch (error) {
      setQueryStatus("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Session query failed. Upload remains available.",
      );
      setSessions([]);
      setDeviceSessions([]);
      setSelectedDeviceSession(null);
      selectSession(
        createDraftSession({
          participantId: participantId.trim() || "P01",
          taskPlanId: activePlan.id,
        }),
      );
    }
  };

  const downloadSelectedSession = async () => {
    if (!selectedDeviceSession) return;
    setQueryStatus("loading");
    setStatusMessage(`Downloading ${selectedDeviceSession.name} from the glasses...`);
    try {
      const endpoint = backendEndpoint.trim().replace(/\?$/, "");
      const deviceEndpoint = endpoint.replace(/\/api\/sessions(?:\?.*)?$/, "/api/device-sessions");
      const params = new URLSearchParams({
        participantId: participantId.trim(),
        taskPlanId: activePlan.id,
      });
      const response = await fetch(
        `${deviceEndpoint}/${encodeURIComponent(selectedDeviceSession.name)}/download?${params}`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(`Recording download failed with ${response.status}`);
      const session = normalizeSessionResponse({ sessions: [(await response.json()).session] })[0];
      if (!session) throw new Error("The downloaded recording did not include an RGB video.");
      setSessions([session]);
      selectSession(session);
      setQueryStatus("ready");
      setStatusMessage(`${selectedDeviceSession.name} is ready for annotation.`);
    } catch (error) {
      setQueryStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Recording download failed.");
    }
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setQueryStatus("error");
      setStatusMessage("Choose a browser-playable RGB video file.");
      event.target.value = "";
      return;
    }

    if (selectedSession?.source === "manual-upload") {
      URL.revokeObjectURL(selectedSession.rgbVideoUrl);
    }

    const uploadSession = createUploadSession({
      fileName: file.name,
      objectUrl: URL.createObjectURL(file),
      participantId: participantId.trim() || "manual-participant",
      taskPlanId: activePlan.id,
    });

    setSessions((current) => [uploadSession, ...current]);
    selectSession(uploadSession);
    setQueryStatus("ready");
    setStatusMessage("Manual RGB upload loaded for annotation.");
    event.target.value = "";
  };

  const readVideoSeconds = () => {
    const seconds = videoRef.current?.currentTime ?? currentSeconds;
    setCurrentSeconds(seconds);
    return seconds;
  };

  const markStart = (stepNumber: number) => {
    const seconds = readVideoSeconds();
    updateAnnotation(stepNumber, (current) =>
      setStepStart(current, seconds, nowIso()),
    );
  };

  const markEnd = (stepNumber: number) => {
    const seconds = readVideoSeconds();
    updateAnnotation(stepNumber, (current) => {
      try {
        return setStepEnd(current, seconds, nowIso());
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : "Invalid step end time.",
        );
        return current;
      }
    });
  };

  const exportJson = () => {
    if (!selectedSession) return;
    downloadFile(
      `cogar-${selectedSession.id}-annotations.json`,
      JSON.stringify(exportRows, null, 2),
      "application/json;charset=utf-8",
    );
  };

  const exportCsv = () => {
    if (!selectedSession) return;
    downloadFile(
      `cogar-${selectedSession.id}-annotations.csv`,
      buildCsv(exportRows),
      "text/csv;charset=utf-8",
    );
  };

  const resetDraft = () => {
    if (!window.confirm("Reset the current annotation draft on this device?"))
      return;
    if (selectedSession?.source === "manual-upload") {
      URL.revokeObjectURL(selectedSession.rgbVideoUrl);
    }
    setSessions([]);
    setSelectedSession(null);
    setAnnotationsBySession({});
    setCurrentSeconds(0);
    setDurationSeconds(0);
    setQueryStatus("idle");
    setStatusMessage("Ready to load sessions.");
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            C
          </div>
          <div>
            <p className="eyebrow">RESEARCH CONSOLE</p>
            <h1>
              Cog<span>AR</span>
            </h1>
          </div>
        </div>
        <div className="session-tools">
          <div className={`live-pill is-${queryStatus}`}>
            <span aria-hidden="true" />
            {selectedSession ? selectedSession.source : queryStatus}
          </div>
          <div
            className="timer"
            aria-label={`Video timestamp ${formatTimecode(currentSeconds)}`}
          >
            <small>VIDEO TIME</small>
            <strong>{formatTimecode(currentSeconds)}</strong>
          </div>
          <button
            className="export-button"
            type="button"
            disabled={!selectedSession}
            onClick={exportCsv}
          >
            Export CSV
          </button>
          <button
            className="ghost-button"
            type="button"
            disabled={!selectedSession}
            onClick={exportJson}
          >
            Export JSON
          </button>
          <button className="ghost-button" type="button" onClick={resetDraft}>
            Reset
          </button>
        </div>
      </header>

      <nav className="plan-tabs" aria-label="Task plans">
        {plans.map((plan) => (
          <button
            type="button"
            className={plan.id === activePlan.id ? "is-active" : ""}
            onClick={() => selectPlan(plan.id)}
            aria-current={plan.id === activePlan.id ? "page" : undefined}
            key={plan.id}
          >
            <span>{plan.code}</span>
            {plan.title}
          </button>
        ))}
        <p>{activePlan.code} / 04</p>
      </nav>

      <section className="intro annotation-intro">
        <div className="plan-heading">
          <div className="plan-code" aria-hidden="true">
            {activePlan.code}
          </div>
          <div>
            <p className="eyebrow">{activePlan.eyebrow}</p>
            <h2>Annotation Console</h2>
            <p className="intro-copy">{activePlan.description}</p>
          </div>
        </div>
        <div className="progress-card">
          <div className="progress-copy">
            <span>Step annotations</span>
            <strong>{progress}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <p>
            {completeCount}/{activePlan.tasks.length} complete ·{" "}
            {selectedSession ? selectedSession.id : "draft pending"}
          </p>
        </div>
      </section>

      <section className="loader-card" aria-label="Session loader">
        <div className="loader-fields">
          <label>
            <span>Participant ID</span>
            <select value={participantId} onChange={(event) => selectParticipant(event.target.value)}>
              {Array.from({ length: 36 }, (_, index) => {
                const id = `P${String(index + 1).padStart(2, "0")}`;
                return <option value={id} key={id}>Participant {String(index + 1).padStart(2, "0")}</option>;
              })}
            </select>
          </label>
          <label>
            <span>Task plan</span>
            <select
              value={activePlan.id}
              onChange={(event) => selectPlan(event.target.value as PlanId)}
            >
              {plans.map((plan) => (
                <option value={plan.id} key={plan.id}>
                  {plan.title}
                </option>
              ))}
            </select>
          </label>
          <label className="backend-endpoint-field">
            <span>Backend endpoint</span>
            <input
              value={backendEndpoint}
              onChange={(event) => setBackendEndpoint(event.target.value)}
              placeholder="http://localhost:8765/api/sessions"
            />
          </label>
          <button
            type="button"
            className="task-start-button"
            onClick={querySessions}
            disabled={queryStatus === "loading"}
          >
            <span aria-hidden="true">⌕</span>
            Query sessions
          </button>
          <label className="upload-button">
            <span aria-hidden="true">↑</span>
            Upload RGB
            <input accept="video/*" type="file" onChange={handleUpload} />
          </label>
        </div>
        <div className={`status-line status-${queryStatus}`}>
          <span aria-hidden="true" />
          {statusMessage}
        </div>
        <div className="session-list" aria-label="Device recordings">
            <strong>Device recordings</strong>
            {deviceSessions.length > 0 ? deviceSessions.map((session) => (
              <button
                type="button"
                className={selectedDeviceSession?.name === session.name ? "is-selected" : ""}
                onClick={() => setSelectedDeviceSession(session)}
                key={session.name}
              >
                <strong>{session.name}</strong>
                <small>On connected glasses</small>
              </button>
            )) : <small>Query the connected glasses to select a recording.</small>}
            <button
              type="button"
              className="task-start-button"
              onClick={downloadSelectedSession}
              disabled={!selectedDeviceSession || queryStatus === "loading"}
            >
              Download selected
            </button>
        </div>
        {sessions.length > 0 && (
          <div className="session-list">
            {sessions.map((session) => (
              <button
                type="button"
                className={
                  selectedSession?.id === session.id ? "is-selected" : ""
                }
                onClick={() => selectSession(session)}
                key={session.id}
              >
                <strong>{session.id}</strong>
                <span>{session.sourceVrsName}</span>
                <small>
                  {session.durationSeconds
                    ? formatTimecode(session.durationSeconds)
                    : "duration pending"}
                </small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="workspace-grid">
        <article className="video-card" aria-label="RGB view">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RGB VIEW</p>
              <h3>{selectedSession?.sourceVrsName ?? "No recording loaded"}</h3>
            </div>
            <strong>{formatTimecode(durationSeconds || currentSeconds)}</strong>
          </div>
          <div className="video-frame">
            {hasVideo ? (
              <video
                controls
                ref={videoRef}
                src={selectedSession?.rgbVideoUrl}
                onTimeUpdate={(event) =>
                  setCurrentSeconds(event.currentTarget.currentTime)
                }
                onLoadedMetadata={(event) => {
                  const duration = event.currentTarget.duration;
                  if (Number.isFinite(duration)) setDurationSeconds(duration);
                }}
              />
            ) : (
              <div className="video-empty">
                <span aria-hidden="true">▶</span>
                <p>Annotate now, or upload a Project Aria RGB recording for video timestamps.</p>
              </div>
            )}
          </div>
          <dl className="session-meta">
            <div>
              <dt>Participant</dt>
              <dd>{selectedSession?.participantId ?? participantId}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{selectedSession?.source ?? "none"}</dd>
            </div>
            <div>
              <dt>RGB score</dt>
              <dd>
                {selectedSession?.quality?.rgbCameraScore !== undefined
                  ? `${selectedSession.quality.rgbCameraScore}%`
                  : "pending"}
              </dd>
            </div>
            <div>
              <dt>Frames</dt>
              <dd>
                {selectedSession?.quality?.rgbFramesProcessed !== undefined
                  ? `${selectedSession.quality.rgbFramesProcessed}/${selectedSession.quality.rgbFramesExpected ?? "?"}`
                  : "pending"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="annotation-card" aria-label="Step annotations">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{activePlan.annotationTitle}</p>
              <h3>Step annotations</h3>
            </div>
            <strong>{completeCount}/{activePlan.tasks.length}</strong>
          </div>
          <div className="annotation-list">
            {annotationRows.map((annotation) => {
              const step = activePlan.tasks[annotation.stepNumber - 1];
              const complete = isStepComplete(annotation);

              return (
                <section
                  className={`annotation-row ${complete ? "is-complete" : ""}`}
                  key={annotation.stepNumber}
                >
                  <div className="step-cell">
                    <span className="step-number">
                      {String(annotation.stepNumber).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>{annotation.stepName}</strong>
                      <p>{step.correctOptions[0]?.text ?? "Review step outcome"}</p>
                    </div>
                  </div>

                  <div className="time-controls">
                    <button
                      type="button"
                      onClick={() => markStart(annotation.stepNumber)}
                    >
                      Mark start
                    </button>
                    <span>{formatTimecode(annotation.startSeconds ?? 0)}</span>
                    <button
                      type="button"
                      onClick={() => markEnd(annotation.stepNumber)}
                    >
                      Mark end
                    </button>
                    <span>{formatTimecode(annotation.endSeconds ?? 0)}</span>
                  </div>

                  <label className="range-control">
                    <span>Reliance {annotation.relianceAmount ?? "-"}</span>
                    <input
                      min={0}
                      max={7}
                      step={1}
                      type="range"
                      value={annotation.relianceAmount ?? 0}
                      onChange={(event) =>
                        updateAnnotation(annotation.stepNumber, (current) => ({
                          ...current,
                          relianceAmount: Number(event.target.value),
                          updatedAt: nowIso(),
                        }))
                      }
                    />
                  </label>

                  <div className="segmented-control">
                    {relianceTypes.map((item) => (
                      <button
                        type="button"
                        className={
                          annotation.relianceType === item.value
                            ? "is-selected"
                            : ""
                        }
                        title={item.label}
                        onClick={() =>
                          updateAnnotation(annotation.stepNumber, (current) => ({
                            ...current,
                            relianceType: item.value,
                            updatedAt: nowIso(),
                          }))
                        }
                        key={item.value}
                      >
                        {item.short}
                      </button>
                    ))}
                  </div>

                  <label className="range-control">
                    <span>Confidence {annotation.confidence ?? "-"}</span>
                    <input
                      min={0}
                      max={7}
                      step={1}
                      type="range"
                      value={annotation.confidence ?? 0}
                      onChange={(event) =>
                        updateAnnotation(annotation.stepNumber, (current) => ({
                          ...current,
                          confidence: Number(event.target.value),
                          updatedAt: nowIso(),
                        }))
                      }
                    />
                  </label>

                  <label className="state-select">
                    <span>Cognitive state</span>
                    <select
                      value={annotation.cognitiveState ?? ""}
                      onChange={(event) =>
                        updateAnnotation(annotation.stepNumber, (current) => ({
                          ...current,
                          cognitiveState: event.target.value as CognitiveState,
                          updatedAt: nowIso(),
                        }))
                      }
                    >
                      <option value="">Choose state</option>
                      {cognitiveStates.map((state) => (
                        <option value={state.value} key={state.value}>
                          {state.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="notes-field">
                    <span>Notes</span>
                    <textarea
                      value={annotation.notes ?? ""}
                      onChange={(event) =>
                        updateAnnotation(annotation.stepNumber, (current) => ({
                          ...current,
                          notes: event.target.value,
                          updatedAt: nowIso(),
                        }))
                      }
                    />
                  </label>
                </section>
              );
            })}
          </div>
        </article>
      </section>

      <footer>
        <p>Draft annotations stay on this device until export or reset.</p>
        <p>CogAR · Project Aria RGB annotation view</p>
      </footer>
    </main>
  );
}
