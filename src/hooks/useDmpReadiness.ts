import { dmpSchema } from "@/schemas/dmp";
import { useDmpStore } from "@/store/dmpStore";
import type { DmpDraft } from "@/types/dmp";

export interface ReadinessItem {
  label: string;
  done: boolean;
}

export const computeReadiness = (draft: DmpDraft) => {
  const schemaResult = dmpSchema.safeParse(draft);
  const contributors = draft.contributor ?? [];
  const contactCount = contributors.filter((c) => c.is_contact).length;
  const datasets = draft.dataset ?? [];

  const checklistItems: ReadinessItem[] = [
    { label: "Title provided", done: Boolean(draft.title) },
    { label: "Description provided", done: Boolean(draft.description) },
    { label: "Language provided", done: Boolean(draft.language) },
    {
      label: "Begin & end dates set",
      done: Boolean(draft.begin_date && draft.end_date),
    },
    {
      label: "Ethical issues answered",
      done: draft.ethical_issues_exist !== undefined,
    },
    ...(draft.ethical_issues_exist
      ? [
          {
            label: "Ethical issues described",
            done: Boolean(draft.ethical_issues_description),
          },
        ]
      : []),
    { label: "At least one contributor added", done: contributors.length > 0 },
    { label: "Exactly one primary contact set", done: contactCount === 1 },
    { label: "At least one research output added", done: datasets.length > 0 },
    {
      label: "Every research output has protection & security set",
      done:
        datasets.length > 0 &&
        datasets.every(
          (d) =>
            Boolean(d.protection_level) &&
            Boolean(d.security_classification_level),
        ),
    },
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
