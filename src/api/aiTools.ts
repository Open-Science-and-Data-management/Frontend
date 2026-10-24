import { z } from "zod";

/**
 * The complete set of things the assistant may ask for. There is deliberately
 * no tool that commits, approves, submits, completes or deletes — those are
 * acts with consequences, and they happen through the normal UI with a person
 * pressing the button. An injected instruction can only ever reach this list.
 */
export const TOOL_NAMES = [
  "recentAiActivity",
  "queryDmp",
  "explainField",
  "summarizeDmp",
  "checkReadiness",
  "proposeFieldChange",
  "proposeRewrite",
  "proposeAddTask",
  "proposeUpdateTask",
  "proposeAddDataset",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * Which tools are switched on. The plan is to widen this deliberately —
 * read-only first, then field proposals, then tasks — rather than opening
 * everything and hoping the guards hold.
 */
export const ENABLED_TOOLS: Record<ToolName, boolean> = {
  recentAiActivity: true,
  queryDmp: true,
  explainField: true,
  summarizeDmp: true,
  checkReadiness: true,
  proposeFieldChange: true,
  proposeRewrite: true,
  proposeAddTask: true,
  proposeUpdateTask: true,
  // A new research output changes what the committee approved; that belongs in
  // the form, not in a chat turn.
  proposeAddDataset: false,
};

export const toolCallSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("recentAiActivity") }),
  z.object({ tool: z.literal("queryDmp"), path: z.string().min(1) }),
  z.object({ tool: z.literal("explainField"), path: z.string().min(1) }),
  z.object({ tool: z.literal("summarizeDmp") }),
  z.object({ tool: z.literal("checkReadiness") }),
  z.object({
    tool: z.literal("proposeFieldChange"),
    path: z.string().min(1),
    value: z.unknown(),
  }),
  // "Make the description shorter": a rewrite of free text, drafted by the
  // model and proposed like any other change.
  z.object({
    tool: z.literal("proposeRewrite"),
    path: z.string().min(1),
    direction: z.union([
      z.object({ kind: z.enum(["shorter", "formal"]) }),
      z.object({
        kind: z.enum(["emphasize", "custom"]),
        detail: z.string().min(1),
      }),
    ]),
  }),
  z.object({
    tool: z.literal("proposeAddTask"),
    title: z.string().min(1),
    lifecycle_stage: z
      .enum(["collect", "process", "analyse", "preserve", "share"])
      .optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    details: z.string().optional(),
  }),
  z.object({
    tool: z.literal("proposeUpdateTask"),
    task_id: z.string().min(1),
    patch: z.record(z.unknown()),
  }),
  z.object({
    tool: z.literal("proposeAddDataset"),
    patch: z.record(z.unknown()),
  }),
]);

export type ToolCall = z.infer<typeof toolCallSchema>;

/**
 * What the planner is told about the plan. Counts and ids only — never the
 * document's prose. Content from an uploaded proposal is data to be reasoned
 * about, not instructions to follow, and it must not be able to steer which
 * tools get called.
 */
export interface PlannerScope {
  datasetCount: number;
  hasDraft: boolean;
  /** The editor section in view, so an ambiguous word resolves to what's on screen. */
  section?: string;
  /** Named only so the panel can say what it's talking about. */
  planTitle?: string;
}

/**
 * The same word means different fields in different sections. "Description"
 * in the Ethical section is the ethics write-up, not the plan's summary.
 */
const SECTION_OVERRIDES: Record<string, Record<string, string>> = {
  // Only genuinely ambiguous words belong here. "Title" means the plan's
  // title everywhere — the Ethical section has no title of its own.
  ethical: {
    description: "ethical_issues_description",
  },
};

const STAGE_WORDS: [
  RegExp,
  "collect" | "process" | "analyse" | "preserve" | "share",
][] = [
  [/backup|preserv|deposit|archive|เก็บ|สำรอง/i, "preserve"],
  [/publish|share|release|เผยแพร่|แชร์/i, "share"],
  [/analys|analyz|วิเคราะห์/i, "analyse"],
  [/clean|process|qc|ประมวลผล|ตรวจ/i, "process"],
  [/collect|sample|เก็บตัวอย่าง|รวบรวม/i, "collect"],
];

/** Field words a person is likely to use, mapped to real paths. */
const FIELD_WORDS: [RegExp, string][] = [
  [/retention|duration|เก็บ.*ปี|ระยะเวลา/i, "preservation.duration"],
  [/repositor|คลัง/i, "preservation.repository"],
  [/access|การเข้าถึง/i, "access"],
  [/protection level|การป้องกัน/i, "protection_level"],
  [/security classification|การจำแนก/i, "security_classification_level"],
  [/begin date|start date|วันเริ่ม/i, "begin_date"],
  [/end date|finish date|วันสิ้นสุด/i, "end_date"],
  [/schema.?version/i, "schema_version"],
  [/indigenous|ชนพื้นเมือง/i, "indigenous_considerations"],
  [/ethical|จริยธรรม/i, "ethical_issues_exist"],
  [/\btitle\b|ชื่อแผน/i, "title"],
  [/description|คำอธิบาย/i, "description"],
  [/language|ภาษา/i, "language"],
];

/** Free text a person might ask to have reworded from the chat. */
const PROSE_FIELDS = new Set([
  "title",
  "description",
  "ethical_issues_description",
  // Listed so a request is refused with its reason, not misheard.
  "indigenous_considerations",
]);

