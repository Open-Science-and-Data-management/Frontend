import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  recordAiEvent,
  scopeKey,
  UNSCOPED,
  useAiThread,
  type ThreadEntry,
  type ThreadTurn,
} from "@/store/aiThread";
import type { ChatProposal } from "@/store/chatTools";
import {
  appendThreadEntry,
  resetThreadDb,
  THREAD_PAGE_SIZE,
} from "@/api/mock/threadServer";
import { CURRENT_USER_ID, setSessionUserId } from "@/config/current-user";

const COMMITTEE_ID = "user-2";

beforeEach(() => {
  localStorage.clear();
  resetThreadDb();
  useAiThread.setState({ threads: {}, paging: {}, adoptions: [] });
});

afterEach(() => setSessionUserId(null));

/** Coming back later, or on another machine: nothing cached, only the server. */
const comeBack = () =>
  useAiThread.setState({ threads: {}, paging: {}, adoptions: [] });

const entries = (scope: string | null) =>
  useAiThread.getState().entriesFor(scope);

describe("one thread per plan", () => {
  it("keeps each plan's history apart", () => {
    recordAiEvent("dmp-a", {
      action: "regenerate_field",
      summary: "Rewrote Title",
      token_count: 100,
    });
    recordAiEvent("dmp-b", {
      action: "generate_tasks",
      summary: "Generated 3 tasks",
      token_count: 300,
    });

    expect(entries("dmp-a")).toHaveLength(1);
    expect(entries("dmp-b")).toHaveLength(1);
    expect(entries("dmp-a")[0]).toMatchObject({
      kind: "event",
      summary: "Rewrote Title",
    });
  });

  it("files work done before a plan existed under 'unscoped'", () => {
    recordAiEvent(null, {
      action: "analyze_proposal",
      summary: "Read proposal.docx",
      token_count: 900,
    });

    expect(scopeKey(null)).toBe(UNSCOPED);
    expect(entries(null)).toHaveLength(1);
  });

  it("hands that history to the plan it turned out to be about", () => {
    recordAiEvent(null, {
      action: "analyze_proposal",
      summary: "Read proposal.docx",
      token_count: 900,
    });
    useAiThread.getState().append("dmp-new", {
      id: "t1",
      kind: "user",
      text: "Summarise this",
      at: new Date(),
    });

    useAiThread.getState().adopt(UNSCOPED, "dmp-new");

    expect(entries(null)).toHaveLength(0);
    // The earlier work leads, then the conversation that followed.
    expect(entries("dmp-new").map((e) => e.kind)).toEqual(["event", "user"]);
  });

  it("clears one plan's chat without touching another", () => {
    const say = (dmpId: string) =>
      useAiThread.getState().append(dmpId, {
        id: `q-${dmpId}`,
        kind: "user",
        text: "What is the current access?",
        at: new Date(),
      });
    say("dmp-a");
    say("dmp-b");

    useAiThread.getState().clear("dmp-a");

    expect(entries("dmp-a")).toHaveLength(0);
    expect(entries("dmp-b")).toHaveLength(1);
  });

  it("records every action in order, with its cost", () => {
    (
      [
        ["analyze_proposal", 900],
        ["regenerate_field", 120],
        ["batch_regenerate", 300],
        ["generate_tasks", 640],
        ["redraft_steps", 340],
      ] as const
    ).forEach(([action, token_count]) =>
      recordAiEvent("dmp-a", { action, summary: action, token_count }),
    );

    const log = entries("dmp-a");
    expect(log.map((e) => (e as { action?: string }).action)).toEqual([
      "analyze_proposal",
      "regenerate_field",
      "batch_regenerate",
      "generate_tasks",
      "redraft_steps",
    ]);
    expect(
      log.reduce(
        (sum, e) => sum + ((e as { token_count?: number }).token_count ?? 0),
        0,
      ),
    ).toBe(2300);
  });
});

const proposal = (
  id: string,
  status: ChatProposal["status"],
): ChatProposal => ({
  id,
  kind: "field",
  label: "Title",
  before: "Old",
  after: "New",
  needsHumanConfirm: false,
  status,
});

