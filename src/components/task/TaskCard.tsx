import React from "react";
import { format } from "date-fns";
import { Task, TASK_EVIDENCE_LEVELS } from "@/types/task";
import { useTaskStore } from "@/store/taskStore";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  TaskProgressDialog,
  LEVEL_META,
} from "@/components/task/TaskProgressDialog";
import { Pen, Check, ListChecks } from "lucide-react";
import { cn } from "@/utils/cn";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
}

const PRIORITY_COLORS: Record<Task["priority"], string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warn-subtle text-warn",
  low: "bg-ok-subtle text-ok",
};

const STATUS_COLORS: Record<Task["status"], string> = {
  done: "bg-ok-subtle text-ok",
  in_progress: "bg-secondary text-secondary-foreground",
  todo: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<Task["status"], string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<Task["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit }) => {
  const { deleteTask, updateTask } = useTaskStore();
  const [progressOpen, setProgressOpen] = React.useState(false);
  const confirm = useConfirm();

  const handleStatusChange = (newStatus: Task["status"]) => {
    updateTask(task.task_id as string, { status: newStatus });
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold">{task.title}</h3>
          <div className="flex space-x-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}
            >
              {PRIORITY_LABELS[task.priority]}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}
            >
              {STATUS_LABELS[task.status]}
            </span>
          </div>
        </div>

        {task.details && (
          <p className="text-sm text-muted-foreground">{task.details}</p>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5 capitalize">
              {task.lifecycle_stage}
            </span>
            <span className="tabular-nums">{task.progress_percent}%</span>
          </div>
          <ProgressBar
            value={task.progress_percent}
            label={`${task.title} progress`}
          />
          {/* The three evidence levels at a glance */}
          <button
            type="button"
            onClick={() => setProgressOpen(true)}
            className="flex w-full items-center gap-1.5 rounded pt-0.5 text-left text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {TASK_EVIDENCE_LEVELS.map((level) => {
              const done = (task.checklist ?? []).some(
                (i) => i.level === level && i.done,
              );
              return (
                <span
                  key={level}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5",
                    done ? "bg-ok-subtle text-ok" : "bg-muted",
                  )}
                >
                  {done && <Check className="h-3 w-3" />}
                  {LEVEL_META[level].short}
                </span>
              );
            })}
          </button>
        </div>

        {(task.start_date || task.end_date) && (
          <div className="text-sm text-muted-foreground">
            {task.start_date && (
              <span>
                <span className="font-medium">Start:</span>{" "}
                {format(task.start_date, "PPP")}
              </span>
            )}
            {task.start_date && task.end_date && <span> · </span>}
            {task.end_date && (
              <span>
                <span className="font-medium">Due:</span>{" "}
                {format(task.end_date, "PPP")}
              </span>
            )}
          </div>
        )}

        <div className="flex justify-end items-center pt-4 border-t">
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProgressOpen(true)}
            >
              <ListChecks className="mr-1.5 h-3.5 w-3.5" />
              Progress
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Delete this task?",
                    description:
                      "Its evidence and progress are discarded with it.",
                    confirmLabel: "Delete task",
                  })
                )
                  deleteTask(task.task_id as string);
              }}
              className="text-destructive hover:bg-destructive/5"
            >
              Delete
            </Button>

            <Button variant="secondary" size="sm" onClick={() => onEdit(task)}>
              <Pen className="mr-2 w-4 h-4 shrink-0" />
              Edit
            </Button>

            {task.status !== "done" && (
              <Button size="sm" onClick={() => handleStatusChange("done")}>
                Complete
              </Button>
            )}
          </div>
        </div>
      </div>

      <TaskProgressDialog
        task={task}
        open={progressOpen}
        onOpenChange={setProgressOpen}
      />
    </div>
  );
};
