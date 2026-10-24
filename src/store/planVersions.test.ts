import { beforeEach, describe, expect, it } from "vitest";
import { outputsInForce, useDmpStore } from "@/store/dmpStore";
import { useNotificationStore } from "@/store/notificationStore";
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
      label: "Research output 1: Access",
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

describe("what an approved plan's edits cost", () => {
  beforeEach(() => {
    state().submitForApproval();
    state().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });
  });

  it("treats moving the timeline as major", () => {
    edit({ end_date: new Date("2027-06-30T00:00:00.000Z") });
    expect(state().pendingChanges()).toMatchObject([
      { label: "End date", edit_type: "major" },
    ]);
  });

  it("treats changing the ethics answer as major", () => {
    edit({ ethical_issues_exist: true });
    expect(state().pendingChanges()[0]).toMatchObject({
      label: "Ethical issues",
      edit_type: "major",
    });
  });

  it("keeps wording edits minor, so they apply without sign-off", () => {
    edit({ title: "Rice Genomics Data Management Plan" });
    state().saveMinorEdits();
    expect(record().versions).toHaveLength(1);
    expect(record().versions[0].minor_edits).toHaveLength(1);
  });
});

describe("the list shown before editing", () => {
  it("names every edit that needs sign-off again", async () => {
    const { majorTriggers } = await import("@/config/plan-diff");
    expect(majorTriggers()).toEqual(
      expect.arrayContaining([
        "Begin date",
        "End date",
        "Ethical issues",
        "Access of a research output",
        "Protection level of a research output",
        "Security classification of a research output",
        "Adding or removing a research output",
        "Repository of a research output",
        "Retention period of a research output",
        "Licence of a research output",
        "Any change to contributors",
      ]),
    );
  });
});

describe("isMajorTrigger is the only source of major", () => {
  it("compares every field the policy governs, so no flag can be ignored", async () => {
    const { COMPARED_KEYS } = await import("@/config/plan-diff");
    const { dmpFieldPolicy, datasetFieldPolicy } =
      await import("@/config/field-policy");
    Object.keys(dmpFieldPolicy)
      .filter((k) => k !== "schema_version")
      .forEach((key) => expect(COMPARED_KEYS.dmp).toContain(key));
    Object.keys(datasetFieldPolicy)
      .map((k) => k.split(".")[0])
      .forEach((key) => expect(COMPARED_KEYS.dataset).toContain(key));
  });

  it("shows exactly the flagged fields as needing sign-off, and nothing else", async () => {
    const { majorTriggers } = await import("@/config/plan-diff");
    const { dmpFieldPolicy, datasetFieldPolicy, planListPolicy } =
      await import("@/config/field-policy");
    const flagged = (policy: Record<string, { isMajorTrigger?: boolean }>) =>
      Object.entries(policy).filter(([, p]) => p.isMajorTrigger).length;
    expect(majorTriggers()).toHaveLength(
      flagged(dmpFieldPolicy) +
        flagged(datasetFieldPolicy) +
        flagged(planListPolicy),
    );
  });
});

