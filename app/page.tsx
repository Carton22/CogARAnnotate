"use client";

import { useEffect, useMemo, useState } from "react";

type Reliance = "app-rely" | "over-rely" | "under-rely" | "app-reject";

type TaskState = {
  audioPlays: number;
  finalAt?: string;
  finalElapsed?: number;
  reliance?: Reliance;
};

type LogEntry = {
  id: string;
  task: number;
  action: string;
  detail: string;
  timestamp: string;
  elapsed: number;
};

const tasks = [
  {
    name: "Bread",
    correctInstruction: "Take a piece of bread and put it on a plate.",
  },
  {
    name: "Ketchup",
    correctInstruction: "Add ketchup.",
    incorrectInstruction: "Add ketchup and salt.",
  },
  {
    name: "Cheese",
    correctInstruction: "Add a piece of cheese.",
  },
  {
    name: "Ham",
    correctInstruction: "Add a piece of ham.",
  },
  {
    name: "Bread",
    correctInstruction: "Add the second piece of bread.",
    incorrectInstruction: "Put celery into this.",
  },
  {
    name: "Microwave",
    correctInstruction: "Put the sandwich in the microwave.",
  },
];

const relianceOptions: { key: Reliance; label: string; short: string }[] = [
  { key: "app-rely", label: "Appropriate reliance", short: "App Rely" },
  { key: "over-rely", label: "Over reliance", short: "Over Rely" },
  { key: "under-rely", label: "Under reliance", short: "Under Rely" },
  { key: "app-reject", label: "Appropriate rejection", short: "App Reject" },
];

const STORAGE_KEY = "dete-reliance-console-v1";

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatClock(timestamp?: string) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function emptyTaskState(): Record<number, TaskState> {
  return Object.fromEntries(tasks.map((_, index) => [index + 1, { audioPlays: 0 }]));
}

