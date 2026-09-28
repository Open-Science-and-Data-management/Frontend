import React, { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useTaskStore } from "@/store/taskStore";
import { Task } from "@/types/task";
import { TaskColumn } from "@/components/task/TaskColumn";
import { TaskCard } from "@/components/task/TaskCard";

interface TaskBoardProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
}

// "cancelled" tasks aren't surfaced as a column — same 3-section board,
// just updated to the new status values.
const COLUMNS: { status: Task["status"]; title: string }[] = [
  { status: "todo", title: "To Do" },
  { status: "in_progress", title: "In Progress" },
  { status: "done", title: "Done" },
];

export const TaskBoard: React.FC<TaskBoardProps> = ({ tasks, onEdit }) => {
  const { updateTask } = useTaskStore();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.task_id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const newStatus = over.id as Task["status"];
    const task = tasks.find((t) => t.task_id === active.id);
    if (task && task.status !== newStatus) {
      updateTask(task.task_id as string, { status: newStatus });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} onEdit={onEdit} /> : null}
      </DragOverlay>
    </DndContext>
  );
};
