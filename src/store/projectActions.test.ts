import { beforeEach, describe, expect, it } from "vitest";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import { deleteProject } from "@/store/projectActions";
import { planModeOf } from "@/config/plan-mode";

const plan = {
  project_id: "proj-2",
  title: "Sediment",
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
  dataset: [],
  schema_version: "v3.0",
};
const seededProjects = useProjectStore.getState().projects;
const record = () =>
  useDmpStore.getState().dmps.find((d) => d.dmp_id === "dmp-sed");

beforeEach(() => {
  localStorage.clear();
  // One test deletes proj-2 on purpose; put the projects back each time.
  useProjectStore.setState({ projects: seededProjects });
  useDmpStore.setState({
    draft: plan as never,
    status: "draft",
    currentDmpId: "dmp-sed",
    dmps: [],
  });
});

describe("a plan keeps the mode it was submitted under", () => {
  it("pins the project's mode at first submission", () => {
    useDmpStore.getState().finalize(); // proj-2 is independent
    expect(record()?.plan_mode).toBe("independent");
  });

  it("stays independent even if its project disappears", () => {
    useDmpStore.getState().finalize();
    // Bypassing the guard on purpose, as old data or a future bug might.
    useProjectStore.getState().removeProject("proj-2");
    expect(planModeOf(record(), useProjectStore.getState().projects)).toBe(
      "independent",
    );
  });

  it("stays put if its project's mode is changed afterwards", () => {
    useDmpStore.getState().submitForApproval();
    useProjectStore
      .getState()
      .updateProject("proj-2", { plan_mode: "institutional" });
    expect(record()?.plan_mode).toBe("independent");
  });
});

describe("deleting a project", () => {
  it("is refused while it has plans", () => {
    useDmpStore.getState().submitForApproval();
    const result = deleteProject("proj-2");
    expect(result.ok).toBe(false);
    expect(useProjectStore.getState().getProject("proj-2")).toBeDefined();
  });

  it("counts a plan still open in the editor", () => {
    expect(deleteProject("proj-2").ok).toBe(false);
  });

  it("goes ahead once nothing depends on it", () => {
    useDmpStore.setState({ draft: {}, currentDmpId: null, dmps: [] });
    const created = useProjectStore
      .getState()
      .createProject({ project_name: "Empty" });
    expect(deleteProject(created.project_id as string)).toEqual({ ok: true });
  });
});
