import { describe, expect, it } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import standard from "./vendor/GCWG-RDA-maDMP-schema_v3.0.json";
import { approvalFromPlan, mapFormToMadmp, type MadmpContext } from "./mapper";
import {
  APPROVAL_STATUSES,
  CONTACT_ROLES,
  ISO_639_1_TO_3,
  MADMP_SCHEMA_VERSION,
  PROTECTION_LEVELS,
  SECURITY_CLASSIFICATION_LEVELS,
} from "./vocabularies";
import type { DmpForm } from "@/types/dmp";

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(standard);

const expectConformant = (doc: unknown) => {
  const ok = validate(doc);
  expect(
    ok
      ? []
      : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`),
  ).toEqual([]);
};

const context: MadmpContext = {
  dmpId: "10.1234/dmp-1",
  created: new Date("2026-01-10T09:00:00.000Z"),
  modified: new Date("2026-02-01T12:30:00.000Z"),
};

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
      protection_level: "Protected A",
      security_classification_level: "restricted",
      keyword: ["sediment", "coastal geology"],
      domain: "generic",
      domain_metadata: {},
      preservation: { doi_requested: false, statement: "Kept for 10 years." },
      distribution: [],
      schema_fields: [],
    },
  ],
  schema_version: MADMP_SCHEMA_VERSION,
  ...over,
});

const withDistribution = (
  dist: Partial<DmpForm["dataset"][number]["distribution"][number]>,
  datasetPatch: Partial<DmpForm["dataset"][number]> = {},
): DmpForm => {
  const base = form();
  return {
    ...base,
    dataset: [
      {
        ...base.dataset[0],
        ...datasetPatch,
        distribution: [
          {
            distribution_id: "d1-csv",
            title: "Core measurements (CSV)",
            data_access: "shared",
            format: "text/csv",
            ...dist,
          },
        ],
      } as DmpForm["dataset"][number],
    ],
  };
};

describe("exports conform to GCWG-RDA maDMP v3.0", () => {
  it("for a plain plan", () => {
    expectConformant(mapFormToMadmp(form(), context));
  });

  it("with an open distribution and its licence", () => {
    expectConformant(
      mapFormToMadmp(
        withDistribution({
          data_access: "open",
          license: "https://creativecommons.org/licenses/by/4.0/",
          download_url: "https://data.example.edu/core.csv",
          byte_size: 20480,
        }),
        context,
      ),
    );
  });

  it("with an institution's own classification scheme", () => {
    expectConformant(
      mapFormToMadmp(
        withDistribution(
          {},
          {
            protection_level: "other",
            protection_level_other_nomenclature: "Mahidol data classification",
            protection_level_other: "Level 2",
            security_classification_level: "other",
            security_classification_level_other_nomenclature:
              "Mahidol data classification",
            security_classification_level_other: "Internal",
          },
        ),
        context,
      ),
    );
  });

  it("with free-form values from plans written before v3.0", () => {
    expectConformant(
      mapFormToMadmp(
        withDistribution(
          {},
          {
            protection_level: "Standard",
            security_classification_level: "Internal",
          },
        ),
        context,
      ),
    );
  });

  it("with costs, Thai as a two-letter code, and Indigenous considerations", () => {
    expectConformant(
      mapFormToMadmp(
        form({
          language: "th",
          indigenous_considerations: "Samples come from Moken community land.",
          cost: [
            { title: "Cloud storage", value: 12000, currency_code: "THB" },
            { title: "Volunteer time", value: 0, currency_code: "THB" },
          ],
        }),
        context,
      ),
    );
  });

  it("with domain metadata, dates included", () => {
    const base = form();
    expectConformant(
      mapFormToMadmp(
        {
          ...base,
          dataset: [
            {
              ...base.dataset[0],
              domain: "life_sciences",
              domain_metadata: {
                organism: "Oryza sativa",
                collection_date: new Date("2025-03-01T00:00:00.000Z"),
              },
            },
          ],
        },
        context,
      ),
    );
  });

  it.each([
    ["institutional draft", "draft", "institutional"],
    ["institutional, submitted", "pending", "institutional"],
    ["institutional, approved", "approved", "institutional"],
    ["independent, finalized", "approved", "independent"],
  ] as const)("with the approval of an %s plan", (_label, status, planMode) => {
    const approval = approvalFromPlan({
      status,
      planMode,
      decidedAt: new Date("2026-02-01T00:00:00.000Z"),
      submittedAt: new Date("2026-01-20T00:00:00.000Z"),
      contactName: "Dr. Aran Suwannachot",
      contactRole: "Principal Investigator",
    });
    expectConformant(mapFormToMadmp(form(), { ...context, approval }));
  });
});

describe("what goes where in v3.0", () => {
  const out = () => mapFormToMadmp(form(), context);

  it("nests plan fields under general_info and pins the schema version", () => {
    const info = out().dmp.general_info;
    expect(info.title).toBe("Coastal Sediment Archive DMP");
    expect(info.schema_version).toBe("v3.0");
    expect(info.dmp_id).toEqual({ identifier: "10.1234/dmp-1", type: "doi" });
    expect(info.ethical_issues_report).toBe(
      "https://ethics.university.edu/approvals/2025-041",
    );
  });

  it("names the contact, with the email v3.0 requires", () => {
    const { contact } = out().dmp;
    expect(contact.name).toBe("Dr. Aran Suwannachot");
    expect(contact.mbox).toBe("aran.s@example.edu");
    expect(contact.role).toBe("principalInvestigator");
    expect(contact.contact_id).toEqual({
      identifier: "0000-0002-1825-0097",
      type: "orcid",
    });
  });

  it("identifies a contributor without ORCID or email by our own id, named as such", () => {
    const mali = out().dmp.contributor?.[1];
    expect(mali?.mbox).toBeUndefined();
    expect(mali?.contributor_id).toEqual({
      identifier: "contributor:c2",
      type: "other",
      registry_name: "DMP-Researcher",
    });
  });

  it("puts subject keywords in `subject`, since v3.0 repurposed `keyword`", () => {
    const dataset = out().dmp.dataset[0];
    expect(dataset.subject).toEqual([
      { heading_name: "sediment" },
      { heading_name: "coastal geology" },
    ]);
    expect(dataset).not.toHaveProperty("keyword");
  });

  it("keeps a pre-v3.0 value as `other`, rather than guessing a level", () => {
    const dist = mapFormToMadmp(
      withDistribution({}, { protection_level: "Standard" }),
      context,
    ).dmp.dataset[0].distribution?.[0];
    expect(dist?.protection_level).toBe("other");
    expect(dist?.protection_level_other_level).toBe("Standard");
  });

  it("rolls the most restrictive dataset level up to the plan", () => {
    const base = form();
    const info = mapFormToMadmp(
      {
        ...base,
        dataset: [
          base.dataset[0],
          {
            ...base.dataset[0],
            dataset_id: "d2",
            protection_level: "Protected B",
            security_classification_level: "confidential",
          },
        ],
      },
      context,
    ).dmp.general_info;
    expect(info.protection_level).toBe("Protected B");
    expect(info.security_classification_level).toBe("confidential");
  });

  it("records an independent plan's approval as not applicable", () => {
    expect(
      approvalFromPlan({
        status: "approved",
        planMode: "independent",
        contactName: "x",
        contactRole: "y",
      }).status,
    ).toBe("not applicable");
  });

  it("admits nothing at the root but dmp", () => {
    expect(Object.keys(out())).toEqual(["dmp"]);
  });
});

describe("our vocabularies match the standard's", () => {
  const dmp = (standard as any).properties.dmp.properties;
  const enumOf = (node: any) => node.enum as string[];

  it("for protection, security, approval and contact roles", () => {
    expect([...PROTECTION_LEVELS]).toEqual(
      enumOf(dmp.general_info.properties.protection_level),
    );
    expect([...SECURITY_CLASSIFICATION_LEVELS]).toEqual(
      enumOf(dmp.general_info.properties.security_classification_level),
    );
    expect([...APPROVAL_STATUSES]).toEqual(
      enumOf(dmp.approval.properties.status),
    );
    expect([...CONTACT_ROLES]).toEqual(enumOf(dmp.contact.properties.role));
  });

  it("for every language the form offers", () => {
    const languages = new Set(enumOf(dmp.general_info.properties.language));
    const invalid = Object.entries(ISO_639_1_TO_3).filter(
      ([, code]) => !languages.has(code),
    );
    expect(invalid).toEqual([]);
  });
});
