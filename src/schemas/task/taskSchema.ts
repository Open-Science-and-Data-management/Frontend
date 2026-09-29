import { z } from "zod";
import { LifecycleStage, TaskStatus, Priority, GeneratedBy } from "../shared/enums";

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