describe("the agreed split", () => {
  beforeEach(() => {
    state().submitForApproval();
    state().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });
  });

  it.each([
    [
      "Indigenous considerations",
      { indigenous_considerations: "Samples from Moken land." },
    ],
  ])("%s is major", (label, patch) => {
    edit(patch as Partial<DmpDraft>);
    expect(state().pendingChanges()[0]).toMatchObject({
      label,
      edit_type: "major",
    });
  });

  it.each([
    ["Personal data", { personal_data: "yes" }],
    [
      "Personal data plan",
      { personal_data_plan: "Pseudonymised before analysis." },
    ],
  ])("a research output's %s is major", (label, patch) => {
    edit({ dataset: [output(patch as Partial<Dataset>)] });
    expect(state().pendingChanges()[0]).toMatchObject({
      label: `Research output 1: ${label}`,
      edit_type: "major",
    });
  });

  it("notices a change of contact, and sends it for sign-off", () => {
    edit({
      contributor: [
        {
          contributor_id: "c1",
          name: "Aran",
          role: "PI",
          email: "aran@example.edu",
          is_contact: false,
        },
        {
          contributor_id: "c2",
          name: "Mali",
          role: "Data steward",
          email: "mali@example.edu",
          is_contact: true,
        },
      ],
    });
    const changes = state().pendingChanges();
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every((c) => c.edit_type === "major")).toBe(true);
    expect(changes.map((c) => c.label)).toContain("Contributor added: Mali");

    // Not applied in place: it waits for a decision.
    state().saveMinorEdits();
    expect(record().versions[0].minor_edits).toHaveLength(0);
    expect(state().submitRevision()).toBe(true);
    expect(record().versions.at(-1)!.status).toBe("pending");
  });

  it.each([
    [
      "Repository",
      { preservation: { doi_requested: false, repository: "Zenodo" } },
    ],
    [
      "Retention period",
      { preservation: { doi_requested: false, duration: "15 years" } },
    ],
    [
      "Licence",
      { distribution: [{ title: "Reads", license: "CC-BY-4.0" }] as never },
    ],
  ])("a research output's %s is major", (_label, patch) => {
    edit({ dataset: [output(patch as Partial<Dataset>)] });
    expect(state().pendingChanges()[0].edit_type).toBe("major");
  });

  // The parts that carry a commitment are major; the rest of the same
  // object stays a wording fix.
  it.each([
    [
      "the preservation statement",
      { preservation: { doi_requested: false, statement: "Kept in Zenodo." } },
    ],
    [
      "a distribution's title",
      { distribution: [{ title: "Raw reads, v2" }] as never },
    ],
  ])("rewording %s stays minor", (_label, patch) => {
    edit({ dataset: [output(patch as Partial<Dataset>)] });
    const changes = state().pendingChanges();
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every((c) => c.edit_type === "minor")).toBe(true);
  });
});

describe("a batch with a major in it", () => {
  beforeEach(() => {
    state().submitForApproval();
    state().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });
    edit({
      title: "Rice Genomics DMP, revised",
      end_date: new Date("2027-06-30T00:00:00.000Z"),
    });
  });

  it("is major as a whole, while each change keeps its own label", async () => {
    const { editTypeOf } = await import("@/config/plan-diff");
    const changes = state().pendingChanges();
    expect(changes.map((c) => [c.label, c.edit_type])).toEqual([
      ["Title", "minor"],
      ["End date", "major"],
    ]);
    expect(editTypeOf(changes)).toBe("major");
  });

  it("can't have its minor half saved quietly", () => {
    state().saveMinorEdits();
    expect(record().versions[0].minor_edits).toHaveLength(0);
    expect(state().pendingChanges()).toHaveLength(2);
  });

  it("goes for sign-off together, as one major version", () => {
    state().submitRevision();
    const v2 = state().pendingVersion();
    expect(v2?.edit_type).toBe("major");
    expect(v2?.changes.map((c) => c.label)).toEqual(["Title", "End date"]);
  });
});

it("names a nested field the way the readiness list does", () => {
  state().submitForApproval();
  state().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });
  edit({
    dataset: [output(), output({ dataset_id: "ds-2", title: "Manuscript" })],
  });
  state().submitRevision();
  state().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });

  edit({
    dataset: [
      output(),
      output({
        dataset_id: "ds-2",
        title: "Manuscript",
        protection_level: "Protected B",
      }),
    ],
  });
  expect(state().pendingChanges()).toMatchObject([
    {
      path: "dataset[1].protection_level",
      label: "Research output 2: Protection level",
      from: "Standard",
      to: "Protected B",
      edit_type: "major",
    },
  ]);
});

