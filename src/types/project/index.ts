import { z } from "zod";
import {
  projectSchema,
  createProjectSchema,
  projectMemberSchema,
} from "@/schemas/project";

// Export types generated from Zod schemas
export type Project = z.infer<typeof projectSchema>;
export type CreateProject = z.infer<typeof createProjectSchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;

// Re-export shared enums used by Project for convenience
export { ProjectStatus, ProjectRole } from "@/schemas/shared";
