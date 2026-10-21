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
    protection_level: "Protected A",
    security_classification_level: "restricted",
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
  description: "Sequencing.",
  language: "eng",
  begin_date: new Date("2026-01-01T00:00:00.000Z"),
  end_date: new Date("2026-12-31T00:00:00.000Z"),
  ethical_issues_exist: false,
  contributor: [
    {
      contributor_id: "c1",
      name: "A",
      role: "PI",
      email: "a@x.org",
      is_contact: true,
    },
  ],
  cost: [],
  dataset: [output()],
  schema_version: "v3.0",
});

const s = () => useDmpStore.getState();
const rec = () => s().dmps.find((d) => d.dmp_id === "p")!;
const v = (n: number) => rec().versions.find((x) => x.number === n)!;
const edit = (patch: Partial<DmpDraft>) =>
  useDmpStore.setState({ draft: { ...s().draft, ...patch } });
const approver = { name: "Prof. Mali Chaiyasit", position: "Chair" };

beforeEach(() => {
  localStorage.clear();
  useDmpStore.setState({
    draft: plan(),
    status: "draft",
    currentDmpId: "p",
    dmps: [],
  });
});

describe("A — Cancel on a plan waiting for its first decision", () => {
  it("keeps the submission with the committee, dropping only later edits", () => {
    s().submitForApproval();
    edit({ title: "Edited after submitting" });
    expect(s().closeDraft()).toBe("kept");
    expect(rec().archived_at).toBeUndefined();
    expect(rec().status).toBe("pending");
    expect(v(1).status).toBe("pending");
    expect(rec().draft.title).toBe("Rice Genomics DMP");
  });
});

describe("B — one revision waits at a time", () => {
  beforeEach(() => {
    s().submitForApproval();
    s().approve(approver);
    edit({ dataset: [output({ access: "open" })] });
    expect(s().submitRevision()).toBe(true);
  });

  it("refuses a second submission while one is pending", () => {
    edit({ dataset: [output({ access: "closed" })] });
    expect(s().submitRevision()).toBe(false);
    expect(rec().versions.filter((x) => x.status === "pending")).toHaveLength(
      1,
    );
  });

  it("accepts the next one once the first is decided", () => {
    s().approve(approver);
    edit({ dataset: [output({ access: "closed" })] });
    expect(s().submitRevision()).toBe(true);
    expect(s().pendingVersion()?.number).toBe(3);
  });

  it("records the version it was built on", () => {
    expect(v(2).based_on?.number).toBe(1);
    expect(v(2).based_on?.snapshot.dataset?.[0].access).toBe("shared");
  });
});

