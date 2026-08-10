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
  cognitiveStateOrderFromAnnotation,
  createUploadSession,
  applyStepTimingRanges,
  deriveStepTimingRangesFromCsv,
  extractQuickTimeStartIso,
  formatTimecode,
  isStepComplete,
  randomizeCognitiveStatesForStep,
  type CognitiveState,
  type RecordingSession,
  type StepAnnotation,
} from "./annotation-model";
import {
  DEFAULT_ANNOTATION_SHEET_SYNC_URL,
  publishAnnotations,
} from "./annotation-sync.mjs";
import { planForParticipant, plans, type PlanId } from "./task-plans";

// v2 clears pre-randomization drafts whose fixed Boba/Shelf step names would
// otherwise override the participant-specific sequence.
const STORAGE_KEY = "cogar-annotation-console-v2";
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
const cognitiveStateLabels = Object.fromEntries(
  cognitiveStates.map((state) => [state.value, state.label]),
) as Record<CognitiveState, string>;

type SavedState = {
  activePlanId: PlanId;
  participantId: string;
  sessions: RecordingSession[];
  selectedSession?: RecordingSession;
  annotationsBySession: Record<string, Record<number, StepAnnotation>>;
  sheetSyncUrl?: string;
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
  const [sheetSyncUrl, setSheetSyncUrl] = useState(DEFAULT_ANNOTATION_SHEET_SYNC_URL);
  const [sheetSyncStatus, setSheetSyncStatus] = useState<
    "off" | "ready" | "syncing" | "sent" | "failed"
  >(DEFAULT_ANNOTATION_SHEET_SYNC_URL ? "ready" : "off");
  const [videoStartIso, setVideoStartIso] = useState("");
  const [importedTimingFileName, setImportedTimingFileName] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const boundedPlaybackEndSecondsRef = useRef<number | null>(null);

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
          if (typeof parsed.sheetSyncUrl === "string") {
            setSheetSyncUrl(parsed.sheetSyncUrl);
            setSheetSyncStatus(parsed.sheetSyncUrl.trim() ? "ready" : "off");
          }
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
        sheetSyncUrl,
      }),
    );
  }, [
    activePlanId,
    annotationsBySession,
    hydrated,
    participantId,
    sheetSyncUrl,
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
    boundedPlaybackEndSecondsRef.current = null;
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
    boundedPlaybackEndSecondsRef.current = null;
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
    boundedPlaybackEndSecondsRef.current = null;
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

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setQueryStatus("error");
      setStatusMessage("Choose a browser-playable RGB video file.");
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
    try {
      const detectedStartIso = extractQuickTimeStartIso(await file.arrayBuffer());
      if (detectedStartIso) {
        setVideoStartIso(detectedStartIso);
        setStatusMessage(`RGB upload loaded. Detected video start ISO ${detectedStartIso}.`);
      } else {
        setVideoStartIso("");
        setStatusMessage("RGB upload loaded, but no QuickTime start timestamp was found.");
      }
    } catch {
      setVideoStartIso("");
      setStatusMessage("RGB upload loaded, but video metadata could not be read.");
    }
  };

  const handleTimingCsvUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedSession) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const csv = String(reader.result ?? "");
        const ranges = deriveStepTimingRangesFromCsv(csv, {
          participantId,
          taskPlanId: activePlan.id,
          videoStartIso,
        });
        if (ranges.length === 0) {
          setQueryStatus("error");
          setStatusMessage("No matching AI accepted or rejected rows found for this participant and plan.");
          return;
        }

        setAnnotationsBySession((allSessions) => {
          const current =
            allSessions[selectedSession.id] ??
            createEmptyAnnotations(selectedSession, activePlan);
          return {
            ...allSessions,
            [selectedSession.id]: applyStepTimingRanges(
              current,
              ranges,
              nowIso(),
            ),
          };
        });
        setImportedTimingFileName(file.name);
        setQueryStatus("ready");
        setStatusMessage(`Imported AI decision timing for ${ranges.length} steps.`);
      } catch (error) {
        setQueryStatus("error");
        setStatusMessage(
          error instanceof Error
            ? error.message
            : "Could not import AI decision timing CSV.",
        );
      }
    };
    reader.onerror = () => {
      setQueryStatus("error");
      setStatusMessage("Could not read the selected timing CSV file.");
    };
    reader.readAsText(file);
  };

  const playVideo = (annotation?: StepAnnotation) => {
    if (!videoRef.current) {
      setStatusMessage("Upload an RGB recording before playing video.");
      return;
    }
    if (
      annotation &&
      typeof annotation.startSeconds === "number" &&
      typeof annotation.endSeconds === "number" &&
      annotation.endSeconds > annotation.startSeconds
    ) {
      videoRef.current.currentTime = annotation.startSeconds;
      setCurrentSeconds(annotation.startSeconds);
      boundedPlaybackEndSecondsRef.current = annotation.endSeconds;
    } else {
      boundedPlaybackEndSecondsRef.current = null;
    }
    videoRef.current.play().catch(() => {
      setStatusMessage("Video playback could not start. Use the video controls or upload a browser-playable file.");
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

  const syncAnnotationsToSheet = async () => {
    if (!selectedSession) return;
    if (!sheetSyncUrl.trim()) {
      setSheetSyncStatus("off");
      setStatusMessage("Paste the deployed Google Apps Script URL before syncing.");
      return;
    }

    setSheetSyncStatus("syncing");
    try {
      await publishAnnotations(exportRows, sheetSyncUrl);
      setSheetSyncStatus("sent");
      setStatusMessage(`Synced ${exportRows.length} annotation rows to Google Sheets.`);
    } catch {
      setSheetSyncStatus("failed");
      setStatusMessage("Google Sheets sync failed. Check the Apps Script URL and deployment access.");
    }
  };

  const setCognitiveStateOrder = (
    stepNumber: number,
    cognitiveStateOrder: CognitiveState[],
  ) => {
    updateAnnotation(stepNumber, (current) => ({
      ...current,
      cognitiveStateOrder,
      cognitiveState: cognitiveStateOrder[0],
      updatedAt: nowIso(),
    }));
  };

  const toggleCognitiveState = (
    annotation: StepAnnotation,
    state: CognitiveState,
  ) => {
    const currentOrder = cognitiveStateOrderFromAnnotation(annotation);
    const nextOrder = currentOrder.includes(state)
      ? currentOrder.filter((selectedState) => selectedState !== state)
      : [...currentOrder, state];
    setCognitiveStateOrder(annotation.stepNumber, nextOrder);
  };

  const moveCognitiveState = (
    annotation: StepAnnotation,
    state: CognitiveState,
    direction: -1 | 1,
  ) => {
    const currentOrder = cognitiveStateOrderFromAnnotation(annotation);
    const currentIndex = currentOrder.indexOf(state);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentOrder.length) {
      return;
    }
    const nextOrder = [...currentOrder];
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [
      nextOrder[nextIndex],
      nextOrder[currentIndex],
    ];
    setCognitiveStateOrder(annotation.stepNumber, nextOrder);
  };

  const dragCognitiveState = (
    annotation: StepAnnotation,
    draggedState: CognitiveState,
    targetState: CognitiveState,
  ) => {
    if (draggedState === targetState) return;
    const currentOrder = cognitiveStateOrderFromAnnotation(annotation);
    if (!currentOrder.includes(draggedState) || !currentOrder.includes(targetState)) {
      return;
    }
    const withoutDragged = currentOrder.filter((state) => state !== draggedState);
    const targetIndex = withoutDragged.indexOf(targetState);
    const nextOrder = [
      ...withoutDragged.slice(0, targetIndex),
      draggedState,
      ...withoutDragged.slice(targetIndex),
    ];
    setCognitiveStateOrder(annotation.stepNumber, nextOrder);
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
          <label className="participant-control">
            <span>Participant ID</span>
            <select
              value={participantId}
              onChange={(event) => selectParticipant(event.target.value)}
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
      </section>

      <section className="loader-card upload-card" aria-label="RGB upload">
        <div className="loader-fields">
          <label className="upload-button">
            <span aria-hidden="true">↑</span>
            Upload RGB
            <input accept="video/*" type="file" onChange={handleUpload} />
          </label>
          <label className="upload-button">
            <span aria-hidden="true">↧</span>
            Import AI decision timings
            <input accept=".csv,text/csv" type="file" onChange={handleTimingCsvUpload} />
          </label>
          <div className="detected-video-start">
            <span>Detected video start ISO</span>
            <strong>{videoStartIso || "pending"}</strong>
          </div>
        </div>
        <div className={`status-line status-${queryStatus}`}>
          <span aria-hidden="true" />
          {statusMessage}
        </div>
        {importedTimingFileName && (
          <p className="timing-import-note">
            Timing source: {importedTimingFileName}
          </p>
        )}
        <div className="sheet-sync-panel">
          <span className={`sheet-sync-badge is-${sheetSyncStatus}`}>
            Google Sheets sync · {sheetSyncStatus}
          </span>
          <label className="sheet-sync-field">
            <span>Google Sheets sync URL</span>
            <input
              value={sheetSyncUrl}
              onChange={(event) => {
                const value = event.target.value;
                setSheetSyncUrl(value);
                setSheetSyncStatus(value.trim() ? "ready" : "off");
              }}
              placeholder="Paste deployed Google Apps Script web app URL"
              aria-label="Google Sheets sync URL"
            />
          </label>
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
                  {
                    const seconds = event.currentTarget.currentTime;
                    setCurrentSeconds(seconds);
                    const endSeconds = boundedPlaybackEndSecondsRef.current;
                    if (endSeconds !== null && seconds >= endSeconds) {
                      event.currentTarget.pause();
                      boundedPlaybackEndSecondsRef.current = null;
                    }
                  }
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
              const selectedCognitiveStates =
                cognitiveStateOrderFromAnnotation(annotation);
              const randomizedCognitiveStates = randomizeCognitiveStatesForStep(
                participantId,
                activePlan.id,
                annotation.stepNumber,
              );
              const orderedCognitiveStates = [
                ...selectedCognitiveStates,
                ...randomizedCognitiveStates.filter(
                  (state) => !selectedCognitiveStates.includes(state),
                ),
              ];

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
                      className="play-video-button"
                      onClick={() => playVideo(annotation)}
                    >
                      Play step
                    </button>
                    <span>{formatTimecode(annotation.endSeconds ?? 0)}</span>
                  </div>

                  <label className="range-control">
                    <span>
                      Reliance on AI
                      <output>{annotation.relianceAmount ?? "-"}</output>
                    </span>
                    <small>
                      To what extent did you rely on the AI during this step? 0 =
                      Not at all; 7 = Completely
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

                  <label className="range-control">
                    <span>
                      Trust in the AI
                      <output>{annotation.confidence ?? "-"}</output>
                    </span>
                    <small>
                      To what extent did you trust the AI&apos;s instructions? 0 = Not
                      at all; 7 = Completely
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

                  <label className="range-control">
                    <span>
                      Cognitive engagement
                      <output>{annotation.cognitiveEngagement ?? "-"}</output>
                    </span>
                    <small>
                      To what extent did you critically evaluate the AI&apos;s
                      instructions? 0 = Not at all; 7 = Completely
                    </small>
                    <input
                      min={0}
                      max={7}
                      step={1}
                      type="range"
                      value={annotation.cognitiveEngagement ?? 0}
                      onChange={(event) =>
                        updateAnnotation(annotation.stepNumber, (current) => ({
                          ...current,
                          cognitiveEngagement: Number(event.target.value),
                          updatedAt: nowIso(),
                        }))
                      }
                    />
                  </label>

                  <label className="range-control">
                    <span>
                      Task planning
                      <output>{annotation.taskPlanningEngagement ?? "-"}</output>
                    </span>
                    <small>
                      How much did you actively think through how to complete
                      this task? 0 = Not at all; 7 = Completely
                    </small>
                    <input
                      min={0}
                      max={7}
                      step={1}
                      type="range"
                      value={annotation.taskPlanningEngagement ?? 0}
                      onChange={(event) =>
                        updateAnnotation(annotation.stepNumber, (current) => ({
                          ...current,
                          taskPlanningEngagement: Number(event.target.value),
                          updatedAt: nowIso(),
                        }))
                      }
                    />
                  </label>

                  <fieldset className="state-order">
                    <legend>Cognitive state</legend>
                    <small>
                      Tick every state you experienced, then drag selected states
                      into transition order.
                    </small>
                    <div className="state-order-list">
                      {orderedCognitiveStates.map((state) => {
                        const selectedIndex = selectedCognitiveStates.indexOf(state);
                        const isSelected = selectedIndex >= 0;
                        return (
                          <div
                            className={`state-order-item ${isSelected ? "is-selected" : ""}`}
                            draggable={isSelected}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", state);
                            }}
                            onDragOver={(event) => {
                              if (isSelected) event.preventDefault();
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              dragCognitiveState(
                                annotation,
                                event.dataTransfer.getData("text/plain") as CognitiveState,
                                state,
                              );
                            }}
                            key={state}
                          >
                            <label>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCognitiveState(annotation, state)}
                              />
                              <span>{cognitiveStateLabels[state]}</span>
                            </label>
                            {isSelected && (
                              <div className="state-order-tools" aria-label="Reorder selected state">
                                <span>{selectedIndex + 1}</span>
                                <button
                                  type="button"
                                  aria-label={`Move ${cognitiveStateLabels[state]} earlier`}
                                  disabled={selectedIndex === 0}
                                  onClick={() => moveCognitiveState(annotation, state, -1)}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move ${cognitiveStateLabels[state]} later`}
                                  disabled={selectedIndex === selectedCognitiveStates.length - 1}
                                  onClick={() => moveCognitiveState(annotation, state, 1)}
                                >
                                  ↓
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>

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
          <div className="annotation-sync-footer">
            <div>
              <span className={`sheet-sync-badge is-${sheetSyncStatus}`}>
                Google Sheets sync · {sheetSyncStatus}
              </span>
              <p>Sync all answers to Google Sheets after finishing step 10.</p>
            </div>
            <button
              className="sheet-sync-button"
              type="button"
              disabled={!selectedSession || sheetSyncStatus === "syncing"}
              onClick={syncAnnotationsToSheet}
            >
              Sync Sheet
            </button>
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
