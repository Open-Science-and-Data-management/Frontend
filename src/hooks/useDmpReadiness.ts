import type { z } from "zod";
import { dmpSchema } from "@/schemas/dmp";
import { useDmpStore } from "@/store/dmpStore";
import type { DmpDraft } from "@/types/dmp";

/**
 * The editor's sections, in the order they're authored — so an item can say
 * where to go and fix it, and the nav and the checklist stay in step.
 */
export const DMP_SECTIONS = [
  "general",
  "dataset",
  "ethical",
  "people",
  "system",
] as const;

export type DmpSection = (typeof DMP_SECTIONS)[number];

export const SECTION_LABELS: Record<DmpSection, string> = {
  general: "General",
  dataset: "Research outputs",
  ethical: "Ethical",
  people: "People & cost",
  system: "System info",
};

export interface ReadinessItem {
  label: string;
  done: boolean;
  section: DmpSection;
  /** The input to focus, so "where do I fix this" ends at the field itself. */
  fieldId?: string;
}

/** DatasetCard names a few inputs by a short form of the field. */
const DATASET_INPUT: Record<string, string> = {
  protection_level: "protection",
  security_classification_level: "security",
  type: "type",
  status: "status",
  domain: "domain",
};

/**
 * The DOM id of the input a schema path points at, following the ids the
 * editor's sections give their inputs. Best effort: an unknown path still
 * opens the right section, it just doesn't focus anything.
 */
export const fieldIdFor = (
  path: (string | number)[],
  draft: DmpDraft,
): string | undefined => {
  const [root, index, key, subIndex, subKey] = path;
  if (root === "contributor" && typeof index === "number" && key) {
    const id = draft.contributor?.[index]?.contributor_id;
    return id ? `contributor-${String(key)}-${id}` : undefined;
  }
  if (root === "dataset" && typeof index === "number") {
    const id = draft.dataset?.[index]?.dataset_id;
    if (!id) return undefined;
    if (key === "distribution" && typeof subIndex === "number" && subKey)
      return `distribution-${String(subKey)}-${id}-${subIndex}`;
    if (key === "domain_metadata" && subIndex !== undefined)
      return `${String(subIndex)}-${id}`;
    if (typeof key === "string") return `${DATASET_INPUT[key] ?? key}-${id}`;
    return undefined;
  }
  return typeof root === "string" ? root : undefined;
};

/** A cover like "dataset.*.protection_level" matches exactly that path shape. */
const coversPath = (pattern: string, path: (string | number)[]) => {
  const parts = pattern.split(".");
  return (
    parts.length === path.length &&
    parts.every((part, i) => part === "*" || part === String(path[i]))
  );
};

/** Which section owns each top-level field of the plan. */
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

/** Field names as the forms label them, so an error points at something visible. */
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  language: "Language",
  begin_date: "Begin date",
  end_date: "End date",
  alternate_identifier: "Alternate identifier",
  ethical_issues_description: "Ethical issues description",
  ethical_issues_report: "Ethical issues report URL",
  name: "Name",
  surname: "Surname",
  role: "Role",
  email: "Email",
  orcid: "ORCID",
  value: "Amount",
  currency_code: "Currency",
  type: "Type",
  status: "Status",
  access: "Access",
  personal_data: "Personal data",
  sensitive_data: "Sensitive data",
  protection_level: "Protection level",
  security_classification_level: "Security classification level",
  keyword: "Keywords",
  license: "Licence",
  user_id: "Linked account",
  domain: "Research domain",
  domain_metadata: "Domain details",
  preservation: "Preservation",
  distribution: "Distribution",
  schema_version: "Schema version",
};

/** Repeating groups are numbered in the UI, so errors name the row. */
const GROUP_NOUNS: Record<string, string> = {
  dataset: "Research output",
  contributor: "Contributor",
  cost: "Cost item",
  distribution: "Distribution",
};

const humanise = (key: string) =>
  FIELD_LABELS[key] ??
  key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * Turns a Zod issue path into something a person can act on, e.g.
 * ["dataset", 1, "protection_level"] → "Research output 2 — Protection level".
 */
const labelForPath = (path: (string | number)[]): string => {
  const parts: string[] = [];

  path.forEach((segment, index) => {
    if (typeof segment === "number") return;
    const next = path[index + 1];
    parts.push(
      typeof next === "number" && GROUP_NOUNS[segment]
        ? `${GROUP_NOUNS[segment]} ${next + 1}`
        : humanise(segment),
    );
  });

  return parts.length > 0 ? parts.join(" — ") : "Plan details";
};

