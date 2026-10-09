import React from "react";
import { differenceInCalendarDays } from "date-fns";
import { reviewQueue, useDmpLibrary } from "@/hooks/useDmpLibrary";
import { useTaskStore } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import {
  planInForce,
  projectProgressFor,
  timelineOf,
} from "@/config/dashboard";
import { countBy } from "@/config/plan-diff";
import type { DmpRecord, PlanVersion } from "@/store/dmpStore";
import type { User } from "@/types/user";

/** "This week": submissions from today and the six days before it. */
const WEEK_DAYS = 7;
const QUEUE_LIMIT = 6;
const DECISION_LIMIT = 5;
const PROGRESS_LIMIT = 4;

export interface AwaitingReview {
  plan: DmpRecord;
  version: PlanVersion;
  isRevision: boolean;
  /** Whole days since it was submitted; 0 means today. */
  daysWaiting: number;
  researcher?: User;
  projectName?: string;
  /** Major / minor changes, for a revision. */
  changes: { major: number; minor: number };
  /** "Week 4 of 14" for the plan's own timeline. */
  timeline: string;
}

export interface MyDecision {
  plan: DmpRecord;
  version: PlanVersion;
}

/**
 * Everything the committee's dashboard shows, worked out once — the summary
 * line, stat cards and lists read from the same numbers.
 */
export const useCommitteeDashboard = () => {
  const library = useDmpLibrary();
  const tasks = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const getResearcherFor = useProjectStore((s) => s.getResearcherFor);
  const userId = useAuthStore((s) => s.userId);

  return React.useMemo(() => {
    const today = new Date();
    const projectOf = (projectId?: string) =>
      projects.find((p) => p.project_id === projectId);

    const awaiting: AwaitingReview[] = reviewQueue(library).map(
      ({ record, version, isRevision }) => {
        const dates = planInForce(record);
        return {
          plan: record,
          version,
          isRevision,
          daysWaiting: Math.max(
            0,
            differenceInCalendarDays(today, version.created_at),
          ),
          researcher: getResearcherFor(record.project_id),
          projectName: projectOf(record.project_id)?.project_name,
          changes: countBy(version.changes),
          timeline: timelineOf(dates.begin_date, dates.end_date, today),
        };
      },
    );

    const submittedThisWeek = awaiting.filter(
      (a) => a.daysWaiting < WEEK_DAYS,
    ).length;
    // The queue is oldest-first, so the head is the longest wait.
    const oldest = awaiting[0];

    // Decisions this reviewer made: by id, or by the approver recorded then.
    const mine: MyDecision[] = library
      .flatMap((plan) =>
        plan.versions
          .filter(
            (v) =>
              (v.status === "approved" || v.status === "rejected") &&
              v.decided_at &&
              (v.decided_by === userId || v.approver?.user_id === userId),
          )
          .map((version) => ({ plan, version })),
      )
      .sort(
        (a, b) =>
          (b.version.decided_at?.getTime() ?? 0) -
          (a.version.decided_at?.getTime() ?? 0),
      );
    const approvedByMe = mine.filter(
      (d) => d.version.status === "approved",
    ).length;

    // The committee oversees institutional projects; independent ones sign
    // their own plans off.
    const overseen = projects.filter((p) => p.plan_mode === "institutional");
    const planIds = new Set(library.map((p) => p.dmp_id));
    const progress = projectProgressFor(
      overseen,
      library,
      tasks.filter((t) => planIds.has(t.dmp_id)),
      today,
    );

    return {
      awaiting: awaiting.slice(0, QUEUE_LIMIT),
      waitingCount: awaiting.length,
      submittedThisWeek,
      oldest,
      decisions: mine.slice(0, DECISION_LIMIT),
      decisionCount: mine.length,
      approvedByMe,
      returnedByMe: mine.length - approvedByMe,
      overseenCount: overseen.length,
      projectsWithOverdue: progress.filter((p) => p.overdue > 0).length,
      progress: progress.slice(0, PROGRESS_LIMIT),
    };
  }, [library, tasks, projects, getResearcherFor, userId]);
};
