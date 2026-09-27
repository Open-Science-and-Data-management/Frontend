import { z } from 'zod';
import { taskSchema, createTaskSchema, updateTaskSchema } from '@/schemas/task';

// Export types generated from Zod schemas
export type Task = z.infer<typeof taskSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;

// Re-export enums for convenience
export { TaskStatus, TaskPriority } from '@/schemas/task';
