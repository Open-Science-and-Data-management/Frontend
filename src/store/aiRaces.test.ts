import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENT_USER_ID } from "@/config/current-user";
import { useAiThread, UNSCOPED, type ThreadTurn } from "@/store/aiThread";
import { useChatStore } from "@/store/chatStore";
import { useDmpStore, type DmpRecord } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import { useQuotaStore } from "@/store/quotaStore";
import { useToastStore } from "@/store/toastStore";

// AI replies take seconds. These pin down what happens when the person moves
// on in the meantime: the reply is still kept on the plan it was for, and
// nothing is written over what's in front of them.

const record = (dmp_id: string, title: string): DmpRecord => ({
  dmp_id,
  title,
  description: "",
  status: "draft",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
  dataset_count: 0,
  contributor_count: 0,
  tasks_generated: false,
  versions: [],
  draft: { title, description: `About ${title}` },
});

const state = () => useDmpStore.getState();
const recordOf = (id: string) => state().dmps.find((d) => d.dmp_id === id)!;
const toasts = () => useToastStore.getState().toasts;
const entries = (scope: string | null) =>
  useAiThread.getState().entriesFor(scope);
const turns = (scope: string | null) =>
  entries(scope).filter((e) => e.kind !== "event") as ThreadTurn[];
const account = () =>
  useProjectStore.getState().users.find((u) => u.user_id === CURRENT_USER_ID)!;
const setUsed = (ai_token_used: number) =>
  useProjectStore.getState().updateUser(CURRENT_USER_ID, { ai_token_used });

/** Lets every pending AI call reply. */
const settle = () => vi.advanceTimersByTimeAsync(5000);

const docx = (size = 20000) =>
  new File([new Uint8Array(size).fill(1)], "proposal.docx");

