import React from "react";
import { format } from "date-fns";
import { Link2, Paperclip, ShieldCheck, Trash2 } from "lucide-react";
import type { Task } from "@/types/task";
import { useTaskStore } from "@/store/taskStore";
import { useDmpStore } from "@/store/dmpStore";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  TaskLifecycleTag,
  TaskPriorityBar,
  TaskStatusBox,
} from "@/components/task/TaskMeta";
import {
  evidenceSatisfies,
  REQUIREMENT_COPY,
  requirementFor,
} from "@/config/task-evidence";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/utils/cn";

interface TaskCardProps {
  task: Task;
  /** Shown only when the board is mixing tasks from several plans. */
  planName?: string;
  onEdit: (task: Task) => void;
}

const EVIDENCE_ICON = {
  none: null,
  file: Paperclip,
  url: Link2,
  rdm_deposit: ShieldCheck,
} as const;

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  planName,
  onEdit,
}) => {
  const { deleteTask, completeTask, reopenTask } = useTaskStore();
  const toast = useToastStore((s) => s.toast);
  const confirm = useConfirm();

  const isDone = task.status === "done";
  const isCancelled = task.status === "cancelled";
  const EvidenceIcon = EVIDENCE_ICON[task.evidence.type];
  const requirement = requirementFor(task);
  const doneCount = (task.checklist ?? []).filter((i) => i.done).length;
  const taskId = task.task_id as string;

  // A dropped output leaves its tasks behind for the record; without saying so
  // the row reads as ordinary work against something that no longer exists.
  const orphaned = useDmpStore((s) =>
    task.dataset_id ? !s.datasetExists(task.dmp_id, task.dataset_id) : false,
  );

  // Tickable when the evidence rule is already satisfied — which is always
  // true for self-declared work, and true elsewhere once proof is attached.
  const canToggle = !isCancelled && (isDone || evidenceSatisfies(task));

  const blockedReason =
    canToggle || isCancelled ? undefined : REQUIREMENT_COPY[requirement].hint;

  const toggle = () => {
    if (isDone) {
      reopenTask(taskId);
      return;
    }
    if (completeTask(taskId)) {
      toast({ title: "Task closed", description: task.title });
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        // Aiming at the locked box deserves an answer, not a silent jump.
        if (
          blockedReason &&
          (e.target as HTMLElement).closest('[role="img"]')
        ) {
          toast({ title: "Evidence needed first", description: blockedReason });
        }
        onEdit(task);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(task);
        }
      }}
      aria-label={`Open ${task.title}`}
      className={cn(
        "flex cursor-pointer overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isCancelled && "opacity-60",
      )}
    >
      <TaskPriorityBar priority={task.priority} className="self-stretch" />

      <div className="min-w-0 flex-1 space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <TaskStatusBox
              status={task.status}
              className={canToggle ? "mt-0.5" : "mt-1"}
              onToggle={canToggle ? toggle : undefined}
              blockedReason={blockedReason}
              actionLabel={
                isDone ? `Reopen ${task.title}` : `Mark ${task.title} done`
              }
            />
            <div className="min-w-0">
              <h3
                className={cn(
                  "font-semibold leading-snug",
                  (isDone || isCancelled) &&
                    "text-muted-foreground line-through",
                )}
              >
                {task.title}
              </h3>
              {planName && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {planName}
                </p>
              )}
            </div>
          </div>
          <TaskLifecycleTag
            stage={task.lifecycle_stage}
            className="mt-0.5 shrink-0"
          />
        </div>

        {task.details && !isDone && (
          <p className="text-sm text-muted-foreground">{task.details}</p>
        )}

        {/* The bar is the in-progress state; a closed or unstarted row
            doesn't need one. */}
        {task.status === "in_progress" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {doneCount} of {task.checklist.length} steps
              </span>
              <span className="tabular-nums">{task.progress_percent}%</span>
            </div>
            <ProgressBar
              value={task.progress_percent}
              label={`${task.title} progress`}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            {EvidenceIcon && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  task.evidence.type === "rdm_deposit" && "text-ok",
                )}
                title={task.evidence.label ?? task.evidence.ref}
              >
                <EvidenceIcon className="h-3.5 w-3.5" />
                <span className="max-w-[12rem] truncate">
                  {task.evidence.label ?? task.evidence.ref}
                </span>
              </span>
            )}
            {orphaned && (
              <span
                className="inline-flex items-center gap-1 rounded border border-dashed border-input px-1.5 text-muted-foreground"
                title="The research output this task belonged to was removed from the plan"
              >
                Output removed
              </span>
            )}
            {!EvidenceIcon && requirement !== "declared" && !isCancelled && (
              <span className="text-warn">Evidence needed to close</span>
            )}
            {task.end_date && (
              <span>Due {format(task.end_date, "d MMM yyyy")}</span>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${task.title}`}
            onClick={async (e) => {
              e.stopPropagation();
              if (
                await confirm({
                  title: "Delete this task?",
                  description: "Its checklist and evidence go with it.",
                  confirmLabel: "Delete task",
                })
              )
                deleteTask(task.task_id as string);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
