import { describe, expect, it } from "vitest";
import { mapFormToMadmp } from "@/schemas/madmp/mapper";
import type { DmpForm } from "@/types/dmp";

const ids = { dmpDoi: "10.1234/dmp-1" };

const form = (over: Partial<DmpForm> = {}): DmpForm => ({
  title: "Coastal Sediment Archive DMP",
  description: "Core samples from the 2025 survey season.",
  language: "eng",
  begin_date: new Date("2025-01-01T00:00:00.000Z"),
  end_date: new Date("2025-12-31T00:00:00.000Z"),
  ethical_issues_exist: true,
  ethical_issues_description: "Interviews are consented and anonymised.",
  ethical_issues_report: "https://ethics.university.edu/approvals/2025-041",
  contributor: [
    {
      contributor_id: "c1",
      title: "Dr.",
      name: "Aran",
      surname: "Suwannachot",
      role: "Principal Investigator",
      email: "aran.s@example.edu",
      orcid: "0000-0002-1825-0097",
      is_contact: true,
    },
    {
      contributor_id: "c2",
      name: "Mali",
      role: "Data steward",
      email: "",
      is_contact: false,
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
      protection_level: "Institutional storage",
      security_classification_level: "internal",
      keyword: [],
      domain: "generic",
      domain_metadata: {},
      preservation: { doi_requested: false },
      distribution: [],
      schema_fields: [],
    },
  ],
  schema_version: "FAIRer maDMP 1.2",
  ...over,
});

describe("mapFormToMadmp", () => {
  it("exports the contact's email as mbox", () => {
    const out = mapFormToMadmp(form(), ids);

    expect(out.dmp.contact.name).toBe("Dr. Aran Suwannachot");
    expect(out.dmp.contact.mbox).toBe("aran.s@example.edu");
  });

  it("carries each contributor's email, omitting blanks", () => {
    const out = mapFormToMadmp(form(), ids);

    expect(out.dmp.contributor?.[0].mbox).toBe("aran.s@example.edu");
    // An empty string is not a valid mbox — it has to be absent, not "".
    expect(out.dmp.contributor?.[1]).not.toHaveProperty("mbox", "");
    expect(out.dmp.contributor?.[1].mbox).toBeUndefined();
  });

  it("exports the ethical issues report URL", () => {
    const out = mapFormToMadmp(form(), ids);

    expect(out.dmp.ethical_issues_report).toBe(
      "https://ethics.university.edu/approvals/2025-041",
    );
    expect(out.dmp.ethical_issues_exist).toBe("yes");
  });

  it("omits the report when there isn't one", () => {
    const out = mapFormToMadmp(form({ ethical_issues_report: "" }), ids);

    expect(out.dmp.ethical_issues_report).toBeUndefined();
  });

  it("falls back to the first contributor when none is marked contact", () => {
    const out = mapFormToMadmp(
      form({
        contributor: form().contributor.map((c) => ({
          ...c,
          is_contact: false,
        })),
      }),
      ids,
    );

    expect(out.dmp.contact.name).toBe("Dr. Aran Suwannachot");
  });
});