describe("the server keeps the thread", () => {
  it("is there when the researcher comes back", async () => {
    recordAiEvent("dmp-a", {
      action: "regenerate_field",
      summary: "Rewrote Title",
      token_count: 100,
    });
    comeBack();
    expect(entries("dmp-a")).toHaveLength(0);

    await useAiThread.getState().load("dmp-a");

    expect(entries("dmp-a")).toMatchObject([{ summary: "Rewrote Title" }]);
  });

  it("keeps a proposal's decision, not just the proposal", async () => {
    useAiThread.getState().append("dmp-a", {
      id: "t1",
      kind: "assistant",
      text: "One change to review.",
      at: new Date(),
      proposals: [proposal("p1", "pending")],
    });
    useAiThread.getState().updateEntry("dmp-a", "t1", (e) => ({
      ...(e as ThreadTurn),
      proposals: [proposal("p1", "accepted")],
    }));
    comeBack();
    await useAiThread.getState().load("dmp-a");

    expect((entries("dmp-a")[0] as ThreadTurn).proposals?.[0].status).toBe(
      "accepted",
    );
  });

  it("keeps all of it, served in pages, oldest page last", async () => {
    const total = THREAD_PAGE_SIZE * 2 + 10;
    for (let i = 0; i < total; i++)
      recordAiEvent("dmp-a", {
        action: "regenerate_field",
        summary: `event ${i}`,
        token_count: 1,
      });
    comeBack();

    await useAiThread.getState().load("dmp-a");
    expect(entries("dmp-a")).toHaveLength(THREAD_PAGE_SIZE);
    expect(useAiThread.getState().paging["dmp-a"].hasMore).toBe(true);

    await useAiThread.getState().loadEarlier("dmp-a");
    await useAiThread.getState().loadEarlier("dmp-a");

    const log = entries("dmp-a") as { summary: string }[];
    expect(log).toHaveLength(total);
    expect(useAiThread.getState().paging["dmp-a"].hasMore).toBe(false);
    expect(new Set(log.map((e) => e.summary)).size).toBe(total);
  });

  it("follows an adopted conversation into its plan", async () => {
    recordAiEvent(null, {
      action: "analyze_proposal",
      summary: "Read proposal.docx",
      token_count: 900,
    });
    useAiThread.getState().adopt(UNSCOPED, "dmp-new");
    comeBack();

    await useAiThread.getState().load("dmp-new");
    await useAiThread.getState().load(null);

    expect(entries("dmp-new")).toHaveLength(1);
    expect(entries(null)).toHaveLength(0);
  });
});

describe("the thread is the researcher's own", () => {
  it("isn't readable by the committee, even for the same plan", async () => {
    recordAiEvent("dmp-a", {
      action: "regenerate_field",
      summary: "Rewrote Title",
      token_count: 100,
    });

    setSessionUserId(COMMITTEE_ID);
    await useAiThread.getState().load("dmp-a");

    expect(entries("dmp-a")).toEqual([]);
  });

  it("refuses a write from anyone but a researcher", async () => {
    setSessionUserId(COMMITTEE_ID);
    await expect(
      appendThreadEntry("dmp-a", {
        id: "x",
        kind: "user",
        text: "hi",
        at: new Date(),
      }),
    ).rejects.toThrow(/researcher/);
  });

  it("isn't left in memory for whoever signs in next in the tab", () => {
    setSessionUserId(CURRENT_USER_ID);
    recordAiEvent("dmp-a", {
      action: "regenerate_field",
      summary: "Rewrote Title",
      token_count: 100,
    });
    expect(entries("dmp-a")).toHaveLength(1);

    setSessionUserId(COMMITTEE_ID);

    expect(entries("dmp-a")).toEqual([]);
  });
});

describe("clearing the chat keeps the plan's AI record", () => {
  const seed = () => {
    const thread = useAiThread.getState();
    const at = (s: number) => new Date(2026, 0, 1, 9, 0, s);
    const items: ThreadEntry[] = [
      { id: "q", kind: "user", text: "Shorten the title", at: at(1) },
      {
        id: "mixed",
        kind: "assistant",
        text: "Two changes to review.",
        at: at(2),
        proposals: [proposal("kept", "accepted"), proposal("lost", "pending")],
        rejections: [{ label: "Begin date", reason: "Locked." }],
      },
      {
        id: "declined",
        kind: "assistant",
        text: "One change to review.",
        at: at(3),
        proposals: [proposal("no", "rejected")],
      },
      { id: "a", kind: "assistant", text: "Access is open.", at: at(4) },
    ];
    items.forEach((e) => thread.append("dmp-a", e));
    recordAiEvent("dmp-a", {
      action: "regenerate_field",
      summary: "Rewrote Description",
      token_count: 80,
    });
  };

  const expectRecordOnly = () => {
    const log = entries("dmp-a");
    expect(log.map((e) => e.id)).toEqual(["mixed", log[1].id]);
    const kept = log[0] as ThreadTurn;
    expect(kept.proposals?.map((p) => p.id)).toEqual(["kept"]);
    expect(kept.rejections).toBeUndefined();
    expect(log[1]).toMatchObject({ kind: "event" });
  };

  it("drops the Q&A, keeps AI actions and accepted changes", () => {
    seed();
    useAiThread.getState().clear("dmp-a");
    expectRecordOnly();
  });

  it("and the server agrees after a reload", async () => {
    seed();
    useAiThread.getState().clear("dmp-a");
    comeBack();
    await useAiThread.getState().load("dmp-a");
    expectRecordOnly();
  });
});
