import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTaskStore } from '@/store/taskStore';
import { TaskForm } from '@/components/task/TaskForm';
import { TaskCard } from '@/components/task/TaskCard';
import { Task, TaskStatus } from '@/types/task';
import { Button } from '@/components/ui/button';

export const TaskDashboard: React.FC = () => {
  const { tasks } = useTaskStore();
  const [isCreating, setIsCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsCreating(true);
  };

  const handleFormSuccess = () => {
    setIsCreating(false);
    setEditingTask(null);
  };

  const filteredTasks = filter === 'all' 
    ? tasks 
    : tasks.filter(task => task.status === filter);

  return (
    <>
      <Helmet>
        <title>Task Dashboard | Task Manager</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <Button onClick={() => setIsCreating(true)}>
            Create New Task
          </Button>
        </div>

        {isCreating && (
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingTask ? 'Edit Task' : 'Create New Task'}
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

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={filter === 'all' ? 'default' : 'outline'} 
              onClick={() => setFilter('all')}
              size="sm"
            >
              All
            </Button>
            <Button 
              variant={filter === TaskStatus.TODO ? 'default' : 'outline'} 
              onClick={() => setFilter(TaskStatus.TODO)}
              size="sm"
            >
              To Do
            </Button>
            <Button 
              variant={filter === TaskStatus.IN_PROGRESS ? 'default' : 'outline'} 
              onClick={() => setFilter(TaskStatus.IN_PROGRESS)}
              size="sm"
            >
              In Progress
            </Button>
            <Button 
              variant={filter === TaskStatus.COMPLETED ? 'default' : 'outline'} 
              onClick={() => setFilter(TaskStatus.COMPLETED)}
              size="sm"
            >
              Completed
            </Button>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No tasks found. Create your first task!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onEdit={handleEditTask} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
