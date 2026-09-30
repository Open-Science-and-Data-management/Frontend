import { describe, expect, it } from "vitest";
import { generateTaskChecklist, generateTasks } from "@/api/aiApi";

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
    outputs: [{ title: "Sequence reads", type: "raw", access: "shared" }],
  };

  it("drafts a list of plain steps", async () => {
    const { steps } = await generateTaskChecklist(base);

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => typeof s === "string")).toBe(true);
  });

  it("names the plan's output in the steps", async () => {
    const { steps } = await generateTaskChecklist(base);

    expect(steps.some((s) => s.includes("Sequence reads"))).toBe(true);
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
