import React from "react";
import { formatDistanceToNow } from "date-fns";
import { Database, Users, Calendar } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DmpRecord } from "@/store/dmpStore";

interface DmpListCardProps {
  dmp: DmpRecord;
  projectName?: string;
  isCurrent?: boolean;
  onOpen: (dmp: DmpRecord) => void;
}

const STATUS_HINT: Record<DmpRecord["status"], string> = {
  draft: "Still editable",
  pending: "Waiting on the committee",
  approved: "In force. Minor edits apply now; major ones need sign-off.",
};

export const DmpListCard: React.FC<DmpListCardProps> = ({
  dmp,
  projectName,
  isCurrent,
  onOpen,
}) => (
  <button
    type="button"
    onClick={() => onOpen(dmp)}
    className="block w-full rounded-lg border bg-card p-5 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{dmp.title}</p>
          {isCurrent && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Open in editor
            </span>
          )}
        </div>
        {projectName && (
          <p className="mt-0.5 text-xs text-muted-foreground">{projectName}</p>
        )}
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {dmp.description || "No description yet."}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={dmp.status} />
        <span className="text-xs text-muted-foreground">
          {dmp.archived_at
            ? "Archived. Open it to bring it back."
            : STATUS_HINT[dmp.status]}
        </span>
      </div>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Database className="h-3.5 w-3.5" />
        {dmp.dataset_count} dataset{dmp.dataset_count === 1 ? "" : "s"}
      </span>
      <span className="inline-flex items-center gap-1">
        <Users className="h-3.5 w-3.5" />
        {dmp.contributor_count} contributor
        {dmp.contributor_count === 1 ? "" : "s"}
      </span>
      <span className="inline-flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5" />
        Updated {formatDistanceToNow(dmp.updated_at, { addSuffix: true })}
      </span>
    </div>
  </button>
);
