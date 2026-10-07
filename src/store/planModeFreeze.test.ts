import { describe, expect, it } from "vitest";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import { storageKey } from "@/store/persist";
import { freezeSubmittedModes, planModeOf } from "@/config/plan-mode";

const seeded = (id: string) =>
  useDmpStore.getState().dmps.find((d) => d.dmp_id === id);

describe("plans submitted before modes were frozen", () => {
  it("are frozen from the seed: submitted plans carry their mode, drafts don't", () => {
    expect(seeded("dmp-pollinator")?.plan_mode).toBe("institutional");
    expect(seeded("dmp-sediment")?.plan_mode).toBe("independent");
    expect(seeded("dmp-sensor-pilot")?.plan_mode).toBeUndefined();
  });

  it("keep their mode when the project goes — finding 3, on an old plan", () => {
    const projects = useProjectStore.getState().projects;
    useProjectStore.getState().removeProject("proj-2"); // the low-level path
    expect(
      planModeOf(seeded("dmp-sediment"), useProjectStore.getState().projects),
    ).toBe("independent");
    useProjectStore.setState({ projects });
  });

  it("are frozen when plans saved by an older version load", async () => {
    const legacy = {
      dmp_id: "dmp-legacy",
      project_id: "proj-2",
      title: "Saved last month",
      description: "",
      status: "approved",
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-02T00:00:00.000Z",
      dataset_count: 0,
      contributor_count: 0,
      tasks_generated: false,
      draft: {},
      versions: [],
      active_version: 1,
    };
    localStorage.setItem(
      storageKey("dmps"),
      JSON.stringify({ state: { dmps: [legacy] }, version: 1 }),
    );
    await useDmpStore.persist.rehydrate();
    expect(seeded("dmp-legacy")?.plan_mode).toBe("independent");
  });
});

describe("freezeSubmittedModes", () => {
  const projects = useProjectStore.getState().projects;
  it("fills only what's missing on submitted plans", () => {
    const out = freezeSubmittedModes(
      [
        { status: "draft", project_id: "proj-2" },
        { status: "pending", project_id: "proj-2" },
        {
          status: "approved",
          project_id: "proj-2",
          plan_mode: "institutional" as const,
        },
      ],
      projects,
    );
    expect(out.map((r) => r.plan_mode)).toEqual([
      undefined,
      "independent",
      "institutional", // an existing freeze is never overwritten
    ]);
  });
});
