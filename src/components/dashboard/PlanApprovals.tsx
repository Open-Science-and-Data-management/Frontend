import React from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Tooltip } from "@/components/ui/tooltip";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { userFullName, userInitials } from "@/schemas/user";
import { useDmpStore } from "@/store/dmpStore";
import type {
  ApprovalState,
  PlanApproval,
} from "@/hooks/useResearcherDashboard";
import type { PlanVersion } from "@/store/dmpStore";
import type { User } from "@/types/user";
import { cn } from "@/utils/cn";

const STATE_CHIP: Record<
  ApprovalState,
  { label: string; variant: "warn" | "ok" | "neutral" }
> = {
  in_review: { label: "In review", variant: "warn" },
  returned: { label: "Sent back", variant: "neutral" },
  approved: { label: "Approved", variant: "ok" },
};

const deciderOf = (v: PlanVersion) =>
  v.approver ? `${v.approver.name} (${v.approver.position})` : "the committee";

/** One sentence on where the decision stands, in the researcher's terms. */
const statusLine = (
  state: ApprovalState,
  v: PlanVersion,
  committee: User[],
) => {
  if (state === "in_review") {
    const who =
      committee.length > 0
        ? committee.map((u) => userFullName(u)).join(", ")
        : "your committee";
    return `Waiting on ${who} · submitted ${formatDistanceToNow(v.created_at, { addSuffix: true })}.`;
  }
  if (state === "returned")
    return `Sent back by ${deciderOf(v)}${v.note ? `: “${v.note}”` : "."}`;
  return `Approved by ${deciderOf(v)}${v.decided_at ? ` on ${format(v.decided_at, "MMM d")}` : ""}.`;
};

/** The committee's members as initials, the way a reviewer list reads. */
const Committee: React.FC<{ users: User[]; state: ApprovalState }> = ({
  users,
  state,
}) =>
  users.length === 0 ? null : (
    <div className="flex -space-x-1.5">
      {users.map((u) => (
        <Tooltip key={u.user_id} content={userFullName(u)}>
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-semibold",
              state === "approved"
                ? "bg-ok-subtle text-ok"
                : state === "returned"
                  ? "bg-warn-subtle text-warn"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {userInitials(u)}
          </span>
        </Tooltip>
      ))}
    </div>
  );

/**
 * Where each submitted plan stands with the committee — waiting, sent back
 * with a reason, or approved and by whom. Opens the plan where it's acted on.
 */
export const PlanApprovals: React.FC<{ items: PlanApproval[] }> = ({
  items,
}) => {
  const navigate = useNavigate();
  const openDmp = useDmpStore((s) => s.openDmp);

  const open = (item: PlanApproval) => {
    // Same rule as My DMPs: a draft opens in the editor, the rest on Status.
    const opened = openDmp(item.plan.dmp_id) ?? item.plan;
    navigate(opened.status === "draft" ? "/dmp/create" : "/dmp/status");
  };

  return (
    <DashboardSection
      title="Plan approval"
      description="Where your submitted plans stand with the committee."
      viewAll={{ to: "/dmps", label: "My DMPs" }}
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing submitted yet</p>
          <p className="text-xs text-muted-foreground">
            Plans you submit for approval are tracked here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const chip = STATE_CHIP[item.state];
            return (
              <li key={item.plan.dmp_id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className="w-full rounded-md border bg-muted/20 p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.plan.title}
                      </p>
                      {item.projectName && (
                        <p className="truncate text-xs text-muted-foreground">
                          {item.projectName}
                        </p>
                      )}
                    </div>
                    <Chip variant={chip.variant} className="shrink-0">
                      v{item.version.number} · {chip.label}
                    </Chip>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Committee users={item.committee} state={item.state} />
                    <p className="min-w-0 flex-1 text-xs text-muted-foreground line-clamp-2">
                      {statusLine(item.state, item.version, item.committee)}
                    </p>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
};
