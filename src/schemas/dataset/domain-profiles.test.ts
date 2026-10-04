import { describe, expect, it } from "vitest";
import { datasetSchema } from "@/schemas/dataset";
import {
  DomainKeyEnum,
  domainProfiles,
  foreignDomainKeys,
  getDomainProfile,
  validateDomainMetadata,
} from "@/schemas/dataset/domain-profiles";
import { suggestDomain } from "@/api/aiApi";

const dataset = (patch: Record<string, unknown> = {}) => ({
  dataset_id: "d1",
  type: "raw" as const,
  title: "Reads",
  status: "planned" as const,
  access: "shared" as const,
  personal_data: "no" as const,
  sensitive_data: "no" as const,
  protection_level: "Standard",
  security_classification_level: "Internal",
  keyword: [],
  domain: "generic",
  domain_metadata: {},
  preservation: { doi_requested: false },
  distribution: [],
  schema_fields: [],
  ...patch,
});

describe("the registry is the single source", () => {
  it("has a profile for every key, and generic takes no fields", () => {
    DomainKeyEnum.options.forEach((key) => {
      expect(domainProfiles[key].key).toBe(key);
    });
    expect(domainProfiles.generic.fields).toEqual([]);
    expect(validateDomainMetadata("generic", {}).success).toBe(true);
  });

  it("derives validation from the declared fields, so the two can't drift", () => {
    // Anything the profile renders, the profile also accepts — the schema is
    // built from this very list, and this is what pins that down.
    DomainKeyEnum.options.forEach((key) => {
      const everyField = Object.fromEntries(
        domainProfiles[key].fields.map((f) => [f.key, null]),
      );
      expect(foreignDomainKeys(key, everyField)).toEqual([]);
    });
  });

  it("falls back to generic for an unknown domain", () => {
    expect(getDomainProfile("astrology").key).toBe("generic");
    expect(getDomainProfile(undefined).key).toBe("generic");
  });

  it("rejects a value from another domain's profile", () => {
    // Strict on purpose: a leftover key means the data no longer means what
    // the profile says it means.
    const result = validateDomainMetadata("geospatial", {
      coordinate_system: "EPSG:4326",
      organism: "Oryza sativa",
    });
    expect(result.success).toBe(false);
  });

  it("names exactly the keys a domain switch has to drop", () => {
    const metadata = { organism: "Oryza sativa", sample_count: 12 };
    expect(foreignDomainKeys("geospatial", metadata).sort()).toEqual([
      "organism",
      "sample_count",
    ]);
    expect(foreignDomainKeys("life_sciences", metadata)).toEqual([]);
  });
});

describe("every profile in the registry holds together", () => {
  const profiles = DomainKeyEnum.options.map((key) => domainProfiles[key]);

  it("declares each field once, with a label", () => {
    profiles.forEach((p) => {
      const keys = p.fields.map((f) => f.key);
      expect(new Set(keys).size, `${p.key} repeats a field key`).toBe(
        keys.length,
      );
      p.fields.forEach((f) => expect(f.label.trim()).not.toBe(""));
    });
  });

  it("gives every select something to choose from", () => {
    profiles.forEach((p) =>
      p.fields
        .filter((f) => f.type === "select")
        .forEach((f) =>
          expect(
            (f.options ?? []).length,
            `${p.key}.${f.key} has no options`,
          ).toBeGreaterThan(1),
        ),
    );
  });

  it("accepts a full set of its own values", () => {
    // The strongest guard as domains get added: fill every declared field with
    // a value of its declared type and the profile must take all of it.
    const sample = (field: (typeof profiles)[number]["fields"][number]) => {
      switch (field.type) {
        case "number":
          return 3;
        case "toggle":
          return true;
        case "date":
          return new Date("2026-01-15T00:00:00.000Z");
        case "select":
          return field.options?.[0];
        default:
          return "filled in";
      }
    };

    profiles.forEach((p) => {
      const everything = Object.fromEntries(
        p.fields.map((f) => [f.key, sample(f)]),
      );
      const result = validateDomainMetadata(p.key, everything);
      expect(
        result.success,
        `${p.key}: ${result.error?.issues[0]?.message}`,
      ).toBe(true);
    });
  });

  it("asks for something identifying wherever it asks for anything", () => {
    // A non-generic domain with no required field would record nothing in
    // particular, which is what `generic` is already for.
    profiles
      .filter((p) => p.key !== "generic" && p.fields.length > 0)
      .forEach((p) =>
        expect(
          p.fields.some((f) => f.required),
          `${p.key} has no required field`,
        ).toBe(true),
      );
  });
});

describe("a dataset is judged by its own domain", () => {
  it("accepts core fields with no domain chosen", () => {
    expect(datasetSchema.safeParse(dataset()).success).toBe(true);
  });

  it("requires the profile's required fields once a domain is picked", () => {
    const result = datasetSchema.safeParse(
      dataset({ domain: "life_sciences", domain_metadata: {} }),
    );
    expect(result.success).toBe(false);
    // The error points at the field, not at the blob.
    expect(result.error?.issues[0].path).toEqual([
      "domain_metadata",
      "organism",
    ]);
  });

  it("passes once the required field is answered", () => {
    expect(
      datasetSchema.safeParse(
        dataset({
          domain: "life_sciences",
          domain_metadata: { organism: "Oryza sativa", sample_count: 12 },
        }),
      ).success,
    ).toBe(true);
  });

  it("refuses a select value the profile doesn't offer", () => {
    const result = datasetSchema.safeParse(
      dataset({
        domain: "life_sciences",
        domain_metadata: { organism: "Rice", sequencing_platform: "Guesswork" },
      }),
    );
    expect(result.success).toBe(false);
  });
});

describe("AI suggests a domain but not a compliance claim", () => {
  it("reads the domain out of the text", () => {
    expect(suggestDomain("rice genome sequencing").domain).toBe(
      "life_sciences",
    );
    expect(suggestDomain("household survey of farmers").domain).toBe(
      "social_science",
    );
    expect(suggestDomain("satellite remote sensing").domain).toBe("geospatial");
    expect(suggestDomain("a study").domain).toBe("generic");
  });

  it("fills what the text answers", () => {
    const { domain_metadata } = suggestDomain(
      "rice whole genome sequencing on illumina",
    );
    expect(domain_metadata).toMatchObject({
      organism: "Oryza sativa",
      sequencing_platform: "Illumina",
      assay_type: "WGS",
    });
  });

  it("never fills a field the profile reserves for a person", () => {
    // Both of these are assertions a researcher makes, not a model.
    expect(suggestDomain("rice sequencing")).not.toHaveProperty(
      "domain_metadata.biosafety_reviewed",
    );
    expect(
      suggestDomain("household survey").domain_metadata,
    ).not.toHaveProperty("consent_obtained");
  });

  it("only ever suggests keys the chosen profile declares", () => {
    // It may leave a required field for the researcher — that's the point, it
    // then shows up on the readiness list. What it must never do is invent a
    // key, which the strict profile would reject forever.
    [
      "rice sequencing",
      "household survey",
      "gis coordinate",
      "a study",
    ].forEach((text) => {
      const { domain, domain_metadata } = suggestDomain(text);
      expect(foreignDomainKeys(domain, domain_metadata)).toEqual([]);
    });
  });

  it("leaves a required field it cannot answer for the researcher", () => {
    const { domain_metadata } = suggestDomain("satellite mapping study");
    expect(validateDomainMetadata("geospatial", domain_metadata).success).toBe(
      false,
    );
    expect(domain_metadata).not.toHaveProperty("coordinate_system");
  });
});
