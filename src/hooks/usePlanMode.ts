import React from "react";
import { resolvePlanMode } from "@/config/plan-mode";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import type { PlanMode } from "@/types/project";

/** The mode of one project, for a page that already knows which one it's on. */
export const usePlanMode = (projectId?: string): PlanMode => {
  const projects = useProjectStore((s) => s.projects);
  return resolvePlanMode(projects, projectId);
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
      resolvePlanMode(
        projects,
        // The plan open in the editor isn't in `dmps` until it's checked back in.
        dmpId && dmpId === currentDmpId
          ? draftProjectId
          : dmps.find((d) => d.dmp_id === dmpId)?.draft.project_id,
      ),
    [projects, dmps, draftProjectId, currentDmpId],
  );
};
