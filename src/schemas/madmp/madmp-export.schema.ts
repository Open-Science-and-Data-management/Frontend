import { z } from "zod";
import {
  APPROVAL_STATUSES,
  CONTACT_ROLES,
  MADMP_SCHEMA_VERSION,
  PROTECTION_LEVELS,
  SECURITY_CLASSIFICATION_LEVELS,
} from "./vocabularies";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const isoDateTime = z.string().datetime({ offset: true });
const yesNoUnknown = z.enum(["yes", "no", "unknown"]);
const access = z.enum(["open", "shared", "closed"]);

const pid = <T extends readonly [string, ...string[]]>(types: T) =>
  z.object({
    identifier: z.string().min(1),
    type: z.enum(types),
    registry_name: z.string().optional(),
  });

const DMP_ID_TYPES = ["handle", "doi", "ark", "url", "uri", "other"] as const;
const DATASET_ID_TYPES = ["handle", "doi", "ark", "url", "other"] as const;
const PERSON_ID_TYPES = ["orcid", "isni", "openid", "other"] as const;

const generalInfoOut = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dmp_id: pid(DMP_ID_TYPES),
  created: isoDateTime,
  modified: isoDateTime,
  language: z.string().length(3),
  protection_level: z.enum(PROTECTION_LEVELS).optional(),
  protection_level_other_nomenclature: z.string().optional(),
  protection_level_other_level: z.string().optional(),
  security_classification_level: z
    .enum(SECURITY_CLASSIFICATION_LEVELS)
    .optional(),
  security_classification_level_other_nomenclature: z.string().optional(),
  security_classification_level_other_level: z.string().optional(),
  schema_version: z.literal(MADMP_SCHEMA_VERSION),
  schema_version_uri: z.string().url(),
  ethical_issues_exist: yesNoUnknown,
  ethical_issues_description: z.string().optional(),
  ethical_issues_report: z.string().optional(),
  alternate_identifier: z
    .array(z.object({ identifier: pid(DATASET_ID_TYPES) }))
    .optional(),
});

const contactOut = z.object({
  name: z.string().min(1),
  mbox: z.string().email(),
  contact_id: pid(PERSON_ID_TYPES),
  role: z.enum(CONTACT_ROLES).optional(),
});

const contributorOut = z.object({
  name: z.string().min(1),
  role: z.array(z.string()).min(1),
  mbox: z.string().email().optional(),
  contributor_id: pid(PERSON_ID_TYPES),
});

const approvalOut = z
  .object({
    status: z.enum(APPROVAL_STATUSES),
    description: z.string().optional(),
    by_name: z.string().optional(),
    by_position: z.string().optional(),
    by_mbox: z.string().email().optional(),
    date: isoDate.optional(),
  })
  .superRefine((a, ctx) => {
    // Mirrors the standard: a decision, or a submission, names who and when.
    if (["approved", "rejected", "submitted"].includes(a.status)) {
      (["by_name", "by_position", "date"] as const).forEach((key) => {
        if (!a[key])
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when status is ${a.status}`,
          });
      });
    }
  });

const projectOut = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  start: isoDate.optional(),
  end: isoDate.optional(),
});

const costOut = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    value: z.number().optional(),
    currency_code: z.string().length(3).optional(),
  })
  .refine((c) => !c.value || Boolean(c.currency_code), {
    message: "currency_code is required when value is above zero",
    path: ["currency_code"],
  });

const indigenousOut = z.object({
  exist: yesNoUnknown,
  description: z.string().optional(),
  dmp_discussion: z.enum(["yes", "no", "not applicable", "unknown"]).optional(),
  indigenous_control_over_data: z
    .enum(["yes", "no", "not applicable", "unknown"])
    .optional(),
  traditional_knowledge: yesNoUnknown.optional(),
});

/** Distributions spell the Protected levels in lower case. */
const DISTRIBUTION_PROTECTION = [
  "unknown",
  "not protected",
  "protected A",
  "protected B",
  "protected C",
  "other",
] as const;

const distributionOut = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  distribution_id: pid(DATASET_ID_TYPES),
  data_access: access,
  access_url: z.string().optional(),
  download_url: z.string().optional(),
  format: z.array(z.string()).optional(),
  byte_size: z.number().optional(),
  license: z
    .object({ license_ref: z.string().min(1), start_date: isoDate })
    .optional(),
  protection_level: z.enum(DISTRIBUTION_PROTECTION),
  protection_level_other_nomenclature: z.string().optional(),
  protection_level_other_level: z.string().optional(),
  security_classification_level: z.enum(SECURITY_CLASSIFICATION_LEVELS),
  security_classification_level_other_nomenclature: z.string().optional(),
  security_classification_level_other_level: z.string().optional(),
  openness_other_rating_system: z.string(),
});

const datasetOut = z.object({
  title: z.string().min(1),
  dataset_id: pid(DATASET_ID_TYPES),
  description: z.string().optional(),
  type: z.string().optional(),
  subject: z.array(z.object({ heading_name: z.string().min(1) })).optional(),
  language: z.string().length(3).optional(),
  personal_data: yesNoUnknown,
  sensitive_data: yesNoUnknown,
  data_quality_assurance: z.array(z.string()).optional(),
  preservation_statement: z.string().optional(),
  distribution: z.array(distributionOut).optional(),
  // Extensions: the standard leaves nested objects open, and these carry the
  // only domain-specific detail the plan records.
  domain: z.string().optional(),
  domain_metadata: z.record(z.unknown()).optional(),
});

export const madmpExportSchema = z
  .object({
    dmp: z.object({
      general_info: generalInfoOut,
      contact: contactOut,
      contributor: z.array(contributorOut).optional(),
      approval: approvalOut.optional(),
      project: z.array(projectOut).optional(),
      cost: z.array(costOut).optional(),
      indigenous_considerations: indigenousOut.optional(),
      dataset: z.array(datasetOut).min(1),
    }),
  })
  // The standard's root admits `dmp` and nothing else.
  .strict();

export type MadmpExport = z.infer<typeof madmpExportSchema>;
