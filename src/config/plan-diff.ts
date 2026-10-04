import type { z } from "zod";
import type { EditType } from "@/schemas/shared";
import type { DmpDraft } from "@/types/dmp";
import type { Dataset } from "@/types/dataset";
import { datasetFieldPolicy, dmpFieldPolicy } from "@/config/field-policy";

type Edit = z.infer<typeof EditType>;

export interface FieldChange {
  /** Where the value lives, e.g. `dataset[0].access`. */
  path: string;
  /** The same thing in words, for a person reading the list. */
  label: string;
  from: string;
  to: string;
  edit_type: Edit;
}

const LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  language: "Language",
  begin_date: "Begin date",
  end_date: "End date",
  alternate_identifier: "Alternate identifier",
  ethical_issues_exist: "Ethical issues",
  ethical_issues_description: "Ethical issues description",
  ethical_issues_report: "Ethical issues report URL",
  indigenous_considerations: "Indigenous considerations",
  access: "Access",
  personal_data: "Personal data",
  sensitive_data: "Sensitive data",
  personal_data_plan: "Personal data plan",
  protection_level: "Protection level",
  security_classification_level: "Security classification",
  data_quality_assurance: "Quality assurance",
  keyword: "Keywords",
  located_at: "Located at",
  status: "Status",
  domain: "Research domain",
  domain_metadata: "Domain details",
  preservation: "Preservation",
  distribution: "Distribution",
  schema_fields: "Schema fields",
  type: "Output type",
};

const humanise = (key: string) =>
  LABELS[key] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Stable enough to compare: dates by instant, objects by shape. */
const show = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "—";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value))
    return value.length === 0 ? "—" : value.map(show).join(", ");
  if (typeof value === "object")
    return JSON.stringify(value, (_k, v) =>
      v instanceof Date ? v.toISOString() : v,
    );
  return String(value);
};

const same = (a: unknown, b: unknown) => show(a) === show(b);

/**
 * Whether changing this field means the plan has to be looked at again.
 *
 * It isn't a judgement made here — `field-policy` already marks the fields
 * that carry a commitment (access, protection, security classification), and
 * this reads that same mark so the two can't disagree.
 */
const editTypeFor = (
  key: string,
  policies: Record<string, { isMajorTrigger?: boolean }>,
): Edit => (policies[key]?.isMajorTrigger ? "major" : "minor");

const compare = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[],
  policies: Record<string, { isMajorTrigger?: boolean }>,
  prefix: string,
  labelPrefix: string,
): FieldChange[] =>
  keys
    .filter((key) => !same(before[key], after[key]))
    .map((key) => ({
      path: `${prefix}${key}`,
      label: `${labelPrefix}${humanise(key)}`,
      from: show(before[key]),
      to: show(after[key]),
      edit_type: editTypeFor(key, policies),
    }));

const DMP_KEYS = Object.keys(dmpFieldPolicy).filter(
  (key) => key !== "schema_version",
);

const DATASET_KEYS = [
  "title",
  "description",
  "type",
  "status",
  "located_at",
  "access",
  "personal_data",
  "sensitive_data",
  "personal_data_plan",
  "protection_level",
  "security_classification_level",
  "data_quality_assurance",
  "keyword",
  "domain",
  "domain_metadata",
  "preservation",
  "distribution",
];

const outputLabel = (index: number) => `Research output ${index + 1} — `;

/**
 * What moved between the version in force and the plan being edited.
 *
 * Only the two ends matter: how many times something was typed in between is
 * nobody's business, but what the committee would be asked to re-read is.
 */
export const diffPlans = (
  active: DmpDraft,
  working: DmpDraft,
): FieldChange[] => {
  const changes: FieldChange[] = [
    ...compare(
      active as Record<string, unknown>,
      working as Record<string, unknown>,
      DMP_KEYS,
      dmpFieldPolicy,
      "",
      "",
    ),
  ];

  const before = active.dataset ?? [];
  const after = working.dataset ?? [];
  const byId = (list: Dataset[]) =>
    new Map(list.map((d) => [d.dataset_id as string, d]));
  const beforeById = byId(before);
  const afterById = byId(after);

  after.forEach((dataset, index) => {
    const previous = beforeById.get(dataset.dataset_id as string);

    // A new research output changes what was approved, so it is always major.
    if (!previous) {
      changes.push({
        path: `dataset[${index}]`,
        label: `Research output added — ${dataset.title || "Untitled"}`,
        from: "—",
        to: dataset.title || "Untitled",
        edit_type: "major",
      });
      return;
    }

    changes.push(
      ...compare(
        previous as unknown as Record<string, unknown>,
        dataset as unknown as Record<string, unknown>,
        DATASET_KEYS,
        datasetFieldPolicy,
        `dataset[${index}].`,
        outputLabel(index),
      ),
    );
  });

  before.forEach((dataset) => {
    if (afterById.has(dataset.dataset_id as string)) return;
    changes.push({
      path: `dataset[${dataset.dataset_id}]`,
      label: `Research output removed — ${dataset.title || "Untitled"}`,
      from: dataset.title || "Untitled",
      to: "—",
      edit_type: "major",
    });
  });

  return changes;
};

/** One major anywhere makes the whole revision major. */
export const editTypeOf = (changes: FieldChange[]): Edit =>
  changes.some((c) => c.edit_type === "major") ? "major" : "minor";

export const countBy = (changes: FieldChange[]) => ({
  minor: changes.filter((c) => c.edit_type === "minor").length,
  major: changes.filter((c) => c.edit_type === "major").length,
});
