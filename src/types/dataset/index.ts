import { z } from "zod";
import { datasetSchema, distributionSchema } from "@/schemas/dataset";

// Export types generated from Zod schemas
export type Dataset = z.infer<typeof datasetSchema>;
export type Distribution = z.infer<typeof distributionSchema>;

// Re-export shared enums used by Dataset for convenience
export {
  DatasetType,
  DatasetStatus,
  DataAccess,
  YesNoUnknown,
} from "@/schemas/shared";
