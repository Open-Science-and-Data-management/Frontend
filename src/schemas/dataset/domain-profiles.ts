import { z } from "zod";
import type { FieldPermission } from "@/config/field-policy";

/**
 * Research domains a dataset can belong to.
 *
 * This is a different axis from `type`: `type` says what the output *is*
 * (raw / software / publication), `domain` says what field it comes from. One
 * dataset carries both — raw data from the life sciences, say.
 */
export const DomainKeyEnum = z.enum([
  "generic",
  "life_sciences",
  "social_science",
  "geospatial",
  "physical_sciences",
]);

export type DomainKey = z.infer<typeof DomainKeyEnum>;

export type DomainFieldType =
  "text" | "textarea" | "number" | "select" | "date" | "toggle";

export interface DomainField {
  key: string;
  label: string;
  type: DomainFieldType;
  required?: boolean;
  /** For `select`; the stored value must be one of these. */
  options?: string[];
  /** Shown under the input. */
  help?: string;
  /**
   * Defaults to AI-draftable. A profile marks its own policy-bearing fields
   * human-owned, so adding a domain never means editing field-policy too.
   */
  permission?: FieldPermission;
}

export interface DomainProfile {
  key: DomainKey;
  label: string;
  description: string;
  fields: DomainField[];
  /** Strict: a value from another domain's profile is a validation failure. */
  schema: z.ZodType<Record<string, unknown>>;
}

const fieldSchema = (field: DomainField): z.ZodTypeAny => {
  switch (field.type) {
    case "number":
      return z.coerce.number();
    case "toggle":
      return z.boolean();
    case "date":
      return z.coerce.date();
    case "select":
      return field.options?.length
        ? z.enum(field.options as [string, ...string[]])
        : z.string();
    default:
      return field.required
        ? z.string().min(1, `${field.label} is required`)
        : z.string();
  }
};

/**
 * The profile's schema is derived from its own field list, so the two can
 * never drift: declare a field and it is both rendered and validated.
 */
const schemaFor = (fields: DomainField[]) =>
  z
    .object(
      Object.fromEntries(
        fields.map((field) => [
          field.key,
          field.required ? fieldSchema(field) : fieldSchema(field).optional(),
        ]),
      ),
    )
    .strict();

const profile = (
  key: DomainKey,
  label: string,
  description: string,
  fields: DomainField[],
): DomainProfile => ({
  key,
  label,
  description,
  fields,
  schema: schemaFor(fields) as z.ZodType<Record<string, unknown>>,
});

export const domainProfiles: Record<DomainKey, DomainProfile> = {
  generic: profile(
    "generic",
    "Generic",
    "Core fields only — nothing domain-specific to record.",
    [],
  ),

  // The domain this project is built around, so it's the one filled out.
  life_sciences: profile(
    "life_sciences",
    "Life sciences",
    "Organisms, samples and the instruments that read them.",
    [
      {
        key: "organism",
        label: "Organism",
        type: "text",
        required: true,
        help: "Species or cultivar the data describes, e.g. Oryza sativa IR64.",
      },
      {
        key: "sequencing_platform",
        label: "Sequencing platform",
        type: "select",
        options: ["Illumina", "Oxford Nanopore", "PacBio", "Sanger", "Other"],
      },
      {
        key: "assay_type",
        label: "Assay type",
        type: "select",
        options: ["WGS", "RNA-seq", "Amplicon / 16S", "Genotyping", "Other"],
      },
      { key: "sample_count", label: "Number of samples", type: "number" },
      {
        key: "collection_date",
        label: "Collected on",
        type: "date",
        help: "When the samples were taken.",
      },
      {
        key: "protocol_notes",
        label: "Protocol notes",
        type: "textarea",
        help: "Extraction, library prep, anything a reuser would need.",
      },
      {
        key: "biosafety_reviewed",
        label: "Biosafety reviewed",
        type: "toggle",
        // A compliance claim: the researcher says this, never the model.
        permission: "human",
        help: "Tick only once the biosafety review has actually happened.",
      },
    ],
  ),

  // Deliberately thin — enough to prove the registry drives the UI on its
  // own. Fill these out when a project actually needs them.
  social_science: profile(
    "social_science",
    "Social science",
    "Who the data is about and how it was gathered.",
    [
      {
        key: "population",
        label: "Population studied",
        type: "text",
        required: true,
        help: "Who the data describes, e.g. smallholder rice farmers in Nan.",
      },
      { key: "sample_size", label: "Sample size", type: "number" },
      {
        key: "collection_instrument",
        label: "Collection instrument",
        type: "select",
        options: [
          "Survey",
          "Interview",
          "Observation",
          "Administrative records",
          "Other",
        ],
      },
      {
        key: "consent_obtained",
        label: "Participant consent obtained",
        type: "toggle",
        permission: "human",
      },
    ],
  ),

  geospatial: profile(
    "geospatial",
    "Geospatial",
    "Where the data sits on the ground.",
    [
      {
        key: "coordinate_system",
        label: "Coordinate system",
        type: "text",
        required: true,
        help: "EPSG code or CRS name, e.g. EPSG:4326.",
      },
      {
        key: "bounding_box",
        label: "Bounding box",
        type: "text",
        help: "minLon, minLat, maxLon, maxLat.",
      },
      {
        key: "spatial_resolution",
        label: "Spatial resolution",
        type: "text",
        help: "e.g. 10 m, or 1:50,000.",
      },
    ],
  ),

  physical_sciences: profile(
    "physical_sciences",
    "Physical sciences",
    "What measured it, and under what conditions.",
    [
      { key: "instrument", label: "Instrument", type: "text" },
      {
        key: "measurement_conditions",
        label: "Measurement conditions",
        type: "textarea",
        help: "Temperature, pressure, calibration — whatever the reading depends on.",
      },
    ],
  ),
};

/** Always resolves: anything unrecognised is treated as generic. */
export const getDomainProfile = (domain?: string): DomainProfile =>
  domainProfiles[(domain ?? "generic") as DomainKey] ?? domainProfiles.generic;

export const validateDomainMetadata = (
  domain: string | undefined,
  metadata: unknown,
) => getDomainProfile(domain).schema.safeParse(metadata ?? {});

/** Keys the given domain has no field for — what a domain switch must drop. */
export const foreignDomainKeys = (
  domain: string | undefined,
  metadata: Record<string, unknown> = {},
): string[] => {
  const known = new Set(getDomainProfile(domain).fields.map((f) => f.key));
  return Object.keys(metadata).filter((key) => !known.has(key));
};
