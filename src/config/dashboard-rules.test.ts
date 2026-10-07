import { describe, expect, it } from "vitest";
import { daysUntilDue, dueState, isOpenTask } from "@/config/task-due";
import { lifecycleProgress } from "@/config/progress";
import type { Task } from "@/types/task";

const task = (patch: Partial<Task> = {}): Task =>
  ({
    task_id: Math.random().toString(36).slice(2),
    dmp_id: "dmp-1",
    title: "Task",
    lifecycle_stage: "collect",
    status: "todo",
    priority: "medium",
    progress_percent: 0,
    checklist: [],
    evidence: { type: "none" },
    generated_by: "user",
    ...patch,
  }) as Task;

describe("when a task is due", () => {
  const today = new Date(2026, 9, 8, 15, 30); // Oct 8, mid-afternoon

  it("counts calendar days, ignoring the time of day", () => {
    expect(daysUntilDue(new Date("2026-10-08T00:00:00.000Z"), today)).toBe(0);
    expect(daysUntilDue(new Date("2026-10-09T00:00:00.000Z"), today)).toBe(1);
    expect(daysUntilDue(new Date("2026-10-06T00:00:00.000Z"), today)).toBe(-2);
  });

  it("tags past dates overdue, the next three days due soon, the rest upcoming", () => {
    expect(dueState(-1)).toBe("overdue");
    expect(dueState(0)).toBe("due_soon");
    expect(dueState(3)).toBe("due_soon");
    expect(dueState(4)).toBe("upcoming");
  });

  it("only treats unfinished, uncancelled work as open", () => {
    expect(isOpenTask(task({ status: "todo" }))).toBe(true);
    expect(isOpenTask(task({ status: "in_progress" }))).toBe(true);
    expect(isOpenTask(task({ status: "done" }))).toBe(false);
    expect(isOpenTask(task({ status: "cancelled" }))).toBe(false);
  });
});

describe("lifecycle progress", () => {
  it("is zero with no tasks", () => {
    expect(lifecycleProgress([])).toEqual({ stages: [], overall: 0 });
  });

  it("weighs each stage equally, however many tasks it has", () => {
    const { overall, stages } = lifecycleProgress([
      // collect: 1 of 1 done → 100%
      task({ lifecycle_stage: "collect", status: "done" }),
      // process: 0 of 3 done → 0%
      task({ lifecycle_stage: "process" }),
      task({ lifecycle_stage: "process" }),
      task({ lifecycle_stage: "process" }),
    ]);
    expect(stages).toHaveLength(2);
    expect(overall).toBe(50);
  });

  it("leaves cancelled work out entirely", () => {
    const { overall, stages } = lifecycleProgress([
      task({ lifecycle_stage: "collect", status: "done" }),
      task({ lifecycle_stage: "collect", status: "cancelled" }),
      task({ lifecycle_stage: "share", status: "cancelled" }),
    ]);
    expect(stages.map((s) => s.stage)).toEqual(["collect"]);
    expect(overall).toBe(100);
  });
});
