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
      "Review the table assembly recording from first side structure through box assemblies.",
    tasks: [
      {
        name: "Take side 2",
        correctOptions: [{ text: "Take a No.3 piece" }],
        mainKind: "correct",
      },
      {
        name: "Insert mid-layer 2 into side 2",
        correctOptions: [{ text: "Connect a No.4 piece with the No.3 piece" }],
        mainKind: "correct",
      },
      {
        name: "Insert side 3 between side 2 and mid-layer 2",
        correctOptions: [{ text: "Connect another No.3 piece with No.4 piece" }],
        incorrectOptions: [{ text: "Connect the No.1 piece with the No.4 piece" }],
        mainKind: "incorrect",
      },
      {
        name: "Insert mid-layer 1 between sides 2 and 3",
        correctOptions: [
          { text: "Replace the No.1 piece with the No.3 piece" },
          { text: "Insert a No.6 piece between the 2 No.3 pieces", tone: "green" },
        ],
        mainKind: "correct",
      },
      {
        name: "Connect the top with sides 2 and 3",
        correctOptions: [{ text: "Insert the No.1 piece on top" }],
        mainKind: "correct",
      },
      {
        name: "Connect side 1 with the top",
        correctOptions: [{ text: "Connect the No.1 piece and No.2 piece" }],
        mainKind: "correct",
      },
      {
        name: "Connect the (A) left, back, right, and front pieces",
        correctOptions: [],
        incorrectOptions: [
          { text: "Take two No.5 pieces and two No.9 pieces into a box" },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Connect the (A) bottom and insert",
        correctOptions: [
          { text: "Connect the No.7 piece with the box assembly" },
          { text: "Replace the No.9 with No.6 pieces", tone: "green" },
        ],
        mainKind: "correct",
      },
      {
        name: "Connect the (C) left, back, right, and front pieces",
        correctOptions: [
          { text: "Take two No.5 pieces and two No.6 pieces into a box" },
        ],
        mainKind: "correct",
      },
      {
        name: "Connect the (C) bottom and insert",
        correctOptions: [{ text: "Connect the No.7 piece with the box assembly" }],
        mainKind: "correct",
      },
      {
        name: "Connect the (B) left, back, right, and front pieces",
        correctOptions: [{ text: "Replace the No.6 with No.9 pieces" }],
        incorrectOptions: [
          { text: "Take two No.8 pieces and two No.6 pieces into a box" },
        ],
        mainKind: "incorrect",
      },
      {
        name: "Connect the (B) bottom and insert",
        correctOptions: [{ text: "Connect the No.7 piece with the box assembly" }],
        mainKind: "correct",
      },
    ],
  },
];
