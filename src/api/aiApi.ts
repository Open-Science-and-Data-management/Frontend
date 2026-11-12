import type { DmpDraft } from "@/types/dmp";

/**
 * Shared vocabulary for the AI features. The AI itself runs on the backend
 * (see `aiStream.ts`); this file only holds what the UI needs around it: the
 * shape of a rewrite request, cost estimates shown before a run (the server
 * charges the real cost), and the questions asked when a proposal says too
 * little.
 */

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

/** How much of the submission checklist a drafted plan left open. */
export type Coverage = "low" | "ok";

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

/**
 * Pre-flight estimates, so a cost can be shown before the person commits.
 * Estimates only: the server counts and charges what a run really cost.
 */
export const estimateCost = {
  analyzeProposal: (file: File) =>
    PROMPT_OVERHEAD.analyze_proposal + Math.ceil(file.size / 12),
  regenerateField: (currentValue: string) =>
    PROMPT_OVERHEAD.regenerate_field + tokensIn(currentValue) * 2,
  chat: (message: string) => PROMPT_OVERHEAD.chat + tokensIn(message) * 2,
  generateTasks: (outputCount: number) =>
    PROMPT_OVERHEAD.generate_tasks + outputCount * 140,
};

/** Steers offered when drafting tasks again. */
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

/**
 * What the analysis could not work out from the document. These become the
 * questions put to the researcher instead of inventing answers.
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
