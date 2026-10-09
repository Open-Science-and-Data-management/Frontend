import { differenceInCalendarDays, format } from "date-fns";
import { lifecycleProgress } from "@/config/progress";
import { daysUntilDue, isOpenTask } from "@/config/task-due";
import { toLocalDay } from "@/utils/calendarDate";
import type { DmpRecord } from "@/store/dmpStore";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";

/**
 * What both dashboards — researcher and committee — say about a project, so
 * the two sides can never describe the same project differently.
 */

export interface ProjectProgress {
  project: Project;
  plan: DmpRecord;
  overall: number;
  done: number;
  total: number;
  /** Open tasks past their due date. */
  overdue: number;
  /** "Week 6 of 12", or why there's no week to give. */
  timeline: string;
}

/** Where today falls in a plan's timeline, in weeks. */
export const timelineOf = (begin?: Date, end?: Date, today = new Date()) => {
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

/** The plan content that counts: the version in force, else the draft. */
export const planInForce = (plan: DmpRecord) =>
  plan.versions.find((v) => v.number === plan.active_version)?.snapshot ??
  plan.draft;

/** The plan a project's work runs against: the one in force, else the newest. */
export const leadPlanOf = (library: DmpRecord[], projectId?: string) => {
  const plans = library.filter((d) => d.project_id === projectId);
  return (
    plans.find((d) => d.active_version !== undefined) ??
    [...plans].sort(
      (a, b) => b.updated_at.getTime() - a.updated_at.getTime(),
    )[0]
  );
};

/** Progress of each project that has a plan, most recently active first. */
export const projectProgressFor = (
  projects: Project[],
  library: DmpRecord[],
  tasks: Task[],
  today = new Date(),
): ProjectProgress[] =>
  projects
    .flatMap((project) => {
      const plan = leadPlanOf(library, project.project_id);
      if (!plan) return [];

      const planTasks = tasks.filter((t) => t.dmp_id === plan.dmp_id);
      const counted = planTasks.filter((t) => t.status !== "cancelled");
      const dates = planInForce(plan);

      return [
        {
          project,
          plan,
          overall: lifecycleProgress(planTasks).overall,
          done: counted.filter((t) => t.status === "done").length,
          total: counted.length,
          overdue: planTasks.filter(
            (t) =>
              isOpenTask(t) &&
              t.end_date &&
              daysUntilDue(t.end_date, today) < 0,
          ).length,
          timeline: timelineOf(dates.begin_date, dates.end_date, today),
        },
      ];
    })
    .sort((a, b) => b.plan.updated_at.getTime() - a.plan.updated_at.getTime());
