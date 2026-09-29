import { z } from "zod";
import { taskSchema, createTaskSchema, updateTaskSchema } from "@/schemas/task";

// Export types generated from Zod schemas
export type Task = z.infer<typeof taskSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;

export type {
  TaskChecklistItem,
  TaskEvidenceLevelValue,
} from "@/schemas/task";
export { TaskEvidenceLevel, TASK_EVIDENCE_LEVELS } from "@/schemas/task";

// Re-export shared enums used by Task for convenience
export {
  TaskStatus,
  Priority,
  LifecycleStage,
  GeneratedBy,
} from "@/schemas/shared";
