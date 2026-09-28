import { z } from "zod";
import { projectSchema } from "@/schemas/project";

// Export types generated from Zod schemas
export type Project = z.infer<typeof projectSchema>;

// Re-export shared enums used by Project for convenience
export { ProjectStatus } from "@/schemas/shared";
