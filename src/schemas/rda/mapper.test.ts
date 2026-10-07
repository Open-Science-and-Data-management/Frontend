import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import standard from "./vendor/RDA-DMP-Common-Standard_v1.3.json";
import {
  ISO_639_1_TO_2,
  licenceUrl,
  mapFormToRda,
  type RdaContext,
} from "./mapper";
import type { DmpForm } from "@/types/dmp";

const ajv = new Ajv2020({ strict: false, allErrors: true });
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

const context: RdaContext = {
  dmpId: "dmp-pollinator",
  created: new Date("2026-01-10T09:00:00.000Z"),
  modified: new Date("2026-02-01T12:30:00.000Z"),
  project: { title: "Urban Pollinator Genomics" },
};

const form = (over: Partial<DmpForm> = {}): DmpForm => ({
  title: "Urban Pollinator Genomics DMP",
  description: "Genomic diversity of urban pollinators.",
  language: "th",
  begin_date: new Date("2025-01-01T00:00:00.000Z"),
  end_date: new Date("2025-12-31T00:00:00.000Z"),
  ethical_issues_exist: false,
  contributor: [
    {
      contributor_id: "c1",
      title: "Dr.",
      name: "Aran",
      surname: "Suwannachot",
      role: "Principal Investigator",
      email: "aran@example.edu",
      orcid: "0000-0002-1825-0097",
      is_contact: true,
    },
    {
      contributor_id: "c2",
      name: "Mali",
      role: "Data steward",
      is_contact: false,
    },
  ],
  cost: [{ title: "Sequencing", value: 85000, currency_code: "THB" }],
  dataset: [
    {
      dataset_id: "ds-reads",
      type: "raw",
      title: "Pollinator sequence reads",
      status: "planned",
      access: "open",
      personal_data: "no",
      sensitive_data: "no",
      protection_level: "other",
      protection_level_other_nomenclature: "Mahidol data classification",
      protection_level_other: "Level 1",
      security_classification_level: "unclassified",
      keyword: ["pollinators", "genomics"],
      domain: "life_sciences",
      domain_metadata: {
        organism: "Apis mellifera",
        collection_date: new Date("2025-03-01T00:00:00.000Z"),
      },
      preservation: { doi_requested: true, statement: "Deposited in ENA." },
      distribution: [
        {
          title: "Reads (FASTQ)",
          data_access: "open",
          license: "CC-BY-4.0",
          download_url: "https://data.example.edu/reads.fastq.gz",
          format: "application/gzip",
          byte_size: 1048576,
        },
      ],
      schema_fields: [],
    },
  ],
  schema_version: "v3.0",
  ...over,
});

describe("exports conform to the RDA DMP Common Standard v1.3", () => {
  it("for a full plan", () => {
    expectConformant(mapFormToRda(form(), context));
  });

  it("for a minimal plan with no distributions or costs", () => {
    const base = form();
    expectConformant(
      mapFormToRda(
        {
          ...base,
          cost: [],
          dataset: [{ ...base.dataset[0], distribution: [], keyword: [] }],
        },
        context,
      ),
    );
  });

  it("when a licence is free text that can't become a link", () => {
    const base = form();
    const out = mapFormToRda(
      {
        ...base,
        dataset: [
          {
            ...base.dataset[0],
            distribution: [
              {
                title: "Reads",
                data_access: "shared",
                license: "Ask the PI for terms",
              },
            ],
          },
        ],
      },
      context,
    );
    expectConformant(out);
    const dist = (out.dmp.dataset as any)[0].distribution[0];
    expect(dist.license).toBeUndefined();
    expect(dist.description).toBe("Licence: Ask the PI for terms");
  });
});

describe("what goes where in RDA", () => {
  const dmp = () => mapFormToRda(form(), context).dmp as any;

  it("stays flat, with keywords where RDA keeps them", () => {
    expect(dmp().title).toBe("Urban Pollinator Genomics DMP");
    expect(dmp().dataset[0].keyword).toEqual(["pollinators", "genomics"]);
    expect(dmp()).not.toHaveProperty("general_info");
  });

  it("keeps Thai as an RDA language code", () => {
    expect(dmp().language).toBe("tha");
  });

  it("links the licence deed", () => {
    expect(dmp().dataset[0].distribution[0].license).toEqual([
      {
        license_ref: "https://creativecommons.org/licenses/by/4.0/",
        start_date: "2025-01-01",
      },
    ]);
  });

  it("carries protection and security in security_and_privacy", () => {
    expect(dmp().dataset[0].security_and_privacy).toEqual([
      {
        title: "Protection level",
        description: "Mahidol data classification: Level 1",
      },
      { title: "Security classification", description: "unclassified" },
    ]);
  });

  it("keeps the research domain as an extension", () => {
    expect(dmp().dataset[0].domain).toBe("life_sciences");
    // A calendar date, exported as the day itself.
    expect(dmp().dataset[0].domain_metadata.collection_date).toBe(
      "2025-03-01",
    );
  });
});

describe("licence links", () => {
  it.each([
    ["https://example.org/terms", "https://example.org/terms"],
    ["cc0-1.0", "https://creativecommons.org/publicdomain/zero/1.0/"],
    ["MIT", "https://opensource.org/licenses/MIT"],
    ["EUPL-1.2", "https://spdx.org/licenses/EUPL-1.2.html"],
    ["", undefined],
    ["Ask the PI", undefined],
  ])("%s → %s", (input, expected) => {
    expect(licenceUrl(input)).toBe(expected);
  });
});

describe("every language the form offers is an RDA language", () => {
  it("maps all ISO 639-1 codes into RDA's list", () => {
    const allowed = new Set((standard as any).$defs.LanguageCode.enum);
    expect(
      Object.entries(ISO_639_1_TO_2).filter(([, code]) => !allowed.has(code)),
    ).toEqual([]);
  });
});
