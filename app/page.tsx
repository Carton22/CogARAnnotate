"use client";

import {
  type TouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Reliance = "app-rely" | "over-rely" | "under-rely" | "app-reject";
type PlanId = "sandwich" | "shelf" | "boba" | "table";
type CueKind = "correct" | "incorrect";

type TaskState = {
  audioPlays: number;
  finalAt?: string;
  finalElapsed?: number;
  reliance?: Reliance;
};

type LogEntry = {
  id: string;
  planId: PlanId;
  task: number;
  action: string;
  detail: string;
  timestamp: string;
  elapsed: number;
};

type InstructionOption = {
  audioSrc: string;
  text: string;
  tone?: "blue" | "green";
};

type Task = {
  name: string;
  correctOptions: InstructionOption[];
  incorrectOptions?: InstructionOption[];
  mainKind: CueKind;
};

type Plan = {
  id: PlanId;
  code: string;
  eyebrow: string;
  title: string;
  description: string;
  tasks: Task[];
};

const plans: Plan[] = [
  {
    id: "sandwich",
    code: "A",
    eyebrow: "WIZARD OF OZ · TASK A",
    title: "Sandwich plan",
    description:
      "Choose a blue alternative correct option or a red incorrect instruction, mark the participant's final act, then classify their reliance.",
    tasks: [
      {
        name: "Bread",
        correctOptions: [
          {
            text: "Take a piece of bread and put in a plate.",
            audioSrc: "/audio/sandwich/step01_main_take_bread.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Ketchup",
        correctOptions: [
          {
            text: "Add ketchup",
            audioSrc: "/audio/sandwich/step02_alt_add_ketchup.mp3",
          },
        ],
        incorrectOptions: [
          {
            text: "Add ketchup and salt",
            audioSrc: "/audio/sandwich/step02_main_add_ketchup_salt.mp3",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Cheese",
        correctOptions: [
          {
            text: "Add a piece of cheese.",
            audioSrc: "/audio/sandwich/step03_main_add_cheese.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Ham",
        correctOptions: [
          {
            text: "Add a piece of ham.",
            audioSrc: "/audio/sandwich/step04_main_add_ham.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Bread",
        correctOptions: [
          {
            text: "Add bread",
            audioSrc: "/audio/sandwich/step05_alt_add_bread.mp3",
          },
        ],
        incorrectOptions: [
          {
            text: "Put celery into this",
            audioSrc: "/audio/sandwich/step05_main_put_celery.mp3",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Microwave",
        correctOptions: [
          {
            text: "Put into microwave.",
            audioSrc: "/audio/sandwich/step06_main_put_microwave.mp3",
          },
        ],
        mainKind: "correct",
      },
    ],
  },
  {
    id: "shelf",
    code: "B",
    eyebrow: "WIZARD OF OZ · TASK B",
    title: "Shelf assembly plan",
    description:
      "Guide the eight-step yellow-piece assembly, mark the final act, and classify the participant's reliance at each step.",
    tasks: [
      {
        name: "Take the yellow labeled piece (left side)",
        correctOptions: [
          {
            text: "Take a yellow piece",
            audioSrc:
              "/audio/yellow-piece-assembly/step01_main_take_yellow_piece.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Insert the bottom at slot 1",
        correctOptions: [
          {
            text: "Take a green piece and insert to slot 1 of the yellow piece",
            audioSrc:
              "/audio/yellow-piece-assembly/step02_main_green_slot1.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Insert a mid-layer at slot 2",
        correctOptions: [],
        incorrectOptions: [
          {
            text: "Insert a green piece into slot 2",
            audioSrc:
              "/audio/yellow-piece-assembly/step03_main_green_slot2.mp3",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Insert a mid-layer at slot 3",
        correctOptions: [
          {
            text: "Insert a green piece to slot 3 of the yellow piece",
            audioSrc:
              "/audio/yellow-piece-assembly/step04_main_green_slot3.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Insert a mid-layer at slot 4",
        correctOptions: [
          {
            text: "Insert a green piece to slot 4 of the yellow piece",
            audioSrc:
              "/audio/yellow-piece-assembly/step05_main_green_slot4.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Insert a top-layer at slot 5",
        correctOptions: [
          {
            text: "Insert a red piece to slot 5 of the yellow piece",
            audioSrc:
              "/audio/yellow-piece-assembly/step06_main_red_slot5.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Insert right-layer at the right side",
        correctOptions: [
          {
            text: "Insert a yellow piece on the right side",
            audioSrc:
              "/audio/yellow-piece-assembly/step07_alt_yellow_right.mp3",
          },
          {
            text: "replace the green piece slot 2 with the red piece",
            audioSrc:
              "/audio/yellow-piece-assembly/step07_alt_replace_green_red.mp3",
            tone: "green",
          },
        ],
        incorrectOptions: [
          {
            text: "Insert a black piece (back) on the right side",
            audioSrc:
              "/audio/yellow-piece-assembly/step07_main_black_back_right.mp3",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Insert the back",
        correctOptions: [
          {
            text: "Insert a black piece on the back side",
            audioSrc:
              "/audio/yellow-piece-assembly/step08_main_black_back.mp3",
          },
        ],
        mainKind: "correct",
      },
    ],
  },
  {
    id: "boba",
    code: "C",
    eyebrow: "WIZARD OF OZ · TASK C",
    title: "Boba tea plan",
    description:
      "Control the ten-step strawberry matcha drink study, including alternative recovery prompts and reliance classification.",
    tasks: [
      {
        name: "Take a cup",
        correctOptions: [
          {
            text: "Take an empty cup and put in front of you",
            audioSrc:
              "/audio/strawberry-matcha-drink/step01_main_take_cup.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Add strawberry sugar syrup",
        correctOptions: [
          {
            text: "Add strawberry sugar syrup into the cup",
            audioSrc:
              "/audio/strawberry-matcha-drink/step02_main_add_strawberry_syrup.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Add boba and coat every pearl",
        correctOptions: [
          {
            text: "Add boba",
            audioSrc:
              "/audio/strawberry-matcha-drink/step03_alt_add_boba.mp3",
          },
        ],
        incorrectOptions: [
          {
            text: "Add boba and a few lemon drops.",
            audioSrc:
              "/audio/strawberry-matcha-drink/step03_main_add_boba_lemon.mp3",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Add strawberry yogurt as a bottom layer",
        correctOptions: [
          {
            text: "Add strawberry yogurt as the bottom layer",
            audioSrc:
              "/audio/strawberry-matcha-drink/step04_main_add_strawberry_yogurt.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Take a second cup",
        correctOptions: [
          {
            text: "Take a second empty cup",
            audioSrc:
              "/audio/strawberry-matcha-drink/step05_main_take_second_cup.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Mix milk and coconut milk in the 2nd cup",
        correctOptions: [
          {
            text: "Take a second empty cup",
            audioSrc:
              "/audio/strawberry-matcha-drink/step06_main_take_second_cup.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Pour into the first cup as the 2nd layer",
        correctOptions: [
          {
            text: "Pour into the first cup as the 2nd layer",
            audioSrc:
              "/audio/strawberry-matcha-drink/step07_main_pour_second_layer.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Pour matcha cream on the top of the first cup",
        correctOptions: [
          {
            text: "Pour in the matcha cream on top as 3rd layer",
            audioSrc:
              "/audio/strawberry-matcha-drink/step08_alt_matcha_third_layer.mp3",
          },
        ],
        incorrectOptions: [
          {
            text: "Pour in the matcha cream and stir until evenly mixed.",
            audioSrc:
              "/audio/strawberry-matcha-drink/step08_main_pour_matcha_stir.mp3",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Add matcha powder on top",
        correctOptions: [
          {
            text: "Add matcha powder on the top",
            audioSrc:
              "/audio/strawberry-matcha-drink/step09_main_add_matcha_powder.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Add a straw and taste",
        correctOptions: [
          {
            text: "Add a straw and have a taste",
            audioSrc:
              "/audio/strawberry-matcha-drink/step10_main_add_straw.mp3",
          },
        ],
        mainKind: "correct",
      },
    ],
  },
  {
    id: "table",
    code: "D",
    eyebrow: "WIZARD OF OZ · TASK D",
    title: "Table assembly plan",
    description:
      "Control the twelve-step table assembly study from the first side structure through the three box assemblies.",
    tasks: [
      {
        name: "Take side 2",
        correctOptions: [
          {
            text: "Take a No.3 piece",
            audioSrc: "/audio/box-assembly/step01_main_take_no3.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Insert mid-layer 2 into side 2",
        correctOptions: [
          {
            text: "Connect a No.4 piece with the No.3 piece",
            audioSrc:
              "/audio/box-assembly/step02_main_connect_no4_no3.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Insert side 3 between side 2 and mid-layer 2",
        correctOptions: [
          {
            text: "Connect another No.3 piece with No.4 piece",
            audioSrc:
              "/audio/box-assembly/step03_alt_connect_another_no3_no4.mp3",
          },
        ],
        incorrectOptions: [
          {
            text: "Connect the No.1 piece with the No.4 piece",
            audioSrc:
              "/audio/box-assembly/step03_main_connect_no1_no4.mp3",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Insert mid-layer 1 between sides 2 and 3",
        correctOptions: [
          {
            text: "(Optional) Replace the No.1 piece with the No.3 piece",
            audioSrc:
              "/audio/box-assembly/step04_alt_optional_replace_no1_no3.mp3",
          },
          {
            text: "Insert a No.6 piece between the 2 No.3 pieces",
            audioSrc:
              "/audio/box-assembly/step04_alt_insert_no6_between_no3.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Connect the top with sides 2 and 3",
        correctOptions: [
          {
            text: "Insert the No.1 piece on top of the 2 No.3 pieces",
            audioSrc:
              "/audio/box-assembly/step05_main_no1_on_two_no3.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Connect side 1 with the top",
        correctOptions: [
          {
            text: "Connect the No.1 piece and No.2 piece",
            audioSrc:
              "/audio/box-assembly/step06_main_connect_no1_no2.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Connect the (A) left, back, right, and front pieces",
        correctOptions: [],
        incorrectOptions: [
          {
            text: "Take two No.5 pieces and two No.9 pieces and connect together into a box",
            audioSrc: "/audio/box-assembly/step07_main_box_a.mp3",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Connect the (A) bottom with the remaining parts and insert",
        correctOptions: [
          {
            text: "Connect the No.7 piece with the box assembly",
            audioSrc:
              "/audio/box-assembly/step08_main_connect_no7_box.mp3",
          },
          {
            text: "replace the No.9 with No.6 pieces and connect with No.5 pieces",
            audioSrc:
              "/audio/box-assembly/step08_alt_replace_no9_no6.mp3",
            tone: "green",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Connect the (C) left, back, right, and front pieces",
        correctOptions: [
          {
            text: "Take two No.5 pieces and two No.6 pieces and connect together into a box",
            audioSrc: "/audio/box-assembly/step09_main_box_c.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Connect the (C) bottom with the remaining parts and insert",
        correctOptions: [
          {
            text: "Connect the No.7 piece with the box assembly",
            audioSrc:
              "/audio/box-assembly/step10_main_connect_no7_box.mp3",
          },
        ],
        mainKind: "correct",
      },
      {
        name: "Connect the (B) left, back, right, and front pieces",
        correctOptions: [
          {
            text: "replace the No.6 with No.9 pieces",
            audioSrc:
              "/audio/box-assembly/step11_alt_replace_no6_no9.mp3",
          },
        ],
        incorrectOptions: [
          {
            text: "Take two No.8 pieces and two No.6 pieces and connect together into a box",
            audioSrc: "/audio/box-assembly/step11_main_box_b.mp3",
          },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Connect the (B) bottom with the remaining parts and insert",
        correctOptions: [
          {
            text: "Connect the No.7 piece with the box assembly",
            audioSrc:
              "/audio/box-assembly/step12_main_connect_no7_box.mp3",
          },
        ],
        mainKind: "correct",
      },
    ],
  },
];

const relianceOptions: { key: Reliance; label: string; short: string }[] = [
  { key: "app-rely", label: "Appropriate reliance", short: "App Rely" },
  { key: "over-rely", label: "Over reliance", short: "Over Rely" },
  { key: "under-rely", label: "Under reliance", short: "Under Rely" },
  { key: "app-reject", label: "Appropriate rejection", short: "App Reject" },
];

const STORAGE_KEY = "cogar-control-console-v2";

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

function emptyPlanState(plan: Plan): Record<number, TaskState> {
  return Object.fromEntries(
    plan.tasks.map((_, index) => [index + 1, { audioPlays: 0 }]),
  );
}

function emptyTaskState(): Record<PlanId, Record<number, TaskState>> {
  return Object.fromEntries(
    plans.map((plan) => [plan.id, emptyPlanState(plan)]),
  ) as Record<PlanId, Record<number, TaskState>>;
}

export default function Home() {
  const [activePlanIndex, setActivePlanIndex] = useState(0);
  const [turnDirection, setTurnDirection] = useState<"next" | "previous">(
    "next",
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [taskState, setTaskState] =
    useState<Record<PlanId, Record<number, TaskState>>>(emptyTaskState);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [playingCue, setPlayingCue] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const activePlan = plans[activePlanIndex];
  const activeState = taskState[activePlan.id] ?? emptyPlanState(activePlan);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    let restored:
      | {
          activePlanIndex?: number;
          startedAt?: number | null;
          taskState?: Record<PlanId, Record<number, TaskState>>;
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
        setActivePlanIndex(
          Math.min(Math.max(restored.activePlanIndex ?? 0, 0), plans.length - 1),
        );
        setStartedAt(restored.startedAt ?? null);
        setTaskState({
          ...emptyTaskState(),
          ...(restored.taskState ?? {}),
        });
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
      JSON.stringify({ activePlanIndex, startedAt, taskState, logs }),
    );
  }, [activePlanIndex, hydrated, logs, startedAt, taskState]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const elapsed = startedAt
    ? Math.max(0, Math.floor((now - startedAt) / 1000))
    : 0;
  const completed = Object.values(activeState).filter(
    (item) => item.finalAt,
  ).length;
  const classified = Object.values(activeState).filter(
    (item) => item.reliance,
  ).length;
  const progress = Math.round(
    ((completed + classified) / (activePlan.tasks.length * 2)) * 100,
  );
  const allTaskStates = Object.values(taskState).flatMap((state) =>
    Object.values(state),
  );
  const allComplete =
    allTaskStates.length > 0 &&
    allTaskStates.every((state) => state.finalAt && state.reliance);

  const ensureStarted = () => {
    if (startedAt) return;
    setStartedAt(new Date().getTime());
  };

  const addLog = (
    planId: PlanId,
    task: number,
    action: string,
    detail: string,
  ) => {
    const timestamp = new Date().toISOString();
    const elapsedAtAction = startedAt
      ? Math.max(
          0,
          Math.floor((new Date().getTime() - startedAt) / 1000),
        )
      : 0;
    setLogs((current) => [
      {
        id: crypto.randomUUID(),
        planId,
        task,
        action,
        detail,
        timestamp,
        elapsed: elapsedAtAction,
      },
      ...current,
    ]);
  };

  const updateTask = (
    planId: PlanId,
    taskNumber: number,
    update: (current: TaskState) => TaskState,
  ) => {
    setTaskState((current) => ({
      ...current,
      [planId]: {
        ...current[planId],
        [taskNumber]: update(
          current[planId]?.[taskNumber] ?? { audioPlays: 0 },
        ),
      },
    }));
  };

  const playInstruction = (
    planId: PlanId,
    taskNumber: number,
    option: InstructionOption,
    kind: CueKind,
    optionIndex = 0,
    shouldRecord = true,
    actionLabel?: string,
  ) => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;

    const audio = new Audio(option.audioSrc);
    audio.preload = "auto";
    audio.onended = () => setPlayingCue(null);
    audio.onerror = () => setPlayingCue(null);
    audioRef.current = audio;
    setPlayingCue(`${planId}-${taskNumber}-${kind}-${optionIndex}`);
    void audio.play().catch(() => setPlayingCue(null));

    if (shouldRecord) {
      ensureStarted();
      updateTask(planId, taskNumber, (current) => ({
        ...current,
        audioPlays: current.audioPlays + 1,
      }));
      addLog(
        planId,
        taskNumber,
        actionLabel ??
          (kind === "correct"
            ? "Alternative correct option"
            : "Incorrect instruction"),
        option.text,
      );
    }
  };

  const markFinalAct = (planId: PlanId, taskNumber: number) => {
    ensureStarted();
    const timestamp = new Date().toISOString();
    const elapsedAtAction = startedAt
      ? Math.max(
          0,
          Math.floor((new Date().getTime() - startedAt) / 1000),
        )
      : 0;
    updateTask(planId, taskNumber, (current) => ({
      ...current,
      finalAt: timestamp,
      finalElapsed: elapsedAtAction,
    }));
    addLog(
      planId,
      taskNumber,
      "Final act",
      `Marked at ${formatClock(timestamp)}`,
    );
  };

  const markReliance = (
    planId: PlanId,
    taskNumber: number,
    reliance: Reliance,
  ) => {
    ensureStarted();
    const option = relianceOptions.find((item) => item.key === reliance)!;
    updateTask(planId, taskNumber, (current) => ({
      ...current,
      reliance,
    }));
    addLog(planId, taskNumber, "Reliance", option.label);
  };

  const goToPlan = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= plans.length) return;
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingCue(null);
    setTurnDirection(nextIndex > activePlanIndex ? "next" : "previous");
    setActivePlanIndex(nextIndex);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const distance = endX - touchStartX.current;
    touchStartX.current = null;
    if (distance < -60) goToPlan(activePlanIndex + 1);
    if (distance > 60) goToPlan(activePlanIndex - 1);
  };

  const resetSession = () => {
    if (!window.confirm("Reset this session and remove all local records?"))
      return;
    audioRef.current?.pause();
    audioRef.current = null;
    setStartedAt(null);
    setTaskState(emptyTaskState());
    setLogs([]);
    setPlayingCue(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const exportCsv = () => {
    const header = [
      "plan",
      "task",
      "step",
      "action",
      "detail",
      "timestamp_iso",
      "elapsed",
    ];
    const rows = [...logs].reverse().map((entry) => {
      const plan = plans.find((item) => item.id === entry.planId)!;
      return [
        plan.title,
        entry.task,
        plan.tasks[entry.task - 1].name,
        entry.action,
        entry.detail,
        entry.timestamp,
        formatElapsed(entry.elapsed),
      ];
    });
    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cogar-${new Date().toISOString().slice(0, 19)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const sessionLabel = useMemo(() => {
    if (!startedAt) return "Ready";
    if (allComplete) return "Complete";
    return "Live session";
  }, [allComplete, startedAt]);

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
          <div className={`live-pill ${startedAt ? "is-live" : ""}`}>
            <span aria-hidden="true" />
            {sessionLabel}
          </div>
          <div
            className="timer"
            aria-label={`Session elapsed time ${formatElapsed(elapsed)}`}
          >
            <small>SESSION TIME</small>
            <strong>{formatElapsed(elapsed)}</strong>
          </div>
          <button className="ghost-button" type="button" onClick={resetSession}>
            Reset session
          </button>
        </div>
      </header>

      <nav className="plan-tabs" aria-label="Task plans">
        {plans.map((plan, index) => (
          <button
            type="button"
            className={index === activePlanIndex ? "is-active" : ""}
            onClick={() => goToPlan(index)}
            aria-current={index === activePlanIndex ? "page" : undefined}
            key={plan.id}
          >
            <span>{plan.code}</span>
            {plan.title}
          </button>
        ))}
        <p>
          {String(activePlanIndex + 1).padStart(2, "0")} /{" "}
          {String(plans.length).padStart(2, "0")}
        </p>
      </nav>

      <div
        className="page-stage"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activePlanIndex > 0 && (
          <button
            type="button"
            className="page-arrow page-arrow-previous"
            onClick={() => goToPlan(activePlanIndex - 1)}
            aria-label={`Previous task: ${plans[activePlanIndex - 1].title}`}
            title={`Previous: ${plans[activePlanIndex - 1].title}`}
          >
            ←
          </button>
        )}
        {activePlanIndex < plans.length - 1 && (
          <button
            type="button"
            className="page-arrow page-arrow-next"
            onClick={() => goToPlan(activePlanIndex + 1)}
            aria-label={`Next task: ${plans[activePlanIndex + 1].title}`}
            title={`Next: ${plans[activePlanIndex + 1].title}`}
          >
            →
          </button>
        )}

        <div
          className={`plan-page turn-${turnDirection}`}
          key={activePlan.id}
        >
          <section className="intro">
            <div className="plan-heading">
              <div className="plan-code" aria-hidden="true">
                {activePlan.code}
              </div>
              <div>
                <p className="eyebrow">{activePlan.eyebrow}</p>
                <h2>{activePlan.title}</h2>
                <p className="intro-copy">{activePlan.description}</p>
              </div>
            </div>
            <div className="progress-card">
              <div className="progress-copy">
                <span>Task progress</span>
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
                {completed}/{activePlan.tasks.length} final acts · {classified}/
                {activePlan.tasks.length} classified
              </p>
            </div>
          </section>

          <section
            className="console-card"
            aria-label={`${activePlan.title} control matrix`}
          >
            <div className="matrix-scroll">
              <div className="matrix" role="table" aria-label="Task control matrix">
                <div className="matrix-header" role="row">
                  <div className="step-heading" role="columnheader">
                    <span>Task sequence &amp; instructions</span>
                    <span className="cue-legend">
                      <span className="legend-correct">Correct</span>
                      <span className="legend-recovery">Recovery</span>
                      <span className="legend-incorrect">Incorrect</span>
                    </span>
                  </div>
                  <div role="columnheader">AI audio</div>
                  <div role="columnheader">Final act</div>
                  {relianceOptions.map((option) => (
                    <div role="columnheader" key={option.key}>
                      {option.short}
                    </div>
                  ))}
                </div>

                {activePlan.tasks.map((task, index) => {
                  const taskNumber = index + 1;
                  const state = activeState[taskNumber] ?? { audioPlays: 0 };
                  return (
                    <div
                      className={`matrix-row ${
                        state.finalAt ? "is-complete" : ""
                      }`}
                      role="row"
                      key={`${task.name}-${taskNumber}`}
                    >
                      <div className="task-cell" role="rowheader">
                        <div className="step-number">
                          {String(taskNumber).padStart(2, "0")}
                        </div>
                        <div className="step-copy">
                          <strong>{task.name}</strong>
                          <div className="instruction-cues">
                            {task.correctOptions.map((option, optionIndex) => (
                              <button
                                type="button"
                                className={`cue-button cue-correct is-hint-only ${
                                  option.tone === "green" ? "cue-green" : ""
                                } ${
                                  playingCue ===
                                  `${activePlan.id}-${taskNumber}-correct-${optionIndex}`
                                    ? "is-playing"
                                    : ""
                                }`}
                                onClick={() =>
                                  playInstruction(
                                    activePlan.id,
                                    taskNumber,
                                    option,
                                    "correct",
                                    optionIndex,
                                    false,
                                  )
                                }
                                aria-label={`Play unlogged instruction preview ${
                                  optionIndex + 1
                                } for task ${taskNumber}: ${
                                  option.text
                                }`}
                                title="Preview only — no timestamp or event log"
                                data-testid={`${activePlan.id}-correct-option-${taskNumber}-${optionIndex}`}
                                key={option.audioSrc}
                              >
                                <span aria-hidden="true">▶</span>
                                {option.text}
                              </button>
                            ))}
                            {task.incorrectOptions?.map(
                              (option, optionIndex) => (
                                <button
                                  type="button"
                                  className={`cue-button cue-incorrect ${
                                    playingCue ===
                                    `${activePlan.id}-${taskNumber}-incorrect-${optionIndex}`
                                      ? "is-playing"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    playInstruction(
                                      activePlan.id,
                                      taskNumber,
                                      option,
                                      "incorrect",
                                      optionIndex,
                                      false,
                                    )
                                  }
                                  aria-label={`Play unlogged incorrect instruction preview ${
                                    optionIndex + 1
                                  } for task ${taskNumber}: ${option.text}`}
                                  title="Preview only — no timestamp or event log"
                                  data-testid={`${activePlan.id}-incorrect-option-${taskNumber}-${optionIndex}`}
                                  key={option.audioSrc}
                                >
                                  <span aria-hidden="true">▶</span>
                                  {option.text}
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      </div>

                      <div role="cell" className="action-cell">
                        <button
                          type="button"
                          className={`circle-button audio-button ${
                            playingCue ===
                            `${activePlan.id}-${taskNumber}-${task.mainKind}-0`
                              ? "is-playing"
                              : ""
                          }`}
                          onClick={() => {
                            const mainOption =
                              task.mainKind === "correct"
                                ? task.correctOptions[0]
                                : task.incorrectOptions![0];
                            playInstruction(
                              activePlan.id,
                              taskNumber,
                              mainOption,
                              task.mainKind,
                              0,
                              true,
                              "AI audio",
                            );
                          }}
                          aria-label={`Play main AI audio for task ${taskNumber}`}
                          title="Play main AI instruction"
                          data-testid={`${activePlan.id}-audio-${taskNumber}`}
                        >
                          <span className="speaker-icon" aria-hidden="true">
                            ▶
                          </span>
                        </button>
                        <small>
                          {state.audioPlays ? `${state.audioPlays}×` : "Play"}
                        </small>
                      </div>

                      <div role="cell" className="action-cell">
                        <button
                          type="button"
                          className={`circle-button final-button ${
                            state.finalAt ? "is-selected" : ""
                          }`}
                          onClick={() =>
                            markFinalAct(activePlan.id, taskNumber)
                          }
                          aria-label={`Mark final act timestamp for task ${taskNumber}`}
                          aria-pressed={Boolean(state.finalAt)}
                          title="Mark final act"
                          data-testid={`${activePlan.id}-final-${taskNumber}`}
                        >
                          <span aria-hidden="true">
                            {state.finalAt ? "✓" : "＋"}
                          </span>
                        </button>
                        <small>
                          {state.finalAt
                            ? formatClock(state.finalAt)
                            : "Mark"}
                        </small>
                      </div>

                      {relianceOptions.map((option) => {
                        const selected = state.reliance === option.key;
                        return (
                          <div
                            role="cell"
                            className="action-cell"
                            key={option.key}
                          >
                            <button
                              type="button"
                              className={`circle-button reliance-button ${
                                selected ? "is-selected" : ""
                              }`}
                              onClick={() =>
                                markReliance(
                                  activePlan.id,
                                  taskNumber,
                                  option.key,
                                )
                              }
                              aria-label={`${option.label} for task ${taskNumber}`}
                              aria-pressed={selected}
                              title={option.label}
                              data-testid={`${activePlan.id}-${option.key}-${taskNumber}`}
                            >
                              <span aria-hidden="true">
                                {selected ? "✓" : ""}
                              </span>
                            </button>
                            <small>
                              {selected ? "Selected" : option.short}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="log-card">
        <div className="log-header">
          <div>
            <p className="eyebrow">LOCAL RECORD · ALL TASKS</p>
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
            {logs.slice(0, 8).map((entry) => {
              const logPlan = plans.find(
                (plan) => plan.id === entry.planId,
              )!;
              return (
                <article className="log-item" key={entry.id}>
                  <div className="log-task">
                    {logPlan.code}
                    {entry.task}
                  </div>
                  <div>
                    <strong>{entry.action}</strong>
                    <p>{entry.detail}</p>
                  </div>
                  <time dateTime={entry.timestamp}>
                    {formatElapsed(entry.elapsed)}
                    <span>{formatClock(entry.timestamp)}</span>
                  </time>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-log">
            <span aria-hidden="true">◎</span>
            <p>Actions from both task plans will appear here with timestamps.</p>
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
