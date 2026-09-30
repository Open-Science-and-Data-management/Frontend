import React from "react";
import { useTaskStore } from "@/store/taskStore";
import { useToastStore } from "@/store/toastStore";
import { TaskCard } from "@/components/task/TaskCard";
import { REQUIREMENT_COPY, requirementFor } from "@/config/task-evidence";
import type { Task } from "@/types/task";
import { cn } from "@/utils/cn";

interface TaskKanbanProps {
  tasks: Task[];
  planLabel?: (dmpId: string) => string | undefined;
  onEdit: (task: Task) => void;
}

const COLUMNS: { status: Task["status"]; title: string; hint: string }[] = [
  { status: "todo", title: "To Do", hint: "Nothing waiting to start." },
  {
    status: "in_progress",
    title: "In Progress",
    hint: "Tick a checklist step to move a task here.",
  },
  {
    status: "done",
    title: "Done",
    hint: "Closed tasks land here once their evidence is in.",
  },
];

/**
 * The board view. Dragging is allowed, but dropping on Done runs the same
 * evidence check as the tick box — a card can't be dragged past the rule it
 * would otherwise have to satisfy.
 */
export const TaskKanban: React.FC<TaskKanbanProps> = ({
  tasks,
  planLabel,
  onEdit,
}) => {
  const { completeTask, reopenTask, cancelTask } = useTaskStore();
  const toast = useToastStore((s) => s.toast);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<string | null>(null);

  const cancelled = tasks.filter((t) => t.status === "cancelled");
  const columns = cancelled.length
    ? [
        ...COLUMNS,
        {
          status: "cancelled" as const,
          title: "Cancelled",
          hint: "Kept for the record.",
        },
      ]
    : COLUMNS;

  const drop = (status: Task["status"]) => {
    const task = tasks.find((t) => t.task_id === dragging);
    setDragging(null);
    setOver(null);
    if (!task || task.status === status) return;

    const id = task.task_id as string;

    if (status === "done") {
      if (!completeTask(id)) {
        toast({
          title: "Evidence needed first",
          description: REQUIREMENT_COPY[requirementFor(task)].hint,
          variant: "destructive",
        });
      }
      return;
    }

    if (status === "cancelled") {
      cancelTask(id);
      return;
    }

    // Back to an open state: progress is recomputed from the checklist, so
    // the card lands in whichever of the two columns the evidence says.
    reopenTask(id);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {columns.map((column) => {
        const items = tasks.filter((t) => t.status === column.status);

        return (
          <div
            key={column.status}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(column.status);
            }}
            onDragLeave={() => setOver((o) => (o === column.status ? null : o))}
            onDrop={() => drop(column.status)}
            className={cn(
              "flex min-h-48 flex-col gap-3 rounded-lg border bg-muted/30 p-3 transition-colors",
              over === column.status && "border-primary bg-primary/5",
            )}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {column.title}
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {items.length}
              </span>
            </div>

            {items.map((task) => (
              <div
                key={task.task_id}
                draggable
                onDragStart={() => setDragging(task.task_id as string)}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                className={cn(
                  "cursor-grab active:cursor-grabbing",
                  dragging === task.task_id && "opacity-50",
                )}
              >
                <TaskCard
                  task={task}
                  planName={planLabel?.(task.dmp_id)}
                  onEdit={onEdit}
                />
              </div>
            ))}

            {items.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {column.hint}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
