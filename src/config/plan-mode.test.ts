import { describe, expect, it } from "vitest";
import {
  activation,
  isActive,
  resolvePlanMode,
  statusLabel,
} from "@/config/plan-mode";
import { evidenceSatisfies, toggleState } from "@/config/task-evidence";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";

const project = (plan_mode: Project["plan_mode"]): Project => ({
  project_id: "p1",
  project_name: "P",
  status: "active",
  plan_mode,
});

const depositTask = (ref: string, type: Task["evidence"]["type"]): Task => ({
  task_id: "t1",
  dmp_id: "d1",
  dataset_id: "ds1",
  title: "Deposit the reads",
  lifecycle_stage: "preserve",
  status: "in_progress",
  priority: "medium",
  generated_by: "ai",
  progress_percent: 0,
  checklist: [],
  evidence: { type, ref },
});

describe("the active state is what everything hangs off", () => {
  it("treats both routes as the same destination", () => {
    expect(isActive("approved")).toBe(true);
    expect(isActive("pending")).toBe(false);
    expect(isActive("draft")).toBe(false);
  });

  it("names the transition after whoever makes it", () => {
    expect(activation("institutional")).toMatchObject({
      by: "committee",
      reviewed: true,
    });
    expect(activation("independent")).toMatchObject({
      by: "self",
      reviewed: false,
    });
  });

  it("never tells an independent researcher a committee approved them", () => {
    expect(statusLabel("approved", "institutional")).toBe("Approved");
    expect(statusLabel("approved", "independent")).toBe("Finalized");
    expect(statusLabel("pending", "independent")).not.toMatch(/approval/i);
  });

  it("falls back to institutional for a project it can't find", () => {
    expect(resolvePlanMode([], "missing")).toBe("institutional");
    expect(resolvePlanMode([project("independent")], "p1")).toBe("independent");
  });
});

describe("evidence is the gate that replaces the committee", () => {
  it("accepts a link for preserve under a committee", () => {
    const task = depositTask("https://example.org/record/1", "url");
    expect(evidenceSatisfies(task, "institutional")).toBe(true);
    expect(toggleState(task, "institutional").canToggle).toBe(true);
  });

  it("demands the repository's own record when nobody reviews the plan", () => {
    const linked = depositTask("https://example.org/record/1", "url");
    expect(evidenceSatisfies(linked, "independent")).toBe(false);

    const { canToggle, blockedReason } = toggleState(linked, "independent");
    expect(canToggle).toBe(false);
    expect(blockedReason).toMatch(/DOI/);

    const deposited = depositTask("10.5281/zenodo.123", "rdm_deposit");
    expect(evidenceSatisfies(deposited, "independent")).toBe(true);
  });

  it("leaves self-declared work alone in both modes", () => {
    const chore: Task = {
      ...depositTask("", "none"),
      dataset_id: undefined,
      lifecycle_stage: "collect",
    };
    expect(evidenceSatisfies(chore, "independent")).toBe(true);
    expect(evidenceSatisfies(chore, "institutional")).toBe(true);
  });
});
