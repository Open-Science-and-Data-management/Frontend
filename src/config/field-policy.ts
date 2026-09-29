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
  begin_date: { permission: "locked", editableBeforeApproval: true },
  end_date: { permission: "locked", editableBeforeApproval: true },
  ethical_issues_exist: { permission: "human" },
  ethical_issues_description: { permission: "human" },
  ethical_issues_report: { permission: "human" },
  indigenous_considerations: { permission: "human" },
  schema_version: { permission: "locked" },
};

export const datasetFieldPolicy: Record<string, FieldPolicy> = {
  title: { permission: "ai" },
  description: { permission: "ai" },
  keyword: { permission: "ai" },
  schema_fields: { permission: "ai" },
  access: { permission: "human", isMajorTrigger: true },
  personal_data: { permission: "human" },
  sensitive_data: { permission: "human" },
  personal_data_plan: { permission: "human" },
  protection_level: { permission: "human", isMajorTrigger: true },
  security_classification_level: { permission: "human", isMajorTrigger: true },
  "preservation.statement": { permission: "human" },
};