export default function Home() {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [taskState, setTaskState] = useState<Record<number, TaskState>>(emptyTaskState);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [playingCue, setPlayingCue] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    let restored:
      | {
          startedAt?: number | null;
          taskState?: Record<number, TaskState>;
          logs?: LogEntry[];
        }
      | undefined;
    if (saved) {
      try {
        restored = JSON.parse(saved);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    queueMicrotask(() => {
      if (restored) {
        setStartedAt(restored.startedAt ?? null);
        setTaskState(restored.taskState ?? emptyTaskState());
        setLogs(restored.logs ?? []);
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ startedAt, taskState, logs }),
    );
  }, [hydrated, logs, startedAt, taskState]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const completed = Object.values(taskState).filter((item) => item.finalAt).length;
  const classified = Object.values(taskState).filter((item) => item.reliance).length;
  const progress = Math.round(((completed + classified) / (tasks.length * 2)) * 100);

  const addLog = (task: number, action: string, detail: string) => {
    const timestamp = new Date().toISOString();
    const elapsedAtAction = startedAt
      ? Math.max(0, Math.floor((new Date().getTime() - startedAt) / 1000))
      : 0;
    setLogs((current) => [
      { id: crypto.randomUUID(), task, action, detail, timestamp, elapsed: elapsedAtAction },
      ...current,
    ]);
  };

  const ensureStarted = () => {
    if (startedAt) return;
    setStartedAt(new Date().getTime());
  };

  const playInstruction = (
    taskNumber: number,
    instruction: string,
    kind: "correct" | "incorrect",
  ) => {
    ensureStarted();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(instruction);
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => setPlayingCue(null);
    utterance.onerror = () => setPlayingCue(null);
    setPlayingCue(`${taskNumber}-${kind}`);
    window.speechSynthesis.speak(utterance);
    setTaskState((current) => ({
      ...current,
      [taskNumber]: {
        ...current[taskNumber],
        audioPlays: current[taskNumber].audioPlays + 1,
      },
    }));
    addLog(
      taskNumber,
      kind === "correct" ? "Correct instruction" : "Incorrect instruction",
      instruction,
    );
  };

  const markFinalAct = (taskNumber: number) => {
    ensureStarted();
    const timestamp = new Date().toISOString();
    const elapsedAtAction = startedAt
      ? Math.max(0, Math.floor((new Date().getTime() - startedAt) / 1000))
      : 0;
    setTaskState((current) => ({
      ...current,
      [taskNumber]: {
        ...current[taskNumber],
        finalAt: timestamp,
        finalElapsed: elapsedAtAction,
      },
    }));
    addLog(taskNumber, "Final act", `Marked at ${formatClock(timestamp)}`);
  };

  const markReliance = (taskNumber: number, reliance: Reliance) => {
    ensureStarted();
    const option = relianceOptions.find((item) => item.key === reliance)!;
    setTaskState((current) => ({
      ...current,
      [taskNumber]: { ...current[taskNumber], reliance },
    }));
    addLog(taskNumber, "Reliance", option.label);
  };

  const resetSession = () => {
    if (!window.confirm("Reset this session and remove all local records?")) return;
    window.speechSynthesis.cancel();
    setStartedAt(null);
    setTaskState(emptyTaskState());
    setLogs([]);
    setPlayingCue(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const exportCsv = () => {
    const header = ["task", "step", "action", "detail", "timestamp_iso", "elapsed"];
    const rows = [...logs].reverse().map((entry) => [
      entry.task,
      tasks[entry.task - 1].name,
      entry.action,
      entry.detail,
      entry.timestamp,
      formatElapsed(entry.elapsed),
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cogar-${new Date().toISOString().slice(0, 19)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const sessionLabel = useMemo(() => {
    if (!startedAt) return "Ready";
    if (completed === tasks.length && classified === tasks.length) return "Complete";
    return "Live session";
  }, [classified, completed, startedAt]);

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">C</div>
          <div>
            <p className="eyebrow">RESEARCH CONSOLE</p>
            <h1>Cog<span>AR</span></h1>
          </div>
        </div>
        <div className="session-tools">
          <div className={`live-pill ${startedAt ? "is-live" : ""}`}>
            <span aria-hidden="true" />
            {sessionLabel}
          </div>
          <div className="timer" aria-label={`Session elapsed time ${formatElapsed(elapsed)}`}>
            <small>SESSION TIME</small>
            <strong>{formatElapsed(elapsed)}</strong>
          </div>
          <button className="ghost-button" type="button" onClick={resetSession}>
            Reset session
          </button>
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow">WIZARD OF OZ · TASK A</p>
          <h2>Sandwich plan</h2>
          <p className="intro-copy">
            Play a blue correct instruction or a red incorrect instruction, mark the
            participant&apos;s final act, then classify their reliance.
          </p>
        </div>
        <div className="progress-card">
          <div className="progress-copy">
            <span>Session progress</span>
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
          <p>{completed}/6 final acts · {classified}/6 classified</p>
        </div>
      </section>

      <section className="console-card" aria-label="Sandwich plan control matrix">
        <div className="matrix-scroll">
          <div className="matrix" role="table" aria-label="Task control matrix">
            <div className="matrix-header" role="row">
              <div className="step-heading" role="columnheader">
                <span>Task sequence &amp; instructions</span>
                <span className="cue-legend">
                  <span className="legend-correct">Correct</span>
                  <span className="legend-incorrect">Incorrect</span>
                </span>
              </div>
              <div role="columnheader">AI audio</div>
              <div role="columnheader">Final act</div>
              {relianceOptions.map((option) => (
                <div role="columnheader" key={option.key}>{option.short}</div>
              ))}
            </div>

            {tasks.map((task, index) => {
              const taskNumber = index + 1;
              const state = taskState[taskNumber] ?? { audioPlays: 0 };
              return (
                <div
                  className={`matrix-row ${state.finalAt ? "is-complete" : ""}`}
                  role="row"
                  key={`${task.name}-${taskNumber}`}
                >
                  <div className="task-cell" role="rowheader">
                    <div className="step-number">{String(taskNumber).padStart(2, "0")}</div>
                    <div className="step-copy">
                      <strong>{task.name}</strong>
                      <div className="instruction-cues">
                        <button
                          type="button"
                          className={`cue-button cue-correct ${
                            playingCue === `${taskNumber}-correct` ? "is-playing" : ""
                          }`}
                          onClick={() =>
                            playInstruction(
                              taskNumber,
                              task.correctInstruction,
                              "correct",
                            )
                          }
                          aria-label={`Play correct instruction for task ${taskNumber}: ${task.correctInstruction}`}
                          data-testid={`correct-instruction-${taskNumber}`}
                        >
                          <span aria-hidden="true">▶</span>
                          {task.correctInstruction}
                        </button>
                        {task.incorrectInstruction ? (
                          <button
                            type="button"
                            className={`cue-button cue-incorrect ${
                              playingCue === `${taskNumber}-incorrect`
                                ? "is-playing"
                                : ""
                            }`}
                            onClick={() =>
                              playInstruction(
                                taskNumber,
                                task.incorrectInstruction!,
                                "incorrect",
                              )
                            }
                            aria-label={`Play incorrect instruction for task ${taskNumber}: ${task.incorrectInstruction}`}
                            data-testid={`incorrect-instruction-${taskNumber}`}
                          >
                            <span aria-hidden="true">▶</span>
                            {task.incorrectInstruction}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div role="cell" className="action-cell">
                    <button
                      type="button"
                      className={`circle-button audio-button ${
                        playingCue === `${taskNumber}-correct` ? "is-playing" : ""
                      }`}
                      onClick={() =>
                        playInstruction(
                          taskNumber,
                          task.correctInstruction,
                          "correct",
                        )
                      }
                      aria-label={`Play correct AI audio for task ${taskNumber}: ${task.correctInstruction}`}
                      title="Play correct AI instruction"
                      data-testid={`audio-${taskNumber}`}
                    >
                      <span className="speaker-icon" aria-hidden="true">▶</span>
                    </button>
                    <small>{state.audioPlays ? `${state.audioPlays}×` : "Play"}</small>
                  </div>

                  <div role="cell" className="action-cell">
                    <button
                      type="button"
                      className={`circle-button final-button ${state.finalAt ? "is-selected" : ""}`}
                      onClick={() => markFinalAct(taskNumber)}
                      aria-label={`Mark final act timestamp for task ${taskNumber}`}
                      aria-pressed={Boolean(state.finalAt)}
                      title="Mark final act"
                      data-testid={`final-${taskNumber}`}
                    >
                      <span aria-hidden="true">{state.finalAt ? "✓" : "＋"}</span>
                    </button>
                    <small>{state.finalAt ? formatClock(state.finalAt) : "Mark"}</small>
                  </div>

                  {relianceOptions.map((option) => {
                    const selected = state.reliance === option.key;
                    return (
                      <div role="cell" className="action-cell" key={option.key}>
                        <button
                          type="button"
                          className={`circle-button reliance-button ${selected ? "is-selected" : ""}`}
                          onClick={() => markReliance(taskNumber, option.key)}
                          aria-label={`${option.label} for task ${taskNumber}`}
                          aria-pressed={selected}
                          title={option.label}
                          data-testid={`${option.key}-${taskNumber}`}
                        >
                          <span aria-hidden="true">{selected ? "✓" : ""}</span>
                        </button>
                        <small>{selected ? "Selected" : option.short}</small>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="log-card">
        <div className="log-header">
          <div>
            <p className="eyebrow">LOCAL RECORD</p>
            <h3>Event log</h3>
          </div>
          <button
            type="button"
            className="export-button"
            onClick={exportCsv}
            disabled={!logs.length}
          >
            Export CSV
          </button>
        </div>
        {logs.length ? (
          <div className="log-list" aria-live="polite">
            {logs.slice(0, 8).map((entry) => (
              <article className="log-item" key={entry.id}>
                <div className="log-task">T{entry.task}</div>
                <div>
                  <strong>{entry.action}</strong>
                  <p>{entry.detail}</p>
                </div>
                <time dateTime={entry.timestamp}>
                  {formatElapsed(entry.elapsed)}
                  <span>{formatClock(entry.timestamp)}</span>
                </time>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-log">
            <span aria-hidden="true">◎</span>
            <p>Actions will appear here with timestamps.</p>
          </div>
        )}
      </section>

      <footer>
        <p>Records stay on this device until you reset the session.</p>
        <p>CogAR · Wizard of Oz operator view</p>
      </footer>
    </main>
  );
}
