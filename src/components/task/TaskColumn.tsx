import React from "react";
import { Task } from "@/types/task";
import { TaskCard } from "@/components/task/TaskCard";

interface TaskColumnProps {
  status: Task["status"];
  title: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
}

const EMPTY_HINT: Record<string, string> = {
  todo: "Nothing waiting to start.",
  in_progress: "Nothing underway — add evidence to a task to move it here.",
  done: "Nothing finished yet — a task lands here at 100% evidence.",
};

export const TaskColumn: React.FC<TaskColumnProps> = ({
  status,
  title,
  tasks,
  onEdit,
}) => {
  return (
    <div className="flex min-h-64 flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {tasks.map((task) => (
          <TaskCard key={task.task_id} task={task} onEdit={onEdit} />
        ))}
        {tasks.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {EMPTY_HINT[status] ?? "Nothing here."}
          </p>
        )}
      </div>
    </div>
  );
};
