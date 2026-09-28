import { z } from "zod";
import { dmpSchema, dmpDraftSchema } from "@/schemas/dmp";

// Export types generated from Zod schemas
export type DmpForm = z.infer<typeof dmpSchema>;
export type DmpDraft = z.infer<typeof dmpDraftSchema>;

// Re-export shared enums used by Dmp for convenience
export { DmpStatus } from "@/schemas/shared";
