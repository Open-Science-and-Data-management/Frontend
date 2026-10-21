import type { DmpDraft } from "@/types/dmp";
import {
  AiError,
  totalTokens,
  type AiCallOptions,
  type AiUsage,
  type ProvenanceMap,
} from "@/api/aiContract";
import { serve } from "@/api/mock/aiServer";
import { MADMP_SCHEMA_VERSION } from "@/schemas/madmp/vocabularies";
import {
  getDomainProfile,
  type DomainKey,
} from "@/schemas/dataset/domain-profiles";

export type RegenerateDirection =
  | { kind: "shorter" | "formal" }
  | { kind: "emphasize" | "custom"; detail: string };

/** A direction in words, for toasts and the AI thread. */
export const describeDirection = (direction: RegenerateDirection): string => {
  switch (direction.kind) {
    case "shorter":
      return "shorter";
    case "formal":
      return "more formal";
    case "emphasize":
      return `emphasising ${direction.detail}`;
    default:
      return direction.detail;
  }
};

export type Coverage = "low" | "ok";

/**
 * Every AI result carries the provider's usage; `token_count` is its total,
 * for display only. What the quota was charged is the server's business.
 */
interface Metered {
  usage: AiUsage;
  token_count: number;
}

const metered = (usage: AiUsage): Metered => ({
  usage,
  token_count: totalTokens(usage),
});

export interface AnalyzeResult extends Metered {
  draft: DmpDraft;
  coverage: Coverage;
  /**
   * Where each drafted value came from. Absent when the analysis can't say —
   * and then the UI makes no claim either way.
   */
  provenance?: ProvenanceMap;
}

export interface RegenerateResult extends Metered {
  text: string;
}

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

export interface ChatResult extends Metered {
  reply: string;
}

const list = (items: string[]) => items.map((i) => `• ${i}`).join("\n");

