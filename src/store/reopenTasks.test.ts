import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { useDmpStore } from "@/store/dmpStore";
import { useTaskStore } from "@/store/taskStore";
import { installPlanEffects } from "@/store/planEffects";
import type { DmpDraft } from "@/types/dmp";
import type { Dataset } from "@/types/dataset";
import type { Task } from "@/types/task";

const uninstall = installPlanEffects();
afterAll(uninstall);

const output = (id: string, title: string): Dataset =>
  ({
    dataset_id: id,
    type: "raw",
    title,
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
  }) as Dataset;
const plan = (datasets: Dataset[]): DmpDraft => ({
  project_id: "proj-1",
  title: "Rice",
  description: "d",
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
  dataset: datasets,
  schema_version: "v3.0",
});
const task = (
  id: string,
  datasetId: string,
  status: Task["status"],
  checklist: Task["checklist"] = [],
): Task =>
  ({
    task_id: id,
    dmp_id: "p",
    dataset_id: datasetId,
    title: id,
    lifecycle_stage: "collect",
    status,
    priority: "medium",
    generated_by: "ai",
    progress_percent: 0,
    checklist,
    evidence: { type: "none" },
  }) as Task;

const d = () => useDmpStore.getState();
const t = () => useTaskStore.getState();
const byId = (id: string) => t().tasks.find((x) => x.task_id === id)!;
const approver = { name: "Prof. Mali Chaiyasit", position: "Chair" };
const reads = output("ds-reads", "Reads");
const paper = output("ds-paper", "Paper");

beforeEach(() => {
  localStorage.clear();
  useTaskStore.setState({ tasks: [], reopenOffers: [] });
  useDmpStore.setState({
    draft: plan([reads, paper]),
    status: "draft",
    currentDmpId: "p",
    dmps: [],
  });
  d().submitForApproval();
  d().approve(approver);
  useTaskStore.setState({
    tasks: [
      task("t-started", "ds-paper", "in_progress", [
        { item_id: "s", label: "Draft", done: true },
      ]),
      task("t-todo", "ds-paper", "todo"),
      task("t-reads", "ds-reads", "todo"),
    ],
  });
  // v2 removes the paper; its tasks are cancelled when that's approved.
  useDmpStore.setState({ draft: plan([reads]) });
  d().submitRevision();
  d().approve(approver);
});

const bringBack = (datasets: Dataset[]) => {
  useDmpStore.setState({ draft: plan(datasets) });
  d().submitRevision();
  d().approve(approver);
};

describe("cancelling records what it replaced", () => {
  it("keeps each task's previous status, the reason, and the output's title", () => {
    expect(byId("t-started")).toMatchObject({
      status: "cancelled",
      cancelled_from: "in_progress",
      cancel_reason: "output_removed",
      cancelled_dataset_title: "Paper",
    });
    expect(byId("t-todo").cancelled_from).toBe("todo");
  });
});

describe("when the output comes back", () => {
  it("offers to reopen — and reopens nothing by itself", () => {
    bringBack([reads, paper]);
    expect(byId("t-started").status).toBe("cancelled");
    expect(byId("t-todo").status).toBe("cancelled");
    expect(t().reopenOffers).toHaveLength(1);
    expect(
      t().reopenOffers[0].items.map((i) => [i.task_id, i.restore_to]),
    ).toEqual([
      ["t-started", "in_progress"],
      ["t-todo", "todo"],
    ]);
  });

  it("reopens only what's chosen, each to the status it had", () => {
    bringBack([reads, paper]);
    const offer = t().reopenOffers[0];
    expect(t().reopenFromOffer(offer.offer_id, ["t-started"])).toBe(1);
    expect(byId("t-started").status).toBe("in_progress"); // not a blanket "todo"
    expect(byId("t-started").checklist[0].done).toBe(true);
    expect(byId("t-started").cancel_reason).toBeUndefined();
    expect(byId("t-todo").status).toBe("cancelled"); // not chosen: stays
    expect(t().reopenOffers).toHaveLength(0); // answered, so closed
  });

  it("relinks to the output when it returns under a new id", () => {
    bringBack([reads, output("ds-paper-v2", "Paper")]);
    const item = t().reopenOffers[0].items.find(
      (i) => i.task_id === "t-started",
    )!;
    expect(item).toMatchObject({ relink_to: "ds-paper-v2", relinked: true });
    t().reopenFromOffer(t().reopenOffers[0].offer_id, ["t-started"]);
    expect(byId("t-started").dataset_id).toBe("ds-paper-v2");
    expect(d().datasetExists("p", byId("t-started").dataset_id as string)).toBe(
      true,
    );
  });

  it("doesn't offer tasks someone cancelled by hand", () => {
    t().cancelTask("t-reads");
    expect(byId("t-reads").cancel_reason).toBe("manual");
    bringBack([reads, paper]);
    expect(t().reopenOffers[0].items.map((i) => i.task_id)).not.toContain(
      "t-reads",
    );
  });

  it("leaves everything cancelled when the offer is declined", () => {
    bringBack([reads, paper]);
    t().dismissReopenOffer(t().reopenOffers[0].offer_id);
    expect(byId("t-started").status).toBe("cancelled");
    expect(t().reopenOffers).toHaveLength(0);
  });
});
