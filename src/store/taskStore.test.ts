import { beforeEach, describe, expect, it } from "vitest";
import { useTaskStore } from "@/store/taskStore";
import type { Task } from "@/types/task";

const baseTask: Omit<Task, "task_id" | "checklist"> = {
  dmp_id: "dmp-a",
  title: "Deposit the dataset",
  status: "todo",
  priority: "medium",
  lifecycle_stage: "preserve",
  progress_percent: 0,
  generated_by: "user",
};

const only = () => useTaskStore.getState().tasks[0];

beforeEach(() => {
  localStorage.clear();
  useTaskStore.setState({ tasks: [] });
});

describe("evidence drives progress and status", () => {
  it("starts a new task at zero with no evidence", () => {
    useTaskStore.getState().addTask(baseTask);

    expect(only().progress_percent).toBe(0);
    expect(only().status).toBe("todo");
    expect(only().checklist).toEqual([]);
  });

  it("moves to in_progress on the first evidence item", () => {
    useTaskStore.getState().addTask(baseTask);
    useTaskStore
      .getState()
      .setChecklistItem(only().task_id as string, "basic", {
        done: true,
        note: "Agreed with the team.",
      });

    expect(only().progress_percent).toBe(33);
    expect(only().status).toBe("in_progress");
  });

  it("reaches done only when all three levels are evidenced", () => {
    useTaskStore.getState().addTask(baseTask);
    const id = only().task_id as string;

    useTaskStore.getState().setChecklistItem(id, "basic", { done: true });
    useTaskStore.getState().setChecklistItem(id, "output", { done: true });
    expect(only().status).toBe("in_progress");

    useTaskStore
      .getState()
      .setChecklistItem(id, "preserve_share", { done: true });
    expect(only().progress_percent).toBe(100);
    expect(only().status).toBe("done");
  });

  it("walks the status back when evidence is withdrawn", () => {
    useTaskStore.getState().addTask(baseTask);
    const id = only().task_id as string;
    (["basic", "output", "preserve_share"] as const).forEach((level) =>
      useTaskStore.getState().setChecklistItem(id, level, { done: true }),
    );
    expect(only().status).toBe("done");

    useTaskStore.getState().setChecklistItem(id, "output", { done: false });
    expect(only().progress_percent).toBe(67);
    expect(only().status).toBe("in_progress");
  });

  it("leaves a cancelled task cancelled", () => {
    useTaskStore.getState().addTask({ ...baseTask, status: "cancelled" });
    useTaskStore
      .getState()
      .setChecklistItem(only().task_id as string, "basic", { done: true });

    expect(only().status).toBe("cancelled");
  });

  it("promotes the output file to the task's deliverable", () => {
    useTaskStore.getState().addTask(baseTask);
    useTaskStore
      .getState()
      .setChecklistItem(only().task_id as string, "output", {
        done: true,
        file_id: "file-9",
        filename: "results.csv",
      });

    expect(only().file_id).toBe("file-9");
  });

  it("clears completed_at when an item is undone", () => {
    useTaskStore.getState().addTask(baseTask);
    const id = only().task_id as string;
    useTaskStore.getState().setChecklistItem(id, "basic", { done: true });
    expect(only().checklist[0].completed_at).toBeInstanceOf(Date);

    useTaskStore.getState().setChecklistItem(id, "basic", { done: false });
    expect(only().checklist[0].completed_at).toBeUndefined();
  });
});

describe("tasks belong to exactly one plan", () => {
  it("scopes by dmp_id", () => {
    useTaskStore.getState().addTask(baseTask);
    useTaskStore.getState().addTask({ ...baseTask, dmp_id: "dmp-b" });

    expect(useTaskStore.getState().getTasksForDmp("dmp-a")).toHaveLength(1);
    expect(useTaskStore.getState().getTasksForDmp("dmp-b")).toHaveLength(1);
    expect(useTaskStore.getState().getTasksForDmp("dmp-c")).toHaveLength(0);
  });

  it("keeps the owning plan on AI-generated tasks", () => {
    useTaskStore
      .getState()
      .addGeneratedTasks([
        { ...baseTask, dmp_id: "dmp-x", generated_by: "ai" },
      ]);

    expect(only().dmp_id).toBe("dmp-x");
    expect(only().generated_by).toBe("ai");
  });
});
