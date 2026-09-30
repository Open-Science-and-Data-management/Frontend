import { beforeEach, describe, expect, it } from "vitest";
import { clearPersistedState, jsonStorage, storageKey } from "@/store/persist";

beforeEach(() => localStorage.clear());

describe("persisted storage", () => {
  it("namespaces its keys", () => {
    expect(storageKey("tasks")).toBe("dmp-researcher/tasks");
  });

  it("revives timestamps as Dates", () => {
    const when = new Date("2025-05-20T10:30:00.000Z");
    jsonStorage!.setItem("k", { state: { when }, version: 1 });

    const read = jsonStorage!.getItem("k") as { state: { when: Date } };
    expect(read.state.when).toBeInstanceOf(Date);
    expect(read.state.when.getTime()).toBe(when.getTime());
  });

  it("leaves date-shaped strings alone", () => {
    // Form values like an <input type="date"> are strings and must stay strings.
    jsonStorage!.setItem("k", {
      state: { plain: "2025-05-20", notADate: "hello" },
      version: 1,
    });

    const read = jsonStorage!.getItem("k") as {
      state: { plain: unknown; notADate: unknown };
    };
    expect(read.state.plain).toBe("2025-05-20");
    expect(read.state.notADate).toBe("hello");
  });

  it("clears only its own namespace", () => {
    localStorage.setItem(storageKey("tasks"), "1");
    localStorage.setItem("theme", "dark");

    clearPersistedState();

    expect(localStorage.getItem(storageKey("tasks"))).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});

describe("stored tasks migrate forward", () => {
  const migrateFn = async () => {
    const { useTaskStore } = await import("@/store/taskStore");
    return (
      useTaskStore.persist.getOptions() as {
        migrate?: (s: unknown, v: number) => unknown;
      }
    ).migrate!;
  };

  it("turns the old level checklist into plain steps and keeps evidence", async () => {
    const migrate = await migrateFn();

    const older = {
      tasks: [
        {
          task_id: "t1",
          checklist: [
            { level: "basic", title: "Describe what was done", done: true },
            { level: "output", title: "Attach the deliverable", done: false },
          ],
        },
      ],
    };

    const out = migrate(older, 3) as {
      tasks: {
        checklist: { item_id: string; label: string; done: boolean }[];
        evidence: { type: string };
      }[];
    };

    expect(out.tasks[0].checklist.map((s) => s.label)).toEqual([
      "Describe what was done",
      "Attach the deliverable",
    ]);
    expect(out.tasks[0].checklist[0].done).toBe(true);
    expect(out.tasks[0].checklist[0].item_id).toBeTruthy();
    // Evidence moved onto the task itself; nothing to carry over yet.
    expect(out.tasks[0].evidence).toEqual({ type: "none" });
  });

  it("leaves current data alone", async () => {
    const migrate = await migrateFn();
    const current = { tasks: [{ task_id: "t1", checklist: [] }] };
    expect(migrate(current, 4)).toBe(current);
  });
});

describe("a pasted DOI is not proof of a deposit", () => {
  it("never classifies pasted evidence as a repository record", async () => {
    const { classifyPastedEvidence, looksLikeDoi } =
      await import("@/config/task-evidence");

    // A journal article DOI looks exactly like a dataset deposit DOI.
    const article = classifyPastedEvidence("https://doi.org/10.1038/s41586-1");
    expect(looksLikeDoi("https://doi.org/10.1038/s41586-1")).toBe(true);
    expect(article.type).toBe("url");
    expect(article.label).toBe("10.1038/s41586-1");

    expect(classifyPastedEvidence("https://example.org/out.csv").type).toBe(
      "url",
    );
  });

  it("flags system-verified work as still awaiting the repository", async () => {
    const { awaitingVerification } = await import("@/config/task-evidence");

    const task = {
      dataset_id: "d1",
      lifecycle_stage: "share",
      evidence: { type: "url", ref: "https://doi.org/10.1038/x" },
    };

    expect(awaitingVerification(task as never)).toBe(true);
  });

  it("tolerates a row stored before evidence existed", async () => {
    const { evidenceSatisfies } = await import("@/config/task-evidence");

    const legacy = { dataset_id: "d1", lifecycle_stage: "process" };
    expect(evidenceSatisfies(legacy as never)).toBe(false);

    const general = { lifecycle_stage: "collect" };
    expect(evidenceSatisfies(general as never)).toBe(true);
  });
});
