import type { z } from "zod";
import { dayString } from "@/utils/calendarDate";
import type { EditType } from "@/schemas/shared";
import type { DmpDraft } from "@/types/dmp";
import type { Dataset } from "@/types/dataset";
import {
  datasetFieldPolicy,
  dmpFieldPolicy,
  planListPolicy,
  type FieldPolicy,
} from "@/config/field-policy";

type Edit = z.infer<typeof EditType>;

/** Lists inside a plan, and the id that identifies an entry in each. */
const LIST_ID = {
  dataset: "dataset_id",
  contributor: "contributor_id",
  cost: "cost_id",
} as const;
export type PlanList = keyof typeof LIST_ID;

/**
 * Exactly what a change touches, by entity id rather than array position — so
 * it can be replayed onto a different version of the plan, where outputs may
 * have been reordered, added or removed.
 */
export interface ChangeTarget {
  list?: PlanList;
  id?: string;
  field?: string;
  op: "set" | "add" | "remove";
}

export interface FieldChange {
  /** Where the value lives, e.g. `dataset[0].access`. */
  path: string;
  /** Machine-readable twin of `path`; absent on changes stored before it existed. */
  target?: ChangeTarget;
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
  is_contact: "Primary contact",
  user_id: "Linked account",
  orcid: "ORCID",
  email: "Email",
  role: "Role",
  name: "Name",
  surname: "Surname",
  value: "Amount",
  currency_code: "Currency",
};

const humanise = (key: string) =>
  LABELS[key] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** How a missing value reads in a change list. */
export const NOT_SET = "Not set";

/** Stable enough to compare: dates by instant, objects by shape. */
const show = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return NOT_SET;
  if (value instanceof Date) return dayString(value);
  if (Array.isArray(value))
    return value.length === 0 ? NOT_SET : value.map(show).join(", ");
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
): Edit =>
  Object.entries(policies).some(
    ([path, policy]) =>
      (path === key || path.startsWith(`${key}.`)) && policy.isMajorTrigger,
  )
    ? "major"
    : "minor";

const listEdit = (policy: FieldPolicy): Edit =>
  policy.isMajorTrigger ? "major" : "minor";

const compare = (
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[],
  policies: Record<string, { isMajorTrigger?: boolean }>,
  prefix: string,
  labelPrefix: string,
  entity?: { list: PlanList; id: string },
): FieldChange[] =>
  keys
    .filter((key) => !same(before[key], after[key]))
    .map((key) => ({
      path: `${prefix}${key}`,
      target: { ...entity, field: key, op: "set" as const },
      label: `${labelPrefix}${humanise(key)}`,
      from: show(before[key]),
      to: show(after[key]),
      edit_type: editTypeFor(key, policies),
    }));

const DMP_KEYS = Object.keys(dmpFieldPolicy).filter(
  (key) => key !== "schema_version",
);

/** Descriptive fields compared even though no policy names them. */
const DESCRIPTIVE_DATASET_KEYS = [
  "type",
  "status",
  "located_at",
  "data_quality_assurance",
  "language",
  "domain",
  "domain_metadata",
  "preservation",
  "distribution",
  "protection_level_other_nomenclature",
  "protection_level_other",
  "security_classification_level_other_nomenclature",
  "security_classification_level_other",
];

/**
 * Every field the policy governs is compared — derived, not listed, so marking
 * a field `isMajorTrigger` can never be silently ignored by a diff that
 * doesn't look at it.
 */
const DATASET_KEYS = [
  ...new Set([
    ...Object.keys(datasetFieldPolicy).map((key) => key.split(".")[0]),
    ...DESCRIPTIVE_DATASET_KEYS,
  ]),
];

/** Exposed for the test that holds the diff to the policy. */
export const COMPARED_KEYS = { dmp: DMP_KEYS, dataset: DATASET_KEYS };

const outputLabel = (index: number) => `Research output ${index + 1}: `;

/**
 * Contributors and costs: added, removed, or any field changed. Each entry is
 * matched by id, so reordering isn't a change. Severity is the list's policy.
 */
