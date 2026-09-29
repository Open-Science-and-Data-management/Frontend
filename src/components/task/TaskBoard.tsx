import React from "react";
import { Task } from "@/types/task";
import { TaskColumn } from "@/components/task/TaskColumn";

interface TaskBoardProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
}

// "cancelled" tasks aren't surfaced as a column.
const COLUMNS: { status: Task["status"]; title: string }[] = [
  { status: "todo", title: "To Do" },
  { status: "in_progress", title: "In Progress" },
  { status: "done", title: "Done" },
];

/**
 * Read-only columns: a task's column follows its evidence, so there's no
 * dragging. Moving a card between columns by hand would let someone claim
 * "Done" without the proof that earns it — progress is updated through the
 * evidence checklist instead.
 */
export const TaskBoard: React.FC<TaskBoardProps> = ({ tasks, onEdit }) => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((column) => (
        <TaskColumn
          key={column.status}
          status={column.status}
          title={column.title}
          tasks={tasks.filter((task) => task.status === column.status)}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
};
