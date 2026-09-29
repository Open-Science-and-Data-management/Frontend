import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDmpList,
  draftHasContent,
  useDmpStore,
  type DmpRecord,
} from "@/store/dmpStore";
import type { DmpDraft } from "@/types/dmp";

const record = (overrides: Partial<DmpRecord> = {}): DmpRecord => {
  const base: DmpRecord = {
    dmp_id: "dmp-1",
    title: "Seeded plan",
    description: "",
    status: "draft",
    created_at: new Date("2025-01-01T00:00:00.000Z"),
    updated_at: new Date("2025-01-02T00:00:00.000Z"),
    dataset_count: 0,
    contributor_count: 0,
    tasks_generated: false,
    draft: {},
    ...overrides,
  };
  // The payload has to agree with the summary, or "open this plan" tests pass
  // for the wrong reason.
  return { ...base, draft: { title: base.title, ...base.draft } };
};

const listState = (over: Partial<Parameters<typeof buildDmpList>[0]> = {}) => ({
  dmps: [record()],
  draft: {} as DmpDraft,
  status: "draft" as const,
  currentDmpId: null,
  draftCreatedAt: new Date("2025-02-01T00:00:00.000Z"),
  draftUpdatedAt: new Date("2025-02-02T00:00:00.000Z"),
  tasksGenerated: false,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  useDmpStore.setState({
    dmps: [record(), record({ dmp_id: "dmp-2", title: "Other plan" })],
    draft: {},
    currentDmpId: null,
    status: "draft",
    tasksGenerated: false,
    tokenUsed: 0,
  });
});

describe("draftHasContent", () => {
  it("ignores an empty draft but counts any real content", () => {
    expect(draftHasContent({})).toBe(false);
    expect(draftHasContent({ project_id: "p1" })).toBe(false);
    expect(draftHasContent({ title: "x" })).toBe(true);
    expect(
      draftHasContent({
        contributor: [{ name: "A", role: "r", is_contact: true }],
      }),
    ).toBe(true);
  });
});

describe("buildDmpList", () => {
  it("projects the open draft over its record instead of duplicating it", () => {
    const list = buildDmpList(
      listState({
        draft: { title: "Renamed while editing" },
        currentDmpId: "dmp-1",
        status: "pending",
      }),
    );

    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Renamed while editing");
    expect(list[0].status).toBe("pending");
    expect(list[0].updated_at).toEqual(new Date("2025-02-02T00:00:00.000Z"));
  });

  it("adds a draft that has no record yet", () => {
    const list = buildDmpList(
      listState({ draft: { title: "Brand new" }, currentDmpId: "dmp-new" }),
    );

    expect(list).toHaveLength(2);
    expect(list[0].dmp_id).toBe("dmp-new");
  });

  it("leaves the library alone when the draft is empty", () => {
    const list = buildDmpList(listState({ currentDmpId: "dmp-1" }));

    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Seeded plan");
  });

  it("counts datasets and contributors for the list card", () => {
    const list = buildDmpList(
      listState({
        currentDmpId: "dmp-1",
        draft: {
          title: "Counted",
          dataset: [{ dataset_id: "d1" }, { dataset_id: "d2" }] as never,
          contributor: [{ name: "A", role: "r", is_contact: true }] as never,
        },
      }),
    );

    expect(list[0].dataset_count).toBe(2);
    expect(list[0].contributor_count).toBe(1);
  });
});

describe("checking a plan in and out", () => {
  it("files the open draft before loading another", () => {
    useDmpStore.setState({
      currentDmpId: "dmp-1",
      draft: { title: "Edited but not saved" },
    });

    useDmpStore.getState().openDmp("dmp-2");

    const filed = useDmpStore.getState().dmps.find((d) => d.dmp_id === "dmp-1");
    expect(filed?.title).toBe("Edited but not saved");
    expect(useDmpStore.getState().currentDmpId).toBe("dmp-2");
    expect(useDmpStore.getState().draft.title).toBe("Other plan");
  });

  it("restores the status and task state of the plan it opens", () => {
    useDmpStore.setState({
      dmps: [
        record({ dmp_id: "dmp-2", status: "approved", tasks_generated: true }),
      ],
    });

    useDmpStore.getState().openDmp("dmp-2");

    expect(useDmpStore.getState().status).toBe("approved");
    expect(useDmpStore.getState().tasksGenerated).toBe(true);
  });

  it("ignores an unknown id", () => {
    expect(useDmpStore.getState().openDmp("nope")).toBeUndefined();
    expect(useDmpStore.getState().currentDmpId).toBeNull();
  });

  it("discarding removes the plan from the library", () => {
    useDmpStore.setState({ currentDmpId: "dmp-1", draft: { title: "Doomed" } });

    useDmpStore.getState().resetDraft();

    expect(useDmpStore.getState().dmps.some((d) => d.dmp_id === "dmp-1")).toBe(
      false,
    );
    expect(useDmpStore.getState().currentDmpId).toBeNull();
    expect(useDmpStore.getState().draft).toEqual({});
  });
});

describe("token budget", () => {
  it("bills against the limit and refuses what it can't cover", () => {
    const { tokenLimit } = useDmpStore.getState();
    useDmpStore.setState({ tokenUsed: tokenLimit - 100 });

    expect(useDmpStore.getState().tokensLeft()).toBe(100);
    expect(useDmpStore.getState().hasTokensFor(100)).toBe(true);
    expect(useDmpStore.getState().hasTokensFor(101)).toBe(false);
  });

  it("never reports a negative balance", () => {
    useDmpStore.setState({
      tokenUsed: useDmpStore.getState().tokenLimit + 500,
    });
    expect(useDmpStore.getState().tokensLeft()).toBe(0);
  });
});