/** How a rewrite request is phrased, mapped to the direction it asks for. */
const REWRITE_DIRECTIONS: [
  RegExp,
  { kind: "shorter" | "formal" } | { kind: "custom"; detail: string },
][] = [
  [
    /\b(?:shorter|shorten|concise|brief|tighten)\b|สั้นลง|กระชับ/i,
    { kind: "shorter" },
  ],
  [/\bformal\b|ทางการ/i, { kind: "formal" }],
  [
    /\b(?:plainer|simpler|clearer|plain language)\b|เข้าใจง่าย/i,
    { kind: "custom", detail: "plainer language" },
  ],
];

const DATASET_SCOPED = new Set([
  "preservation.duration",
  "preservation.repository",
  "preservation.statement",
  "access",
  "protection_level",
  "security_classification_level",
]);

/**
 * Stand-in for the model. It reads the person's message — and only that — and
 * emits tool calls. It never returns state, and it never treats plan content
 * as an instruction, so a poisoned proposal can't make it call anything.
 */
export const planToolCalls = (
  message: string,
  scope: PlannerScope,
): ToolCall[] => {
  const text = message.trim();
  const calls: ToolCall[] = [];

  if (/^\s*(summar|สรุป|overview)/i.test(text)) {
    return [{ tool: "summarizeDmp" }];
  }

  // "is it ready?", "what's missing?" — answered from the submission
  // checklist, as advice. Never a verdict: the committee decides.
  if (
    /\b(?:ready|missing|left to (?:do|fill)|still need|before (?:i |we )?submit)\b|ครบ|ขาด|พร้อม/i.test(
      text,
    )
  ) {
    return [{ tool: "checkReadiness" }];
  }

  // "what have you done", "what did you change" — answered from the thread.
  // The verb can land either side of "you": "what have you done", "what did
  // you change". Both have to reach the same answer.
  if (
    /(?:what|which)\b.*\b(?:you|ai)\b.*\b(?:done|chang|did|generat|made|wrote)/i.test(
      text,
    ) ||
    /\b(?:history|activity)\b|ทำอะไร/i.test(text)
  ) {
    return [{ tool: "recentAiActivity" }];
  }

  // "what is X" / "explain X" — read-only, always safe.
  const explain = text.match(
    /(?:what (?:is|does)|explain|อธิบาย|คืออะไร)\s*(.*)$/i,
  );
  const asksValue = /(current|right now|ตอนนี้|เท่าไหร่|กี่)/i.test(text);

  const matched = FIELD_WORDS.find(([re]) => re.test(text))?.[1];
  const fieldWord = matched
    ? (SECTION_OVERRIDES[scope.section ?? ""]?.[matched] ?? matched)
    : undefined;

  if (explain && fieldWord && !asksValue) {
    return [{ tool: "explainField", path: fieldWord }];
  }
  if (fieldWord && asksValue) {
    return [
      {
        tool: "queryDmp",
        path: DATASET_SCOPED.has(fieldWord)
          ? `dataset[0].${fieldWord}`
          : fieldWord,
      },
    ];
  }

  // "make the description shorter" / "ทำคำอธิบายให้สั้นลง": reworded, not
  // set. Checked before "change X to Y" so "change the title to be more
  // formal" isn't taken as a new title reading "be more formal".
  const rewrite = REWRITE_DIRECTIONS.find(([re]) => re.test(text))?.[1];
  if (rewrite && fieldWord && PROSE_FIELDS.has(fieldWord)) {
    return [{ tool: "proposeRewrite", path: fieldWord, direction: rewrite }];
  }

  // "change X to Y" / "เปลี่ยน X เป็น Y"
  const change = text.match(
    /(?:change|set|update|make|เปลี่ยน|ตั้ง|แก้)\s+.*?(?:\s+(?:to|=|เป็น)\s+)(.+?)(?:\s+(?:and|แล้ว|,)\s+.*)?$/i,
  );
  if (change && fieldWord) {
    // "15 years for every output" is one value and one scope. Without this the
    // qualifier is written into the field.
    const value = change[1]
      .replace(
        /\s+(?:for|on|in|across|of)\s+(?:every|all|each|both|the)\b.*$/i,
        "",
      )
      .replace(/\s+(?:ทุก|ทั้งหมด)\b.*$/i, "")
      .replace(/\s+(?:and|แล้ว)\s+.*$/i, "")
      .replace(/[.。]$/, "")
      .trim();
    if (!value) return calls;
    const everyOutput = /every|all|ทุก/i.test(text);

    if (DATASET_SCOPED.has(fieldWord)) {
      const indices = everyOutput
        ? Array.from({ length: scope.datasetCount }, (_, i) => i)
        : [0];
      indices.forEach((i) =>
        calls.push({
          tool: "proposeFieldChange",
          path: `dataset[${i}].${fieldWord}`,
          value,
        }),
      );
    } else {
      calls.push({ tool: "proposeFieldChange", path: fieldWord, value });
    }
  }

  // "add a task to ..." / "เพิ่ม task ..."
  const addTask = text.match(
    /(?:add|create|เพิ่ม|สร้าง)\s+(?:a\s+)?(?:task|งาน)\s*(?:to|for|ว่า|ชื่อ)?\s*(.+)$/i,
  );
  if (addTask) {
    const title = addTask[1].replace(/[.。]$/, "").trim();
    calls.push({
      tool: "proposeAddTask",
      title: title.slice(0, 120),
      lifecycle_stage:
        STAGE_WORDS.find(([re]) => re.test(title))?.[1] ?? "process",
      priority: /urgent|critical|ด่วน/i.test(title) ? "high" : "medium",
    });
  }

  return calls;
};
