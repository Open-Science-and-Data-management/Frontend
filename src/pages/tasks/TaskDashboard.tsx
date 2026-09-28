import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTaskStore } from "@/store/taskStore";
import { TaskForm } from "@/components/task/TaskForm";
import { TaskBoard } from "@/components/task/TaskBoard";
import { Task } from "@/types/task";
import { Button } from "@/components/ui/button";

export const TaskDashboard: React.FC = () => {
  const { tasks } = useTaskStore();
  const [isCreating, setIsCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsCreating(true);
  };

  const handleFormSuccess = () => {
    setIsCreating(false);
    setEditingTask(null);
  };

  return (
    <>
      <Helmet>
        <title>Task Dashboard | Task Manager</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <Button onClick={() => setIsCreating(true)}>Create New Task</Button>
        </div>

        {isCreating && (
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingTask ? "Edit Task" : "Create New Task"}
              </h2>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCreating(false);
                  setEditingTask(null);
                }}
              >
                Cancel
              </Button>
            </div>
            <TaskForm
              task={editingTask || undefined}
              onSuccess={handleFormSuccess}
            />
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No tasks found. Create your first task!
            </p>
          </div>
        ) : (
          <TaskBoard tasks={tasks} onEdit={handleEditTask} />
        )}
      </div>
    </>
  );
};
