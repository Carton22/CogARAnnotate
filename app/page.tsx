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
  setStepEnd,
  setStepStart,
  type CognitiveState,
  type RecordingSession,
  type RelianceType,
  type StepAnnotation,
} from "./annotation-model";
import { planForParticipant, plans, type PlanId } from "./task-plans";

// v2 clears pre-randomization drafts whose fixed Boba/Shelf step names would
// otherwise override the participant-specific sequence.
const STORAGE_KEY = "cogar-annotation-console-v2";
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
  sessions: RecordingSession[];
  selectedSession?: RecordingSession;
  annotationsBySession: Record<string, Record<number, StepAnnotation>>;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionResultList = {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionInstance = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition() {
  if (typeof window === "undefined") return undefined;
  const browserWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
}

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
  const [queryStatus, setQueryStatus] = useState<
    "idle" | "error" | "ready"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("Upload an RGB recording to use video timestamps.");
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [selectedSession, setSelectedSession] =
    useState<RecordingSession | null>(null);
  const [annotationsBySession, setAnnotationsBySession] = useState<
    Record<string, Record<number, StepAnnotation>>
  >({});
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [recordingStep, setRecordingStep] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const activePlan = planForParticipant(activePlanId, participantId);
  const annotations = useMemo(
    () => (selectedSession ? (annotationsBySession[selectedSession.id] ?? {}) : {}),
    [annotationsBySession, selectedSession],
  );
  const annotationRows = useMemo(
    () =>
      activePlan.tasks.map((task, index) => {
        const stepNumber = index + 1;
        const saved = annotations[stepNumber];
        return {
          ...(saved ?? {
            sessionId: selectedSession?.id ?? "",
            stepNumber,
            notes: "",
            updatedAt: nowIso(),
          }),
          sessionId: selectedSession?.id ?? "",
          participantId,
          taskPlanId: activePlan.id,
          stepNumber,
          stepName: task.name,
        };
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
          setActivePlanId(parsed.activePlanId ?? "sandwich");
          setParticipantId(parsed.participantId ?? "P01");
          setSessions([]);
          setSelectedSession(null);
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
        sessions: [],
        selectedSession: undefined,
        annotationsBySession,
      }),
    );
  }, [
    activePlanId,
    annotationsBySession,
    hydrated,
    participantId,
  ]);

  useEffect(() => {
    return () => {
      speechRecognitionRef.current?.stop();
    };
  }, []);

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

  const appendNoteTranscript = (stepNumber: number, transcript: string) => {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) return;
    updateAnnotation(stepNumber, (current) => ({
      ...current,
      notes: [current.notes?.trim(), cleanTranscript].filter(Boolean).join(" "),
      updatedAt: nowIso(),
    }));
  };

  const stopSpeechInput = () => {
    speechRecognitionRef.current?.stop();
    speechRecognitionRef.current = null;
    setRecordingStep(null);
  };

  const startSpeechInput = (stepNumber: number) => {
    if (recordingStep === stepNumber) {
      stopSpeechInput();
      return;
    }

    speechRecognitionRef.current?.stop();
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setStatusMessage("Speech input is not supported in this browser. Type notes instead.");
      setRecordingStep(null);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(
        { length: event.results.length - event.resultIndex },
        (_, index) => event.results[event.resultIndex + index],
      )
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");
      appendNoteTranscript(stepNumber, transcript);
    };
    recognition.onerror = () => {
      setStatusMessage("Speech transcription stopped. Check microphone permission or type notes instead.");
      setRecordingStep(null);
      speechRecognitionRef.current = null;
    };
    recognition.onend = () => {
      setRecordingStep(null);
      speechRecognitionRef.current = null;
    };
    speechRecognitionRef.current = recognition;
    setRecordingStep(stepNumber);
    setStatusMessage(`Listening for step ${String(stepNumber).padStart(2, "0")} notes...`);
    recognition.start();
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
                    <span>Reliance on AI {annotation.relianceAmount ?? "-"}</span>
                    <small>
                      To what extent did you rely on the AI to complete this task?
                      0 = Not at all; 7 = Completely
                    </small>
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
                    <span>Trust in the AI {annotation.confidence ?? "-"}</span>
                    <small>
                      To what extent did you trust the AI&apos;s recommendations when making your decision?
                      0 = Not at all; 7 = Completely
                    </small>
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
                    <span>Cognitive engagement</span>
                    <small>
                      To what extent did you critically evaluate the AI&apos;s instructions rather than accept them without reflection?
                    </small>
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
                    <span>What&apos;s your thinking process at that step?</span>
                    <div className="notes-toolbar">
                      <small>Think aloud or type your notes.</small>
                      <button
                        type="button"
                        className={recordingStep === annotation.stepNumber ? "is-recording" : ""}
                        onClick={() => startSpeechInput(annotation.stepNumber)}
                      >
                        {recordingStep === annotation.stepNumber
                          ? "Stop recording"
                          : "Start speech input"}
                      </button>
                    </div>
                    <textarea
                      aria-label={`Thinking process notes for step ${annotation.stepNumber}`}
                      placeholder="What's your thinking process at that step?"
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
