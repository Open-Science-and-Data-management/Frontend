import { z } from "zod";
import { LifecycleStage, TaskStatus, Priority, GeneratedBy } from "../shared/enums";

/**
 * Progress is evidenced in three escalating levels rather than typed in:
 *  - basic          the work happened (a written account)
 *  - output         a deliverable exists (a task_deliverable file)
 *  - preserve_share it's deposited/published (an evidence file)
 */
export const TaskEvidenceLevel = z.enum(["basic", "output", "preserve_share"]);
export const TASK_EVIDENCE_LEVELS = TaskEvidenceLevel.options;

export const taskChecklistItemSchema = z.object({
  level: TaskEvidenceLevel,
  done: z.boolean().default(false),
  note: z.string().optional(),
  file_id: z.string().optional(),
  // Denormalised so the card can render without resolving the file store.
  filename: z.string().optional(),
  completed_at: z.coerce.date().optional(),
});

export type TaskChecklistItem = z.infer<typeof taskChecklistItemSchema>;
export type TaskEvidenceLevelValue = z.infer<typeof TaskEvidenceLevel>;

const taskObjectSchema = z.object({
  task_id: z.string().optional(),
  dmp_id: z.string(),
  dataset_id: z.string().optional(),
  source_version_id: z.string().optional(),
  title: z.string().min(1),
  details: z.string().optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  progress_percent: z.coerce.number().min(0).max(100).default(0),
  // Derived from `checklist`; never edited directly.
  checklist: z.array(taskChecklistItemSchema).default([]),
  file_id: z.string().optional(),
  lifecycle_stage: LifecycleStage,
  status: TaskStatus.default("todo"),
  priority: Priority.default("medium"),
  generated_by: GeneratedBy.default("user"),
});

const dateOrderRefinement = (t: { start_date?: Date; end_date?: Date }) =>
  !t.start_date || !t.end_date || t.end_date >= t.start_date;
const dateOrderIssue = {
  message: "end_date should not be before start_date",
  path: ["end_date"],
};

export const taskSchema = taskObjectSchema.refine(
  dateOrderRefinement,
  dateOrderIssue,
);
export const createTaskSchema = taskObjectSchema
  .omit({ task_id: true })
  .refine(dateOrderRefinement, dateOrderIssue);
export const updateTaskSchema = taskObjectSchema
  .omit({ task_id: true })
  .partial();

export type Task = z.infer<typeof taskSchema>;
