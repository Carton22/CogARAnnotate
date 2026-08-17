export type PlanId = "training" | "sandwich" | "shelf" | "boba" | "table";

export type CueKind = "correct" | "incorrect";

export type InstructionOption = {
  audioSrc?: string;
  text: string;
  tone?: "blue" | "green" | "red";
};

export type Task = {
  name: string;
  correctOptions: InstructionOption[];
  incorrectOptions?: InstructionOption[];
  recoveryOptions?: InstructionOption[];
  mainKind: CueKind;
};

export type Plan = {
  id: PlanId;
  code: string;
  eyebrow: string;
  title: string;
  annotationTitle: string;
  description: string;
  tasks: Task[];
};

const DISTRACTOR_INSERT_WINDOWS = [
  { label: "A", allowedAfterCorrectSteps: [1, 2, 3] },
  { label: "B", allowedAfterCorrectSteps: [3, 4, 5] },
  { label: "C", allowedAfterCorrectSteps: [5, 6, 7] },
];
const PARTICIPANT_COUNTERBALANCE_COUNT = 36;

const trainingCorrectSteps = [
  "Put a long piece on the ground",
  "Put a square piece at slot 1",
  "Put a square piece at slot 2",
  "Put a square piece at slot 3",
  "Put a square piece at slot 4",
  "Put a long piece on the top",
];
const trainingTasks: Task[] = [
  ...trainingCorrectSteps.slice(0, 3).map((text) => ({
    name: text,
    correctOptions: [{ text }],
    mainKind: "correct" as const,
  })),
  {
    name: "Put a long piece on the top",
    correctOptions: [],
    incorrectOptions: [{ text: "Put a long piece on the top" }],
    mainKind: "incorrect",
  },
  ...trainingCorrectSteps.slice(3).map((text) => ({
    name: text,
    correctOptions: [{ text }],
    mainKind: "correct" as const,
  })),
];
const sandwichCorrectSteps = [
  "Take a plate",
  "Put a bread into the plate",
  "Add a piece of cheese",
  "Add a piece of ham",
  "Add ketchup",
  "Add a bread on top",
  "Put into microwave",
];
const shelfCorrectSteps = [
  "Classify the pieces based on color",
  "Insert a green at slot 1 of the yellow",
  "Insert a pink piece at slot 2 of the yellow",
  "Insert another 2 pink at slot 3 and 4 of the yellow",
  "Insert a green piece at slot 5",
  "Connect another yellow piece with the greens and pinks",
  "Connect a blue piece with the 2 green",
];
const bobaCorrectSteps = [
  "Add strawberry sugar syrup into a cup",
  "Add boba",
  "Add strawberry yogurt as the bottom layer",
  "Pour matcha latte into the cup",
  "Pour coconut milk into the cup",
  "Add milk cream on the top",
  "Put a lid on the cup",
];
const tableCorrectSteps = [
  "Insert a No.4 at slot 1 of a No.3",
  "Connect another No.3 with the No.4",
  "Insert a No.4 at slot 2 of the No.3",
  "Connect a No.1 on top of the 2 No.3",
  "Connect a No.2 with the No.1",
  "Connect 2 No.5 with a No.6",
  "Connect another No.6 with the No.5",
];

const randomizedTaskConfigs = {
  sandwich: {
    correctSteps: sandwichCorrectSteps,
    distractorSteps: [
      "Add peppers",
      "Add the green celery",
      "Add water into a cup",
    ],
  },
  shelf: {
    correctSteps: shelfCorrectSteps,
    distractorSteps: [
      "Insert a purple piece at slot 3 of the yellow",
      "Insert a brown piece at slot 5",
      "Connect the black piece with the 2 green pieces",
    ],
    recoverySteps: [
      "remove the purple piece at slot 3, because the size doesn't match",
      "remove the brown piece at slot 5, because the shape doesn't match",
      "Remove the black piece, because the size doesn't match",
    ],
  },
  boba: {
    correctSteps: bobaCorrectSteps,
    distractorSteps: [
      "grab the left bottle to add white sugar",
      "use a fork to add matcha powder",
      "Insert a white straw",
    ],
    recoverySteps: [
      "grab the right bottle to add white sugar",
      "Use a spoon to add matcha powder",
      "Oh, replace the straw with a bigger black straw for boba",
    ],
  },
  table: {
    correctSteps: tableCorrectSteps,
    distractorSteps: [
      "Take a cutting knife",
      "Connect a No.5 with a No.9",
      "Connect a No.6 with a No.8",
    ],
  },
} satisfies Record<
  "sandwich" | "shelf" | "boba" | "table",
  { correctSteps: string[]; distractorSteps: string[]; recoverySteps?: string[] }
>;

function seededRandom(seedText: string) {
  let seed = 2166136261;
  for (const character of seedText) { seed ^= character.charCodeAt(0); seed = Math.imul(seed, 16777619); }
  return () => { seed += 0x6d2b79f5; let value = seed; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; };
}

