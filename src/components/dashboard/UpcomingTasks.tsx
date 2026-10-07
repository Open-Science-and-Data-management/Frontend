import React from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { DUE_LABELS, type DueState } from "@/config/task-due";
import { toLocalDay } from "@/utils/calendarDate";
import type { UpcomingTask } from "@/hooks/useResearcherDashboard";

const DueTag: React.FC<{ state: DueState }> = ({ state }) =>
  state === "overdue" ? (
    <StatusBadge status="rejected">{DUE_LABELS.overdue}</StatusBadge>
  ) : (
    <Chip variant={state === "due_soon" ? "warn" : "outline"}>
      {DUE_LABELS[state]}
    </Chip>
  );

/** Open tasks with a due date, soonest first; a row opens that task. */
export const UpcomingTasks: React.FC<{ items: UpcomingTask[] }> = ({
  items,
}) => (
  <DashboardSection
    title="Tasks coming up"
    description="Sorted by due date. Click a task to open it."
    viewAll={{ to: "/tasks" }}
  >
    {items.length === 0 ? (
      <div className="flex flex-col items-center gap-1 py-6 text-center">
        <CalendarCheck className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">No upcoming deadlines</p>
        <p className="text-xs text-muted-foreground">
          Tasks with a due date show up here.
        </p>
      </div>
    ) : (
      <ul className="-mx-2">
        {items.map(({ task, state, context }) => (
          <li key={task.task_id}>
            <Link
              to={`/tasks?task=${task.task_id}`}
              className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[context, task.lifecycle_stage].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                {format(toLocalDay(task.end_date as Date), "MMM d")}
              </span>
              <DueTag state={state} />
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    )}
  </DashboardSection>
);
