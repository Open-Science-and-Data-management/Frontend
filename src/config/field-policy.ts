export type FieldPermission = "ai" | "human" | "locked";

export interface FieldPolicy {
  permission: FieldPermission;
  isMajorTrigger?: boolean;
  editableBeforeApproval?: boolean;
}

export const dmpFieldPolicy: Record<string, FieldPolicy> = {
  title: { permission: "ai" },
  description: { permission: "ai" },
  language: { permission: "ai" },
  alternate_identifier: { permission: "human" },
  // Locked to the AI throughout. People can change the timeline after
  // approval too, but that is a change to what was agreed.
  begin_date: {
    permission: "locked",
    editableBeforeApproval: true,
    isMajorTrigger: true,
  },
  end_date: {
    permission: "locked",
    editableBeforeApproval: true,
    isMajorTrigger: true,
  },
  ethical_issues_exist: { permission: "human", isMajorTrigger: true },
  ethical_issues_description: { permission: "human" },
  ethical_issues_report: { permission: "human" },
  indigenous_considerations: { permission: "human", isMajorTrigger: true },
  schema_version: { permission: "locked" },
};

export const datasetFieldPolicy: Record<string, FieldPolicy> = {
  title: { permission: "ai" },
  description: { permission: "ai" },
  keyword: { permission: "ai" },
  schema_fields: { permission: "ai" },
  access: { permission: "human", isMajorTrigger: true },
  personal_data: { permission: "human", isMajorTrigger: true },
  sensitive_data: { permission: "human" },
  personal_data_plan: { permission: "human", isMajorTrigger: true },
  protection_level: { permission: "human", isMajorTrigger: true },
  security_classification_level: { permission: "human", isMajorTrigger: true },
  "preservation.statement": { permission: "human" },
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
  dataset: { permission: "human", isMajorTrigger: true },
  // Includes the contact: changing who answers questions isn't re-reviewed.
  contributor: { permission: "human" },
  cost: { permission: "human" },
};