// Rule-based stand-in for a grounded assistant. Every branch answers from
// the live draft, so replies stay truthful about the plan on screen.
const composeReply = (message: string, ctx: ChatContext): string => {
  const q = message.toLowerCase();
  const plan = ctx.title ? `“${ctx.title}”` : "this plan";

  if (/missing|ready|submit|left to do|incomplete/.test(q)) {
    return ctx.unmet.length === 0
      ? `${plan} looks complete. Every required field is filled in and confirmed, so you can review and submit it whenever you're ready.`
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
      ? "This plan has no research outputs yet. You'll need at least one to submit."
      : `Research outputs:\n${list(ctx.outputs.map((o) => `${o.title} (${o.type}, ${o.access} access)`))}`;
  }

  if (/contributor|who|team|contact|author/.test(q)) {
    return ctx.contributors.length === 0
      ? "No contributors have been added yet. Exactly one of them will need to be the primary contact."
      : `Contributors:\n${list(ctx.contributors.map((c) => `${c.name}, ${c.role}${c.isContact ? " (primary contact)" : ""}`))}`;
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
      : "This plan declares no ethical issues. If that changes, update the Ethical section. Either way, a person has to confirm it.";
  }

  if (/token|quota|cost of ai|budget left/.test(q)) {
    return `You have ${ctx.tokensLeft.toLocaleString()} AI tokens left. Analyzing a proposal is the expensive one; regenerating a single field is cheap.`;
  }

  return `I can only answer from what's in this plan. Try asking about: what's missing before submitting, a summary, the research outputs, contributors, cost, ethical issues, or your remaining tokens.\n\nI can suggest wording, but I can't change or approve anything. You confirm every edit, and your committee approves the plan.`;
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

export interface GenerateTasksResult extends Metered {
  tasks: GeneratedTask[];
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

/**
 * AI may draft domain values, but never a field the profile reserves for a
 * person — a compliance claim is the researcher's to make, in domain metadata
 * exactly as in the core fields.
 */
const aiFillable = (
  domain: DomainKey,
  metadata: Record<string, unknown>,
): Record<string, unknown> => {
  const humanOwned = new Set(
    getDomainProfile(domain)
      .fields.filter((f) => f.permission === "human")
      .map((f) => f.key),
  );
  return Object.fromEntries(
    Object.entries(metadata).filter(
      ([key, value]) => value !== undefined && !humanOwned.has(key),
    ),
  );
};

/**
 * What each domain sounds like in a proposal, and what can be read straight
 * out of the words. Checked in order, first match wins — the specific ones
 * (patients, archives) come before the broad ones.
 */
const DOMAIN_HINTS: {
  domain: DomainKey;
  test: RegExp;
  read?: (text: string) => Record<string, unknown>;
}[] = [
  {
    domain: "health_medical",
    test: /patient|clinical|randomi[sz]ed|\btrial\b|irb|ethics committee|hospital|cohort|diagnos|ผู้ป่วย|คลินิก/,
    read: (t) => ({
      study_type: /trial|interventional|randomi[sz]ed/.test(t)
        ? "Interventional / clinical trial"
        : /cohort|observational/.test(t)
          ? "Observational"
          : /registry/.test(t)
            ? "Registry"
            : undefined,
      // ethics_approval_ref and de-identification are the researcher's.
      ethics_approval_ref: "pending",
      deidentification: "Fully anonymised",
    }),
  },
  {
    domain: "life_sciences",
    test: /rice|ข้าว|sequenc|genom|organism|dna|rna|specimen|cultivar|assay/,
    read: (t) => ({
      organism: /rice|ข้าว/.test(t)
        ? "Oryza sativa"
        : /pollinator|bee/.test(t)
          ? "Apis mellifera"
          : undefined,
      sequencing_platform: /nanopore/.test(t)
        ? "Oxford Nanopore"
        : /illumina/.test(t)
          ? "Illumina"
          : undefined,
      assay_type: /rna-?seq/.test(t)
        ? "RNA-seq"
        : /wgs|whole genome/.test(t)
          ? "WGS"
          : undefined,
      biosafety_reviewed: true,
    }),
  },
  {
    domain: "humanities",
    test: /manuscript|archive|oral history|philolog|palm.?leaf|inscription|historical text|โบราณ|จารึก/,
    read: (t) => ({
      source_type: /manuscript|palm.?leaf/.test(t)
        ? "Manuscript"
        : /oral history/.test(t)
          ? "Oral history"
          : /photograph/.test(t)
            ? "Photograph"
            : undefined,
      rights_holder: "unknown",
    }),
  },
  {
    domain: "social_science",
    test: /survey|interview|focus group|participant|household|questionnaire|แบบสอบถาม/,
    read: (t) => ({
      collection_instrument: /interview/.test(t)
        ? "Interview"
        : /focus group/.test(t)
          ? "Focus group"
          : /survey|questionnaire|แบบสอบถาม/.test(t)
            ? "Survey"
            : undefined,
      consent_obtained: true,
    }),
  },
  {
    domain: "geospatial",
    test: /geospatial|\bgis\b|satellite|remote sensing|coordinate|แผนที่|mapping|land ?cover/,
    read: (t) => ({
      coordinate_system: /epsg:?\s?4326|wgs ?84|gps/.test(t)
        ? "EPSG:4326"
        : undefined,
      acquisition_source: /satellite|remote sensing/.test(t)
        ? "Satellite imagery"
        : /drone|aerial/.test(t)
          ? "Aerial / drone"
          : undefined,
      location_sensitive: true,
    }),
  },
  {
    domain: "physical_sciences",
    test: /spectroscop|diffraction|microscop|chromatograph|beamline|calibration|crystallograph/,
    read: (t) => ({
      measurement_technique: /spectroscop/.test(t)
        ? "Spectroscopy"
        : /diffraction|crystallograph/.test(t)
          ? "Diffraction"
          : /microscop/.test(t)
            ? "Microscopy"
            : /chromatograph/.test(t)
              ? "Chromatography"
              : undefined,
    }),
  },
  {
    domain: "engineering_computing",
    test: /machine learning|deep learning|neural|training a model|benchmark|\bgpu\b|source code|firmware|โมเดล/,
    read: (t) => ({
      model_or_algorithm: /neural|deep learning/.test(t)
        ? "Neural network"
        : undefined,
      third_party_terms: "see licence",
    }),
  },
];

/**
 * Reads a domain out of what the proposal talks about, and fills in whatever
 * the text already answers. A suggestion only: the researcher can change it,
 * and the values arrive marked AI like any other drafted field.
 */
export const suggestDomain = (
  text: string,
): { domain: DomainKey; domain_metadata: Record<string, unknown> } => {
  const t = text.toLowerCase();
  const hit = DOMAIN_HINTS.find((hint) => hint.test.test(t));
  if (!hit) return { domain: "generic", domain_metadata: {} };

  return {
    domain: hit.domain,
    // aiFillable drops the human-owned keys above, so a hint can be written
    // naively and the boundary still holds.
    domain_metadata: aiFillable(hit.domain, hit.read?.(t) ?? {}),
  };
};

/**
 * Shapes the drafted plan by what the researcher told us to aim for. A
 * direction that quietly changed nothing would be worse than none at all, so
 * every branch here is observable in the result.
 */
const applyAnalysisDirection = (
  base: DmpDraft,
  direction: string,
): DmpDraft => {
  const d = direction.toLowerCase();
  if (!d) return base;

  let draft: DmpDraft = { ...base };
  const datasets = (draft.dataset ?? []).map((set) => ({ ...set }));

  if (/open|shar|publish|reuse|เผยแพร่/.test(d)) {
    datasets.forEach((set) => {
      set.access = "open";
      set.preservation = { ...set.preservation, doi_requested: true };
    });
  }

  if (/sensitive|personal|consent|human|ส่วนบุคคล/.test(d)) {
    datasets.forEach((set) => {
      set.personal_data = "yes";
      set.protection_level = "Protected B";
      set.security_classification_level = "confidential";
    });
    draft.ethical_issues_exist = true;
    draft.ethical_issues_description =
      draft.ethical_issues_description ??
      "Personal data is collected, so consent and access control apply.";
  }

  if (/preserv|archive|long.?term|retention|เก็บ/.test(d)) {
    datasets.forEach((set) => {
      set.preservation = {
        ...set.preservation,
        duration: "10 years",
        repository: set.preservation?.repository ?? "Institutional repository",
      };
    });
  }

  // A steer that names a field moves the outputs into that domain.
  const suggested = suggestDomain(d);
  if (suggested.domain !== "generic") {
    datasets.forEach((set) => {
      set.domain = suggested.domain;
      set.domain_metadata = {
        ...(set.domain_metadata ?? {}),
        ...suggested.domain_metadata,
      };
    });
  }

  if (/software|code|script|โค้ด/.test(d)) {
    datasets.push({
      dataset_id: "seed-dataset-software",
      type: "software",
      title: "Analysis code",
      description: "Scripts and notebooks used to process the data.",
      status: "planned",
      access: "open",
      personal_data: "no",
      sensitive_data: "no",
      protection_level: "not protected",
      security_classification_level: "unclassified",
      keyword: ["software"],
      domain: "generic" as const,
      domain_metadata: {},
      preservation: { doi_requested: true },
      distribution: [],
    });
  }

  draft = { ...draft, dataset: datasets };
  return draft;
};

/**
 * What the analysis could not work out from the document. These become the
 * questions we put to the researcher instead of inventing answers.
 */
export interface CoverageGap {
  id: string;
  question: string;
  placeholder: string;
}

export const coverageGaps = (draft: DmpDraft): CoverageGap[] => {
  const gaps: CoverageGap[] = [];

  if (!draft.title?.trim())
    gaps.push({
      id: "title",
      question: "What is the project called?",
      placeholder: "e.g. Urban Pollinator Genomic Survey",
    });
  if ((draft.dataset ?? []).length === 0)
    gaps.push({
      id: "outputs",
      question: "What data or outputs will the project produce?",
      placeholder: "e.g. sequencing reads, field photographs, analysis code",
    });
  if (!draft.begin_date || !draft.end_date)
    gaps.push({
      id: "timeline",
      question: "Roughly when does it run?",
      placeholder: "e.g. Jan 2026 to Dec 2027",
    });
  if (draft.ethical_issues_exist === undefined)
    gaps.push({
      id: "ethics",
      question: "Does it involve personal or sensitive data?",
      placeholder: "e.g. interviews with consent; no personal data",
    });
  gaps.push({
    id: "sharing",
    question: "How should the data be shared and kept?",
    placeholder: "e.g. open after a 6-month embargo, kept 10 years",
  });

  return gaps;
};

export interface RedraftInput {
  filename: string;
  direction: string;
  current: DmpDraft;
}

/**
 * Re-reads the proposal with a new steer and returns field-level suggestions
 * rather than a whole plan. Handing back a replacement draft would silently
 * overwrite everything a person had already changed.
 */
export const redraftFromProposal = async (
  input: RedraftInput,
  opts: AiCallOptions = {},
): Promise<Metered & { fields: { path: string; value: unknown }[] }> => {
  const steered = applyAnalysisDirection(CANNED_DRAFT, input.direction);
  const fields: { path: string; value: unknown }[] = [];

  const d = input.direction.toLowerCase();
  const suffix = input.direction.trim() ? ` (${input.direction.trim()})` : "";

  if (steered.title) fields.push({ path: "title", value: steered.title });
  if (steered.description)
    fields.push({
      path: "description",
      value: `${steered.description} Redrafted from ${input.filename}${suffix}.`,
    });

  (steered.dataset ?? []).forEach((set, index) => {
    if (!(input.current.dataset ?? [])[index]) return;
    fields.push({ path: `dataset[${index}].title`, value: set.title });
    if (set.description)
      fields.push({
        path: `dataset[${index}].description`,
        value: set.description,
      });
    if (/open|shar|publish/.test(d))
      fields.push({ path: `dataset[${index}].access`, value: set.access });
    if (/preserv|archive|retention/.test(d))
      fields.push({
        path: `dataset[${index}].preservation.duration`,
        value: set.preservation?.duration ?? "10 years",
      });
  });

  const usage = await serve({
    input: PROMPT_OVERHEAD.analyze_proposal / 2 + tokensIn(input.direction),
    output: tokensIn(JSON.stringify(fields)),
    ms: 1200,
    signal: opts.signal,
  });
  return { fields, ...metered(usage) };
};

export const generateTasks = async (
  input: GenerateTasksInput,
  opts: AiCallOptions = {},
): Promise<GenerateTasksResult> => {
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
          title: `${verb}: ${o.title}`,
          details: `${verb.toLowerCase()} the ${o.type} output “${o.title}” in line with the approved plan.${steer}`,
          lifecycle_stage: s.stage,
          priority: s.priority,
          dataset_id: o.dataset_id,
        }));
      }),
  );

  const usage = await serve({
    input: PROMPT_OVERHEAD.generate_tasks + tokensIn(direction),
    output: tokensIn(JSON.stringify(tasks)),
    ms: 1300,
    signal: opts.signal,
  });
  return { tasks, ...metered(usage) };
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
  opts: AiCallOptions = {},
): Promise<Metered & { steps: string[] }> => {
  const d = (input.direction ?? "").trim().toLowerCase();
  const output = input.outputs[0]?.title;

  let steps = CHECKLIST_TEMPLATE.map((s) =>
    output ? `${s} (${output})` : `${s} (${input.lifecycleStage})`,
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

  const usage = await serve({
    input: PROMPT_OVERHEAD.generate_tasks / 2 + tokensIn(d),
    output: tokensIn(JSON.stringify(steps)),
    ms: 900,
    signal: opts.signal,
  });
  return { steps, ...metered(usage) };
};

export const aiChat = async (
  message: string,
  context: ChatContext,
  opts: AiCallOptions = {},
): Promise<ChatResult> => {
  const reply = composeReply(message, context);
  const usage = await serve({
    input: PROMPT_OVERHEAD.chat + tokensIn(message),
    output: tokensIn(reply),
    ms: 700,
    signal: opts.signal,
  });
  return { reply, ...metered(usage) };
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
      protection_level: "Protected A",
      security_classification_level: "restricted",
      keyword: ["pollinators", "genomics", "urban ecology"],
      domain: "life_sciences" as const,
      domain_metadata: {
        organism: "Apis mellifera",
        sequencing_platform: "Illumina",
        assay_type: "WGS",
      },
      preservation: { doi_requested: false },
      distribution: [],
      schema_fields: [],
    },
  ],
  schema_version: MADMP_SCHEMA_VERSION,
};

