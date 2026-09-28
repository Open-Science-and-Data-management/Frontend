import { Task, CreateTask } from "@/types/task";

// This is a mock API implementation for the template
// In a real application, this would be replaced with actual API calls

// Simulated delay for API calls
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const taskApi = {
  // Get all tasks
  getTasks: async (): Promise<Task[]> => {
    // Simulate API call delay
    await delay(500);

    // In a real app, this would be an API call
    const tasks = localStorage.getItem("tasks");
    return tasks ? JSON.parse(tasks) : [];
  },

  // Get a single task by ID
  getTask: async (id: string): Promise<Task | null> => {
    await delay(300);

    const tasks = localStorage.getItem("tasks");
    const parsedTasks: Task[] = tasks ? JSON.parse(tasks) : [];
    return parsedTasks.find((task) => task.task_id === id) || null;
  },

  // Create a new task
  createTask: async (taskData: CreateTask): Promise<Task> => {
    await delay(500);

    const newTask: Task = {
      ...taskData,
      task_id: Math.random().toString(36).substring(2, 9),
    };

    const tasks = localStorage.getItem("tasks");
    const parsedTasks: Task[] = tasks ? JSON.parse(tasks) : [];

    const updatedTasks = [...parsedTasks, newTask];
    localStorage.setItem("tasks", JSON.stringify(updatedTasks));

    return newTask;
  },

  // Update an existing task
  updateTask: async (
    id: string,
    taskData: Partial<Task>,
  ): Promise<Task | null> => {
    await delay(500);

    const tasks = localStorage.getItem("tasks");
    const parsedTasks: Task[] = tasks ? JSON.parse(tasks) : [];

    const taskIndex = parsedTasks.findIndex((task) => task.task_id === id);
    if (taskIndex === -1) return null;

    const updatedTask = {
      ...parsedTasks[taskIndex],
      ...taskData,
    };

    parsedTasks[taskIndex] = updatedTask;
    localStorage.setItem("tasks", JSON.stringify(parsedTasks));

    return updatedTask;
  },

  // Delete a task
  deleteTask: async (id: string): Promise<boolean> => {
    await delay(500);

    const tasks = localStorage.getItem("tasks");
    const parsedTasks: Task[] = tasks ? JSON.parse(tasks) : [];

    const filteredTasks = parsedTasks.filter((task) => task.task_id !== id);
    localStorage.setItem("tasks", JSON.stringify(filteredTasks));

    return true;
  },
};
