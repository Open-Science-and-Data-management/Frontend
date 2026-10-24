import { describe, expect, it } from "vitest";
import { isResearcher, isReviewer, seesPlans } from "@/config/roles";

describe("which side each role is on", () => {
  it("puts only committee and chief on the reviewing side", () => {
    expect(isReviewer("committee")).toBe(true);
    expect(isReviewer("chief")).toBe(true);
    expect(isReviewer("researcher")).toBe(false);
    expect(isReviewer("admin")).toBe(false);
  });

  // Admin is operational, not academic: no review, no authoring, no plans.
  it("keeps admin off both sides and away from plans", () => {
    expect(isResearcher("admin")).toBe(false);
    expect(seesPlans("admin")).toBe(false);
  });

  it("lets authors and reviewers see plans", () => {
    expect(seesPlans("researcher")).toBe(true);
    expect(seesPlans("committee")).toBe(true);
    expect(seesPlans("chief")).toBe(true);
    expect(seesPlans(undefined)).toBe(false);
  });
});
