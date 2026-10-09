import React from "react";
import { Link } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { ProgressBar } from "@/components/ui/progress-bar";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import type { ProjectProgress } from "@/config/dashboard";

/**
 * Each project's plan: how far its tasks have come, and when. Shared by the
 * researcher's dashboard (their projects) and the committee's (those it
 * oversees), so both read progress the same way.
 */
export const ProjectProgressList: React.FC<{
  items: ProjectProgress[];
  description?: string;
}> = ({
  items,
  description = "Lifecycle progress of each project's plan.",
}) => (
  <DashboardSection
    title="Project progress"
    description={description}
    viewAll={{ to: "/projects", label: "Projects" }}
  >
    {items.length === 0 ? (
      <div className="flex flex-col items-center gap-1 py-6 text-center">
        <FolderKanban className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">No projects with a plan yet</p>
      </div>
    ) : (
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.project.project_id}>
            <Link
              to={`/projects/${item.project.project_id}`}
              className="-mx-2 block rounded-md px-2 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.project.project_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.plan.title}
                  </p>
                </div>
                <Chip variant="outline" className="shrink-0">
                  {item.timeline}
                </Chip>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar
                  value={item.overall}
                  label={`${item.project.project_name} progress`}
                  className="flex-1"
                />
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                  {item.overall}%
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.total === 0
                  ? item.plan.active_version !== undefined
                    ? "Plan approved — no tasks generated yet."
                    : "Tasks are created once the plan is approved."
                  : `${item.done} of ${item.total} tasks done`}
                {item.overdue > 0 && (
                  <span className="text-destructive">
                    {" "}
                    · {item.overdue} overdue
                  </span>
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </DashboardSection>
);
