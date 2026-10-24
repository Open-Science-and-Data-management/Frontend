import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Lock, Pencil } from "lucide-react";
import { TaskForm } from "@/components/task/TaskForm";
import { TaskEvidence } from "@/components/task/TaskEvidence";
import { TaskLifecycleTag, TaskStatusBox } from "@/components/task/TaskMeta";
import type { Task } from "@/types/task";
import { cn } from "@/utils/cn";

interface TaskFormDialogProps {
  /** Omitted when creating a new task. */
  task?: Task;
  /** The plan a new task is filed under, and its title for the subhead. */
  dmpId?: string;
  planName?: string;
  open: boolean;
  /** Which half to bring into view first — the Progress button opens on evidence. */
  initialFocus?: "details" | "evidence";
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/** Header for each half, so it's obvious which one accepts typing. */
const PaneHeading: React.FC<{
  icon: React.ReactNode;
  title: string;
  note: string;
  accent?: "editable" | "derived";
}> = ({ icon, title, note, accent = "editable" }) => (
  <div className="flex items-start gap-2">
    <span
      className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
        accent === "editable"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
      )}
    >
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  </div>
);

export const TaskFormDialog: React.FC<TaskFormDialogProps> = ({
  task,
  dmpId,
  planName,
  open,
  initialFocus = "details",
  onOpenChange,
  onSuccess,
}) => {
  const evidenceRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open && initialFocus === "evidence") {
      // Opened from the card's Progress button: start where they aimed.
      requestAnimationFrame(() =>
        evidenceRef.current?.scrollIntoView({ block: "nearest" }),
      );
    }
  }, [open, initialFocus]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-card p-6 text-card-foreground shadow-lg focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-lg font-semibold">
                {task ? task.title : "Create new task"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {task
                  ? "Edit the details on the left. Progress on the right comes from evidence and can't be typed in."
                  : planName
                    ? `Filed under ${planName}. Evidence opens once the task exists.`
                    : "Evidence opens once the task exists."}
              </DialogPrimitive.Description>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {task && (
                <>
                  <TaskStatusBox status={task.status} />
                  <TaskLifecycleTag stage={task.lifecycle_stage} />
                </>
              )}
              <DialogPrimitive.Close
                aria-label="Close"
                className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="-mx-1 mt-5 flex-1 overflow-y-auto px-1">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="space-y-4">
                <PaneHeading
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  title="Details"
                  note="Yours to edit."
                />
                {/* Keyed so switching between tasks re-seeds the form defaults. */}
                <TaskForm
                  key={task?.task_id ?? "new"}
                  task={task}
                  dmpId={dmpId}
                  onSuccess={onSuccess}
                  onCancel={() => onOpenChange(false)}
                />
              </section>

              <section
                ref={evidenceRef}
                className="space-y-4 rounded-lg border bg-muted/30 p-4 lg:sticky lg:top-0 lg:max-h-[62vh] lg:self-start lg:overflow-y-auto"
              >
                <PaneHeading
                  icon={<Lock className="h-3.5 w-3.5" />}
                  title="Progress"
                  note="Set by the evidence below."
                  accent="derived"
                />

                {task ? (
                  <TaskEvidence task={task} />
                ) : (
                  <p className="rounded-md border border-dashed bg-background/60 p-4 text-center text-xs text-muted-foreground">
                    A new task starts at 0%. Save it, then attach evidence here
                    to move it along.
                  </p>
                )}
              </section>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
