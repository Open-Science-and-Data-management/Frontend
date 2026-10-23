import { describe, expect, it } from "vitest";
import { suggestAccountFor } from "./contributor.schema";
import { dmpSchema, type DmpForm } from "../dmp/dmp.schema";
import { diffPlans, editTypeOf } from "@/config/plan-diff";
import { mapFormToMadmp } from "../madmp/mapper";
import { mapFormToRda } from "../rda/mapper";
import type { DmpDraft } from "@/types/dmp";

const users = [
  { user_id: "u-aran", email: "aran@example.edu" },
  { user_id: "u-mali", email: "Mali@Example.edu" },
];

describe("suggesting an account for a contributor", () => {
  it("matches by email, ignoring case and spaces", () => {
    expect(
      suggestAccountFor({ email: " mali@example.EDU " }, users)?.user_id,
    ).toBe("u-mali");
  });

  it("offers nothing without an email, or once linked", () => {
    expect(suggestAccountFor({ email: "" }, users)).toBeUndefined();
    expect(
      suggestAccountFor(
        { email: "aran@example.edu", user_id: "u-aran" },
        users,
      ),
    ).toBeUndefined();
  });

  it("won't offer an account another contributor already holds", () => {
    expect(
      suggestAccountFor({ email: "aran@example.edu" }, users, ["u-aran"]),
    ).toBeUndefined();
  });

  it("offers nothing when no account matches", () => {
    expect(
      suggestAccountFor({ email: "guest@elsewhere.org" }, users),
    ).toBeUndefined();
  });
});

const form = (contributor: DmpForm["contributor"]) => ({
  title: "Rice Genomics DMP",
  description: "Sequencing of local cultivars.",
  language: "en",
  begin_date: new Date("2026-01-01T00:00:00.000Z"),
  end_date: new Date("2026-12-31T00:00:00.000Z"),
  ethical_issues_exist: false,
  contributor,
  cost: [],
  dataset: [
    {
      dataset_id: "ds-1",
      type: "raw",
      title: "Sequence reads",
      status: "planned",
      access: "shared",
      personal_data: "no",
      sensitive_data: "no",
      protection_level: "not protected",
      security_classification_level: "unclassified",
      keyword: [],
      domain: "generic",
      domain_metadata: {},
      preservation: { doi_requested: false },
      distribution: [],
      schema_fields: [],
    },
  ],
});

const person = (id: string, user_id?: string, is_contact = false) => ({
  contributor_id: id,
  name: id,
  role: "Researcher",
  email: `${id}@example.edu`,
  is_contact,
  user_id,
});

describe("one account, one contributor", () => {
  it("accepts contributors with and without accounts", () => {
    const result = dmpSchema.safeParse(
      form([person("a", "u-aran", true), person("b"), person("c", "u-mali")]),
    );
    expect(result.success ? [] : result.error.issues).toEqual([]);
  });

  it("names the second contributor linked to the same account", () => {
    const result = dmpSchema.safeParse(
      form([person("a", "u-aran", true), person("b"), person("c", "u-aran")]),
    );
    expect(result.success).toBe(false);
    const issues = result.success ? [] : result.error.issues;
    expect(issues.map((i) => i.path)).toEqual([["contributor", 2, "user_id"]]);
  });
});

describe("linking an account", () => {
  const plan = (user_id?: string): DmpDraft => ({
    project_id: "proj-1",
    title: "Rice Genomics DMP",
    dataset: [],
    contributor: [person("a", user_id, true)],
  });

  // Who is responsible for the data is a commitment: any contributor change
  // goes back for sign-off.
  it("is a major edit, labelled for people", () => {
    const changes = diffPlans(plan(), plan("u-aran"));
    expect(changes.map((c) => [c.label, c.to])).toEqual([
      ["Contributor 1: Linked account", "u-aran"],
    ]);
    expect(editTypeOf(changes)).toBe("major");
  });

  it("stays out of both exports", () => {
    const parsed = dmpSchema.parse(form([person("a", "u-aran", true)]));
    const context = { dmpId: "dmp-x", project: { title: "Rice" } };
    for (const doc of [
      mapFormToMadmp(parsed, context),
      mapFormToRda(parsed, context),
    ])
      expect(JSON.stringify(doc)).not.toContain("u-aran");
  });
});
