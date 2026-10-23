import { describe, expect, it } from "vitest";
import {
  aiApi,
  coverageGaps,
  generateTaskChecklist,
  generateTasks,
  redraftFromProposal,
} from "@/api/aiApi";

const outputs = [
  { dataset_id: "d1", title: "Sequence reads", type: "raw", access: "shared" },
];

const stages = (tasks: { lifecycle_stage: string }[]) => [
  ...new Set(tasks.map((t) => t.lifecycle_stage)),
];

describe("generateTasks honours the direction", () => {
  it("produces one task per lifecycle stage with no direction", async () => {
    const { tasks } = await generateTasks({ outputs });

    expect(tasks).toHaveLength(5);
    expect(stages(tasks)).toEqual([
      "collect",
      "process",
      "analyse",
      "preserve",
      "share",
    ]);
  });

  it("splits each stage when asked for granular work", async () => {
    const { tasks } = await generateTasks({
      outputs,
      direction: "More granular",
    });

    // Every steer has to change the result — a silent no-op would be worse.
    expect(tasks.length).toBeGreaterThan(5);
    expect(stages(tasks)).toHaveLength(5);
  });

  it("narrows the breakdown when asked for fewer, broader tasks", async () => {
    const { tasks } = await generateTasks({
      outputs,
      direction: "Fewer, broader",
    });

    expect(stages(tasks)).toEqual(["collect", "preserve", "share"]);
  });

  it("focuses on preservation and raises the priority", async () => {
    const { tasks } = await generateTasks({
      outputs,
      direction: "Focus on preservation",
    });

    expect(stages(tasks)).toEqual(["preserve", "share"]);
    expect(tasks.every((t) => t.priority === "high")).toBe(true);
  });

  it("records the direction on each task it writes", async () => {
    const { tasks } = await generateTasks({
      outputs,
      direction: "Keep it auditable",
    });

    expect(tasks.every((t) => t.details.includes("Keep it auditable"))).toBe(
      true,
    );
  });

  it("still skips publishing for a closed output", async () => {
    const { tasks } = await generateTasks({
      outputs: [{ ...outputs[0], access: "closed" }],
    });

    expect(stages(tasks)).not.toContain("share");
  });

  it("bills for the direction it was given", async () => {
    const plain = await generateTasks({ outputs });
    const steered = await generateTasks({
      outputs,
      direction: "Focus on sharing",
    });

    expect(steered.token_count).not.toBe(plain.token_count);
  });
});

describe("generateTaskChecklist honours the direction", () => {
  const base = {
    taskTitle: "Deposit the sequence reads",
    lifecycleStage: "preserve",
    taskOutput: {
      dataset_id: "d2",
      title: "Sequence reads",
      type: "raw",
      access: "shared",
      repository: "ENA",
    },
    otherOutputs: ["Trait table"],
  };

  it("drafts a list of plain steps", async () => {
    const { steps } = await generateTaskChecklist(base);

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => typeof s === "string")).toBe(true);
  });

  it("is about the task's own output, never another of the plan's", async () => {
    const { steps } = await generateTaskChecklist(base);

    expect(steps.some((s) => s.includes("Sequence reads"))).toBe(true);
    expect(steps.some((s) => s.includes("Trait table"))).toBe(false);
    expect(steps.some((s) => s.includes("ENA"))).toBe(true);
  });

  it("follows the task's stage: collecting isn't depositing", async () => {
    const { steps } = await generateTaskChecklist({
      ...base,
      taskTitle: "Collect the samples",
      lifecycleStage: "collect",
    });

    expect(steps.some((s) => /collect/i.test(s))).toBe(true);
    expect(steps.some((s) => /deposit|doi/i.test(s))).toBe(false);
  });

  it("drafts plan-wide steps when the task has no output of its own", async () => {
    const { steps } = await generateTaskChecklist({
      taskTitle: "Agree the naming convention",
      lifecycleStage: "process",
      otherOutputs: ["Sequence reads", "Trait table"],
    });

    expect(steps.every((s) => !s.includes("Sequence reads"))).toBe(true);
  });

  it("trims the list when asked to keep it brief", async () => {
    const full = await generateTaskChecklist(base);
    const brief = await generateTaskChecklist({
      ...base,
      direction: "Keep it brief",
    });

    expect(brief.steps.length).toBeLessThan(full.steps.length);
  });

  it("adds steps when asked for more detail", async () => {
    const full = await generateTaskChecklist(base);
    const detailed = await generateTaskChecklist({
      ...base,
      direction: "More detail",
    });

    expect(detailed.steps.length).toBeGreaterThan(full.steps.length);
  });

  it("narrows to deposit steps when told to focus on preservation", async () => {
    const { steps } = await generateTaskChecklist({
      ...base,
      direction: "Focus on preservation",
    });

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => /deposit|doi|receipt/i.test(s))).toBe(true);
  });
});

