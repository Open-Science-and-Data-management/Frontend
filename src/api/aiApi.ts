import type { DmpDraft } from "@/types/dmp";

export type RegenerateDirection =
  | { kind: "shorter" | "formal" }
  | { kind: "emphasize" | "custom"; detail: string };

export type Coverage = "low" | "ok";

export interface AnalyzeResult {
  draft: DmpDraft;
  coverage: Coverage;
  token_count: number;
}

export interface RegenerateResult {
  text: string;
  token_count: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ~4 characters per token is the usual rough rule for English prose.
export const tokensIn = (text: string) => Math.ceil(text.length / 4);

// Overheads for the prompt/system scaffolding each call carries, on top of
// the tokens spent on the actual input and output text.
export const PROMPT_OVERHEAD = {
  analyze_proposal: 450,
  regenerate_field: 60,
  chat: 90,
  generate_tasks: 380,
} as const;

// Pre-flight estimates so a cost can be shown before the user commits.
export const estimateCost = {
  analyzeProposal: (file: File) =>
    PROMPT_OVERHEAD.analyze_proposal + Math.ceil(file.size / 12),
  regenerateField: (currentValue: string) =>
    PROMPT_OVERHEAD.regenerate_field + tokensIn(currentValue) * 2,
  chat: (message: string) => PROMPT_OVERHEAD.chat + tokensIn(message) * 2,
  generateTasks: (outputCount: number) =>
    PROMPT_OVERHEAD.generate_tasks + outputCount * 140,
};

/** What the assistant is allowed to see about the plan it's discussing. */
export interface ChatContext {
  title?: string;
  beginDate?: Date;
  endDate?: Date;
  ethicalIssues?: boolean;
  outputs: { title: string; type: string; access: string }[];
  contributors: { name: string; role: string; isContact: boolean }[];
  costTotal: number;
  currency?: string;
  unmet: string[];
  tokensLeft: number;
}

export interface ChatResult {
  reply: string;
  token_count: number;
}

const list = (items: string[]) => items.map((i) => `• ${i}`).join("\n");

// Rule-based stand-in for a grounded assistant. Every branch answers from
// the live draft, so replies stay truthful about the plan on screen.
const composeReply = (message: string, ctx: ChatContext): string => {
  const q = message.toLowerCase();
  const plan = ctx.title ? `“${ctx.title}”` : "this plan";

  if (/missing|ready|submit|left to do|incomplete/.test(q)) {
    return ctx.unmet.length === 0
      ? `${plan} looks complete — every required field is filled and confirmed. You can review and submit it whenever you're ready.`
      : `${ctx.unmet.length} thing${ctx.unmet.length === 1 ? "" : "s"} still needed before you can submit:\n${list(ctx.unmet)}`;
  }

  if (/summar|overview|what.*plan|describe/.test(q)) {
    const span =
      ctx.beginDate && ctx.endDate
        ? ` It runs ${ctx.beginDate.getFullYear()}–${ctx.endDate.getFullYear()}.`
        : "";
    return `${plan} has ${ctx.outputs.length} research output${ctx.outputs.length === 1 ? "" : "s"} and ${ctx.contributors.length} contributor${ctx.contributors.length === 1 ? "" : "s"}.${span} Ethical issues are marked ${ctx.ethicalIssues ? "present" : "not applicable"}.`;
  }

  if (/output|dataset|software|publication/.test(q)) {
    return ctx.outputs.length === 0
      ? "There are no research outputs on this plan yet — you'll need at least one to submit."
      : `Research outputs:\n${list(ctx.outputs.map((o) => `${o.title} (${o.type}, ${o.access} access)`))}`;
  }

  if (/contributor|who|team|contact|author/.test(q)) {
    return ctx.contributors.length === 0
      ? "No contributors have been added yet. Exactly one of them will need to be the primary contact."
      : `Contributors:\n${list(ctx.contributors.map((c) => `${c.name} — ${c.role}${c.isContact ? " (primary contact)" : ""}`))}`;
  }

  if (/cost|budget|money|spend|currency/.test(q)) {
    return ctx.costTotal > 0
      ? `Budgeted cost totals ${ctx.costTotal.toLocaleString()} ${ctx.currency ?? ""}`.trim() +
          "."
      : "No cost items have been added. Cost is optional, so this won't block submission.";
  }

  if (/ethic|consent|personal data|sensitive/.test(q)) {
    return ctx.ethicalIssues
      ? "This plan declares that ethical issues apply, so the description must be filled in and confirmed by a person before submitting."
      : "This plan declares no ethical issues. If that changes, update the Ethical section — it needs a human confirmation either way.";
  }

  if (/token|quota|cost of ai|budget left/.test(q)) {
    return `You have ${ctx.tokensLeft.toLocaleString()} AI tokens left this month. Analyzing a proposal is the expensive one; regenerating a single field is cheap.`;
  }

  return `I can only answer from what's in this plan. Try asking about: what's missing before submitting, a summary, the research outputs, contributors, cost, ethical issues, or your remaining tokens.\n\nI can suggest wording, but I can't change or approve anything — you confirm every edit, and your committee approves the plan.`;
};

/** One AI-proposed task, before it is written into the task store. */
export interface GeneratedTask {
  title: string;
  details: string;
  lifecycle_stage: "collect" | "process" | "analyse" | "preserve" | "share";
  priority: "low" | "medium" | "high";
  dataset_id?: string;
}

export interface GenerateTasksInput {
  outputs: {
    dataset_id?: string;
    title: string;
    type: string;
    access: string;
  }[];
  beginDate?: Date;
  endDate?: Date;
  /** Free-text steer, e.g. "focus on preservation" or "fewer, broader tasks". */
  direction?: string;
}

/** Ready-made steers, offered as chips next to the free-text box. */
export const TASK_DIRECTIONS = [
  { id: "granular", label: "More granular", hint: "Split each stage in two" },
  {
    id: "broader",
    label: "Fewer, broader",
    hint: "Collect, preserve, share only",
  },
  {
    id: "preservation",
    label: "Focus on preservation",
    hint: "Preserve & share, raised priority",
  },
  {
    id: "sharing",
    label: "Focus on sharing",
    hint: "Publishing steps in detail",
  },
] as const;

export interface GenerateTasksResult {
  tasks: GeneratedTask[];
  token_count: number;
}

// Each output gets a task per lifecycle stage it plausibly needs. Derived
// from the approved plan rather than a fixed list, so the breakdown matches
// what was actually approved.
const STAGE_PLAN: {
  stage: GeneratedTask["lifecycle_stage"];
  verb: string;
  priority: GeneratedTask["priority"];
}[] = [
  { stage: "collect", verb: "Collect", priority: "high" },
  { stage: "process", verb: "Process and clean", priority: "medium" },
  { stage: "analyse", verb: "Analyse", priority: "medium" },
  { stage: "preserve", verb: "Deposit and preserve", priority: "high" },
  { stage: "share", verb: "Publish and share", priority: "low" },
];

/** Splits one stage into two when a granular breakdown is asked for. */
const GRANULAR_SPLIT: Partial<
  Record<GeneratedTask["lifecycle_stage"], [string, string]>
> = {
  collect: ["Set up collection for", "Run collection for"],
  process: ["Clean and validate", "Document the processing of"],
  analyse: ["Analyse", "Write up findings from"],
  preserve: ["Prepare the deposit of", "Deposit and verify"],
  share: ["Prepare the release of", "Publish and announce"],
};

/**
 * Applies the direction to the stage plan. A steer has to change the result
 * visibly — a direction that quietly did nothing would be worse than none.
 */
const planForDirection = (direction: string) => {
  const d = direction.toLowerCase();
  const focus = (stages: GeneratedTask["lifecycle_stage"][]) =>
    STAGE_PLAN.filter((s) => stages.includes(s.stage)).map((s) => ({
      ...s,
      priority: "high" as const,
    }));

  if (/granular|detail|smaller|split|step/.test(d))
    return { plan: STAGE_PLAN, granular: true };
  if (/fewer|broad|high.?level|simpl/.test(d))
    return { plan: focus(["collect", "preserve", "share"]), granular: false };
  if (/preserv|archive|deposit|backup/.test(d))
    return { plan: focus(["preserve", "share"]), granular: false };
  if (/shar|publish|release|open/.test(d))
    return { plan: focus(["share", "preserve"]), granular: true };

  return { plan: STAGE_PLAN, granular: false };
};

export const generateTasks = async (
  input: GenerateTasksInput,
): Promise<GenerateTasksResult> => {
  await delay(1300);

  const direction = input.direction?.trim() ?? "";
  const { plan, granular } = planForDirection(direction);
  const steer = direction ? ` Direction: ${direction}.` : "";

  const tasks: GeneratedTask[] = input.outputs.flatMap((o) =>
    plan
      // A closed output is never published, so no share task is proposed.
      .filter((s) => !(s.stage === "share" && o.access === "closed"))
      .flatMap((s) => {
        const verbs =
          granular && GRANULAR_SPLIT[s.stage]
            ? GRANULAR_SPLIT[s.stage]!
            : [s.verb];

        return verbs.map((verb) => ({
          title: `${verb} — ${o.title}`,
          details: `${verb.toLowerCase()} the ${o.type} output “${o.title}” in line with the approved plan.${steer}`,
          lifecycle_stage: s.stage,
          priority: s.priority,
          dataset_id: o.dataset_id,
        }));
      }),
  );

  const token_count =
    PROMPT_OVERHEAD.generate_tasks +
    tokensIn(direction) +
    tokensIn(JSON.stringify(tasks));
  return { tasks, token_count };
};

export interface GenerateChecklistInput {
  taskTitle: string;
  lifecycleStage: string;
  /** The outputs the plan approved, so steps name real deliverables. */
  outputs: { title: string; type: string; access: string }[];
  direction?: string;
}

/** The steps a list is drafted from, before the direction narrows them. */
const CHECKLIST_TEMPLATE = [
  "Agree the approach and record it",
  "Do the work and note what changed",
  "Produce the deliverable",
  "Check it against the plan",
  "Deposit it in the repository",
  "Record the DOI or receipt",
];

/**
 * Drafts the steps for one task from the approved plan. The direction has to
 * change the result — a steer that quietly did nothing would be worse than
 * having none.
 */
export const generateTaskChecklist = async (
  input: GenerateChecklistInput,
): Promise<{ steps: string[]; token_count: number }> => {
  await delay(900);

  const d = (input.direction ?? "").trim().toLowerCase();
  const output = input.outputs[0]?.title;

  let steps = CHECKLIST_TEMPLATE.map((s) =>
    output ? `${s} — ${output}` : `${s} (${input.lifecycleStage})`,
  );

  if (/brief|fewer|short|minimal|simpl/.test(d))
    steps = steps.filter((_, i) => i % 2 === 0);
  if (/detail|granular|thorough|more/.test(d))
    steps = [
      ...steps,
      "Log the decisions taken along the way",
      "Have a second person review it",
    ];
  if (/preserv|archive|deposit|backup/.test(d))
    steps = steps.filter((s) => /deposit|doi|receipt/i.test(s));
  if (/quality|check|valid|qa/.test(d))
    steps = [...steps, "Run the quality checks and keep the report"];

  const token_count =
    PROMPT_OVERHEAD.generate_tasks / 2 +
    tokensIn(d) +
    tokensIn(JSON.stringify(steps));

  return { steps, token_count };
};

export const aiChat = async (
  message: string,
  context: ChatContext,
): Promise<ChatResult> => {
  await delay(700);
  const reply = composeReply(message, context);
  return {
    reply,
    token_count: PROMPT_OVERHEAD.chat + tokensIn(message) + tokensIn(reply),
  };
};

// Canned draft returned for any uploaded proposal — stands in for a real
// document-understanding + LLM-extraction pipeline.
const CANNED_DRAFT: DmpDraft = {
  title: "Genomic Diversity Mapping of Urban Pollinator Populations",
  description:
    "This project surveys genomic diversity in urban pollinator populations across metropolitan green corridors, combining field sampling with high-throughput sequencing to assess resilience to habitat fragmentation.",
  language: "en",
  begin_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  end_date: new Date(new Date().getFullYear() + 2, new Date().getMonth(), 1),
  ethical_issues_exist: true,
  ethical_issues_description:
    "Field sampling of wild pollinator species requires a collection permit; no human or animal welfare protocols beyond standard invertebrate handling apply.",
  indigenous_considerations: undefined,
  contributor: [
    {
      contributor_id: "seed-contributor-1",
      title: "Dr.",
      name: "Aran",
      surname: "Suwannachot",
      role: "Principal Investigator",
      email: "aran.s@example.edu",
      orcid: "0000-0002-1825-0097",
      is_contact: true,
    },
  ],
  cost: [],
  dataset: [
    {
      dataset_id: "seed-dataset-1",
      type: "raw",
      title: "Pollinator genomic sequence reads",
      description: "Raw FASTQ sequencing reads from field-collected specimens.",
      status: "planned",
      access: "shared",
      personal_data: "no",
      sensitive_data: "no",
      protection_level: "Standard",
      security_classification_level: "Internal",
      keyword: ["pollinators", "genomics", "urban ecology"],
      preservation: { doi_requested: false },
      distribution: [],
      schema_fields: [],
    },
  ],
  schema_version: "FAIRer maDMP 1.2",
};

export const aiApi = {
  analyzeProposal: async (file: File): Promise<AnalyzeResult> => {
    await delay(1400);

    if (!file.name.toLowerCase().endsWith(".docx")) {
      throw new Error(
        "Couldn't read this file — please upload a .docx proposal.",
      );
    }
    if (file.size === 0) {
      throw new Error(
        "This file looks empty or unreadable — try re-exporting it, or upload a different file.",
      );
    }

    // Deterministic stand-in for a real coverage/confidence score.
    const coverage: Coverage = file.size < 5000 ? "low" : "ok";
    // Input document + the whole drafted plan that comes back out.
    const token_count =
      PROMPT_OVERHEAD.analyze_proposal +
      Math.ceil(file.size / 12) +
      tokensIn(JSON.stringify(CANNED_DRAFT));

    return { draft: CANNED_DRAFT, coverage, token_count };
  },

  regenerateField: async (
    fieldLabel: string,
    currentValue: string,
    direction: RegenerateDirection,
  ): Promise<RegenerateResult> => {
    await delay(900);

    const base = currentValue || `${fieldLabel} (AI draft)`;
    let text: string;
    switch (direction.kind) {
      case "shorter": {
        const firstSentence = base.split(". ")[0]?.trim() ?? "";
        if (firstSentence && firstSentence.length < base.trim().length - 1) {
          text = firstSentence.replace(/\.?$/, ".");
        } else {
          // Already a single sentence — trim it back instead of returning
          // the input unchanged, which reads as a no-op to the user.
          const words = base.replace(/\.\s*$/, "").split(/\s+/);
          const kept = Math.max(6, Math.ceil(words.length * 0.6));
          text = `${words.slice(0, kept).join(" ")}.`;
        }
        break;
      }
      case "formal":
        text = `${base.replace(/\.$/, "")}, in accordance with institutional data governance standards.`;
        break;
      case "emphasize":
        text = `${base.replace(/\.$/, "")}, with particular emphasis on ${direction.detail}.`;
        break;
      case "custom":
        text = `${base.replace(/\.$/, "")} (${direction.detail}).`;
        break;
      default:
        text = base;
    }

    const token_count =
      PROMPT_OVERHEAD.regenerate_field + tokensIn(base) + tokensIn(text);
    return { text, token_count };
  },
};
