import React from "react";
import { Task } from "@/types/task";
import { TaskCard } from "@/components/task/TaskCard";

interface TaskBoardProps {
  tasks: Task[];
  /** Supplied only when the list shows more than one plan's tasks. */
  planLabel?: (dmpId: string) => string | undefined;
  onEdit: (task: Task) => void;
}

/**
 * A single ordered list, not columns. Status is on the row itself, and the
 * ordering that matters — what to do first — comes from priority and due date,
 * which columns would scatter.
 */
export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  planLabel,
  onEdit,
}) => (
  <div className="space-y-2">
    {tasks.map((task) => (
      <TaskCard
        key={task.task_id}
        task={task}
        planName={planLabel?.(task.dmp_id)}
        onEdit={onEdit}
      />
    ))}
  </div>
);
