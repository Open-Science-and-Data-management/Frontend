import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/store/taskStore";
import {
  Task,
  TaskStatus,
  Priority,
  LifecycleStage,
} from "@/types/task";

// Placeholder until tasks are created within a real DMP context (no DMP
// selection/routing exists yet).
const DEFAULT_DMP_ID = "demo-dmp-1";

// Validates only the fields this form edits; ownership fields (dmp_id,
// dataset_id, generated_by) aren't user-editable here and are filled in
// on submit, so they're excluded from the domain schema's requirements.
const taskFormSchema = z
  .object({
    title: z.string().min(1, { message: "Title is required" }),
    details: z.string().optional(),
    status: TaskStatus.default("todo"),
    priority: Priority.default("medium"),
    lifecycle_stage: LifecycleStage,
    progress_percent: z.coerce.number().min(0).max(100).default(0),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .refine((t) => !t.start_date || !t.end_date || t.end_date >= t.start_date, {
    message: "end_date should not be before start_date",
    path: ["end_date"],
  });

type TaskFormData = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  task?: Task;
  onSuccess?: () => void;
}

const STATUS_OPTIONS = TaskStatus.options;
const PRIORITY_OPTIONS = Priority.options;
const LIFECYCLE_OPTIONS = LifecycleStage.options;

export const TaskForm: React.FC<TaskFormProps> = ({ task, onSuccess }) => {
  const { addTask, updateTask } = useTaskStore();

  const defaultValues: TaskFormData = {
    title: task?.title || "",
    details: task?.details || "",
    status: task?.status || "todo",
    priority: task?.priority || "medium",
    lifecycle_stage: task?.lifecycle_stage || "collect",
    progress_percent: task?.progress_percent ?? 0,
    start_date: task?.start_date ? format(task.start_date, "yyyy-MM-dd") : undefined,
    end_date: task?.end_date ? format(task.end_date, "yyyy-MM-dd") : undefined,
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues,
  });

  const onSubmit = async (data: TaskFormData) => {
    try {
      const payload = {
        ...data,
        start_date: data.start_date ? new Date(data.start_date) : undefined,
        end_date: data.end_date ? new Date(data.end_date) : undefined,
      };

      if (task) {
        updateTask(task.task_id as string, payload);
      } else {
        addTask({
          ...payload,
          dmp_id: DEFAULT_DMP_ID,
          generated_by: "user",
        });
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          id="title"
          type="text"
          {...register("title")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        />
        {errors.title && (
          <p className="text-sm text-destructive mt-1">
            {errors.title.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="details" className="block text-sm font-medium mb-1">
          Details
        </label>
        <textarea
          id="details"
          {...register("details")}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        />
        {errors.details && (
          <p className="text-sm text-destructive mt-1">
            {errors.details.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-1">
            Status
          </label>
          <select
            id="status"
            {...register("status")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background capitalize"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option} className="capitalize">
                {option.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium mb-1">
            Priority
          </label>
          <select
            id="priority"
            {...register("priority")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background capitalize"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="lifecycle_stage"
            className="block text-sm font-medium mb-1"
          >
            Lifecycle Stage
          </label>
          <select
            id="lifecycle_stage"
            {...register("lifecycle_stage")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background capitalize"
          >
            {LIFECYCLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {errors.lifecycle_stage && (
            <p className="text-sm text-destructive mt-1">
              {errors.lifecycle_stage.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="progress_percent"
            className="block text-sm font-medium mb-1"
          >
            Progress (%)
          </label>
          <input
            id="progress_percent"
            type="number"
            min={0}
            max={100}
            {...register("progress_percent", { valueAsNumber: true })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          />
          {errors.progress_percent && (
            <p className="text-sm text-destructive mt-1">
              {errors.progress_percent.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="start_date" className="block text-sm font-medium mb-1">
            Start Date (Optional)
          </label>
          <input
            id="start_date"
            type="date"
            {...register("start_date")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          />
        </div>

        <div>
          <label htmlFor="end_date" className="block text-sm font-medium mb-1">
            Due Date (Optional)
          </label>
          <input
            id="end_date"
            type="date"
            {...register("end_date")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          />
          {errors.end_date && (
            <p className="text-sm text-destructive mt-1">
              {errors.end_date.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={isSubmitting}>
          {task ? "Update Task" : "Create Task"}
        </Button>
      </div>
    </form>
  );
};
