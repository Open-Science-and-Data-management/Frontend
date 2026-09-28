import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/types/task";
import { TaskCard } from "@/components/task/TaskCard";

interface DraggableTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
}

export const DraggableTaskCard: React.FC<DraggableTaskCardProps> = ({
  task,
  onEdit,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.task_id as string });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }}
      className="cursor-grab touch-none active:cursor-grabbing"
    >
      <TaskCard task={task} onEdit={onEdit} />
    </div>
  );
};
