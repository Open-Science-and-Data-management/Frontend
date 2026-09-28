import { z } from "zod";
import { ProjectStatus } from "../shared/enums";

export const projectSchema = z.object({
  project_id: z.string().optional(),
  project_name: z.string().min(1),
  description: z.string().optional(),
  proposal_file_id: z.string().optional(),
  status: ProjectStatus.default("draft"),
});
export type Project = z.infer<typeof projectSchema>;
