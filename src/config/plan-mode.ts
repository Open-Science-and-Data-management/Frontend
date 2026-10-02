import type { z } from "zod";
import { DmpStatus } from "@/types/dmp";
import type { PlanMode, Project } from "@/types/project";

type Status = z.infer<typeof DmpStatus>;
export const isActive = (status: Status): boolean => status === "approved";

export const isAwaitingDecision = (status: Status): boolean =>
  status === "pending";

interface Activation {
  /** Who moves the plan to active. */
  by: "committee" | "self";
  /** What the control that starts it is called. */
  action: string;
  /** Whether the plan parks in a review queue on the way. */
  reviewed: boolean;
  /** What "active" is called to this researcher. */
  activeLabel: string;
}

export const activation = (mode: PlanMode): Activation =>
  mode === "independent"
    ? {
        by: "self",
        action: "Finalize plan",
        reviewed: false,
        activeLabel: "Finalized",
      }
    : {
        by: "committee",
        action: "Submit for approval",
        reviewed: true,
        activeLabel: "Approved",
      };

/**
 * A plan's state in this researcher's words. An independent plan was never
 * "approved" by anyone, so it must not say so.
 */
export const statusLabel = (status: Status, mode: PlanMode): string => {
  if (isActive(status)) return activation(mode).activeLabel;
  if (isAwaitingDecision(status))
    return mode === "independent" ? "Ready to finalize" : "Awaiting approval";
  return "Draft";
};

/** The mode a plan inherits from the project that owns it. */
export const resolvePlanMode = (
  projects: Project[],
  projectId?: string,
): PlanMode =>
  projects.find((p) => p.project_id === projectId)?.plan_mode ??
  "institutional";
