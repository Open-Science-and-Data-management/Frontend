import { beforeEach, describe, expect, it } from "vitest";
import {
  backupBeforeMigrate,
  backupKeyFor,
  listBackups,
  migrateTasks,
  restoreBackup,
} from "@/store/taskMigrations";

/** A row as v1 actually stored it: levels, no titles, one inline file. */
const v1 = () => ({
  tasks: [
    {
      task_id: "t1",
      title: "Deposit the reads",
      details: "Upload and record the DOI.",
      status: "done",
      progress_percent: 100,
      checklist: [
        { level: "basic", done: true, note: "Agreed with the team." },
        {
          level: "output",
          done: true,
          file_id: "f1",
          filename: "reads.fastq.gz",
        },
        { level: "preserve_share", done: false },
      ],
    },
  ],
});

describe("migrating stored tasks to v4", () => {
  it("keeps every task and every step", () => {
    const out = migrateTasks(v1(), 1) as { tasks: { checklist: unknown[] }[] };

    expect(out.tasks).toHaveLength(1);
    expect(out.tasks[0].checklist).toHaveLength(3);
  });

  it("reconstructs labels from the level instead of writing 'Step'", () => {
    const out = migrateTasks(v1(), 1) as {
      tasks: { checklist: { label: string; done: boolean }[] }[];
    };

    expect(out.tasks[0].checklist.map((s) => s.label)).toEqual([
      "Describe what was done",
      "Attach the deliverable",
      "Show it was deposited or published",
    ]);
    expect(out.tasks[0].checklist.map((s) => s.done)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("promotes the strongest attached file to the task's evidence", () => {
    const out = migrateTasks(v1(), 1) as {
      tasks: { evidence: { type: string; ref: string; label: string } }[];
    };

    expect(out.tasks[0].evidence).toEqual({
      type: "file",
      ref: "f1",
      label: "reads.fastq.gz",
    });
  });

  it("prefers a preserve/share file over an output one", () => {
    const state = v1();
    state.tasks[0].checklist[2] = {
      level: "preserve_share",
      done: true,
      files: [{ file_id: "f9", filename: "deposit-receipt.pdf" }],
    } as never;

    const out = migrateTasks(state, 2) as {
      tasks: { evidence: { ref: string } }[];
    };
    expect(out.tasks[0].evidence.ref).toBe("f9");
  });

  it("carries step notes into the task's details rather than dropping them", () => {
    const out = migrateTasks(v1(), 1) as { tasks: { details: string }[] };

    expect(out.tasks[0].details).toContain("Upload and record the DOI.");
    expect(out.tasks[0].details).toContain("Agreed with the team.");
  });

  it("recomputes progress against the migrated list", () => {
    const out = migrateTasks(v1(), 1) as {
      tasks: { progress_percent: number }[];
    };

    // Two of three, not the stored 100.
    expect(out.tasks[0].progress_percent).toBe(67);
  });

  it("gives every step an id", () => {
    const out = migrateTasks(v1(), 1) as {
      tasks: { checklist: { item_id: string }[] }[];
    };
    const ids = out.tasks[0].checklist.map((s) => s.item_id);

    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  it("keeps v3 titles as they were", () => {
    const v3 = {
      tasks: [
        {
          task_id: "t1",
          checklist: [
            {
              item_id: "a",
              level: "basic",
              core: true,
              title: "My own step",
              done: false,
            },
          ],
        },
      ],
    };

    const out = migrateTasks(v3, 3) as {
      tasks: { checklist: { label: string; item_id: string }[] }[];
    };
    expect(out.tasks[0].checklist[0].label).toBe("My own step");
    expect(out.tasks[0].checklist[0].item_id).toBe("a");
  });

  it("leaves current data untouched", () => {
    const current = { tasks: [{ task_id: "t1", checklist: [] }] };
    expect(migrateTasks(current, 4)).toBe(current);
  });

  it("survives a row with no checklist at all", () => {
    const out = migrateTasks({ tasks: [{ task_id: "t1" }] }, 1) as {
      tasks: { checklist: unknown[]; progress_percent: number }[];
    };

    expect(out.tasks[0].checklist).toEqual([]);
    expect(out.tasks[0].progress_percent).toBe(0);
  });
});

describe("the rollback path", () => {
  const KEY = "dmp-researcher/tasks";

  beforeEach(() => localStorage.clear());

  it("copies the payload aside before migrating, and can put it back", () => {
    const original = JSON.stringify({ version: 1, state: v1() });
    localStorage.setItem(KEY, original);

    backupBeforeMigrate(KEY, 1);
    expect(localStorage.getItem(backupKeyFor(KEY, 1))).toBe(original);

    // Something later mangles the live key.
    localStorage.setItem(KEY, '{"version":4,"state":{"tasks":[]}}');
    expect(restoreBackup(KEY, backupKeyFor(KEY, 1))).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(original);
  });

  it("lists what can be restored", () => {
    localStorage.setItem(KEY, "{}");
    backupBeforeMigrate(KEY, 1);
    backupBeforeMigrate(KEY, 3);

    expect(listBackups(KEY).map((b) => b.version)).toEqual([3, 1]);
  });

  it("does nothing when there is nothing stored", () => {
    backupBeforeMigrate(KEY, 1);
    expect(listBackups(KEY)).toEqual([]);
    expect(restoreBackup(KEY, backupKeyFor(KEY, 1))).toBe(false);
  });
});
