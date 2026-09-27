import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useTaskStore } from '@/store/taskStore';
import { 
  Task, 
  TaskStatus, 
  TaskPriority
} from '@/types/task';
import { createTaskSchema, updateTaskSchema } from '@/schemas/task';

type TaskFormData = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
};

interface TaskFormProps {
  task?: Task;
  onSuccess?: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ 
  task, 
  onSuccess 
}) => {
  const { addTask, updateTask } = useTaskStore();
  
  const defaultValues: TaskFormData = {
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || TaskStatus.TODO,
    priority: task?.priority || TaskPriority.MEDIUM,
    dueDate: task?.dueDate ? format(task.dueDate, 'yyyy-MM-dd') : undefined,
  };

  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting } 
  } = useForm<TaskFormData>({
    resolver: zodResolver(task ? updateTaskSchema : createTaskSchema),
    defaultValues,
  });

  const onSubmit = async (data: TaskFormData) => {
    try {
      if (task) {
        updateTask(task.id, {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        });
      } else {
        addTask({
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        });
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          id="title"
          type="text"
          {...register('title')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        />
        {errors.title && (
          <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="description"
          {...register('description')}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        />
        {errors.description && (
          <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-1">
            Status
          </label>
          <select
            id="status"
            {...register('status')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value={TaskStatus.TODO}>To Do</option>
            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.COMPLETED}>Completed</option>
          </select>
        </div>

        <div>
          <label htmlFor="priority" className="block text-sm font-medium mb-1">
            Priority
          </label>
          <select
            id="priority"
            {...register('priority')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            <option value={TaskPriority.LOW}>Low</option>
            <option value={TaskPriority.MEDIUM}>Medium</option>
            <option value={TaskPriority.HIGH}>High</option>
          </select>
        </div>

        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium mb-1">
            Due Date (Optional)
          </label>
          <input
            id="dueDate"
            type="date"
            {...register('dueDate')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={isSubmitting}>
          {task ? 'Update Task' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
};
