import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Task } from "@/types/task";
import { DraggableTaskCard } from "@/components/task/DraggableTaskCard";
import { cn } from "@/utils/cn";

interface TaskColumnProps {
  status: Task["status"];
  title: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
}

export const TaskColumn: React.FC<TaskColumnProps> = ({
  status,
  title,
  tasks,
  onEdit,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[16rem] flex-col gap-3 rounded-lg border bg-muted/30 p-4 transition-colors",
        isOver && "border-primary bg-muted/60",
      )}
    >
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
          <DraggableTaskCard key={task.task_id} task={task} onEdit={onEdit} />
        ))}
        {tasks.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Drop tasks here
          </p>
        )}
      </div>
    </div>
  );
};
