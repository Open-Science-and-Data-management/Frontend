import { beforeEach, describe, expect, it } from "vitest";
import { useDmpStore } from "@/store/dmpStore";
import type { DmpDraft } from "@/types/dmp";
import type { Dataset } from "@/types/dataset";

const output = (patch: Partial<Dataset> = {}): Dataset =>
  ({
    dataset_id: "ds-1",
    type: "raw",
    title: "Sequence reads",
    status: "planned",
    access: "shared",
    personal_data: "no",
    sensitive_data: "no",
    protection_level: "Standard",
    security_classification_level: "Internal",
    keyword: [],
    domain: "generic",
    domain_metadata: {},
    preservation: { doi_requested: false },
    distribution: [],
    schema_fields: [],
    ...patch,
  }) as Dataset;

const plan = (): DmpDraft => ({
  project_id: "proj-1",
  title: "Rice Genomics DMP",
  description: "Sequencing of local cultivars.",
  language: "eng",
  dataset: [output()],
  contributor: [],
});

const state = () => useDmpStore.getState();

const openPlan = () =>
  useDmpStore.setState({
    draft: plan(),
    status: "draft",
    currentDmpId: "dmp-x",
    dmps: [
      {
        dmp_id: "dmp-x",
        title: "Rice Genomics DMP",
        description: "",
        status: "draft",
        created_at: new Date(),
        updated_at: new Date(),
        dataset_count: 1,
        contributor_count: 0,
        tasks_generated: false,
        draft: plan(),
        versions: [],
      },
    ],
  });

const record = () => state().dmps.find((d) => d.dmp_id === "dmp-x")!;
const edit = (patch: Partial<DmpDraft>) =>
  useDmpStore.setState({ draft: { ...state().draft, ...patch } });

beforeEach(() => {
  localStorage.clear();
  openPlan();
});

describe("getting to the first active version", () => {
  it("submits as v1 and only becomes active on a decision", () => {
    state().submitForApproval();
    expect(record().versions).toHaveLength(1);
    expect(record().versions[0].status).toBe("pending");
    expect(record().active_version).toBeUndefined();

    state().approve();
    expect(record().versions[0].status).toBe("approved");
    expect(record().active_version).toBe(1);
    expect(state().status).toBe("approved");
  });

  it("lets an independent researcher finalize straight to active v1", () => {
    state().finalize();
    expect(record().active_version).toBe(1);
    expect(record().versions[0]).toMatchObject({
      number: 1,
      status: "approved",
    });
  });
});

describe("editing a plan that is already in force", () => {
  beforeEach(() => {
    state().submitForApproval();
    state().approve();
  });

  it("measures the working draft against the version in force", () => {
    edit({ description: "Sequencing of local and imported cultivars." });
    const changes = state().pendingChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      label: "Description",
      edit_type: "minor",
    });
  });

  it("applies a minor-only edit without raising a version", () => {
    edit({ description: "A clearer description." });
    state().saveMinorEdits();

    expect(record().versions).toHaveLength(1);
    expect(record().active_version).toBe(1);
    // Logged against the version it amended, and folded into its snapshot.
    expect(record().versions[0].minor_edits).toHaveLength(1);
    expect(record().versions[0].minor_edits[0].changes[0].label).toBe(
      "Description",
    );
    expect(state().pendingChanges()).toEqual([]);
  });

  it("calls a change to access major, because the policy does", () => {
    edit({ dataset: [output({ access: "open" })] });
    const changes = state().pendingChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      label: "Research output 1 — Access",
      from: "shared",
      to: "open",
      edit_type: "major",
    });
  });

  it("treats a new research output as major on its own", () => {
    edit({
      dataset: [output(), output({ dataset_id: "ds-2", title: "Manuscript" })],
    });
    const changes = state().pendingChanges();
    expect(changes.map((c) => c.edit_type)).toContain("major");
  });

  it("refuses to slip a major edit through the quiet path", () => {
    edit({ dataset: [output({ protection_level: "Restricted" })] });
    state().saveMinorEdits();

    // Nothing applied, nothing logged — it has to go round the long way.
    expect(record().versions[0].minor_edits).toHaveLength(0);
    expect(state().pendingChanges()).toHaveLength(1);
  });
});

describe("a revision in flight does not unseat the version in force", () => {
  beforeEach(() => {
    state().submitForApproval();
    state().approve();
    edit({ dataset: [output({ access: "open" })] });
    state().submitRevision();
  });

  it("parks v2 as pending while v1 keeps running", () => {
    expect(record().versions).toHaveLength(2);
    expect(state().pendingVersion()?.number).toBe(2);
    expect(record().active_version).toBe(1);
    // Tasks hang off this, so it must not wobble while review happens.
    expect(state().status).toBe("approved");
  });

  it("carries the reason back on a rejection and leaves v1 in force", () => {
    state().rejectRevision("Open access needs a data sharing agreement first.");

    const rejected = record().versions.find((v) => v.number === 2);
    expect(rejected?.status).toBe("rejected");
    expect(rejected?.note).toMatch(/sharing agreement/);
    expect(record().active_version).toBe(1);
    expect(state().pendingVersion()).toBeUndefined();
  });

  it("moves the plan onto v2 when the decision goes the other way", () => {
    state().approve();
    expect(record().active_version).toBe(2);
    expect(record().versions.find((v) => v.number === 2)?.status).toBe(
      "approved",
    );
    expect(record().versions.find((v) => v.number === 2)?.decided_by).toBe(
      "committee",
    );
    // Measured against the new version in force, nothing is outstanding.
    expect(state().pendingChanges()).toEqual([]);
  });

  it("numbers the next attempt after a rejection", () => {
    state().rejectRevision("Not yet.");
    edit({ dataset: [output({ access: "closed" })] });
    state().submitRevision();

    expect(state().pendingVersion()?.number).toBe(3);
  });
});
