import { z } from "zod";

/**
 * The complete set of things the assistant may ask for. There is deliberately
 * no tool that commits, approves, submits, completes or deletes — those are
 * acts with consequences, and they happen through the normal UI with a person
 * pressing the button. An injected instruction can only ever reach this list.
 */
export const TOOL_NAMES = [
  "queryDmp",
  "explainField",
  "summarizeDmp",
  "proposeFieldChange",
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
  queryDmp: true,
  explainField: true,
  summarizeDmp: true,
  proposeFieldChange: true,
  proposeAddTask: true,
  proposeUpdateTask: true,
  // A new research output changes what the committee approved; that belongs in
  // the form, not in a chat turn.
  proposeAddDataset: false,
};

export const toolCallSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("queryDmp"), path: z.string().min(1) }),
  z.object({ tool: z.literal("explainField"), path: z.string().min(1) }),
  z.object({ tool: z.literal("summarizeDmp") }),
  z.object({
    tool: z.literal("proposeFieldChange"),
    path: z.string().min(1),
    value: z.unknown(),
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
  /** The editor section in view, when there is one. */
  section?: string;
}

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
  [/ethical|จริยธรรม/i, "ethical_issues_exist"],
  [/\btitle\b|ชื่อแผน/i, "title"],
  [/description|คำอธิบาย/i, "description"],
  [/language|ภาษา/i, "language"],
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

  // "what is X" / "explain X" — read-only, always safe.
  const explain = text.match(
    /(?:what (?:is|does)|explain|อธิบาย|คืออะไร)\s*(.*)$/i,
  );
  const asksValue = /(current|right now|ตอนนี้|เท่าไหร่|กี่)/i.test(text);

  const fieldWord = FIELD_WORDS.find(([re]) => re.test(text))?.[1];

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
