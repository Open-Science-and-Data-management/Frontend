import { LifecycleStage } from "@/types/task";
import type { Task } from "@/types/task";

export interface StageProgress {
  stage: Task["lifecycle_stage"];
  total: number;
  done: number;
}

/**
 * Progress is the lifecycle's, not a raw task count: each stage with work in
 * it counts equally, by the share of its tasks that are done. Cancelled work
 * isn't work left to do, so it counts for nothing either way.
 */
export const lifecycleProgress = (
  tasks: Task[],
): { stages: StageProgress[]; overall: number } => {
  const stages = LifecycleStage.options
    .map((stage) => {
      const forStage = tasks.filter(
        (t) => t.lifecycle_stage === stage && t.status !== "cancelled",
      );
      return {
        stage,
        total: forStage.length,
        done: forStage.filter((t) => t.status === "done").length,
      };
    })
    .filter((s) => s.total > 0);

  const overall =
    stages.length === 0
      ? 0
      : Math.round(
          (stages.reduce((sum, s) => sum + s.done / s.total, 0) /
            stages.length) *
            100,
        );

  return { stages, overall };
};