describe("restoring a version", () => {
  const approver = { name: "Prof. Mali Chaiyasit", position: "Chair" };
  beforeEach(() => {
    state().submitForApproval();
    state().approve(approver);
  });

  it("discards unsubmitted edits by restoring the version in force", () => {
    edit({
      title: "Something else",
      end_date: new Date("2030-01-01T00:00:00.000Z"),
    });
    expect(state().pendingChanges()).toHaveLength(2);

    expect(state().restoreVersion(1)).toBe(true);
    expect(state().pendingChanges()).toEqual([]);
    expect(state().restoredFrom).toBeNull();
    // Nothing in force changed, so nothing new was recorded.
    expect(record().versions).toHaveLength(1);
  });

  it("copies the snapshot, so later edits never reach the record", () => {
    state().restoreVersion(1);
    edit({ title: "Edited after restore" });
    expect(record().versions[0].snapshot.title).toBe("Rice Genomics DMP");
  });

  it("keeps dates as dates", () => {
    edit({ end_date: new Date("2027-01-01T00:00:00.000Z") });
    state().restoreVersion(1);
    expect(state().draft.end_date).toBeUndefined(); // the approved plan had none
    edit({ begin_date: new Date("2026-02-01T00:00:00.000Z") });
    state().submitRevision();
    state().approve(approver);
    edit({ begin_date: new Date("2026-05-01T00:00:00.000Z") });
    state().restoreVersion(2);
    expect(state().draft.begin_date).toBeInstanceOf(Date);
  });

  it("reopens a sent-back revision so it can be fixed and resubmitted", () => {
    edit({ dataset: [output({ access: "open" })] });
    state().submitRevision();
    state().rejectRevision("Needs a sharing agreement.", approver);
    // Someone gives up and discards…
    state().restoreVersion(1);
    expect(state().pendingChanges()).toEqual([]);
    // …then thinks better of it and brings the rejected revision back.
    expect(state().restoreVersion(2)).toBe(true);
    expect(state().restoredFrom).toBe(2);
    expect(state().pendingChanges()[0]).toMatchObject({
      label: "Research output 1: Access",
      edit_type: "major",
    });
    state().submitRevision();
    expect(state().pendingVersion()).toMatchObject({
      number: 3,
      restored_from: 2,
    });
    expect(state().restoredFrom).toBeNull();
  });

  it("rolls back to an older approved version only through sign-off", () => {
    edit({ dataset: [output({ access: "open" })] });
    state().submitRevision();
    state().approve(approver); // v2 in force: open
    state().restoreVersion(1); // back to shared — a major change against v2
    expect(state().pendingChanges()[0]).toMatchObject({
      from: "open",
      to: "shared",
      edit_type: "major",
    });
    state().saveMinorEdits(); // the quiet path stays shut
    expect(record().active_version).toBe(2);
    state().submitRevision();
    state().approve(approver);
    expect(record().active_version).toBe(3);
    expect(record().versions.find((v) => v.number === 3)?.restored_from).toBe(
      1,
    );
  });

  it("records a minor-only restore against the version it amended", () => {
    edit({ title: "Rice Genomics DMP, reworded" });
    state().saveMinorEdits();
    state().restoreVersion(1); // v1's snapshot now holds the reworded title
    expect(state().pendingChanges()).toEqual([]);
  });

  it("won't restore a version still waiting on a decision", () => {
    edit({
      title: "Pending title",
      end_date: new Date("2030-01-01T00:00:00.000Z"),
    });
    state().submitRevision();
    expect(state().restoreVersion(2)).toBe(false);
    expect(state().restoreVersion(99)).toBe(false);
  });
});

