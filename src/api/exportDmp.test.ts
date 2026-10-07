import { beforeEach, describe, expect, it } from "vitest";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import madmpStandard from "@/schemas/madmp/vendor/GCWG-RDA-maDMP-schema_v3.0.json";
import rdaStandard from "@/schemas/rda/vendor/RDA-DMP-Common-Standard_v1.3.json";
import { buildExport } from "@/api/exportDmp";
import { useDmpStore } from "@/store/dmpStore";
import type { DmpDraft } from "@/types/dmp";

const madmp = addFormats(new Ajv({ strict: false, allErrors: true })).compile(
  madmpStandard,
);
const rda = addFormats(new Ajv2020({ strict: false, allErrors: true })).compile(
  rdaStandard,
);

const plan = (): DmpDraft => ({
  project_id: "proj-1",
  title: "Rice Genomics DMP",
  description: "Sequencing of local cultivars.",
  language: "eng",
  begin_date: new Date("2026-01-01T00:00:00.000Z"),
  end_date: new Date("2026-12-31T00:00:00.000Z"),
  ethical_issues_exist: false,
  contributor: [
    {
      contributor_id: "c1",
      name: "Aran",
      surname: "Suwannachot",
      role: "Principal Investigator",
      email: "aran@example.edu",
      is_contact: true,
    },
  ],
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
      protection_level: "Protected A",
      security_classification_level: "restricted",
      keyword: ["rice"],
      domain: "life_sciences",
      domain_metadata: { organism: "Oryza sativa" },
      preservation: { doi_requested: false },
      distribution: [],
      schema_fields: [],
    },
  ],
  schema_version: "v3.0",
});

const state = () => useDmpStore.getState();
const record = () => state().dmps.find((d) => d.dmp_id === "dmp-rice");

beforeEach(() => {
  localStorage.clear();
  useDmpStore.setState({
    draft: plan(),
    status: "draft",
    currentDmpId: "dmp-rice",
    dmps: [
      {
        dmp_id: "dmp-rice",
        title: "Rice Genomics DMP",
        description: "",
        status: "draft",
        created_at: new Date("2026-01-05T00:00:00.000Z"),
        updated_at: new Date("2026-01-06T00:00:00.000Z"),
        dataset_count: 1,
        contributor_count: 1,
        tasks_generated: false,
        draft: plan(),
        versions: [],
      },
    ],
  });
});

const exportAs = (format: "madmp" | "rda") =>
  buildExport(format, {
    draft: state().draft,
    status: state().status,
    record: record(),
    dmpId: "dmp-rice",
    planMode: "institutional",
    projectName: "Rice Genomics",
  });

describe("an approved plan, exported", () => {
  beforeEach(() => {
    state().submitForApproval();
    state().approve({
      user_id: "user-2",
      name: "Prof. Mali Chaiyasit",
      position: "Committee chair",
      mbox: "mali@example.edu",
    });
  });

  it("stores who approved, on the version they approved", () => {
    expect(record()?.versions[0].approver).toEqual({
      user_id: "user-2",
      name: "Prof. Mali Chaiyasit",
      position: "Committee chair",
      mbox: "mali@example.edu",
    });
  });

  it("names them in the maDMP approval block, and validates", () => {
    const result = exportAs("madmp");
    if (!result.ok) throw new Error(result.reason);
    const doc = JSON.parse(result.json);
    expect(madmp(doc)).toBe(true);
    expect(doc.dmp.approval).toMatchObject({
      status: "approved",
      by_name: "Prof. Mali Chaiyasit",
      by_position: "Committee chair",
      by_mbox: "mali@example.edu",
    });
    expect(result.filename).toBe("rice-genomics-dmp-madmp-v3.0.json");
  });

  it("validates as RDA too", () => {
    const result = exportAs("rda");
    if (!result.ok) throw new Error(result.reason);
    expect(rda(JSON.parse(result.json))).toBe(true);
    expect(result.filename).toBe("rice-genomics-dmp-rda-1.3.json");
  });
});

describe("the decision trail", () => {
  it("records who sent a revision back", () => {
    state().submitForApproval();
    state().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });
    useDmpStore.setState({
      draft: {
        ...state().draft,
        dataset: [{ ...state().draft.dataset![0], access: "open" }],
      },
    });
    state().submitRevision();
    state().rejectRevision("Needs a sharing agreement.", {
      name: "Dr. Somchai Rattana",
      position: "Committee member",
    });

    const v2 = record()?.versions.find((v) => v.number === 2);
    expect(v2?.status).toBe("rejected");
    expect(v2?.approver?.name).toBe("Dr. Somchai Rattana");
    // The version in force keeps its own approver.
    expect(record()?.versions[0].approver?.name).toBe("Prof. Mali Chaiyasit");
  });
});

it("refuses an incomplete plan rather than export it half-valid", () => {
  useDmpStore.setState({ draft: { title: "Half a plan" } });
  const result = exportAs("madmp");
  expect(result.ok).toBe(false);
});

it("keeps the history of a plan not yet filed in the library", () => {
  // A plan fresh from analysis is open in the editor but absent from `dmps`.
  useDmpStore.setState({ dmps: [] });
  state().submitForApproval();
  state().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });

  expect(record()?.active_version).toBe(1);
  expect(record()?.versions[0].approver?.name).toBe("Prof. Mali Chaiyasit");
});

it("exports a plan approved before versions were kept", () => {
  // Approved, but no version on record: the decision date falls back.
  useDmpStore.setState({ status: "approved" });
  const result = exportAs("madmp");
  if (!result.ok) throw new Error(result.reason);
  const doc = JSON.parse(result.json);
  expect(madmp(doc)).toBe(true);
  expect(doc.dmp.approval.description).toMatch(/not recorded/);
});

describe("what an export describes", () => {
  beforeEach(() => {
    state().submitForApproval();
    state().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });
  });

  it("is the version in force, not unapproved edits in the draft", () => {
    // A major edit nobody has approved yet.
    useDmpStore.setState({
      draft: {
        ...state().draft,
        dataset: [
          { ...state().draft.dataset![0], protection_level: "Protected C" },
        ],
      },
    });
    const result = exportAs("madmp");
    if (!result.ok) throw new Error(result.reason);
    const doc = JSON.parse(result.json);
    expect(doc.dmp.approval.status).toBe("approved");
    expect(doc.dmp.general_info.protection_level).toBe("Protected A");
  });

  it("still excludes a revision while it waits on the committee", () => {
    useDmpStore.setState({
      draft: { ...state().draft, title: "Rice Genomics DMP, revised" },
    });
    state().submitRevision();
    const result = exportAs("rda");
    if (!result.ok) throw new Error(result.reason);
    expect(JSON.parse(result.json).dmp.title).toBe("Rice Genomics DMP");
  });

  it("includes minor edits once saved, since they're applied to the version", () => {
    useDmpStore.setState({
      draft: { ...state().draft, title: "Rice Genomics DMP (wording)" },
    });
    state().saveMinorEdits();
    const result = exportAs("rda");
    if (!result.ok) throw new Error(result.reason);
    expect(JSON.parse(result.json).dmp.title).toBe(
      "Rice Genomics DMP (wording)",
    );
  });

  it("exports an incomplete working draft fine while the version in force is complete", () => {
    useDmpStore.setState({ draft: { ...state().draft, title: "" } });
    expect(exportAs("madmp").ok).toBe(true);
  });
});