export const aiApi = {
  analyzeProposal: async (
    file: File,
    direction?: string,
    opts: AiCallOptions = {},
  ): Promise<AnalyzeResult> => {
    // Refused before the model runs, so nothing is charged.
    if (!file.name.toLowerCase().endsWith(".docx")) {
      throw new AiError({
        code: "invalid_input",
        retryable: false,
        userMessage:
          "We couldn't read this file. Please upload your proposal as a .docx.",
      });
    }
    if (file.size === 0) {
      throw new AiError({
        code: "invalid_input",
        retryable: false,
        userMessage:
          "This file looks empty or unreadable. Try exporting it again, or upload a different file.",
      });
    }

    // Deterministic stand-in for a real coverage/confidence score. A
    // direction is extra signal, so a steered re-run reads as better covered.
    const steer = direction?.trim() ?? "";
    const coverage: Coverage =
      file.size < 5000 && steer.length < 40 ? "low" : "ok";

    // A thin document genuinely yields less. Returning a full plan from one
    // would be the model inventing the parts it couldn't read.
    const extracted: DmpDraft =
      coverage === "low"
        ? {
            title: CANNED_DRAFT.title,
            language: CANNED_DRAFT.language,
            schema_version: CANNED_DRAFT.schema_version,
            dataset: [],
            contributor: [],
            cost: [],
          }
        : CANNED_DRAFT;

    const draft = applyAnalysisDirection(extracted, steer);

    // Input document + the direction + the whole drafted plan coming back.
    const usage = await serve({
      input:
        PROMPT_OVERHEAD.analyze_proposal +
        Math.ceil(file.size / 12) +
        tokensIn(steer),
      output: tokensIn(JSON.stringify(draft)),
      ms: 1400,
      signal: opts.signal,
    });

    // This stand-in reads nothing from the file, so it can't say where any
    // value came from — and returns no provenance rather than a made-up one.
    return { draft, coverage, ...metered(usage) };
  },

  regenerateField: async (
    fieldLabel: string,
    currentValue: string,
    direction: RegenerateDirection,
    opts: AiCallOptions = {},
  ): Promise<RegenerateResult> => {
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

    const usage = await serve({
      input: PROMPT_OVERHEAD.regenerate_field + tokensIn(base),
      output: tokensIn(text),
      ms: 900,
      signal: opts.signal,
    });
    return { text, ...metered(usage) };
  },
};