describe("the committee deciding from its queue", () => {
  const notificationsFor = (userId: string, type: string) =>
    useNotificationStore
      .getState()
      .notifications.filter(
        (n) => n.user_id === userId && n.type === type && n.dmp_id === "dmp-x",
      );

  const mali = {
    user_id: "user-2",
    name: "Prof. Mali Chaiyasit",
    position: "Committee member",
    mbox: "mali@example.edu",
  };

  /** The researcher has moved on to a different plan in the editor. */
  const openOtherPlan = () => {
    const other: DmpDraft = { project_id: "proj-2", title: "Other plan" };
    useDmpStore.setState((s) => ({
      currentDmpId: "dmp-other",
      draft: other,
      status: "draft",
      dmps: [
        ...s.dmps,
        { ...s.dmps[0], dmp_id: "dmp-other", draft: other, versions: [] },
      ],
    }));
  };

  beforeEach(() => {
    useNotificationStore.setState({ notifications: [] });
  });

  it("records a brand-new plan in the library when it is submitted", () => {
    // Drafted this session and never checked in — not in `dmps` yet.
    useDmpStore.setState({ dmps: [] });
    state().submitForApproval();

    expect(record().status).toBe("pending");
    expect(record().versions).toHaveLength(1);
    expect(record().versions[0].status).toBe("pending");
  });

  it("puts a submission in front of every reviewer", () => {
    state().submitForApproval();
    expect(notificationsFor("user-2", "review_requested")).toHaveLength(1);
  });

  it("approves a plan that isn't the one open in the editor", () => {
    state().submitForApproval();
    openOtherPlan();

    expect(state().approveDmp("dmp-x", mali, "Looks good.")).toBe(true);

    expect(record()).toMatchObject({ status: "approved", active_version: 1 });
    expect(record().versions[0]).toMatchObject({
      status: "approved",
      decided_by: "user-2",
      approver: mali,
      note: "Looks good.",
    });
    // The researcher's editor is exactly as they left it.
    expect(state().currentDmpId).toBe("dmp-other");
    expect(state().draft.title).toBe("Other plan");
    expect(state().status).toBe("draft");
    expect(notificationsFor("user-1", "dmp_approved")).toHaveLength(1);
  });

  it("approves a revision from the queue through the same path", () => {
    state().submitForApproval();
    state().approve(mali);
    edit({ dataset: [output({ access: "open" })] });
    state().submitRevision();
    expect(notificationsFor("user-2", "review_requested")).toHaveLength(2);
    openOtherPlan();

    state().approveDmp("dmp-x", mali);

    expect(record().active_version).toBe(2);
    expect(record().versions[1]).toMatchObject({
      status: "approved",
      approver: mali,
    });
    expect(state().currentDmpId).toBe("dmp-other");
  });

  it("sends a first submission back to draft with the reason", () => {
    state().submitForApproval();
    state().returnDmp("dmp-x", mali, "Add a preservation statement.");

    expect(record().status).toBe("draft");
    expect(state().status).toBe("draft");
    expect(record().active_version).toBeUndefined();
    expect(record().versions[0]).toMatchObject({
      status: "rejected",
      decided_by: "user-2",
      note: "Add a preservation statement.",
    });
    expect(notificationsFor("user-1", "dmp_returned")).toHaveLength(1);
  });

  it("numbers the resubmission after the one that came back", () => {
    state().submitForApproval();
    state().returnDmp("dmp-x", mali, "Not yet.");
    state().submitForApproval();

    expect(record().versions.map((v) => [v.number, v.status])).toEqual([
      [1, "rejected"],
      [2, "pending"],
    ]);
  });

  it("does nothing when no version is waiting", () => {
    expect(state().approveDmp("dmp-x", mali)).toBe(false);
    expect(record().status).toBe("draft");
    expect(record().versions).toHaveLength(0);
  });
});

describe("tasks are drafted from the approved plan", () => {
  beforeEach(() => {
    edit({ dataset: [output()] });
    state().submitForApproval();
    state().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });
  });

  it("leaves out an output that's only in a revision waiting on a decision", () => {
    edit({
      dataset: [output(), output({ dataset_id: "ds-2", title: "Trait table" })],
    });
    expect(state().submitRevision()).toBe(true);

    expect(outputsInForce(record()).map((d) => d.dataset_id)).toEqual(["ds-1"]);
  });

  it("is empty for a plan with nothing in force", () => {
    expect(outputsInForce(undefined)).toEqual([]);
  });
});
