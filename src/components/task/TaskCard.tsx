import React from 'react';
import { format } from 'date-fns';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import { useTaskStore } from '@/store/taskStore';
import { Button } from '@/components/ui/button';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit }) => {
  const { deleteTask, updateTask } = useTaskStore();

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.HIGH:
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case TaskPriority.MEDIUM:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case TaskPriority.LOW:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case TaskStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case TaskStatus.TODO:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    updateTask(task.id, { status: newStatus });
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold">{task.title}</h3>
          <div className="flex space-x-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
              {task.status === TaskStatus.IN_PROGRESS 
                ? 'In Progress' 
                : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </span>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground">{task.description}</p>
        
        {task.dueDate && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Due:</span> {format(task.dueDate, 'PPP')}
          </div>
        )}
        
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            Created: {format(task.createdAt, 'PPP')}
          </div>
          
          <div className="flex space-x-2">
            {task.status !== TaskStatus.COMPLETED && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleStatusChange(TaskStatus.COMPLETED)}
              >
                Complete
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit(task)}
            >
              Edit
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => deleteTask(task.id)}
              className="text-destructive hover:bg-destructive/10"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