const sectionForPath = (path: (string | number)[]): DmpSection =>
  SECTION_OF[String(path[0])] ?? "general";

export const computeReadiness = (draft: DmpDraft) => {
  const schemaResult = dmpSchema.safeParse(draft);
  const contributors = draft.contributor ?? [];
  const contactCount = contributors.filter((c) => c.is_contact).length;
  const datasets = draft.dataset ?? [];
  const unprotected = datasets
    .map((d, i) =>
      d.protection_level && d.security_classification_level ? -1 : i,
    )
    .filter((i) => i >= 0);

  // The hand-written items, each owning the schema paths it speaks for. An
  // uncovered failure is appended below rather than left invisible.
  const known: (ReadinessItem & { covers: string[] })[] = [
    {
      label: "Add a title",
      done: Boolean(draft.title),
      section: "general",
      covers: ["title"],
      fieldId: "title",
    },
    {
      label: "Add a description",
      done: Boolean(draft.description),
      section: "general",
      covers: ["description"],
      fieldId: "description",
    },
    {
      label: "Choose a language",
      done: Boolean(draft.language),
      section: "general",
      covers: ["language"],
      fieldId: "language",
    },
    {
      label: "Set begin & end dates",
      done: Boolean(draft.begin_date && draft.end_date),
      section: "general",
      covers: ["begin_date", "end_date"],
      fieldId: draft.begin_date ? "end_date" : "begin_date",
    },
    {
      label: "Answer the ethical issues question",
      done: draft.ethical_issues_exist !== undefined,
      section: "ethical",
      covers: ["ethical_issues_exist"],
      fieldId: "ethical_issues_exist",
    },
    ...(draft.ethical_issues_exist
      ? [
          {
            label: "Describe the ethical issues",
            done: Boolean(draft.ethical_issues_description),
            section: "ethical" as DmpSection,
            covers: ["ethical_issues_description"],
            fieldId: "ethical_issues_description",
          },
        ]
      : []),
    {
      label: "Add a contributor",
      done: contributors.length > 0,
      section: "people",
      covers: ["contributor"],
    },
    {
      label: "Mark exactly one primary contact",
      done: contactCount === 1,
      section: "people",
      covers: ["contributor"],
    },
    {
      label: "Add a research output",
      done: datasets.length > 0,
      section: "dataset",
      covers: ["dataset"],
    },
    {
      // Names the outputs, so with several the reader knows which one.
      label:
        unprotected.length > 0 && unprotected.length < datasets.length
          ? `Set protection & security on research output ${unprotected.map((i) => i + 1).join(", ")}`
          : "Set protection & security on every research output",
      done: datasets.length > 0 && unprotected.length === 0,
      section: "dataset",
      // Only the fields it speaks for — claiming all of "dataset" hid every
      // other output problem (a missing licence, say) behind this one.
      covers: [
        "dataset.*.protection_level",
        "dataset.*.security_classification_level",
      ],
      fieldId: (() => {
        const first = datasets[unprotected[0]];
        if (!first?.dataset_id) return undefined;
        return first.protection_level
          ? `security-${first.dataset_id}`
          : `protection-${first.dataset_id}`;
      })(),
    },
  ];

  // Anything the schema rejects that no unmet item above already speaks for.
  // Without this the list could read "10 of 10 ready" while submit stayed
  // locked, with nothing to tell you which field was wrong.
  const uncovered: ReadinessItem[] = [];
  const seen = new Set<string>();

  if (!schemaResult.success) {
    schemaResult.error.issues.forEach((issue: z.ZodIssue) => {
      // An unmet item speaks for exactly the paths it names, nothing broader.
      const spokenFor = known.some(
        (item) =>
          !item.done &&
          item.covers.some((pattern) => coversPath(pattern, issue.path)),
      );
      if (spokenFor) return;

      const label = `${labelForPath(issue.path)} needs attention`;
      if (seen.has(label)) return;
      seen.add(label);

      uncovered.push({
        label,
        done: false,
        section: sectionForPath(issue.path),
        fieldId: fieldIdFor(issue.path, draft),
      });
    });
  }

  const checklistItems: ReadinessItem[] = [
    ...known.map(({ covers: _covers, ...item }) => item),
    ...uncovered,
  ];

  // Submission is gated on the plan being valid; the single confirmation
  // now happens once, at submit.
  const canSubmit = schemaResult.success;

  return {
    checklistItems,
    canSubmit,
    unmetItems: checklistItems.filter((i) => !i.done),
    schemaError: schemaResult.success ? null : schemaResult.error,
  };
};

export const useDmpReadiness = () => {
  const draft = useDmpStore((s) => s.draft);
  return computeReadiness(draft);
};
