import type { z } from "zod";
import { dmpSchema } from "@/schemas/dmp";
import { useDmpStore } from "@/store/dmpStore";
import type { DmpDraft } from "@/types/dmp";

/** The editor's section ids, so an item can say where to go and fix it. */
export type DmpSection =
  "general" | "dataset" | "ethical" | "people" | "system";

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
}

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

  // The hand-written items, each owning the schema paths it speaks for. An
  // uncovered failure is appended below rather than left invisible.
  const known: (ReadinessItem & { covers: string[] })[] = [
    {
      label: "Title provided",
      done: Boolean(draft.title),
      section: "general",
      covers: ["title"],
    },
    {
      label: "Description provided",
      done: Boolean(draft.description),
      section: "general",
      covers: ["description"],
    },
    {
      label: "Language provided",
      done: Boolean(draft.language),
      section: "general",
      covers: ["language"],
    },
    {
      label: "Begin & end dates set",
      done: Boolean(draft.begin_date && draft.end_date),
      section: "general",
      covers: ["begin_date", "end_date"],
    },
    {
      label: "Ethical issues answered",
      done: draft.ethical_issues_exist !== undefined,
      section: "ethical",
      covers: ["ethical_issues_exist"],
    },
    ...(draft.ethical_issues_exist
      ? [
          {
            label: "Ethical issues described",
            done: Boolean(draft.ethical_issues_description),
            section: "ethical" as DmpSection,
            covers: ["ethical_issues_description"],
          },
        ]
      : []),
    {
      label: "At least one contributor added",
      done: contributors.length > 0,
      section: "people",
      covers: ["contributor"],
    },
    {
      label: "Exactly one primary contact set",
      done: contactCount === 1,
      section: "people",
      covers: ["contributor"],
    },
    {
      label: "At least one research output added",
      done: datasets.length > 0,
      section: "dataset",
      covers: ["dataset"],
    },
    {
      label: "Every research output has protection & security set",
      done:
        datasets.length > 0 &&
        datasets.every(
          (d) =>
            Boolean(d.protection_level) &&
            Boolean(d.security_classification_level),
        ),
      section: "dataset",
      covers: ["dataset"],
    },
  ];

  // Anything the schema rejects that no unmet item above already speaks for.
  // Without this the list could read "10 of 10 ready" while submit stayed
  // locked, with nothing to tell you which field was wrong.
  const uncovered: ReadinessItem[] = [];
  const seen = new Set<string>();

  if (!schemaResult.success) {
    schemaResult.error.issues.forEach((issue: z.ZodIssue) => {
      const root = String(issue.path[0] ?? "");
      const spokenFor = known.some(
        (item) => !item.done && item.covers.includes(root),
      );
      if (spokenFor) return;

      const label = `${labelForPath(issue.path)} needs attention`;
      if (seen.has(label)) return;
      seen.add(label);

      uncovered.push({
        label,
        done: false,
        section: sectionForPath(issue.path),
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
