import { create } from 'zustand';
import { Task, TaskStatus, TaskPriority } from '@/types/task';

interface TaskState {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, task: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  getTaskById: (id: string) => Task | undefined;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [
    {
      id: '1',
      title: 'Create project structure',
      description: 'Set up the initial project structure with all necessary folders',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      createdAt: new Date('2025-05-15T10:00:00'),
      updatedAt: new Date('2025-05-15T11:30:00')
    },
    {
      id: '2',
      title: 'Implement task creation',
      description: 'Create the form and functionality to add new tasks',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      dueDate: new Date('2025-05-18T23:59:59'),
      createdAt: new Date('2025-05-15T14:00:00'),
      updatedAt: new Date('2025-05-15T16:45:00')
    },
    {
      id: '3',
      title: 'Add task filtering',
      description: 'Implement filters for tasks by status and priority',
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      dueDate: new Date('2025-05-20T23:59:59'),
      createdAt: new Date('2025-05-15T17:30:00'),
      updatedAt: new Date('2025-05-15T17:30:00')
    }
  ],
  
  addTask: (task) => set((state) => {
    const newTask: Task = {
      ...task,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return { tasks: [...state.tasks, newTask] };
  }),
  
  updateTask: (id, updatedTask) => set((state) => {
    const tasks = state.tasks.map((task) => 
      task.id === id 
        ? { ...task, ...updatedTask, updatedAt: new Date() } 
        : task
    );
    return { tasks };
  }),
  
  deleteTask: (id) => set((state) => ({
    tasks: state.tasks.filter((task) => task.id !== id)
  })),
  
  getTaskById: (id) => {
    return get().tasks.find((task) => task.id === id);
  }
}));
