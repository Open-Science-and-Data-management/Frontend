import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import {
  Task,
  TASK_EVIDENCE_LEVELS,
  type TaskChecklistItem,
  type TaskEvidenceLevelValue,
} from "@/types/task";

// The seeded tasks belong to the approved seeded plan, since tasks only exist
// once a committee has approved the DMP they came from.
const SEED_DMP_ID = "dmp-pollinator";

// Progress is a function of evidence, never typed in, so the number on a
// card can't disagree with what's actually been produced.
const progressFromChecklist = (checklist: Task["checklist"]) => {
  const done = checklist.filter((i) => i.done).length;
  return Math.round((done / TASK_EVIDENCE_LEVELS.length) * 100);
};

interface TaskState {
  tasks: Task[];
  addTask: (task: Omit<Task, "task_id" | "checklist">) => void;
  addGeneratedTasks: (tasks: Omit<Task, "task_id" | "checklist">[]) => void;
  updateTask: (id: string, task: Partial<Task>) => void;
  setChecklistItem: (
    taskId: string,
    level: TaskEvidenceLevelValue,
    patch: Partial<TaskChecklistItem>,
  ) => void;
  deleteTask: (id: string) => void;
  getTaskById: (id: string) => Task | undefined;
  /** Tasks belong to exactly one plan; the board never mixes them by accident. */
  getTasksForDmp: (dmpId: string) => Task[];
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [
        {
          task_id: "1",
          dmp_id: SEED_DMP_ID,
          title: "Create project structure",
          details:
            "Set up the initial project structure with all necessary folders",
          status: "done",
          priority: "high",
          lifecycle_stage: "collect",
          progress_percent: 100,
          checklist: [
            {
              level: "basic",
              done: true,
              note: "Folder structure agreed and created.",
            },
            { level: "output", done: true, filename: "structure-manifest.csv" },
            {
              level: "preserve_share",
              done: true,
              filename: "deposit-receipt.pdf",
            },
          ],
          generated_by: "user",
        },
        {
          task_id: "2",
          dmp_id: SEED_DMP_ID,
          title: "Implement task creation",
          details: "Create the form and functionality to add new tasks",
          status: "in_progress",
          priority: "medium",
          lifecycle_stage: "process",
          progress_percent: 33,
          checklist: [
            {
              level: "basic",
              done: true,
              note: "Form drafted and reviewed with the team.",
            },
          ],
          end_date: new Date("2025-05-18T23:59:59"),
          generated_by: "user",
        },
        {
          task_id: "3",
          dmp_id: SEED_DMP_ID,
          title: "Add task filtering",
          details: "Implement filters for tasks by status and priority",
          status: "todo",
          priority: "low",
          lifecycle_stage: "process",
          progress_percent: 0,
          checklist: [],
          end_date: new Date("2025-05-20T23:59:59"),
          generated_by: "user",
        },
      ],

      addTask: (task) =>
        set((state) => {
          const newTask: Task = {
            ...task,
            task_id: Math.random().toString(36).substring(2, 9),
            checklist: [],
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
              checklist: [],
            })),
          ],
        })),

      setChecklistItem: (taskId, level, patch) =>
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.task_id !== taskId) return task;

            const existing = task.checklist ?? [];
            const hasLevel = existing.some((i) => i.level === level);
            const checklist = (
              hasLevel
                ? existing
                : [...existing, { level, done: false } as TaskChecklistItem]
            ).map((item) =>
              item.level === level
                ? {
                    ...item,
                    ...patch,
                    completed_at: patch.done ? new Date() : undefined,
                  }
                : item,
            );

            // The output level's file is the task's deliverable.
            const outputItem = checklist.find((i) => i.level === "output");
            const progress = progressFromChecklist(checklist);

            return {
              ...task,
              checklist,
              progress_percent: progress,
              // Status follows the evidence rather than being set by hand, so a
              // task can't sit in "Done" without the proof behind it. An
              // explicitly cancelled task stays cancelled.
              status:
                task.status === "cancelled"
                  ? "cancelled"
                  : progress === 100
                    ? "done"
                    : progress > 0
                      ? "in_progress"
                      : "todo",
              file_id: outputItem?.done ? outputItem.file_id : task.file_id,
            };
          }),
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

      getTasksForDmp: (dmpId) => get().tasks.filter((t) => t.dmp_id === dmpId),
    }),
    {
      name: storageKey("tasks"),
      storage: jsonStorage,
      // Bump when the shape of a stored task changes.
      version: 1,
      partialize: (state) => ({ tasks: state.tasks }),
    },
  ),
);
