import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dmpsApi, type ServerDmp } from "@/api/dmpsApi";
import { ApiError } from "@/api/http";
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
    versions: [],
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
  it("shows the open draft's edits on its own record, not as a second one", () => {
    const list = buildDmpList(
      listState({
        draft: { title: "Renamed while editing" },
        currentDmpId: "dmp-1",
      }),
    );

    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Renamed while editing");
    // Status and timestamps are the server's, never the browser's.
    expect(list[0].status).toBe("draft");
    expect(list[0].updated_at).toEqual(new Date("2025-01-02T00:00:00.000Z"));
  });

  it("lists only plans the server knows", () => {
    const list = buildDmpList(
      listState({ draft: { title: "Brand new" }, currentDmpId: "dmp-new" }),
    );

    expect(list.map((d) => d.dmp_id)).toEqual(["dmp-1"]);
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

/** The plan as the server returns it. */
const serverPlan = (overrides: Partial<ServerDmp> = {}): ServerDmp => ({
  object: "dmp",
  dmp_id: "dmp-1",
  project_id: "p1",
  title: "Seeded plan",
  description: "",
  language: "eng",
  status: "draft",
  plan_mode: "institutional",
  active_version: null,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-03T00:00:00.000Z",
  archived_at: null,
  researcher: { user_id: "u1", name: "Aran" },
  draft: { title: "Seeded plan" },
  draft_revision: 3,
  versions: [],
  ...overrides,
});

describe("opening and closing a plan", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the cached copy at once, then the server's", async () => {
    const get = vi
      .spyOn(dmpsApi, "get")
      .mockResolvedValue(serverPlan({ dmp_id: "dmp-2", draft: { title: "From the server" } }));

    useDmpStore.getState().openDmp("dmp-2");
    expect(useDmpStore.getState().currentDmpId).toBe("dmp-2");
    expect(useDmpStore.getState().draft.title).toBe("Other plan");

    await vi.waitFor(() => expect(useDmpStore.getState().opening).toBe(false));
    expect(get).toHaveBeenCalledWith("dmp-2");
    expect(useDmpStore.getState().draft.title).toBe("From the server");
    expect(useDmpStore.getState().draftRevision).toBe(3);
  });

  it("archives a plan that was never submitted, never deletes it", async () => {
    const archive = vi
      .spyOn(dmpsApi, "archive")
      .mockResolvedValue(serverPlan({ archived_at: "2025-03-01T00:00:00.000Z" }));
    useDmpStore.setState({ currentDmpId: "dmp-1", draft: { title: "Set aside" } });

    expect(await useDmpStore.getState().closeDraft()).toBe("archived");

    expect(archive).toHaveBeenCalledWith("dmp-1");
    const kept = useDmpStore.getState().dmps.find((d) => d.dmp_id === "dmp-1");
    expect(kept?.archived_at).toBeInstanceOf(Date);
    expect(useDmpStore.getState().currentDmpId).toBeNull();
    expect(useDmpStore.getState().draft).toEqual({});
  });

  it("keeps the plan open when the server refuses", async () => {
    vi.spyOn(dmpsApi, "archive").mockRejectedValue(new Error("offline"));
    useDmpStore.setState({ currentDmpId: "dmp-1", draft: { title: "Still here" } });

    expect(await useDmpStore.getState().closeDraft()).toBe("kept");
    expect(useDmpStore.getState().currentDmpId).toBe("dmp-1");
    expect(useDmpStore.getState().draft.title).toBe("Still here");
  });
});

describe("saving the draft", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rebases on a conflict: their fields, then the ones changed here", async () => {
    vi.spyOn(dmpsApi, "get").mockResolvedValue(
      serverPlan({ draft: { title: "Seeded plan", description: "old" } }),
    );
    useDmpStore.getState().openDmp("dmp-1");
    await vi.waitFor(() => expect(useDmpStore.getState().opening).toBe(false));

    const save = vi
      .spyOn(dmpsApi, "saveDraft")
      .mockRejectedValueOnce(
        new ApiError({
          status: 409,
          code: "draft_conflict",
          message: "The draft changed since your last read",
          details: {
            draft: { title: "Seeded plan", description: "theirs", language: "tha" },
            draft_revision: 7,
          },
        }),
      )
      .mockResolvedValueOnce({ draft_revision: 8, draft: {} });

    useDmpStore.getState().setField("title", "Mine");
    expect(await useDmpStore.getState().flushDraft()).toBe(true);

    expect(save).toHaveBeenLastCalledWith(
      "dmp-1",
      expect.objectContaining({ title: "Mine", description: "theirs", language: "tha" }),
      7,
    );
    expect(useDmpStore.getState().draftRevision).toBe(8);
    expect(useDmpStore.getState().saveState).toBe("saved");
  });
});
