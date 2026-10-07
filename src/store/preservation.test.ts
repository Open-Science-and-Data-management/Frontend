import { beforeEach, describe, expect, it } from "vitest";
import { buildDmpList, useDmpStore } from "@/store/dmpStore";
import { hasRecordedWork, useTaskStore } from "@/store/taskStore";
import type { DmpDraft } from "@/types/dmp";
import type { Task } from "@/types/task";

// Tasks and their evidence are the record of work done: nothing here may
// destroy them, whatever the plan's state.

const plan = (): DmpDraft => ({
  project_id: "proj-1",
  title: "Rice",
  description: "d",
  language: "eng",
  begin_date: new Date("2026-01-01T00:00:00.000Z"),
  end_date: new Date("2026-12-31T00:00:00.000Z"),
  ethical_issues_exist: false,
  contributor: [
    {
      contributor_id: "c1",
      name: "A",
      role: "PI",
      email: "a@x.org",
      is_contact: true,
    },
  ],
  cost: [],
  dataset: [],
  schema_version: "v3.0",
});
const task = (patch: Partial<Task> = {}): Task =>
  ({
    task_id: "t1",
    dmp_id: "dmp-rice",
    title: "Sequence batch 1",
    lifecycle_stage: "collect",
    status: "todo",
    priority: "medium",
    generated_by: "ai",
    progress_percent: 0,
    checklist: [],
    evidence: { type: "none" },
    ...patch,
  }) as Task;

const d = () => useDmpStore.getState();
const rec = () => d().dmps.find((x) => x.dmp_id === "dmp-rice");
const list = (includeArchived = false) =>
  buildDmpList({ ...d(), includeArchived }).map((x) => x.dmp_id);

beforeEach(() => {
  localStorage.clear();
  useDmpStore.setState({
    draft: plan(),
    status: "draft",
    currentDmpId: "dmp-rice",
    dmps: [],
  });
  useTaskStore.setState({ tasks: [task()] });
});

describe("a plan in force", () => {
  beforeEach(() => {
    d().submitForApproval();
    d().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });
  });

  it("can't be archived", () => {
    const result = d().archiveDmp("dmp-rice");
    expect(result.ok).toBe(false);
    expect(rec()?.archived_at).toBeUndefined();
  });

  it("keeps everything when the editor is cancelled, losing only unsubmitted edits", () => {
    useDmpStore.setState({ draft: { ...plan(), title: "Unsaved rename" } });
    expect(d().closeDraft()).toBe("discarded");
    expect(rec()).toBeDefined();
    expect(rec()?.archived_at).toBeUndefined();
    expect(rec()?.title).toBe("Rice");
    expect(useTaskStore.getState().tasks).toHaveLength(1);
  });
});

describe("a plan not in force", () => {
  it("is archived — kept, not deleted — and its tasks stay untouched", () => {
    d().submitForApproval(); // pending, not yet in force
    expect(d().archiveDmp("dmp-rice")).toEqual({ ok: true });
    expect(rec()?.archived_at).toBeInstanceOf(Date);
    expect(useTaskStore.getState().tasks).toEqual([task()]);
  });

  it("drops out of everyday lists, but is still there to find", () => {
    d().closeDraft();
    expect(list()).not.toContain("dmp-rice");
    expect(list(true)).toContain("dmp-rice");
  });

  it("comes back as it was", () => {
    d().closeDraft();
    d().unarchiveDmp("dmp-rice");
    expect(rec()?.archived_at).toBeUndefined();
    expect(rec()?.title).toBe("Rice");
    expect(list()).toContain("dmp-rice");
  });
});

describe("a task with recorded work", () => {
  it.each([
    [
      "evidence attached",
      { evidence: { type: "url", ref: "https://doi.org/10.5281/x" } },
    ],
    [
      "a ticked step",
      { checklist: [{ item_id: "s1", label: "Extract", done: true }] },
    ],
    ["a completion", { status: "done", completed_at: new Date() }],
  ] as const)("can't be deleted when it has %s", (_label, patch) => {
    useTaskStore.setState({ tasks: [task(patch as Partial<Task>)] });
    expect(hasRecordedWork(useTaskStore.getState().tasks[0])).toBe(true);
    expect(useTaskStore.getState().deleteTask("t1")).toBe(false);
    expect(useTaskStore.getState().tasks).toHaveLength(1);
  });

  it("can still be cancelled, keeping its evidence", () => {
    useTaskStore.setState({
      tasks: [
        task({ evidence: { type: "url", ref: "https://doi.org/10.5281/x" } }),
      ],
    });
    useTaskStore.getState().cancelTask("t1");
    const kept = useTaskStore.getState().tasks[0];
    expect(kept.status).toBe("cancelled");
    expect(kept.evidence.ref).toBe("https://doi.org/10.5281/x");
  });

  it("is the only kind protected: an untouched task can be deleted", () => {
    expect(useTaskStore.getState().deleteTask("t1")).toBe(true);
    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });
});

it("never cancels over a finished task — e.g. one dragged onto Cancelled", () => {
  const finished = task({
    status: "done",
    completed_at: new Date("2026-05-01T00:00:00.000Z"),
  });
  useTaskStore.setState({ tasks: [finished] });
  useTaskStore.getState().cancelTask("t1");
  expect(useTaskStore.getState().tasks[0].status).toBe("done");
  expect(useTaskStore.getState().tasks[0].completed_at).toEqual(
    finished.completed_at,
  );
});
