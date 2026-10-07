import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { useDmpStore } from "@/store/dmpStore";
import { useTaskStore } from "@/store/taskStore";
import { installPlanEffects } from "@/store/planEffects";
import type { DmpDraft } from "@/types/dmp";
import type { Dataset } from "@/types/dataset";

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
  begin_date: new Date("2026-01-01"),
  end_date: new Date("2026-12-31"),
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

const d = () => useDmpStore.getState();
const taskFor = (datasetId: string) =>
  useTaskStore.getState().tasks.find((t) => t.dataset_id === datasetId);

beforeEach(() => {
  localStorage.clear();
  useDmpStore.setState({
    draft: plan([output("ds-reads", "Reads"), output("ds-paper", "Paper")]),
    status: "draft",
    currentDmpId: "dmp-rice",
    dmps: [],
  });
  d().submitForApproval();
  d().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });
  useTaskStore.setState({
    tasks: ["ds-reads", "ds-paper"].map((id) => ({
      task_id: `t-${id}`,
      dmp_id: "dmp-rice",
      dataset_id: id,
      title: id,
      lifecycle_stage: "collect",
      status: "todo",
      priority: "medium",
      generated_by: "ai",
      progress_percent: 0,
      checklist: [],
      evidence: { type: "none" },
    })) as never,
  });
  // Remove the paper in the editor: a major change, only proposed.
  useDmpStore.setState({ draft: plan([output("ds-reads", "Reads")]) });
});

describe("removing an output from a plan in force", () => {
  it("leaves its tasks running while the removal waits on a decision", () => {
    d().submitRevision();
    expect(taskFor("ds-paper")?.status).toBe("todo");
    // And the output still counts as existing — it's in the version in force.
    expect(d().datasetExists("dmp-rice", "ds-paper")).toBe(true);
  });

  it("keeps them running if the removal is sent back", () => {
    d().submitRevision();
    d().rejectRevision("Keep the paper.", {
      name: "Prof. Mali Chaiyasit",
      position: "Chair",
    });
    expect(taskFor("ds-paper")?.status).toBe("todo");
  });

  it("cancels them — not deletes — once the removal is in force", () => {
    d().submitRevision();
    d().approve({ name: "Prof. Mali Chaiyasit", position: "Chair" });
    expect(taskFor("ds-paper")?.status).toBe("cancelled");
    expect(taskFor("ds-reads")?.status).toBe("todo");
    expect(d().datasetExists("dmp-rice", "ds-paper")).toBe(false);
  });
});