describe("C — a minor fix while a revision waits", () => {
  beforeEach(() => {
    s().submitForApproval();
    s().approve(approver);
    // v2: a major change, now with the committee.
    edit({ dataset: [output({ access: "open" })] });
    s().submitRevision();
    // Then a typo spotted in the description.
    edit({ description: "Sequencing of local cultivars." });
  });

  it("counts only the fix as new — not the revision already submitted", () => {
    expect(
      s()
        .newEdits()
        .map((c) => [c.label, c.edit_type]),
    ).toEqual([["Description", "minor"]]);
  });

  it("lands on the version in force, leaving the waiting revision frozen", () => {
    s().saveMinorEdits();
    expect(v(1).snapshot.description).toBe("Sequencing of local cultivars.");
    // v1 doesn't pick up v2's unapproved change…
    expect(v(1).snapshot.dataset?.[0].access).toBe("shared");
    // …and v2 is untouched.
    expect(v(2).snapshot.description).toBe("Sequencing.");
    expect(v(1).minor_edits.at(-1)?.during_pending).toBe(2);
  });

  it("is carried into the revision when it's approved, so the fix isn't lost", () => {
    s().saveMinorEdits();
    s().approve(approver);
    expect(rec().active_version).toBe(2);
    expect(v(2).snapshot.description).toBe("Sequencing of local cultivars.");
    expect(v(2).snapshot.dataset?.[0].access).toBe("open");
    expect(v(2).carried_minor_edits?.map((c) => c.label)).toEqual([
      "Description",
    ]);
    // Measured against the merged version, nothing is outstanding.
    expect(s().pendingChanges()).toEqual([]);
  });

  it("stays on the version in force if the revision is sent back", () => {
    s().saveMinorEdits();
    s().rejectRevision("Not yet.", approver);
    expect(rec().active_version).toBe(1);
    expect(v(1).snapshot.description).toBe("Sequencing of local cultivars.");
  });

  it("still refuses a major edit through the quiet path", () => {
    edit({ end_date: new Date("2030-01-01T00:00:00.000Z") });
    s().saveMinorEdits();
    expect(v(1).minor_edits.filter((e) => e.during_pending)).toHaveLength(0);
  });

  it("merges by output id, even when the revision reordered the outputs", () => {
    // Reset: v2 adds an output in front, then the fix is to the original one.
    localStorage.clear();
    useDmpStore.setState({
      draft: plan(),
      status: "draft",
      currentDmpId: "p",
      dmps: [],
    });
    s().submitForApproval();
    s().approve(approver);
    edit({
      dataset: [
        output({ dataset_id: "ds-new", title: "Manuscript" }),
        output(),
      ],
    });
    s().submitRevision();
    edit({
      dataset: [
        output({ dataset_id: "ds-new", title: "Manuscript" }),
        output({ title: "Sequence reads (FASTQ)" }),
      ],
    });
    s().saveMinorEdits();
    s().approve(approver);
    const titles = Object.fromEntries(
      (v(2).snapshot.dataset ?? []).map((d) => [d.dataset_id, d.title]),
    );
    expect(titles).toEqual({
      "ds-new": "Manuscript",
      "ds-1": "Sequence reads (FASTQ)",
    });
  });

  it("reports, rather than loses, a fix to an output the revision removed", () => {
    localStorage.clear();
    useDmpStore.setState({
      draft: {
        ...plan(),
        dataset: [output(), output({ dataset_id: "ds-2", title: "Paper" })],
      },
      status: "draft",
      currentDmpId: "p",
      dmps: [],
    });
    s().submitForApproval();
    s().approve(approver);
    edit({ dataset: [output()] }); // v2 removes ds-2
    s().submitRevision();
    // A fix to ds-2 can't be made through the draft (it isn't there), so make
    // it on v1 directly, as a fix saved from elsewhere would be.
    useDmpStore.setState((st) => ({
      dmps: st.dmps.map((d) => ({
        ...d,
        versions: d.versions.map((x) =>
          x.number === 1
            ? {
                ...x,
                snapshot: {
                  ...x.snapshot,
                  dataset: [
                    output(),
                    output({ dataset_id: "ds-2", title: "Paper (final)" }),
                  ],
                },
              }
            : x,
        ),
      })),
    }));
    s().approve(approver);
    expect(v(2).dropped_minor_edits?.map((c) => c.label)).toEqual([
      "Research output 2: Title",
    ]);
  });
});

describe("the working copy after a revision is approved", () => {
  beforeEach(() => {
    s().submitForApproval();
    s().approve(approver);
    edit({ dataset: [output({ access: "open" })] });
    s().submitRevision();
  });

  it("isn't left reading as an edit that undoes the approved change", () => {
    // Discard while waiting: the working copy goes back to v1, without v2.
    s().restoreVersion(1);
    s().approve(approver);
    expect(s().draft.dataset?.[0].access).toBe("open");
    expect(s().pendingChanges()).toEqual([]);
  });

  it("keeps edits nobody has saved or submitted yet", () => {
    edit({ title: "Rice Genomics DMP — draft wording" }); // not saved
    s().approve(approver);
    expect(s().draft.title).toBe("Rice Genomics DMP — draft wording");
    expect(s().draft.dataset?.[0].access).toBe("open");
    expect(
      s()
        .pendingChanges()
        .map((c) => c.label),
    ).toEqual(["Title"]);
  });
});
