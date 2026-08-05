export type PlanId = "sandwich" | "shelf" | "boba" | "table";

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

const shelfCorrectSteps = [
  "Classify the pieces based on color", "Take a yellow piece", "Take a green piece",
  "Insert a green piece at slot 1 of the yellow piece", "Take a pink piece",
  "Insert a pink piece at slot 2 of the yellow piece", "Insert another pink piece at slot 3 of the yellow piece",
  "Insert another pink piece at slot 4 of the yellow piece", "Take a green piece",
  "Align the orientations of the 2 green pieces", "Insert a green piece at slot 5 of the yellow piece",
  "Take a yellow piece", "Insert another yellow piece on the right of green and pink pieces mirroring the 1st yellow panel.",
  "Take a blue piece", "Insert a blue piece with green and pink pieces",
];
const bobaCorrectSteps = [
  "Take a cup", "Add strawberry sugar syrup into the cup", "Add boba into the cup", "Mix boba with the syrup",
  "Add the yogurt into the cup as a bottom layer", "Take a new cup", "Pour the matcha latte into the new cup",
  "Pour coconut milk into the matcha latte", "Mix up the matcha and the coconut milk", "Pour mixed matcha milk into the 1st cup",
  "Throw away the 2nd cup", "Grab the milk cream", "Add cream on top of the 1st cup", "Add matcha powder", "Add a straw",
];
const tableCorrectSteps = [
  "Insert a number four piece at slot one of a number three piece",
  "Connect the other side of the number four piece with a new number three piece",
  "Take another number four piece",
  "Insert the number four piece at slot two between the two number three pieces",
  "Connect the number one piece on top of the two number three pieces",
  "Connect a number two piece at the remaining slot of the number one piece",
  "Connect a number five piece with a number six piece",
  "Connect another number five piece with the number six piece",
  "Connect a second number six piece on the other end of the number five pieces",
  "Connect a number eight piece with a number nine piece",
  "Connect another number eight piece with the number nine piece",
  "Connect a second number nine piece on the other end of the number eight pieces",
  "Connect a number five piece with a number six piece",
  "Connect another number five piece with the number six piece",
  "Connect a second number six piece on the other end of the number five pieces",
];

