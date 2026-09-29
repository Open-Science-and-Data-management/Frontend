import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { TaskForm } from "@/components/task/TaskForm";
import type { Task } from "@/types/task";
import { cn } from "@/utils/cn";

interface TaskFormDialogProps {
  /** Omitted when creating a new task. */
  task?: Task;
  /** The plan a new task is filed under, and its title for the subhead. */
  dmpId?: string;
  planName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const TaskFormDialog: React.FC<TaskFormDialogProps> = ({
  task,
  dmpId,
  planName,
  open,
  onOpenChange,
  onSuccess,
}) => {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-card p-6 text-card-foreground shadow-lg focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold">
                {task ? "Edit task" : "Create new task"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {task
                  ? "Status and progress come from the evidence checklist."
                  : planName
                    ? `Filed under ${planName}. A new task starts with no evidence, so it begins at 0%.`
                    : "A new task starts with no evidence, so it begins at 0%."}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="-mx-1 mt-5 flex-1 overflow-y-auto px-1">
            {/* Keyed so switching between tasks re-seeds the form defaults. */}
            <TaskForm
              key={task?.task_id ?? "new"}
              task={task}
              dmpId={dmpId}
              onSuccess={onSuccess}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
