import React from "react";
import { planModeOf } from "@/config/plan-mode";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import type { PlanMode } from "@/types/project";

/** The mode of the plan open in the editor — pinned once it's been submitted. */
export const useOpenPlanMode = (): PlanMode => {
  const projects = useProjectStore((s) => s.projects);
  const record = useDmpStore((s) =>
    s.dmps.find((d) => d.dmp_id === s.currentDmpId),
  );
  const projectId = useDmpStore((s) => s.draft.project_id);
  return planModeOf(record, projects, projectId);
};

/**
 * A lookup for views that draw tasks from several plans at once — resolving
 * the mode per row inside a map, where a hook can't go.
 */
export const usePlanModeFor = (): ((dmpId?: string) => PlanMode) => {
  const projects = useProjectStore((s) => s.projects);
  const dmps = useDmpStore((s) => s.dmps);
  const draftProjectId = useDmpStore((s) => s.draft.project_id);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);

  return React.useCallback(
    (dmpId?: string) =>
      planModeOf(
        dmps.find((d) => d.dmp_id === dmpId),
        projects,
        // The plan open in the editor isn't in `dmps` until it's checked back in.
        dmpId && dmpId === currentDmpId ? draftProjectId : undefined,
      ),
    [projects, dmps, draftProjectId, currentDmpId],
  );
};