beforeEach(() => {
  vi.useFakeTimers();
  useAiThread.setState({ threads: {}, adoptions: [] });
  useToastStore.setState({ toasts: [] });
  useChatStore.setState({ isThinking: false, pendingTicket: null });
  useQuotaStore.setState({ quota: null, status: "idle" });
  setUsed(0);
  useDmpStore.setState({
    dmps: [record("dmp-a", "Plan A"), record("dmp-b", "Plan B")],
    currentDmpId: "dmp-a",
    draft: { title: "Plan A", description: "About Plan A" },
    status: "draft",
    tasksGenerated: false,
    provenance: null,
    regeneratingFields: {},
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a field rewrite", () => {
  const rewrite = () =>
    state().regenerateField("description", "Description", { kind: "formal" });

  it("lands when nothing moved, and the server's count is what's shown", async () => {
    const run = rewrite();
    await settle();
    await run;
    expect(state().draft.description).toMatch(/institutional data governance/);
    // Charged on the server, read back — never added up in the browser.
    expect(account().ai_token_used).toBeGreaterThan(0);
    expect(useQuotaStore.getState().quota?.used).toBe(account().ai_token_used);
  });

  it("is kept on its own plan, unapplied, when another plan was opened", async () => {
    const run = rewrite();
    state().openDmp("dmp-b");
    await settle();
    await run;

    expect(state().draft.description).toBe("About Plan B");
    expect(recordOf("dmp-a").draft.description).toBe("About Plan A");

    const [kept] = turns("dmp-a");
    expect(kept.proposals).toHaveLength(1);
    expect(kept.proposals![0]).toMatchObject({
      status: "pending",
      path: "description",
      beforeValue: "About Plan A",
    });
    expect(turns("dmp-b")).toEqual([]);
    expect(toasts().at(-1)?.title).toBe("Description wasn't changed");
  });

  it("is marked out of date, not written, when the field moved meanwhile", async () => {
    const run = rewrite();
    state().setField("description", "My own words");
    await settle();
    await run;

    expect(state().draft.description).toBe("My own words");
    const [kept] = turns("dmp-a");
    expect(kept.proposals![0].status).toBe("stale");
    expect(kept.proposals![0].staleReason).toMatch(/My own words/);
  });

  it("undoes only its own rewrite", async () => {
    const run = rewrite();
    await settle();
    await run;
    const rewritten = state().draft.description;
    const undo = toasts().at(-1)?.action?.onClick;
    expect(undo).toBeDefined();

    state().setField("description", "Edited after the rewrite");
    undo!();
    expect(state().draft.description).toBe("Edited after the rewrite");

    state().setField("description", rewritten);
    undo!();
    expect(state().draft.description).toBe("About Plan A");
  });
});

describe("a chat answer", () => {
  const ask = () =>
    useChatStore.getState().send('Change the title to "Plan A, revised"');

  it("is recorded on the plan it was asked about, with its suggestion", async () => {
    const sent = ask();
    state().openDmp("dmp-b");
    await settle();
    await sent;

    const [question, answer] = turns("dmp-a");
    expect(question.kind).toBe("user");
    expect(answer.proposals?.[0]).toMatchObject({
      status: "pending",
      beforeValue: "Plan A",
    });
    expect(turns("dmp-b")).toEqual([]);
  });

  it("flags a suggestion whose field moved while it was being written", async () => {
    const sent = ask();
    state().setField("title", "Renamed by hand");
    await settle();
    await sent;
    expect(turns("dmp-a")[1].proposals?.[0].status).toBe("stale");
  });

  it("follows a conversation adopted into a new plan", async () => {
    useDmpStore.setState({ currentDmpId: null });
    const ticket = useAiThread.getState().ticket(null);
    useAiThread.getState().append(UNSCOPED, {
      id: "q",
      kind: "user",
      text: "hello",
      at: new Date(),
    });
    useAiThread.getState().adopt(UNSCOPED, "dmp-new");
    expect(useAiThread.getState().resolve(ticket)).toBe("dmp-new");
    expect(entries(UNSCOPED)).toEqual([]);
  });

  it("can be stopped — and what the server already counted stays counted", async () => {
    const sent = ask();
    useChatStore.getState().stop();
    await settle();
    await sent;

    const answer = turns("dmp-a")[1];
    expect(answer.stopped).toBe(true);
    expect(answer.proposals).toBeUndefined();
    expect(account().ai_token_used).toBeGreaterThan(0);
    expect(useQuotaStore.getState().quota?.used).toBe(account().ai_token_used);
    expect(useChatStore.getState().isThinking).toBe(false);
  });

  it("says when the budget is spent, without inventing a reset date", async () => {
    setUsed(account().ai_token_limit);
    const sent = ask();
    await settle();
    await sent;

    const answer = turns("dmp-a")[1];
    expect(answer.failed).toEqual({
      retryable: false,
      request: 'Change the title to "Plan A, revised"',
    });
    expect(answer.text).toMatch(/used your AI budget/);
    expect(answer.text).not.toMatch(/reset/i);
  });
});

describe("batch suggestions", () => {
  it("come back marked out of date for fields edited meanwhile", async () => {
    const run = useChatStore.getState().suggestChanges({
      source: "current",
      direction: "more formal",
      targetIds: ["dmp:title", "dmp:description"],
    });
    state().setField("title", "Changed while waiting");
    await settle();
    const result = await run;

    expect(result).toMatchObject({ proposals: 1, stale: 1 });
    const statuses = turns("dmp-a")[0].proposals!.map((p) => [
      p.path,
      p.status,
    ]);
    expect(statuses).toEqual([
      ["title", "stale"],
      ["description", "pending"],
    ]);
    // Nothing was applied either way.
    expect(state().draft.title).toBe("Changed while waiting");
  });
});

describe("drafting a plan from a proposal", () => {
  it("files the new plan without taking over the editor if the person moved on", async () => {
    const run = state().analyzeProposal(docx(), "proj-1");
    state().openDmp("dmp-b");
    await settle();
    const { dmpId, opened } = await run;

    expect(opened).toBe(false);
    expect(state().currentDmpId).toBe("dmp-b");
    expect(recordOf(dmpId).title).toBeTruthy();
    expect(
      entries(dmpId).some(
        (e) => e.kind === "event" && e.action === "analyze_proposal",
      ),
    ).toBe(true);
    expect(toasts().at(-1)?.title).toBe("Your new plan is ready");
  });

  it("drafts a thin plan again in place instead of filing a copy", async () => {
    const first = state().analyzeProposal(docx(1000), "proj-1");
    await settle();
    const { dmpId, coverage } = await first;
    expect(coverage).toBe("low");
    const before = state().dmps.length;

    const again = state().analyzeProposal(
      docx(1000),
      "proj-1",
      "We sequence bee genomes and publish the reads openly in ENA",
      { replace: dmpId },
    );
    await settle();
    const second = await again;

    expect(second.dmpId).toBe(dmpId);
    expect(state().currentDmpId).toBe(dmpId);
    expect(state().dmps.length).toBe(before);
  });

  it("reports usage split into input, output and cached", async () => {
    const run = state().analyzeProposal(docx(), "proj-1");
    await settle();
    const { dmpId } = await run;
    const event = entries(dmpId).find((e) => e.kind === "event");
    expect(event).toMatchObject({
      usage: {
        input_tokens: expect.any(Number),
        output_tokens: expect.any(Number),
        cached_input_tokens: expect.any(Number),
      },
    });
  });
});

describe("generated tasks", () => {
  it("mark the plan they were made for, not the one open now", () => {
    state().markTasksGenerated("dmp-b");
    expect(recordOf("dmp-b").tasks_generated).toBe(true);
    expect(state().currentDmpId).toBe("dmp-a");
    expect(state().tasksGenerated).toBe(false);
  });
});

describe("provenance", () => {
  it("is cleared for a field once the person edits it", () => {
    useDmpStore.setState({
      provenance: {
        title: { source: "proposal", quote: "Plan A" },
        description: { source: "none" },
      },
    });
    state().setField("title", "Mine now");
    expect(state().provenance).toEqual({ description: { source: "none" } });
  });

  it("goes with its plan when another is opened and comes back", () => {
    useDmpStore.setState({ provenance: { title: { source: "none" } } });
    state().openDmp("dmp-b");
    expect(state().provenance).toBeNull();
    state().openDmp("dmp-a");
    expect(state().provenance).toEqual({ title: { source: "none" } });
  });
});

describe("the quota as the UI knows it", () => {
  it("lets a call through to the server while the figure is unknown", () => {
    expect(useQuotaStore.getState().tokensLeft()).toBeNull();
    expect(useQuotaStore.getState().hasTokensFor(1_000_000)).toBe(true);
  });

  it("is read from the account, limit and all", async () => {
    await useQuotaStore.getState().refresh();
    expect(useQuotaStore.getState().quota).toEqual({
      limit: account().ai_token_limit,
      used: 0,
      resets_at: null,
    });
  });
});

describe("a draft begun with no plan open", () => {
  beforeEach(() =>
    useDmpStore.setState({ currentDmpId: null, draft: {}, provenance: null }),
  );

  it("gets an id once it has content, and takes its conversation along", () => {
    useAiThread.getState().append(UNSCOPED, {
      id: "q",
      kind: "user",
      text: "what is protection level?",
      at: new Date(),
    });
    state().setField("title", "Coral reef survey");

    const id = state().currentDmpId;
    expect(id).toBeTruthy();
    expect(entries(id).map((e) => e.id)).toEqual(["q"]);
    expect(entries(UNSCOPED)).toEqual([]);
    // Now it can be filed like any other plan.
    state().openDmp("dmp-b");
    expect(recordOf(id!).title).toBe("Coral reef survey");
  });

  it("receives a reply asked before it had an id", async () => {
    const sent = useChatStore.getState().send("Explain protection level");
    state().setField("title", "Coral reef survey");
    const id = state().currentDmpId;
    await settle();
    await sent;

    expect(turns(id).map((t) => t.kind)).toEqual(["user", "assistant"]);
    expect(entries(UNSCOPED)).toEqual([]);
  });

  it("stays unsaved while it's still blank", () => {
    state().setField("title", "");
    expect(state().currentDmpId).toBeNull();
  });
});

describe("regenerate is for free text only", () => {
  it("refuses a choice field without calling the AI", async () => {
    useDmpStore.setState({
      draft: { title: "Plan A", description: "About Plan A", language: "en" },
    });
    await state().regenerateField("language", "Language", { kind: "formal" });
    expect(state().draft.language).toBe("en");
    expect(account().ai_token_used).toBe(0);
    expect(entries("dmp-a")).toEqual([]);
  });

  it("offers only free-text fields to the batch dialog", () => {
    useDmpStore.setState({
      draft: {
        title: "Plan A",
        description: "About Plan A",
        language: "en",
        dataset: [
          {
            dataset_id: "d1",
            title: "Reads",
            description: "Raw reads",
            access: "open",
          } as never,
        ],
      },
    });
    expect(
      state()
        .eligibleBatchTargets()
        .map((t) => t.id),
    ).toEqual([
      "dmp:title",
      "dmp:description",
      "dataset:d1:title",
      "dataset:d1:description",
    ]);
  });
});

describe("rewriting an output's description", () => {
  const outputs = () =>
    [
      { dataset_id: "d1", title: "Reads", description: "Raw reads" },
      { dataset_id: "d2", title: "Traits", description: "Trait table" },
    ] as never;

  beforeEach(() =>
    useDmpStore.setState({
      draft: {
        title: "Plan A",
        description: "About Plan A",
        dataset: outputs(),
      },
    }),
  );

  it("lands on the same output even if the list was reordered meanwhile", async () => {
    const run = state().regenerateField(
      { datasetId: "d2", field: "description" },
      "Output description",
      { kind: "formal" },
    );
    expect(state().regeneratingFields["dataset:d2:description"]).toBe(true);
    const [d1, d2] = state().draft.dataset!;
    useDmpStore.setState({ draft: { ...state().draft, dataset: [d2, d1] } });
    await settle();
    await run;

    const byId = (id: string) =>
      state().draft.dataset!.find((d) => d.dataset_id === id)!;
    expect(byId("d2").description).toMatch(/institutional data governance/);
    expect(byId("d1").description).toBe("Raw reads");
    expect(state().regeneratingFields["dataset:d2:description"]).toBe(false);
  });

  it("is kept as a suggestion on its plan when another plan was opened", async () => {
    const run = state().regenerateField(
      { datasetId: "d2", field: "description" },
      "Output description",
      { kind: "formal" },
    );
    state().openDmp("dmp-b");
    await settle();
    await run;

    expect(
      recordOf("dmp-a").draft.dataset!.find((d) => d.dataset_id === "d2")!
        .description,
    ).toBe("Trait table");
    const [kept] = turns("dmp-a");
    expect(kept.proposals?.[0]).toMatchObject({
      path: "dataset[1].description",
      status: "pending",
      beforeValue: "Trait table",
    });
  });
});
