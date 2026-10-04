import { z } from "zod";

// maDMP export schema (JSON)
const pid = z.object({ identifier: z.string(), type: z.string() });

const contactOut = z.object({
  name: z.string(),
  mbox: z.string().email().optional(),
  contact_id: pid,
});
const contributorOut = z.object({
  name: z.string(),
  mbox: z.string().email().optional(),
  role: z.array(z.string()),
  contributor_id: pid.optional(),
});
const costOut = z.object({
  title: z.string(),
  description: z.string().optional(),
  value: z.number().optional(),
  currency_code: z.string().optional(),
});
const distributionOut = z.object({
  title: z.string(),
  access_url: z.string().optional(),
  download_url: z.string().optional(),
  format: z.array(z.string()).optional(),
  byte_size: z.number().optional(),
  data_access: z.enum(["open", "shared", "closed"]),
  license: z
    .array(z.object({ license_ref: z.string(), start_date: z.string() }))
    .optional(),
});
const datasetOut = z.object({
  title: z.string(),
  type: z.string().optional(),
  description: z.string().optional(),
  dataset_id: pid,
  personal_data: z.enum(["yes", "no", "unknown"]),
  sensitive_data: z.enum(["yes", "no", "unknown"]),
  keyword: z.array(z.string()).optional(),
  data_quality_assurance: z.array(z.string()).optional(),
  preservation_statement: z.string().optional(),
  distribution: z.array(distributionOut).optional(),
  // FAIRer extension
  protection_level: z.string().optional(),
  security_classification_level: z.string().optional(),
  /**
   * The research domain and its profile's values. Carried as an extension
   * rather than squeezed into `keyword`, which would lose which value meant
   * what; RDA maDMP allows extensions, and dropping them would lose the only
   * domain-specific detail the plan holds.
   */
  domain: z.string().optional(),
  domain_metadata: z.record(z.unknown()).optional(),
});

export const madmpExportSchema = z.object({
  dmp: z.object({
    title: z.string(),
    description: z.string().optional(),
    language: z.string(),
    created: z.string(), // ISO 8601
    modified: z.string(),
    dmp_id: pid,
    ethical_issues_exist: z.enum(["yes", "no", "unknown"]),
    ethical_issues_description: z.string().optional(),
    ethical_issues_report: z.string().url().optional(),
    contact: contactOut,
    contributor: z.array(contributorOut).optional(),
    cost: z.array(costOut).optional(),
    project: z
      .array(
        z.object({
          title: z.string(),
          start: z.string().optional(),
          end: z.string().optional(),
        }),
      )
      .optional(),
    dataset: z.array(datasetOut).min(1),
    // FAIRer extension
    schema_version: z.string().optional(),
  }),
});
export type MadmpExport = z.infer<typeof madmpExportSchema>;
