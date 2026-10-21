export type FieldPermission = "ai" | "human" | "locked";

export type FieldKind =
  "prose" | "choice" | "date" | "number" | "identifier" | "boolean" | "list";

export interface FieldPolicy {
  permission: FieldPermission;
  kind: FieldKind;
  isMajorTrigger?: boolean;
  editableBeforeApproval?: boolean;
}

export const canRegenerate = (policy?: FieldPolicy): boolean =>
  policy?.permission === "ai" && policy.kind === "prose";

export const dmpFieldPolicy: Record<string, FieldPolicy> = {
  title: { permission: "ai", kind: "prose" },
  description: { permission: "ai", kind: "prose" },
  language: { permission: "ai", kind: "choice" },
  alternate_identifier: { permission: "human", kind: "identifier" },
  // Locked to the AI throughout. People can change the timeline after
  // approval too, but that is a change to what was agreed.
  begin_date: {
    permission: "locked",
    kind: "date",
    editableBeforeApproval: true,
    isMajorTrigger: true,
  },
  end_date: {
    permission: "locked",
    kind: "date",
    editableBeforeApproval: true,
    isMajorTrigger: true,
  },
  ethical_issues_exist: {
    permission: "human",
    kind: "boolean",
    isMajorTrigger: true,
  },
  ethical_issues_description: { permission: "human", kind: "prose" },
  // A link to the ethics report (maDMP: a URI), not text to phrase.
  ethical_issues_report: { permission: "human", kind: "identifier" },
  indigenous_considerations: {
    permission: "human",
    kind: "prose",
    isMajorTrigger: true,
  },
  schema_version: { permission: "locked", kind: "identifier" },
};

export const datasetFieldPolicy: Record<string, FieldPolicy> = {
  title: { permission: "ai", kind: "prose" },
  description: { permission: "ai", kind: "prose" },
  keyword: { permission: "ai", kind: "list" },
  schema_fields: { permission: "ai", kind: "list" },
  access: { permission: "human", kind: "choice", isMajorTrigger: true },
  personal_data: { permission: "human", kind: "choice", isMajorTrigger: true },
  sensitive_data: { permission: "human", kind: "choice" },
  personal_data_plan: {
    permission: "human",
    kind: "prose",
    isMajorTrigger: true,
  },
  protection_level: {
    permission: "human",
    kind: "choice",
    isMajorTrigger: true,
  },
  security_classification_level: {
    permission: "human",
    kind: "choice",
    isMajorTrigger: true,
  },
  "preservation.statement": { permission: "human", kind: "prose" },
};

/**
 * The lists inside a plan, judged per entry: adding one, removing one, or
 * changing any field of one. For research outputs, a change *within* an
 * existing output is judged field by field by `datasetFieldPolicy`; adding or
 * removing a whole output is judged here.
 *
 * Together with the two maps above, this is the only place `isMajorTrigger`
 * is set — plan-diff and the "needs sign-off again" list both read it.
 */
export const planListPolicy: Record<
  "dataset" | "contributor" | "cost",
  FieldPolicy
> = {
  dataset: { permission: "human", kind: "list", isMajorTrigger: true },
  // Includes the contact: changing who answers questions isn't re-reviewed.
  contributor: { permission: "human", kind: "list" },
  cost: { permission: "human", kind: "list" },
};
