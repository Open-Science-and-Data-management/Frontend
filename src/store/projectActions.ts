import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";

export type DeleteProjectResult =
  { ok: true } | { ok: false; plans: number; reason: string };

/**
 * Deletes a project only once nothing depends on it. A plan's approvals,
 * versions and tasks belong to its project; deleting the project under them
 * would leave plans pointing at nothing. Screens should call this, never
 * `removeProject` directly.
 */
export const deleteProject = (projectId: string): DeleteProjectResult => {
  const { dmps, draft, currentDmpId } = useDmpStore.getState();
  const openUnfiled =
    currentDmpId !== null &&
    !dmps.some((d) => d.dmp_id === currentDmpId) &&
    draft.project_id === projectId;
  const plans =
    dmps.filter((d) => d.project_id === projectId).length +
    (openUnfiled ? 1 : 0);

  if (plans > 0)
    return {
      ok: false,
      plans,
      reason: `This project still has ${plans} plan${plans === 1 ? "" : "s"}. Delete or move ${plans === 1 ? "it" : "them"} first. Approvals and tasks belong to the project.`,
    };

  useProjectStore.getState().removeProject(projectId);
  return { ok: true };
};