describe("analysis takes a direction", () => {
  const docx = (size: number) =>
    new File([new Uint8Array(size)], "proposal.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

  it("drafts the plain plan with no direction", async () => {
    const { draft } = await aiApi.analyzeProposal(docx(20000));
    expect(draft.dataset?.[0].access).toBe("shared");
    expect(draft.dataset?.every((d) => d.type !== "software")).toBe(true);
  });

  it("opens the outputs when told to share", async () => {
    const { draft } = await aiApi.analyzeProposal(
      docx(20000),
      "Make everything openly shared",
    );
    expect(draft.dataset?.every((d) => d.access === "open")).toBe(true);
    expect(draft.dataset?.[0].preservation?.doi_requested).toBe(true);
  });

  it("raises protection when told the data is sensitive", async () => {
    const { draft } = await aiApi.analyzeProposal(
      docx(20000),
      "Assume personal, sensitive data",
    );
    expect(draft.ethical_issues_exist).toBe(true);
    expect(draft.dataset?.[0].personal_data).toBe("yes");
    // In maDMP v3.0's own terms.
    expect(draft.dataset?.[0].security_classification_level).toBe(
      "confidential",
    );
    expect(draft.dataset?.[0].protection_level).toBe("Protected B");
  });

  it("adds the code as an output when asked", async () => {
    const { draft } = await aiApi.analyzeProposal(
      docx(20000),
      "Include the analysis code as an output",
    );
    expect(draft.dataset?.some((d) => d.type === "software")).toBe(true);
  });

  it("bills for the direction", async () => {
    const plain = await aiApi.analyzeProposal(docx(20000));
    const steered = await aiApi.analyzeProposal(
      docx(20000),
      "Focus on long-term preservation",
    );
    expect(steered.token_count).not.toBe(plain.token_count);
  });

  it("treats a thin document as low coverage, and a steered re-run as covered", async () => {
    const thin = await aiApi.analyzeProposal(docx(1000));
    expect(thin.coverage).toBe("low");

    const guided = await aiApi.analyzeProposal(
      docx(1000),
      "The project collects interview recordings with consent, kept ten years",
    );
    expect(guided.coverage).toBe("ok");
  });
});

describe("coverage gaps become the questions we ask", () => {
  it("asks for what the draft is missing", () => {
    const gaps = coverageGaps({});
    const ids = gaps.map((g) => g.id);

    expect(ids).toContain("title");
    expect(ids).toContain("outputs");
    expect(ids).toContain("timeline");
    expect(ids).toContain("ethics");
  });

  it("stops asking once the draft answers it", () => {
    const gaps = coverageGaps({
      title: "A plan",
      dataset: [{ dataset_id: "d1" }] as never,
      begin_date: new Date(),
      end_date: new Date(),
      ethical_issues_exist: false,
    });

    expect(gaps.map((g) => g.id)).toEqual(["sharing"]);
  });
});

describe("redrafting returns suggestions, never a replacement plan", () => {
  const current = {
    title: "Old title",
    dataset: [{ dataset_id: "d1", title: "Reads" }],
  } as never;

  it("returns field-level changes", async () => {
    const { fields } = await redraftFromProposal({
      filename: "p.docx",
      direction: "",
      current,
    });

    expect(fields.every((f) => typeof f.path === "string")).toBe(true);
    expect(fields.some((f) => f.path === "title")).toBe(true);
    expect(fields.some((f) => f.path === "dataset[0].title")).toBe(true);
  });

  it("only suggests for outputs that still exist", async () => {
    const { fields } = await redraftFromProposal({
      filename: "p.docx",
      direction: "",
      current: { dataset: [] } as never,
    });

    expect(fields.some((f) => f.path.startsWith("dataset["))).toBe(false);
  });

  it("includes the steer in what it proposes", async () => {
    const { fields } = await redraftFromProposal({
      filename: "p.docx",
      direction: "Make everything openly shared",
      current,
    });

    expect(fields.some((f) => f.path === "dataset[0].access")).toBe(true);
    const description = fields.find((f) => f.path === "description");
    expect(String(description?.value)).toContain("p.docx");
  });
});

describe("a thin proposal yields a thin draft, not an invented one", () => {
  const docx = (size: number) =>
    new File([new Uint8Array(size)], "thin.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

  it("extracts little when coverage is low", async () => {
    const { draft, coverage } = await aiApi.analyzeProposal(docx(1000));

    expect(coverage).toBe("low");
    expect(draft.dataset).toEqual([]);
    expect(draft.begin_date).toBeUndefined();
    expect(draft.ethical_issues_exist).toBeUndefined();
  });

  it("leaves real questions for the fallback to ask", async () => {
    const { draft } = await aiApi.analyzeProposal(docx(1000));

    expect(coverageGaps(draft).map((g) => g.id)).toEqual([
      "outputs",
      "timeline",
      "ethics",
      "sharing",
    ]);
  });

  it("fills the plan out once the researcher supplies direction", async () => {
    const guided = await aiApi.analyzeProposal(
      docx(1000),
      "Outputs are sequencing reads and analysis code, shared openly, kept ten years",
    );

    expect(guided.coverage).toBe("ok");
    expect((guided.draft.dataset ?? []).length).toBeGreaterThan(0);
    expect(coverageGaps(guided.draft).map((g) => g.id)).not.toContain(
      "outputs",
    );
  });
});

// The stand-in must not damage text: testers should judge the review flow,
// not a stub that pastes instructions into a title.
describe("the rewrite stand-in only changes wording", () => {
  const rewrite = (label: string, text: string, direction: never) =>
    aiApi.regenerateField(label, text, direction).then((r) => r.text);
  const LONG =
    "This project surveys genomic diversity in urban pollinator populations across metropolitan green corridors, combining field sampling with sequencing.";

  it("shortens at a clause, never mid-phrase", async () => {
    expect(
      await rewrite("Description", LONG, { kind: "shorter" } as never),
    ).toBe(
      "This project surveys genomic diversity in urban pollinator populations across metropolitan green corridors.",
    );
  });

  it("never pastes the instruction into the text", async () => {
    const title = "Genomic Diversity Mapping of Urban Pollinator Populations";
    for (const detail of [
      "Plainer language",
      "More specific",
      "community benefit",
    ]) {
      const out = await rewrite("Title", title, {
        kind: "custom",
        detail,
      } as never);
      expect(out).not.toMatch(new RegExp(detail, "i"));
    }
  });

  it("adds no claim the text didn't make", async () => {
    const out = await rewrite("Description", LONG, { kind: "formal" } as never);
    expect(out).not.toMatch(/governance|accordance|standards/i);
  });

  it("writes nothing from a blank field", async () => {
    expect(await rewrite("Title", "", { kind: "formal" } as never)).toBe("");
  });

  it("doesn't end a title with a full stop", async () => {
    expect(
      await rewrite("Title", "urban pollinators", { kind: "formal" } as never),
    ).toBe("Urban pollinators");
  });
});
