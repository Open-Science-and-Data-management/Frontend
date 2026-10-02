import { z } from "zod";
import {
  projectSchema,
  createProjectSchema,
  projectMemberSchema,
} from "@/schemas/project";

export type Project = z.infer<typeof projectSchema>;
export type CreateProject = z.infer<typeof createProjectSchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;

export { ProjectStatus, ProjectRole, PlanMode } from "@/schemas/shared";

export type PlanMode = z.infer<typeof import("@/schemas/shared").PlanMode>;
