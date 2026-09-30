import { z } from "zod";
import { dmpDraftSchema } from "@/schemas/dmp";
import { datasetBase, preservationSchema } from "@/schemas/dataset";
import type { DmpDraft } from "@/types/dmp";
import type { DmpSection } from "@/hooks/useDmpReadiness";
import {
  datasetFieldPolicy,
  dmpFieldPolicy,
  type FieldPolicy,
} from "@/config/field-policy";

/**
 * The one place that answers, for a path the assistant names: does this field
 * exist, who is allowed to change it, what shape must the value be, and where
 * in the editor does it live. Everything the chat proposes goes through here —
 * the model is never the thing deciding what is writable.
 */
export interface FieldTarget {
  path: string;
  label: string;
  section: DmpSection;
  policy: FieldPolicy;
  validator: z.ZodTypeAny;
  /** Reads the current value, for the before side of a diff. */
  read: (draft: DmpDraft) => unknown;
  /** Set on a dataset field; the id the change applies to. */
  datasetId?: string;
  datasetField?: string;
  /** Nested under `preservation`. */
  preservationField?: string;
}

export interface PathError {
  error: string;
}

const humanise = (key: string) =>
  key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * Anything not explicitly marked `ai` is treated as the researcher's call.
 * A field nobody classified is not a field an assistant should fill silently.
 */
const CONSERVATIVE_DEFAULT: FieldPolicy = { permission: "human" };

const DATASET_PATH = /^dataset\[(\d+)\]\.(.+)$/;

export const resolveFieldPath = (
  draft: DmpDraft,
  rawPath: string,
): FieldTarget | PathError => {
  const path = rawPath.trim();

  const datasetMatch = path.match(DATASET_PATH);
  if (datasetMatch) {
    const index = Number(datasetMatch[1]);
    const field = datasetMatch[2];
    const dataset = (draft.dataset ?? [])[index];
    if (!dataset) {
      return { error: `This plan has no research output at index ${index}.` };
    }

    const preservationField = field.startsWith("preservation.")
      ? field.slice("preservation.".length)
      : undefined;

    const shape = preservationField
      ? preservationSchema.shape
      : datasetBase.shape;
    const key = preservationField ?? field;
    const validator = (shape as Record<string, z.ZodTypeAny>)[key];
    if (!validator) {
      return { error: `"${field}" is not a field of a research output.` };
    }

    return {
      path,
      label: `${dataset.title || `Output ${index + 1}`} — ${humanise(key)}`,
      section: "dataset",
      policy: datasetFieldPolicy[field] ?? CONSERVATIVE_DEFAULT,
      validator,
      datasetId: dataset.dataset_id as string,
      datasetField: field,
      preservationField,
      read: (d) => {
        const target = (d.dataset ?? [])[index];
        if (!target) return undefined;
        return preservationField
          ? (target.preservation as Record<string, unknown> | undefined)?.[
              preservationField
            ]
          : (target as unknown as Record<string, unknown>)[field];
      },
    };
  }

  const validator = (dmpDraftSchema.shape as Record<string, z.ZodTypeAny>)[
    path
  ];
  if (!validator) {
    return { error: `"${path}" is not a field of the plan.` };
  }

  return {
    path,
    label: humanise(path),
    section: SECTION_OF[path] ?? "general",
    policy: dmpFieldPolicy[path] ?? CONSERVATIVE_DEFAULT,
    validator,
    read: (d) => (d as unknown as Record<string, unknown>)[path],
  };
};

const SECTION_OF: Record<string, DmpSection> = {
  title: "general",
  description: "general",
  language: "general",
  begin_date: "general",
  end_date: "general",
  alternate_identifier: "general",
  ethical_issues_exist: "ethical",
  ethical_issues_description: "ethical",
  ethical_issues_report: "ethical",
  indigenous_considerations: "ethical",
  contributor: "people",
  cost: "people",
  dataset: "dataset",
  schema_version: "system",
};

/** Paths the assistant may name, for the stub planner and for `explainField`. */
export const KNOWN_PATHS = [
  ...Object.keys(dmpFieldPolicy),
  ...Object.keys(datasetFieldPolicy).map((f) => `dataset[].${f}`),
  "dataset[].preservation.duration",
  "dataset[].preservation.repository",
];

export const FIELD_HELP: Record<string, string> = {
  title: "The plan's name. AI drafts it from your proposal; you can rewrite it.",
  description: "What the project does, in a paragraph.",
  language: "The language the plan itself is written in.",
  begin_date: "When the project starts. Locked once the committee approves.",
  end_date: "When the project ends. Locked once the committee approves.",
  ethical_issues_exist:
    "Whether the work raises ethical issues. Yours to answer — AI never sets it.",
  ethical_issues_description: "How those ethical issues are handled.",
  ethical_issues_report: "A link to the ethics approval or review report.",
  access: "Who can reach the output: open, shared, or closed.",
  protection_level: "How the data is protected in practice.",
  security_classification_level: "The classification the institution assigns.",
  "preservation.duration": "How long the output is kept after the project ends.",
  "preservation.repository": "Where the output will be deposited.",
  "preservation.statement": "The preservation plan in prose.",
};
