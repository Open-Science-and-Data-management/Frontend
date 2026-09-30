import { z } from "zod";
import { YesNoUnknown, DataAccess, DatasetStatus } from "../shared/enums";
import { distributionSchema } from "./distribution.schema";

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
  security_classification_level: z.string().min(1, "ต้องระบุ security classification"),
  security_classification_level_other: z.string().optional(),
  data_quality_assurance: z.string().optional(),
  keyword: z.array(z.string()).default([]),
  language: z.string().optional(),
  preservation: preservationSchema.default({ doi_requested: false }),
  distribution: z.array(distributionSchema).default([]),
});

// Discriminated union for different dataset types
export const datasetSchema = z.discriminatedUnion("type", [
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
export type Dataset = z.infer<typeof datasetSchema>;
