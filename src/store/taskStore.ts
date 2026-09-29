import { create } from "zustand";
import { Task } from "@/types/task";

// Placeholder until tasks are created within a real DMP context (no DMP
// selection/routing exists yet).
const DEFAULT_DMP_ID = "demo-dmp-1";

interface TaskState {
  tasks: Task[];
  addTask: (task: Omit<Task, "task_id">) => void;
  addGeneratedTasks: (tasks: Omit<Task, "task_id">[]) => void;
  updateTask: (id: string, task: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  getTaskById: (id: string) => Task | undefined;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [
    {
      task_id: "1",
      dmp_id: DEFAULT_DMP_ID,
      title: "Create project structure",
      details:
        "Set up the initial project structure with all necessary folders",
      status: "done",
      priority: "high",
      lifecycle_stage: "collect",
      progress_percent: 100,
      generated_by: "user",
    },
    {
      task_id: "2",
      dmp_id: DEFAULT_DMP_ID,
      title: "Implement task creation",
      details: "Create the form and functionality to add new tasks",
      status: "in_progress",
      priority: "medium",
      lifecycle_stage: "process",
      progress_percent: 50,
      end_date: new Date("2025-05-18T23:59:59"),
      generated_by: "user",
    },
    {
      task_id: "3",
      dmp_id: DEFAULT_DMP_ID,
      title: "Add task filtering",
      details: "Implement filters for tasks by status and priority",
      status: "todo",
      priority: "low",
      lifecycle_stage: "process",
      progress_percent: 0,
      end_date: new Date("2025-05-20T23:59:59"),
      generated_by: "user",
    },
  ],

  addTask: (task) =>
    set((state) => {
      const newTask: Task = {
        ...task,
        task_id: Math.random().toString(36).substring(2, 9),
      };
      return { tasks: [...state.tasks, newTask] };
    }),

  addGeneratedTasks: (tasks) =>
    set((state) => ({
      tasks: [
        ...state.tasks,
        ...tasks.map((task) => ({
          ...task,
          task_id: Math.random().toString(36).substring(2, 9),
        })),
      ],
    })),

  updateTask: (id, updatedTask) =>
    set((state) => {
      const tasks = state.tasks.map((task) =>
        task.task_id === id ? { ...task, ...updatedTask } : task,
      );
      return { tasks };
    }),

  deleteTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.task_id !== id),
    })),

  getTaskById: (id) => {
    return get().tasks.find((task) => task.task_id === id);
  },
}));
