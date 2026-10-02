import { z } from "zod";
import { YesNoUnknown, DataAccess, DatasetStatus } from "../shared/enums";
import { distributionSchema } from "./distribution.schema";
import { DomainKeyEnum, validateDomainMetadata } from "./domain-profiles";

export const schemaFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
});

export const preservationSchema = z.object({
  repository: z.string().optional(),
  duration: z.string().optional(),
  format: z.string().optional(),
  doi_requested: z.boolean().default(false),
  statement: z.string().optional(),
});

export const datasetBase = z.object({
  dataset_id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: DatasetStatus.default("planned"),
  located_at: z.string().optional(),
  access: DataAccess,
  personal_data: YesNoUnknown,
  sensitive_data: YesNoUnknown,
  personal_data_plan: z.string().optional(),
  protection_level: z.string().min(1, "ต้องระบุ protection level"),
  protection_level_other: z.string().optional(),
  security_classification_level: z
    .string()
    .min(1, "ต้องระบุ security classification"),
  security_classification_level_other: z.string().optional(),
  data_quality_assurance: z.string().optional(),
  keyword: z.array(z.string()).default([]),
  /**
   * The research domain, a separate axis from `type`. It selects which profile
   * validates `domain_metadata` — see domain-profiles.ts.
   */
  domain: DomainKeyEnum.default("generic"),
  domain_metadata: z.record(z.unknown()).default({}),
  language: z.string().optional(),
  preservation: preservationSchema.default({ doi_requested: false }),
  distribution: z.array(distributionSchema).default([]),
});

// Discriminated union for different dataset types
const datasetVariants = z.discriminatedUnion("type", [
  datasetBase.extend({
    type: z.literal("raw"),
    schema_fields: z.array(schemaFieldSchema).default([]),
  }),
  datasetBase.extend({
    type: z.literal("software"),
    repository_url: z.string().url().or(z.literal("")).optional(),
    software_version: z.string().optional(),
  }),
  datasetBase.extend({ type: z.literal("publication") }),
  datasetBase.extend({ type: z.literal("other") }),
]);

/**
 * Core fields are the same everywhere; the domain profile decides the rest.
 * Its issues are re-raised under `domain_metadata.<field>` so the readiness
 * list can point at the field that's actually wrong.
 */
export const datasetSchema = datasetVariants.superRefine((dataset, ctx) => {
  const result = validateDomainMetadata(
    dataset.domain,
    dataset.domain_metadata,
  );
  if (result.success) return;

  result.error.issues.forEach((issue) => {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["domain_metadata", ...issue.path],
      message: issue.message,
    });
  });
});

export type Dataset = z.infer<typeof datasetSchema>;
