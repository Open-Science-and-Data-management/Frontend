import { describe, expect, it } from "vitest";
import { daysUntilDue, dueState, isOpenTask } from "@/config/task-due";
import { lifecycleProgress } from "@/config/progress";
import { projectProgressFor, timelineOf } from "@/config/dashboard";
import type { DmpRecord } from "@/store/dmpStore";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";

describe("where a project is in its timeline", () => {
  const begin = new Date("2026-09-01T00:00:00.000Z");
  const end = new Date("2026-11-23T00:00:00.000Z"); // 84 days = 12 weeks

  it("counts weeks from the start date", () => {
    expect(timelineOf(begin, end, new Date(2026, 8, 1))).toBe("Week 1 of 12");
    expect(timelineOf(begin, end, new Date(2026, 8, 8))).toBe("Week 2 of 12");
    expect(timelineOf(begin, end, new Date(2026, 9, 8))).toBe("Week 6 of 12");
  });

  it("says when it hasn't started, has ended, or has no dates", () => {
    expect(timelineOf(begin, end, new Date(2026, 7, 20))).toMatch(/^Starts /);
    expect(timelineOf(begin, end, new Date(2027, 0, 1))).toBe("Timeline ended");
    expect(timelineOf(undefined, end)).toBe("No timeline set");
  });
});

describe("a project's progress", () => {
  const project = {
    project_id: "p1",
    project_name: "P1",
    status: "active",
    plan_mode: "institutional",
  } as Project;
  const plan = (patch: Partial<DmpRecord>): DmpRecord =>
    ({
      dmp_id: "d1",
      project_id: "p1",
      title: "Plan",
      description: "",
      status: "draft",
      created_at: new Date(),
      updated_at: new Date(),
      dataset_count: 0,
      contributor_count: 0,
      tasks_generated: false,
      draft: {},
      versions: [],
      ...patch,
    }) as DmpRecord;

  it("follows the plan in force over a newer draft", () => {
    const inForce = plan({ dmp_id: "live", active_version: 1 });
    const newer = plan({ dmp_id: "new", updated_at: new Date(2099, 0, 1) });
    const [result] = projectProgressFor([project], [newer, inForce], []);
    expect(result.plan.dmp_id).toBe("live");
  });

  it("counts open tasks past their due date as overdue", () => {
    const today = new Date(2026, 9, 8);
    const [result] = projectProgressFor(
      [project],
      [plan({})],
      [
        taskFor("d1", { end_date: new Date("2026-10-01T00:00:00.000Z") }),
        taskFor("d1", {
          end_date: new Date("2026-10-01T00:00:00.000Z"),
          status: "done",
        }),
        taskFor("d1", { end_date: new Date("2026-10-20T00:00:00.000Z") }),
      ],
      today,
    );
    expect(result.overdue).toBe(1);
    expect(result.total).toBe(3);
  });

  it("leaves out projects with no plan", () => {
    expect(projectProgressFor([project], [], [])).toEqual([]);
  });
});

function taskFor(dmpId: string, patch: Partial<Task>): Task {
  return task({ dmp_id: dmpId, ...patch });
}

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
