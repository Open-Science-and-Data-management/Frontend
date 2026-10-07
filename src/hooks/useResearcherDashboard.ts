import React from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { useDmpLibrary } from "@/hooks/useDmpLibrary";
import { useTaskStore } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { planModeOf } from "@/config/plan-mode";
import { lifecycleProgress } from "@/config/progress";
import {
  daysUntilDue,
  dueState,
  isOpenTask,
  type DueState,
} from "@/config/task-due";
import { toLocalDay } from "@/utils/calendarDate";
import type { DmpRecord, PlanVersion } from "@/store/dmpStore";
import type { Project } from "@/types/project";
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

export interface ProjectProgress {
  project: Project;
  plan: DmpRecord;
  overall: number;
  done: number;
  total: number;
  /** "Week 6 of 12", or why there's no week to give. */
  timeline: string;
}

const timelineOf = (begin?: Date, end?: Date, today = new Date()) => {
  if (!begin || !end) return "No timeline set";
  const start = toLocalDay(begin);
  const finish = toLocalDay(end);
  const elapsed = differenceInCalendarDays(today, start);
  if (elapsed < 0) return `Starts ${format(start, "MMM d, yyyy")}`;
  if (differenceInCalendarDays(finish, today) < 0) return "Timeline ended";
  const weeks = Math.max(
    1,
    Math.ceil((differenceInCalendarDays(finish, start) + 1) / 7),
  );
  return `Week ${Math.floor(elapsed / 7) + 1} of ${weeks}`;
};

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
    const progress: ProjectProgress[] = projects
      .filter((p) => myProjectIds.has(p.project_id as string))
      .flatMap((project) => {
        const plans = library.filter(
          (d) => d.project_id === project.project_id,
        );
        // The plan in force is the one work runs against; else the newest.
        const plan =
          plans.find((d) => d.active_version !== undefined) ??
          [...plans].sort(
            (a, b) => b.updated_at.getTime() - a.updated_at.getTime(),
          )[0];
        if (!plan) return [];

        const planTasks = liveTasks.filter((t) => t.dmp_id === plan.dmp_id);
        const counted = planTasks.filter((t) => t.status !== "cancelled");
        const inForce = plan.versions.find(
          (v) => v.number === plan.active_version,
        )?.snapshot;
        const dates = inForce ?? plan.draft;

        return [
          {
            project,
            plan,
            overall: lifecycleProgress(planTasks).overall,
            done: counted.filter((t) => t.status === "done").length,
            total: counted.length,
            timeline: timelineOf(dates.begin_date, dates.end_date, today),
          },
        ];
      })
      .sort(
        (a, b) => b.plan.updated_at.getTime() - a.plan.updated_at.getTime(),
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