function participantNumber(participantId: string) {
  const numeric = Number(participantId.replace(/\D/g, ""));
  return numeric >= 1 && numeric <= 36 ? numeric : 1;
}

export const plans: Plan[] = [
  {
    id: "training",
    code: "T",
    eyebrow: "POST-TASK ANNOTATION · TRAINING",
    title: "Training plan",
    annotationTitle: "Training annotation",
    description:
      "Annotate the participant's training task before the study tasks.",
    tasks: trainingTasks,
  },
  {
    id: "sandwich",
    code: "A",
    eyebrow: "POST-TASK ANNOTATION · TASK A",
    title: "Sandwich plan",
    annotationTitle: "Sandwich annotation",
    description:
      "Annotate the participant's step boundaries, reliance, confidence, and cognitive state while reviewing the RGB recording.",
    tasks: sandwichCorrectSteps.map((text) => ({
      name: text,
      correctOptions: [{ text }],
      mainKind: "correct",
    })),
  },
  {
    id: "shelf",
    code: "B",
    eyebrow: "POST-TASK ANNOTATION · TASK B",
    title: "Shelf assembly plan",
    annotationTitle: "Shelf assembly annotation",
    description:
      "Review the shelf assembly recording and label each step with one reliance and cognitive-state judgment.",
    tasks: shelfCorrectSteps.map((text) => ({
      name: text,
      correctOptions: [{ text }],
      mainKind: "correct",
    })),
  },
  {
    id: "boba",
    code: "C",
    eyebrow: "POST-TASK ANNOTATION · TASK C",
    title: "Boba tea plan",
    annotationTitle: "Boba tea annotation",
    description:
      "Annotate the strawberry matcha drink recording with task-step timing and step-level cognitive labels.",
    tasks: bobaCorrectSteps.map((text) => ({
      name: text,
      correctOptions: [{ text }],
      mainKind: "correct",
    })),
  },
  {
    id: "table",
    code: "D",
    eyebrow: "POST-TASK ANNOTATION · TASK D",
    title: "Table assembly plan",
    annotationTitle: "Table assembly annotation",
    description:
      "Review the participant-specific table assembly recording with the CogARReliance task sequence.",
    tasks: tableCorrectSteps.map((text) => ({
      name: text,
      correctOptions: [{ text }],
      mainKind: "correct",
    })),
  },
];

export function planForParticipant(planId: PlanId, participantId: string): Plan {
  const base = plans.find((plan) => plan.id === planId) ?? plans[0];
  if (planId === "training") return base;
  const config = randomizedTaskConfigs[planId];
  const numericParticipantId = participantNumber(participantId);
  const buckets = new Map<number, Task[]>();
  for (const [index, text] of config.distractorSteps.entries()) {
    const allowedAfterCorrectSteps =
      DISTRACTOR_INSERT_WINDOWS[index].allowedAfterCorrectSteps;
    const insertAfterCorrectStep = counterbalancedChoice(
      allowedAfterCorrectSteps,
      planId,
      index,
      numericParticipantId,
    );
    const bucket = buckets.get(insertAfterCorrectStep) ?? [];
    bucket.push({
      name: text,
      correctOptions: [],
      incorrectOptions: [{ text }],
      recoveryOptions: config.recoverySteps?.[index]
        ? [{ text: config.recoverySteps[index] }]
        : undefined,
      mainKind: "incorrect",
    });
    buckets.set(insertAfterCorrectStep, bucket);
  }
  const tasks = config.correctSteps.flatMap((text, index) => [
    { name: text, correctOptions: [{ text }], mainKind: "correct" as const },
    ...(buckets.get(index + 1) ?? []),
  ]);
  return { ...base, tasks };
}

const counterbalanceOrderCache = new Map<string, number[]>();

function counterbalancedChoice<T>(
  values: T[],
  planId: "sandwich" | "shelf" | "boba" | "table",
  distractorIndex: number,
  participantId: number,
) {
  const participantIndex = normalizedParticipantIndex(participantId);
  const order = counterbalancedOrder(`${planId}-${distractorIndex}`, values.length);
  return values[order[participantIndex]];
}

function normalizedParticipantIndex(participantId: number) {
  const integerParticipantId = Number.isFinite(participantId)
    ? Math.trunc(participantId)
    : 1;
  return (
    ((integerParticipantId - 1) % PARTICIPANT_COUNTERBALANCE_COUNT) +
    PARTICIPANT_COUNTERBALANCE_COUNT
  ) % PARTICIPANT_COUNTERBALANCE_COUNT;
}

function counterbalancedOrder(seedText: string, bucketCount: number) {
  const cacheKey = `${seedText}-${bucketCount}`;
  const cached = counterbalanceOrderCache.get(cacheKey);
  if (cached) return cached;

  const order = Array.from(
    { length: PARTICIPANT_COUNTERBALANCE_COUNT },
    (_, index) => index % bucketCount,
  );
  shuffleInPlace(order, seededRandom(`counterbalance-${seedText}`));
  counterbalanceOrderCache.set(cacheKey, order);
  return order;
}

function shuffleInPlace<T>(values: T[], random: () => number) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
}
