import React from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { userFullName } from "@/schemas/user";
import type { AwaitingReview } from "@/hooks/useCommitteeDashboard";

/** A wait of this many days or more is flagged as overdue for a decision. */
export const LONG_WAIT_DAYS = 7;
/** From here a wait is worth a nudge. */
const NOTICEABLE_WAIT_DAYS = 3;

const waitLabel = (days: number) =>
  days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;

const WaitTag: React.FC<{ days: number }> = ({ days }) =>
  days >= LONG_WAIT_DAYS ? (
    <StatusBadge status="rejected">{days} days waiting</StatusBadge>
  ) : (
    <Chip variant={days >= NOTICEABLE_WAIT_DAYS ? "warn" : "outline"}>
      {waitLabel(days)}
    </Chip>
  );

/** The committee's queue, longest-waiting first; a row opens the review. */
export const AwaitingReviewList: React.FC<{
  items: AwaitingReview[];
  total: number;
}> = ({ items, total }) => (
  <DashboardSection
    title="Awaiting your review"
    description="Sorted by waiting time. Click a plan to open its review."
    viewAll={{ to: "/review" }}
  >
    {items.length === 0 ? (
      <div className="flex flex-col items-center gap-1 py-6 text-center">
        <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">You're all caught up</p>
        <p className="text-xs text-muted-foreground">
          New submissions and revisions land here.
        </p>
      </div>
    ) : (
      <>
        <ul className="-mx-2">
          {items.map((item) => (
            <li key={item.plan.dmp_id}>
              <Link
                to={`/review/${item.plan.dmp_id}`}
                className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.plan.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      item.researcher && userFullName(item.researcher),
                      `DMP v${item.version.number}`,
                      item.isRevision
                        ? `revision · ${item.changes.major} major`
                        : "first submission",
                      item.timeline,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                  {format(item.version.created_at, "MMM d")}
                </span>
                <WaitTag days={item.daysWaiting} />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          {total > items.length
            ? `Showing the ${items.length} longest-waiting of ${total}. `
            : ""}
          The queue updates as you decide, oldest plan first.
        </p>
      </>
    )}
  </DashboardSection>
);
