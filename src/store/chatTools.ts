import { contributorFullName } from "@/schemas/contributor";
import {
  FIELD_HELP,
  resolveFieldPath,
  type FieldTarget,
} from "@/config/field-registry";
import { ENABLED_TOOLS, toolCallSchema, type ToolCall } from "@/api/aiTools";
import type { DmpDraft } from "@/types/dmp";
import type { Task } from "@/types/task";

export interface ChatProposal {
  id: string;
  kind: "field" | "task";
  label: string;
  section?: string;
  before: string;
  after: string;
  /** The parsed value, ready for the store action that applies it. */
  value?: unknown;
  path?: string;
  datasetId?: string;
  datasetField?: string;
  preservationField?: string;
  task?: {
    title: string;
    details?: string;
    lifecycle_stage: Task["lifecycle_stage"];
    priority: Task["priority"];
  };
  /**
   * The field is the researcher's call, not the assistant's. Accepting is
   * their confirmation — it is never applied on their behalf.
   */
  needsHumanConfirm: boolean;
  status: "pending" | "accepted" | "rejected";
}

export interface ChatRejection {
  label: string;
  reason: string;
}

export interface ToolRun {
  answers: string[];
  proposals: ChatProposal[];
  rejections: ChatRejection[];
}

export interface ToolContext {
  draft: DmpDraft;
  /** Tasks only exist once the committee has approved the plan. */
  planApproved: boolean;
  unmet: string[];
}

const makeId = () => Math.random().toString(36).substring(2, 10);

const show = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const fieldHelp = (target: FieldTarget) =>
  FIELD_HELP[target.datasetField ?? target.path] ??
  FIELD_HELP[target.path] ??
  "No description recorded for this field yet.";

const summarise = (ctx: ToolContext): string => {
  const { draft } = ctx;
  const outputs = draft.dataset ?? [];
  const people = draft.contributor ?? [];

  return [
    `${draft.title?.trim() || "This plan"} — ${outputs.length} research output${outputs.length === 1 ? "" : "s"}, ${people.length} contributor${people.length === 1 ? "" : "s"}.`,
    people.length
      ? `Contact: ${contributorFullName(people.find((p) => p.is_contact) ?? people[0]) || "not set"}.`
      : "No contributors yet.",
    ctx.unmet.length
      ? `Still needed before submission: ${ctx.unmet.slice(0, 4).join("; ")}${ctx.unmet.length > 4 ? "…" : ""}.`
      : "Everything needed for submission is in place.",
  ].join("\n");
};

/**
 * Runs one tool call. Every guard lives here rather than in the model's
 * instructions: an unknown tool, a disabled one, a path that isn't a field, a
 * locked field, or a value the schema rejects all stop at this boundary.
 */
export const runToolCall = (call: unknown, ctx: ToolContext): ToolRun => {
  const empty: ToolRun = { answers: [], proposals: [], rejections: [] };

  const parsed = toolCallSchema.safeParse(call);
  if (!parsed.success) {
    return {
      ...empty,
      rejections: [
        {
          label: "Unrecognised request",
          reason: "That isn't a tool I can run.",
        },
      ],
    };
  }

  const tool: ToolCall = parsed.data;
  if (!ENABLED_TOOLS[tool.tool]) {
    return {
      ...empty,
      rejections: [
        {
          label: tool.tool,
          reason:
            "That isn't switched on yet — it's a change that belongs in the form.",
        },
      ],
    };
  }

  switch (tool.tool) {
    case "summarizeDmp":
      return { ...empty, answers: [summarise(ctx)] };

    case "queryDmp": {
      const target = resolveFieldPath(ctx.draft, tool.path);
      if ("error" in target)
        return {
          ...empty,
          rejections: [{ label: tool.path, reason: target.error }],
        };
      return {
        ...empty,
        answers: [
          `${target.label} is currently: ${show(target.read(ctx.draft))}`,
        ],
      };
    }

    case "explainField": {
      const probe = tool.path.includes("[")
        ? tool.path
        : `dataset[0].${tool.path}`;
      const target = resolveFieldPath(ctx.draft, tool.path);
      const fallback = resolveFieldPath(ctx.draft, probe);
      const found = "error" in target ? fallback : target;
      if ("error" in found)
        return {
          ...empty,
          rejections: [{ label: tool.path, reason: found.error }],
        };

      return {
        ...empty,
        answers: [
          `${found.label}: ${fieldHelp(found)}${
            found.policy.permission === "locked"
              ? " This field is locked — it can't be changed here."
              : found.policy.permission === "human"
                ? " This one is yours to decide; I can suggest, never set it."
                : ""
          }`,
        ],
      };
    }

    case "proposeFieldChange": {
      const target = resolveFieldPath(ctx.draft, tool.path);
      if ("error" in target)
        return {
          ...empty,
          rejections: [{ label: tool.path, reason: target.error }],
        };

      // 1. Policy. A locked field is refused outright, whatever was asked.
      if (target.policy.permission === "locked") {
        return {
          ...empty,
          rejections: [
            {
              label: target.label,
              reason:
                "This field is locked by policy, so I can't propose a change to it.",
            },
          ],
        };
      }

      // 2. Schema. A value that doesn't fit never reaches the diff.
      const check = target.validator.safeParse(tool.value);
      if (!check.success) {
        return {
          ...empty,
          rejections: [
            {
              label: target.label,
              reason: `That value doesn't fit this field: ${check.error.issues[0]?.message ?? "invalid"}.`,
            },
          ],
        };
      }

      return {
        ...empty,
        proposals: [
          {
            id: makeId(),
            kind: "field",
            label: target.label,
            section: target.section,
            before: show(target.read(ctx.draft)),
            after: show(check.data),
            value: check.data,
            path: target.path,
            datasetId: target.datasetId,
            datasetField: target.datasetField,
            preservationField: target.preservationField,
            needsHumanConfirm: target.policy.permission === "human",
            status: "pending",
          },
        ],
      };
    }

    case "proposeAddTask": {
      // Tasks exist to execute an approved plan; proposing them earlier would
      // invent work against something the committee hasn't agreed to.
      if (!ctx.planApproved) {
        return {
          ...empty,
          rejections: [
            {
              label: tool.title,
              reason:
                "Tasks are generated once the committee approves the plan — I can't add one before that.",
            },
          ],
        };
      }

      return {
        ...empty,
        proposals: [
          {
            id: makeId(),
            kind: "task",
            label: "New task",
            before: "—",
            after: tool.title,
            task: {
              title: tool.title,
              details: tool.details,
              lifecycle_stage: tool.lifecycle_stage ?? "process",
              priority: tool.priority ?? "medium",
            },
            needsHumanConfirm: false,
            status: "pending",
          },
        ],
      };
    }

    case "proposeUpdateTask":
      return {
        ...empty,
        rejections: [
          {
            label: "Update task",
            reason:
              "I can only suggest new tasks for now; editing one is done on the task itself.",
          },
        ],
      };

    default:
      return empty;
  }
};