const compareList = <T extends Record<string, unknown>>(
  before: T[],
  after: T[],
  idKey: string,
  noun: string,
  nameOf: (entry: T) => string,
  path: string,
  policy: FieldPolicy,
): FieldChange[] => {
  const edit_type = listEdit(policy);
  const id = (entry: T, index: number) => String(entry[idKey] ?? `#${index}`);
  const beforeById = new Map(before.map((e, i) => [id(e, i), e]));
  const afterIds = new Set(after.map((e, i) => id(e, i)));
  const changes: FieldChange[] = [];

  after.forEach((entry, index) => {
    const previous = beforeById.get(id(entry, index));
    if (!previous) {
      changes.push({
        path: `${path}[${index}]`,
        target: { list: path as PlanList, id: id(entry, index), op: "add" },
        label: `${noun} added: ${nameOf(entry)}`,
        from: NOT_SET,
        to: nameOf(entry),
        edit_type,
      });
      return;
    }
    const keys = [...new Set([...Object.keys(previous), ...Object.keys(entry)])]
      .filter((key) => key !== idKey)
      .filter((key) => !same(previous[key], entry[key]));
    keys.forEach((key) =>
      changes.push({
        path: `${path}[${index}].${key}`,
        target: {
          list: path as PlanList,
          id: id(entry, index),
          field: key,
          op: "set",
        },
        label: `${noun} ${index + 1}: ${humanise(key)}`,
        from: show(previous[key]),
        to: show(entry[key]),
        edit_type,
      }),
    );
  });

  before.forEach((entry, index) => {
    if (afterIds.has(id(entry, index))) return;
    changes.push({
      path: `${path}[${id(entry, index)}]`,
      target: { list: path as PlanList, id: id(entry, index), op: "remove" },
      label: `${noun} removed: ${nameOf(entry)}`,
      from: nameOf(entry),
      to: NOT_SET,
      edit_type,
    });
  });

  return changes;
};

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

    // Adding a whole output is judged by the list policy, like removing one.
    if (!previous) {
      changes.push({
        path: `dataset[${index}]`,
        target: {
          list: "dataset",
          id: dataset.dataset_id as string,
          op: "add",
        },
        label: `Research output added: ${dataset.title || "Untitled"}`,
        from: NOT_SET,
        to: dataset.title || "Untitled",
        edit_type: listEdit(planListPolicy.dataset),
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
        { list: "dataset", id: dataset.dataset_id as string },
      ),
    );
  });

  before.forEach((dataset) => {
    if (afterById.has(dataset.dataset_id as string)) return;
    changes.push({
      path: `dataset[${dataset.dataset_id}]`,
      target: {
        list: "dataset",
        id: dataset.dataset_id as string,
        op: "remove",
      },
      label: `Research output removed: ${dataset.title || "Untitled"}`,
      from: dataset.title || "Untitled",
      to: NOT_SET,
      edit_type: listEdit(planListPolicy.dataset),
    });
  });

  changes.push(
    ...compareList(
      (active.contributor ?? []) as Record<string, unknown>[],
      (working.contributor ?? []) as Record<string, unknown>[],
      "contributor_id",
      "Contributor",
      (c) =>
        [c.title, c.name, c.surname].filter(Boolean).join(" ") || "Unnamed",
      "contributor",
      planListPolicy.contributor,
    ),
    ...compareList(
      (active.cost ?? []) as Record<string, unknown>[],
      (working.cost ?? []) as Record<string, unknown>[],
      "cost_id",
      "Cost item",
      (c) => String(c.title || "Untitled"),
      "cost",
      planListPolicy.cost,
    ),
  );

  return changes;
};

/** One major anywhere makes the whole revision major. */
export const editTypeOf = (changes: FieldChange[]): Edit =>
  changes.some((c) => c.edit_type === "major") ? "major" : "minor";

export const countBy = (changes: FieldChange[]) => ({
  minor: changes.filter((c) => c.edit_type === "minor").length,
  major: changes.filter((c) => c.edit_type === "major").length,
});

/**
 * What a person should know before editing an approved plan: the edits that
 * send it back for sign-off. Read from the same policy the diff uses.
 */
export const majorTriggers = (): string[] => [
  ...DMP_KEYS.filter((key) => editTypeFor(key, dmpFieldPolicy) === "major").map(
    humanise,
  ),
  ...DATASET_KEYS.filter(
    (key) => editTypeFor(key, datasetFieldPolicy) === "major",
  ).map((key) => `${humanise(key)} of a research output`),
  ...(planListPolicy.dataset.isMajorTrigger
    ? ["Adding or removing a research output"]
    : []),
  ...(planListPolicy.contributor.isMajorTrigger
    ? ["Any change to contributors"]
    : []),
  ...(planListPolicy.cost.isMajorTrigger ? ["Any change to costs"] : []),
];

type Entity = Record<string, unknown>;
const entries = (plan: DmpDraft, list: PlanList) =>
  ((plan as Record<string, unknown>)[list] ?? []) as Entity[];
const entityIn = (plan: DmpDraft, list: PlanList, id?: string) =>
  entries(plan, list).find((e) => String(e[LIST_ID[list]]) === id);

/** The raw value a change target points at, or the whole entry for add/remove. */
export const valueAt = (plan: DmpDraft, target: ChangeTarget): unknown => {
  if (!target.list)
    return (plan as Record<string, unknown>)[target.field ?? ""];
  const entity = entityIn(plan, target.list, target.id);
  return target.op === "set" ? entity?.[target.field ?? ""] : entity;
};

/** Whether two plans hold the same thing at a target. */
export const sameAt = (a: DmpDraft, b: DmpDraft, target: ChangeTarget) =>
  same(valueAt(a, target), valueAt(b, target));

/**
 * Replays `changes` onto `base`, taking each value from `source` and finding
 * entries by id. A change whose entry no longer exists in `base` (an output
 * the other version removed) can't land, and is returned as skipped rather
 * than dropped silently. Neither input is modified.
 */
export const applyChanges = (
  base: DmpDraft,
  source: DmpDraft,
  changes: FieldChange[],
): { plan: DmpDraft; applied: FieldChange[]; skipped: FieldChange[] } => {
  const plan = structuredClone(base) as Record<string, unknown>;
  const applied: FieldChange[] = [];
  const skipped: FieldChange[] = [];

  changes.forEach((change) => {
    const t = change.target;
    if (!t) return skipped.push(change);

    if (!t.list) {
      plan[t.field ?? ""] = structuredClone(valueAt(source, t));
      return applied.push(change);
    }

    const list = (plan[t.list] ??= []) as Entity[];
    const key = LIST_ID[t.list];
    const index = list.findIndex((e) => String(e[key]) === t.id);

    if (t.op === "remove") {
      if (index >= 0) list.splice(index, 1);
      return applied.push(change);
    }
    if (t.op === "add") {
      const added = entityIn(source, t.list, t.id);
      if (index < 0 && added) list.push(structuredClone(added));
      return applied.push(change);
    }
    if (index < 0) return skipped.push(change);
    list[index] = {
      ...list[index],
      [t.field ?? ""]: structuredClone(valueAt(source, t)),
    };
    applied.push(change);
  });

  return { plan: plan as DmpDraft, applied, skipped };
};
