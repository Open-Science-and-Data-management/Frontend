import React from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, History } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import type { MyDecision } from "@/hooks/useCommitteeDashboard";

/** What this reviewer decided lately, with the note they left. */
export const RecentDecisions: React.FC<{ items: MyDecision[] }> = ({
  items,
}) => (
  <DashboardSection
    title="Recently decided by you"
    description="Your latest approvals and returns."
    viewAll={{ to: "/review", label: "Review queue" }}
  >
    {items.length === 0 ? (
      <div className="flex flex-col items-center gap-1 py-6 text-center">
        <History className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">No decisions yet</p>
        <p className="text-xs text-muted-foreground">
          Plans you approve or send back are listed here.
        </p>
      </div>
    ) : (
      <ul className="-mx-2">
        {items.map(({ plan, version }) => (
          <li key={`${plan.dmp_id}-${version.number}`}>
            <Link
              to={`/review/${plan.dmp_id}`}
              className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {plan.title}{" "}
                  <span className="font-normal text-muted-foreground">
                    · v{version.number}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {version.decided_at &&
                    formatDistanceToNow(version.decided_at, {
                      addSuffix: true,
                    })}
                  {version.note && ` · “${version.note}”`}
                </p>
              </div>
              <StatusBadge status={version.status}>
                {version.status === "rejected" ? "Sent back" : "Approved"}
              </StatusBadge>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    )}
  </DashboardSection>
);
