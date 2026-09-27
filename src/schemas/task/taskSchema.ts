import { z } from 'zod';

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export const taskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, { message: 'Title is required' }),
  description: z.string(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority),
  dueDate: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const createTaskSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),
  description: z.string(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueDate: z.string().optional()
});

export const updateTaskSchema = createTaskSchema.partial();
