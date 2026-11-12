import { describe, expect, it } from "vitest";
import { planStepIndex, planSteps } from "./plan-mode";

describe("plan stepper", () => {
  it("doesn't claim an upload or analysis for any plan", () => {
    const labels = planSteps("institutional").map((s) => s.label);
    expect(labels).not.toContain("Upload");
    expect(labels).not.toContain("Analyze");
  });

  it("names the last stage the way the plan's mode does", () => {
    expect(planSteps("institutional").at(-1)?.label).toBe("Approved");
    expect(planSteps("independent").map((s) => s.label)).toEqual([
      "Start",
      "Review",
      "Finalize",
      "Finalized",
    ]);
  });

  it("follows the plan's status rather than the page", () => {
    expect(planStepIndex("draft")).toBe(1);
    expect(planStepIndex("draft", true)).toBe(2);
    expect(planStepIndex("pending")).toBe(3);
    // In force: every stage done, even while editing a revision.
    expect(planStepIndex("approved")).toBe(4);
    expect(planStepIndex("approved", true)).toBe(4);
  });
});
