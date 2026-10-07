import React from "react";
import { format } from "date-fns";
import { Chip } from "@/components/ui/chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { userFullName } from "@/schemas/user";
import { useProjectStore } from "@/store/projectStore";
import type { DmpRecord, PlanVersion } from "@/store/dmpStore";

const STATUS_TEXT: Record<PlanVersion["status"], string> = {
  draft: "Draft",
  pending: "Awaiting decision",
  approved: "Approved",
  rejected: "Sent back",
};

/**
 * Who decided, in words. The approver recorded at the time wins — it's what
 * the exports name. Older records only carry an id, or the bare "committee".
 */
export const useDeciderName = () => {
  const getUser = useProjectStore((s) => s.getUser);
  return (version: Pick<PlanVersion, "approver" | "decided_by">) => {
    if (version.approver)
      return `${version.approver.name} (${version.approver.position})`;
    const id = version.decided_by;
    if (!id) return undefined;
    if (id === "committee") return "Committee";
    const user = getUser(id);
    return user ? userFullName(user) : id;
  };
};

/** Every numbered version of a plan, newest first, with how each was decided. */
export const VersionHistory: React.FC<{ record: DmpRecord }> = ({ record }) => {
  const deciderName = useDeciderName();
  const versions = [...record.versions].sort((a, b) => b.number - a.number);

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not submitted yet — no versions on record.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {versions.map((version) => (
        <li key={version.number} className="space-y-1 border-l-2 pl-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">
              Version {version.number}
            </span>
            <StatusBadge status={version.status}>
              {STATUS_TEXT[version.status]}
            </StatusBadge>
            {version.number === record.active_version && (
              <Chip variant="ok">In force</Chip>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Submitted {format(version.created_at, "PP")}
            {version.decided_at &&
              ` · decided ${format(version.decided_at, "PP")}`}
            {deciderName(version) && ` by ${deciderName(version)}`}
          </p>
          {version.changes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {version.changes.length} change
              {version.changes.length === 1 ? "" : "s"} ({version.edit_type})
            </p>
          )}
          {version.minor_edits.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {version.minor_edits.length} minor edit
              {version.minor_edits.length === 1 ? "" : "s"} applied since
            </p>
          )}
          {version.note && (
            <blockquote className="rounded-md bg-muted/60 px-2 py-1.5 text-xs italic">
              “{version.note}”
            </blockquote>
          )}
        </li>
      ))}
    </ol>
  );
};
