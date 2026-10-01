import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_THREAD_ENTRIES,
  recordAiEvent,
  scopeKey,
  UNSCOPED,
  useAiThread,
} from "@/store/aiThread";

beforeEach(() => {
  localStorage.clear();
  useAiThread.setState({ threads: {} });
});

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

  it("clears one plan's thread without touching another", () => {
    recordAiEvent("dmp-a", {
      action: "regenerate_field",
      summary: "a",
      token_count: 1,
    });
    recordAiEvent("dmp-b", {
      action: "regenerate_field",
      summary: "b",
      token_count: 1,
    });

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

describe("a thread doesn't grow forever", () => {
  it("keeps the most recent entries and drops the oldest", () => {
    for (let i = 0; i < MAX_THREAD_ENTRIES + 25; i++) {
      recordAiEvent("dmp-a", {
        action: "regenerate_field",
        summary: `event ${i}`,
        token_count: 1,
      });
    }

    const log = entries("dmp-a");
    expect(log).toHaveLength(MAX_THREAD_ENTRIES);
    // The newest survives, the oldest is gone.
    expect((log[log.length - 1] as { summary: string }).summary).toBe(
      `event ${MAX_THREAD_ENTRIES + 24}`,
    );
    expect((log[0] as { summary: string }).summary).toBe("event 25");
  });

  it("caps an adopted thread too", () => {
    for (let i = 0; i < MAX_THREAD_ENTRIES; i++) {
      recordAiEvent(null, {
        action: "analyze_proposal",
        summary: `pre ${i}`,
        token_count: 1,
      });
    }
    recordAiEvent("dmp-new", {
      action: "generate_tasks",
      summary: "after",
      token_count: 1,
    });

    useAiThread.getState().adopt(UNSCOPED, "dmp-new");

    expect(entries("dmp-new")).toHaveLength(MAX_THREAD_ENTRIES);
  });
});
