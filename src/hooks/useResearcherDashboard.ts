import React from "react";
import { useDmpLibrary } from "@/hooks/useDmpLibrary";
import { useTaskStore } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { planModeOf } from "@/config/plan-mode";
import { projectProgressFor, type ProjectProgress } from "@/config/dashboard";
import {
  daysUntilDue,
  dueState,
  isOpenTask,
  type DueState,
} from "@/config/task-due";
import type { DmpRecord, PlanVersion } from "@/store/dmpStore";
import type { Task } from "@/types/task";
import type { User } from "@/types/user";

/** "This week" on the dashboard: today and the six days after it. */
const WEEK_DAYS = 7;
const UPCOMING_LIMIT = 7;
const APPROVAL_LIMIT = 3;
const PROGRESS_LIMIT = 3;

export interface UpcomingTask {
  task: Task;
  days: number;
  state: DueState;
  /** Where it belongs, in words: the project, else the plan. */
  context?: string;
}

export type ApprovalState = "in_review" | "returned" | "approved";

export interface PlanApproval {
  plan: DmpRecord;
  version: PlanVersion;
  state: ApprovalState;
  projectName?: string;
  committee: User[];
}

// Shared with the committee dashboard; re-exported for existing imports.
export type { ProjectProgress };

/** Where a plan stands with the committee, judged from its versions. */
const approvalOf = (
  plan: DmpRecord,
): { state: ApprovalState; version: PlanVersion } | undefined => {
  const pending = plan.versions.find((v) => v.status === "pending");
  if (pending) return { state: "in_review", version: pending };

  const latest = [...plan.versions].sort((a, b) => b.number - a.number)[0];
  if (latest?.status === "rejected")
    return { state: "returned", version: latest };

  const active = plan.versions.find((v) => v.number === plan.active_version);
  return active ? { state: "approved", version: active } : undefined;
};

const APPROVAL_ORDER: Record<ApprovalState, number> = {
  in_review: 0,
  returned: 1,
  approved: 2,
};

/**
 * Everything the researcher's dashboard shows, worked out once so the summary
 * line, the stat cards and the lists can never disagree with each other.
 */
export const useResearcherDashboard = () => {
  const library = useDmpLibrary();
  const tasks = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const members = useProjectStore((s) => s.members);
  const users = useProjectStore((s) => s.users);
  const userId = useAuthStore((s) => s.userId);

  return React.useMemo(() => {
    const today = new Date();
    const planIds = new Set(library.map((p) => p.dmp_id));
    const planOf = (dmpId: string) => library.find((p) => p.dmp_id === dmpId);
    const projectOf = (projectId?: string) =>
      projects.find((p) => p.project_id === projectId);

    // Tasks of archived plans aren't on anyone's list any more.
    const liveTasks = tasks.filter((t) => planIds.has(t.dmp_id));
    const openTasks = liveTasks.filter(isOpenTask);

    const dated: UpcomingTask[] = openTasks
      .filter((t): t is Task & { end_date: Date } => Boolean(t.end_date))
      .map((task) => {
        const days = daysUntilDue(task.end_date, today);
        const plan = planOf(task.dmp_id);
        return {
          task,
          days,
          state: dueState(days),
          context: projectOf(plan?.project_id)?.project_name ?? plan?.title,
        };
      })
      .sort((a, b) => a.days - b.days);

    const overdue = dated.filter((d) => d.state === "overdue");
    const dueThisWeek = dated.filter((d) => d.days >= 0 && d.days < WEEK_DAYS);
    const nextDue = dated.find((d) => d.days >= 0);

    const planCounts = {
      draft: library.filter((p) => p.status === "draft").length,
      pending: library.filter((p) => p.status === "pending").length,
      approved: library.filter((p) => p.status === "approved").length,
    };

    const committeeOf = (projectId?: string) =>
      members
        .filter(
          (m) => m.project_id === projectId && m.project_role === "committee",
        )
        .map((m) => users.find((u) => u.user_id === m.user_id))
        .filter((u): u is User => Boolean(u));

    // Only plans that go to a committee have an approval to report on.
    const approvals: PlanApproval[] = library
      .filter((plan) => planModeOf(plan, projects) === "institutional")
      .flatMap((plan) => {
        const found = approvalOf(plan);
        return found
          ? [
              {
                plan,
                ...found,
                projectName: projectOf(plan.project_id)?.project_name,
                committee: committeeOf(plan.project_id),
              },
            ]
          : [];
      })
      .sort(
        (a, b) =>
          APPROVAL_ORDER[a.state] - APPROVAL_ORDER[b.state] ||
          b.plan.updated_at.getTime() - a.plan.updated_at.getTime(),
      );
    const waitingOnCommittee = approvals.filter(
      (a) => a.state === "in_review",
    ).length;

    // The researcher's own projects that have a plan to measure against.
    const myProjectIds = new Set(
      members
        .filter((m) => m.user_id === userId && m.project_role === "researcher")
        .map((m) => m.project_id),
    );
    const progress = projectProgressFor(
      projects.filter((p) => myProjectIds.has(p.project_id as string)),
      library,
      liveTasks,
      today,
    );

    return {
      library,
      planCounts,
      openTasks,
      inProgressCount: openTasks.filter((t) => t.status === "in_progress")
        .length,
      overdue,
      dueThisWeek,
      nextDue,
      upcoming: dated.slice(0, UPCOMING_LIMIT),
      approvals: approvals.slice(0, APPROVAL_LIMIT),
      waitingOnCommittee,
      progress: progress.slice(0, PROGRESS_LIMIT),
    };
  }, [library, tasks, projects, members, users, userId]);
};
