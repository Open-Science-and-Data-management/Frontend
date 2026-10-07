import React from "react";
import { dayString, fromDayString } from "@/utils/calendarDate";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/store/taskStore";
import { useDmpStore } from "@/store/dmpStore";
import { requirementFor, REQUIREMENT_COPY } from "@/config/task-evidence";
import { Task, Priority, LifecycleStage } from "@/types/task";

// Validates only the fields this form edits; ownership fields (dmp_id,
// dataset_id, generated_by) aren't user-editable here and are filled in
// on submit, so they're excluded from the domain schema's requirements.
const taskFormSchema = z
  .object({
    title: z.string().min(1, { message: "Title is required" }),
    details: z.string().optional(),
    priority: Priority.default("medium"),
    lifecycle_stage: LifecycleStage,
    dataset_id: z.string().optional(),
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
  /** The plan a new task belongs to. Required when creating. */
  dmpId?: string;
  onSuccess?: () => void;
  /** Rendered as a Cancel button when the form is hosted in a dialog. */
  onCancel?: () => void;
}

const PRIORITY_OPTIONS = Priority.options;
const LIFECYCLE_OPTIONS = LifecycleStage.options;

export const TaskForm: React.FC<TaskFormProps> = ({
  task,
  dmpId,
  onSuccess,
  onCancel,
}) => {
  const { addTask, updateTask } = useTaskStore();
  const dmps = useDmpStore((s) => s.dmps);
  const draft = useDmpStore((s) => s.draft);
  // The plan's outputs: linking one is what raises the evidence bar.
  const datasets =
    (dmpId ? dmps.find((d) => d.dmp_id === dmpId)?.draft.dataset : undefined) ??
    draft.dataset ??
    [];

  const defaultValues: TaskFormData = {
    title: task?.title || "",
    details: task?.details || "",
    priority: task?.priority || "medium",
    lifecycle_stage: task?.lifecycle_stage || "collect",
    dataset_id: task?.dataset_id ?? "",
    start_date: task?.start_date ? dayString(task.start_date) : undefined,
    end_date: task?.end_date ? dayString(task.end_date) : undefined,
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues,
  });

  // The evidence rule depends on both, so the hint follows them live.
  const watchedDataset = watch("dataset_id");
  const watchedStage = watch("lifecycle_stage");

  const onSubmit = async (data: TaskFormData) => {
    try {
      const payload = {
        ...data,
        dataset_id: data.dataset_id || undefined,
        start_date: fromDayString(data.start_date),
        end_date: fromDayString(data.end_date),
      };

      if (task) {
        updateTask(task.task_id as string, payload);
      } else {
        if (!dmpId) throw new Error("A task must belong to a DMP");
        addTask({
          ...payload,
          dmp_id: dmpId,
          generated_by: "user",
          // A new task starts with no evidence, so it starts at zero.
          status: "todo",
          progress_percent: 0,
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
            htmlFor="dataset_id"
            className="block text-sm font-medium mb-1"
          >
            Research output (optional)
          </label>
          <select
            id="dataset_id"
            {...register("dataset_id")}
            disabled={task?.status === "done"}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">General work — not tied to an output</option>
            {datasets.map((d) => (
              <option key={d.dataset_id} value={d.dataset_id}>
                {d.title || "Untitled output"}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {task?.status === "done"
              ? "Fixed while the task is closed — it decided which evidence rule applied. Reopen the task to change it."
              : REQUIREMENT_COPY[
                  requirementFor({
                    dataset_id: watchedDataset || undefined,
                    lifecycle_stage: watchedStage,
                  })
                ].hint}
          </p>
        </div>

        <div>
          <label
            htmlFor="start_date"
            className="block text-sm font-medium mb-1"
          >
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
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {task ? "Update Task" : "Create Task"}
        </Button>
      </div>
    </form>
  );
};
