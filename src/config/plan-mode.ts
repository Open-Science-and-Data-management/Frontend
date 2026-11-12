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

/**
 * A plan's mode. Once submitted, a plan keeps the mode it was submitted under
 * (`plan_mode` on its record), so a later change to — or deletion of — its
 * project can't turn a committee plan into a self-finalized one or back.
 * Before that, it follows its project.
 */
export const planModeOf = (
  plan: { plan_mode?: PlanMode; project_id?: string } | undefined,
  projects: Project[],
  projectId?: string,
): PlanMode =>
  plan?.plan_mode ?? resolvePlanMode(projects, plan?.project_id ?? projectId);

/**
 * The authoring stepper. It names stages every plan goes through, however it
 * was started (from a proposal or by hand): the server doesn't record which,
 * so the stepper doesn't claim an upload that may never have happened. The
 * last stage is called what this plan's mode calls it.
 */
export const planSteps = (mode: PlanMode) => [
  { label: "Start" },
  { label: "Review" },
  { label: activation(mode).reviewed ? "Submit" : "Finalize" },
  { label: activation(mode).activeLabel },
];

/**
 * Where a plan stands on the stepper. A plan in force has every stage done,
 * even while a revision of it is being written.
 */
export const planStepIndex = (status: Status, submitting = false): number =>
  isActive(status) ? 4 : isAwaitingDecision(status) ? 3 : submitting ? 2 : 1;
