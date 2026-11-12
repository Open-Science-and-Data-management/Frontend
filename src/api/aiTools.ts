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
