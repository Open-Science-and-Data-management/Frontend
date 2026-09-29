import { describe, expect, it } from "vitest";
import { computeReadiness } from "@/hooks/useDmpReadiness";
import type { DmpDraft } from "@/types/dmp";

const completeDraft = (): DmpDraft => ({
  title: "Coastal Sediment Archive DMP",
  description: "Core samples from the 2025 survey season.",
  language: "eng",
  begin_date: new Date("2025-01-01T00:00:00.000Z"),
  end_date: new Date("2025-12-31T00:00:00.000Z"),
  ethical_issues_exist: false,
  contributor: [
    {
      contributor_id: "c1",
      name: "Aran",
      role: "Principal investigator",
      is_contact: true,
    },
  ],
  cost: [],
  dataset: [
    {
      dataset_id: "d1",
      type: "raw",
      title: "Core measurements",
      status: "planned",
      access: "shared",
      personal_data: "no",
      sensitive_data: "no",
      protection_level: "Stored on institutional storage",
      security_classification_level: "internal",
      keyword: [],
      preservation: { doi_requested: false },
      distribution: [],
      schema_fields: [],
    },
  ],
  schema_version: "FAIRer maDMP 1.2",
});

const labels = (draft: DmpDraft) =>
  computeReadiness(draft).unmetItems.map((i) => i.label);

describe("computeReadiness", () => {
  it("lets a complete plan through", () => {
    const readiness = computeReadiness(completeDraft());

    expect(readiness.unmetItems).toEqual([]);
    expect(readiness.canSubmit).toBe(true);
    expect(readiness.schemaError).toBeNull();
  });

  it("blocks an empty plan and names what's missing", () => {
    const readiness = computeReadiness({});

    expect(readiness.canSubmit).toBe(false);
    expect(labels({})).toContain("Title provided");
    expect(labels({})).toContain("At least one research output added");
  });

  it("requires exactly one primary contact", () => {
    const two = completeDraft();
    two.contributor = [
      { contributor_id: "c1", name: "A", role: "r", is_contact: true },
      { contributor_id: "c2", name: "B", role: "r", is_contact: true },
    ];

    expect(labels(two)).toContain("Exactly one primary contact set");
    expect(computeReadiness(two).canSubmit).toBe(false);
  });

  it("asks for a description only when ethical issues exist", () => {
    const none = completeDraft();
    expect(labels(none)).not.toContain("Ethical issues described");

    const some = completeDraft();
    some.ethical_issues_exist = true;
    expect(labels(some)).toContain("Ethical issues described");
    expect(computeReadiness(some).canSubmit).toBe(false);

    some.ethical_issues_description =
      "Interviews are consented and anonymised.";
    expect(labels(some)).not.toContain("Ethical issues described");
    expect(computeReadiness(some).canSubmit).toBe(true);
  });

  it("rejects an end date before the begin date", () => {
    const backwards = completeDraft();
    backwards.end_date = new Date("2024-01-01T00:00:00.000Z");

    expect(computeReadiness(backwards).canSubmit).toBe(false);
  });

  it("requires protection and security on every output", () => {
    const draft = completeDraft();
    draft.dataset = [
      ...(draft.dataset ?? []),
      { ...(draft.dataset ?? [])[0], dataset_id: "d2", protection_level: "" },
    ];

    expect(labels(draft)).toContain(
      "Every research output has protection & security set",
    );
  });
});

describe("the checklist never claims ready while submit is blocked", () => {
  const assertHonest = (draft: DmpDraft) => {
    const { canSubmit, checklistItems, unmetItems } = computeReadiness(draft);
    // The whole point of the list: if you can't submit, it says why.
    expect(canSubmit || unmetItems.length > 0).toBe(true);
    if (!canSubmit) expect(unmetItems.length).toBeGreaterThan(0);
    expect(checklistItems.every((i) => i.section)).toBe(true);
  };

  it("surfaces a required field that no hand-written item covers", () => {
    const draft = completeDraft();
    // Every hand-written item still passes: a contributor exists and exactly
    // one is the contact. Only the schema knows the role is empty.
    draft.contributor = [
      {
        contributor_id: "c1",
        name: "Aran",
        role: "",
        is_contact: true,
      },
    ];

    const { canSubmit, unmetItems } = computeReadiness(draft);
    expect(canSubmit).toBe(false);
    expect(unmetItems.map((i) => i.label)).toContain(
      "Contributor 1 — Role needs attention",
    );
    expect(unmetItems[0].section).toBe("people");
    assertHonest(draft);
  });

  it("names the research output that is short a field", () => {
    const draft = completeDraft();
    draft.dataset = [
      ...(draft.dataset ?? []),
      { ...(draft.dataset ?? [])[0], dataset_id: "d2", title: "" },
    ];

    const { unmetItems } = computeReadiness(draft);
    const item = unmetItems.find((i) => i.label.includes("Research output 2"));
    expect(item?.label).toBe("Research output 2 — Title needs attention");
    expect(item?.section).toBe("dataset");
    assertHonest(draft);
  });

  it("does not repeat an issue a hand-written item already states", () => {
    const draft = completeDraft();
    draft.title = "";

    const { unmetItems } = computeReadiness(draft);
    expect(unmetItems.filter((i) => i.label.includes("Title"))).toHaveLength(1);
    expect(unmetItems[0].label).toBe("Title provided");
    assertHonest(draft);
  });

  it("stays honest for an empty plan and a complete one", () => {
    assertHonest({});
    assertHonest(completeDraft());
    expect(computeReadiness(completeDraft()).unmetItems).toEqual([]);
  });

  it("routes each item to the section that owns the field", () => {
    const sections = Object.fromEntries(
      computeReadiness({}).checklistItems.map((i) => [i.label, i.section]),
    );

    expect(sections["Title provided"]).toBe("general");
    expect(sections["Begin & end dates set"]).toBe("general");
    expect(sections["Ethical issues answered"]).toBe("ethical");
    expect(sections["At least one contributor added"]).toBe("people");
    expect(sections["At least one research output added"]).toBe("dataset");
  });
});
