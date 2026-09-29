import { dmpSchema } from "@/schemas/dmp";
import { useDmpStore, datasetConfirmKey } from "@/store/dmpStore";
import type { DmpDraft } from "@/types/dmp";

const DATASET_REQUIRED_FIELDS = [
  "access",
  "personal_data",
  "sensitive_data",
  "protection_level",
  "security_classification_level",
];

export interface ReadinessItem {
  label: string;
  done: boolean;
}

export const computeReadiness = (
  draft: DmpDraft,
  confirmedFields: Record<string, boolean>,
) => {
  const schemaResult = dmpSchema.safeParse(draft);
  const ethicalConfirmed = Boolean(confirmedFields.ethical_issues_exist);
  const ethicalDescriptionConfirmed =
    !draft.ethical_issues_exist ||
    Boolean(confirmedFields.ethical_issues_description);

  const contributors = draft.contributor ?? [];
  const contactCount = contributors.filter((c) => c.is_contact).length;
  const datasets = draft.dataset ?? [];
  const datasetsAllConfirmed =
    datasets.length > 0 &&
    datasets.every((d) =>
      DATASET_REQUIRED_FIELDS.every((field) =>
        Boolean(confirmedFields[datasetConfirmKey(d.dataset_id as string, field)]),
      ),
    );

  const checklistItems: ReadinessItem[] = [
    { label: "Title provided", done: Boolean(draft.title) },
    { label: "Description provided", done: Boolean(draft.description) },
    { label: "Language provided", done: Boolean(draft.language) },
    {
      label: "Begin & end dates set",
      done: Boolean(draft.begin_date && draft.end_date),
    },
    { label: "Ethical issues question confirmed", done: ethicalConfirmed },
    ...(draft.ethical_issues_exist
      ? [
          {
            label: "Ethical issues description confirmed",
            done: ethicalDescriptionConfirmed,
          },
        ]
      : []),
    { label: "At least one contributor added", done: contributors.length > 0 },
    { label: "Exactly one primary contact set", done: contactCount === 1 },
    { label: "At least one research output added", done: datasets.length > 0 },
    {
      label: "Every research output's required fields confirmed",
      done: datasetsAllConfirmed,
    },
  ];

  const canSubmit =
    schemaResult.success &&
    ethicalConfirmed &&
    ethicalDescriptionConfirmed &&
    datasetsAllConfirmed;

  return {
    checklistItems,
    canSubmit,
    unmetItems: checklistItems.filter((i) => !i.done),
    schemaError: schemaResult.success ? null : schemaResult.error,
  };
};

export const useDmpReadiness = () => {
  const { draft, confirmedFields } = useDmpStore();
  return computeReadiness(draft, confirmedFields);
};