const randomizedTaskConfigs = {
  shelf: {
    correctSteps: shelfCorrectSteps,
    distractorSteps: [
      "Take a scissors",
      "Insert a purple piece at slot 3",
      "Insert a pink piece at slot 5",
      "Take a black piece",
      "Take a marker pen",
    ],
  },
  boba: {
    correctSteps: bobaCorrectSteps,
    distractorSteps: [
      "Add white sugar to the cup",
      "Take one more plate",
      "Put a piece of lemon on the edge of the cup",
      "Pour out 25% portion of the first cup into the trash can",
      "Stir the cup",
    ],
  },
  table: {
    correctSteps: tableCorrectSteps,
    distractorSteps: [
      "Insert a number seven piece at slot two of a number three piece",
      "Take a number seven piece",
      "Connect a number five piece with a number nine piece",
      "Connect a number six piece with a number eight piece",
      "Take a cutting knife",
    ],
  },
} satisfies Record<
  "shelf" | "boba" | "table",
  { correctSteps: string[]; distractorSteps: string[] }
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
    id: "sandwich",
    code: "A",
    eyebrow: "POST-TASK ANNOTATION · TASK A",
    title: "Sandwich plan",
    annotationTitle: "Sandwich annotation",
    description:
      "Annotate the participant's step boundaries, reliance, confidence, and cognitive state while reviewing the RGB recording.",
    tasks: [
      {
        name: "Bread",
        correctOptions: [{ text: "Take a piece of bread and put in a plate." }],
        mainKind: "correct",
      },
      {
        name: "Ketchup",
        correctOptions: [{ text: "Add ketchup" }],
        incorrectOptions: [{ text: "Add ketchup and lemon pieces" }],
        mainKind: "incorrect",
      },
      {
        name: "Cheese",
        correctOptions: [{ text: "Add a piece of cheese." }],
        mainKind: "correct",
      },
      {
        name: "Ham",
        correctOptions: [{ text: "Add a piece of ham." }],
        mainKind: "correct",
      },
      {
        name: "Bread",
        correctOptions: [{ text: "Add bread" }],
        incorrectOptions: [{ text: "Put celery into this and add bread" }],
        mainKind: "incorrect",
      },
      {
        name: "Microwave",
        correctOptions: [{ text: "Put into microwave." }],
        mainKind: "correct",
      },
    ],
  },
  {
    id: "shelf",
    code: "B",
    eyebrow: "POST-TASK ANNOTATION · TASK B",
    title: "Shelf assembly plan",
    annotationTitle: "Shelf assembly annotation",
    description:
      "Review the shelf assembly recording and label each step with one reliance and cognitive-state judgment.",
    tasks: [
      {
        name: "Take the yellow labeled piece",
        correctOptions: [{ text: "Take a yellow piece" }],
        mainKind: "correct",
      },
      {
        name: "Insert the bottom at slot 1",
        correctOptions: [
          { text: "Take a green piece and insert to slot 1 of the yellow piece" },
        ],
        mainKind: "correct",
      },
      {
        name: "Insert a mid-layer at slot 2",
        correctOptions: [],
        incorrectOptions: [{ text: "Insert a green piece into slot 2" }],
        mainKind: "incorrect",
      },
      {
        name: "Insert a mid-layer at slot 3",
        correctOptions: [{ text: "Insert a pink piece to slot 3" }],
        mainKind: "correct",
      },
      {
        name: "Insert a mid-layer at slot 4",
        correctOptions: [{ text: "Insert a pink piece to slot 4" }],
        mainKind: "correct",
      },
      {
        name: "Insert a top-layer at slot 5",
        correctOptions: [{ text: "Insert a pink piece to slot 5" }],
        mainKind: "correct",
      },
      {
        name: "Insert right-layer at the right side",
        correctOptions: [
          { text: "Insert a yellow piece on the right side" },
          { text: "Replace the green piece slot 2 with the pink piece", tone: "green" },
        ],
        incorrectOptions: [{ text: "Insert a blue piece on the right side" }],
        mainKind: "incorrect",
      },
      {
        name: "Insert the back",
        correctOptions: [{ text: "Insert a blue piece on the back side" }],
        mainKind: "correct",
      },
    ],
  },
  {
    id: "boba",
    code: "C",
    eyebrow: "POST-TASK ANNOTATION · TASK C",
    title: "Boba tea plan",
    annotationTitle: "Boba tea annotation",
    description:
      "Annotate the strawberry matcha drink recording with task-step timing and step-level cognitive labels.",
    tasks: [
      {
        name: "Take a cup",
        correctOptions: [{ text: "Take an empty cup and put in front of you" }],
        mainKind: "correct",
      },
      {
        name: "Add strawberry sugar syrup",
        correctOptions: [{ text: "Add strawberry sugar syrup into the cup" }],
        mainKind: "correct",
      },
      {
        name: "Add boba and coat every pearl",
        correctOptions: [{ text: "Add boba" }],
        incorrectOptions: [{ text: "Add boba and a few peppers" }],
        mainKind: "incorrect",
      },
      {
        name: "Add strawberry yogurt as a bottom layer",
        correctOptions: [{ text: "Add strawberry yogurt as the bottom layer" }],
        mainKind: "correct",
      },
      {
        name: "Take a second cup",
        correctOptions: [{ text: "Take a second empty cup" }],
        mainKind: "correct",
      },
      {
        name: "Mix matcha latte and coconut milk",
        correctOptions: [{ text: "Mix matcha latte and coconut milk" }],
        mainKind: "correct",
      },
      {
        name: "Pour into the first cup as the 2nd layer",
        correctOptions: [{ text: "Pour into the first cup as the 2nd layer" }],
        mainKind: "correct",
      },
      {
        name: "Pour cream on top",
        correctOptions: [{ text: "Pour in the cream on top as 3rd layer" }],
        incorrectOptions: [
          { text: "Pour in the matcha cream and stir until evenly mixed." },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Add matcha powder on top",
        correctOptions: [{ text: "Add matcha powder on the top" }],
        mainKind: "correct",
      },
      {
        name: "Add a straw and taste",
        correctOptions: [{ text: "Add a straw and have a taste" }],
        mainKind: "correct",
      },
    ],
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
  if (planId !== "shelf" && planId !== "boba" && planId !== "table") return base;
  const config = randomizedTaskConfigs[planId];
  const random = seededRandom(`${planId}-${participantNumber(participantId)}`);
  const tasks = Array.from({ length: 5 }, (_, blockIndex) => {
    const block = config.correctSteps.slice(blockIndex * 3, blockIndex * 3 + 3).map((text) => ({
      name: text, correctOptions: [{ text }], mainKind: "correct" as const,
    }));
    const position = blockIndex === 0 ? 1 + Math.floor(random() * 3) : Math.floor(random() * 4);
    const text = config.distractorSteps[blockIndex];
    const distractor = { name: text, correctOptions: [], incorrectOptions: [{ text }], mainKind: "incorrect" as const };
    return [...block.slice(0, position), distractor, ...block.slice(position)];
  }).flat();
  return { ...base, tasks };
}
