import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, ClipboardCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDeciderName } from "@/components/review/VersionHistory";
import { reviewQueue, useDmpLibrary } from "@/hooks/useDmpLibrary";
import { countBy } from "@/config/plan-diff";
import { isReviewer } from "@/config/roles";
import { userFullName } from "@/schemas/user";
import { useProjectStore } from "@/store/projectStore";

/** How many past decisions to keep in view under the queue. */
const RECENT_LIMIT = 8;

export const ReviewQueue: React.FC = () => {
  const library = useDmpLibrary();
  const projects = useProjectStore((s) => s.projects);
  const getUser = useProjectStore((s) => s.getUser);
  const getResearcherFor = useProjectStore((s) => s.getResearcherFor);
  const deciderName = useDeciderName();

  const queue = reviewQueue(library);

  // Decisions the committee made — not researchers finalizing their own plans.
  const recent = React.useMemo(
    () =>
      library
        .flatMap((record) =>
          record.versions
            .filter(
              (v) =>
                (v.status === "approved" || v.status === "rejected") &&
                v.decided_at &&
                (Boolean(v.approver) ||
                  v.decided_by === "committee" ||
                  isReviewer(getUser(v.decided_by ?? "")?.role)),
            )
            .map((version) => ({ record, version })),
        )
        .sort(
          (a, b) =>
            (b.version.decided_at?.getTime() ?? 0) -
            (a.version.decided_at?.getTime() ?? 0),
        )
        .slice(0, RECENT_LIMIT),
    [library, getUser],
  );

  const projectName = (id?: string) =>
    projects.find((p) => p.project_id === id)?.project_name;
  const researcherName = (projectId?: string) => {
    const researcher = getResearcherFor(projectId);
    return researcher ? userFullName(researcher) : undefined;
  };

  return (
    <>
      <Helmet>
        <title>Review queue | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {queue.length === 0
              ? "Nothing is waiting on a decision."
              : `${queue.length} plan${queue.length === 1 ? "" : "s"} waiting on a decision, longest-waiting first.`}
          </p>
        </div>

        {queue.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="You're all caught up"
            description="New submissions and revisions land here when a researcher sends them for approval."
          />
        ) : (
          <ul className="space-y-3">
            {queue.map(({ record, version, isRevision }) => {
              const { major, minor } = countBy(version.changes);
              const researcher = researcherName(record.project_id);
              return (
                <li key={record.dmp_id}>
                  <Link
                    to={`/review/${record.dmp_id}`}
                    className="flex items-center gap-4 rounded-lg border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="font-semibold">{record.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[projectName(record.project_id), researcher]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip variant="outline">Version {version.number}</Chip>
                        {isRevision ? (
                          <Chip variant="warn">
                            Revision · {major} major
                            {minor > 0 ? `, ${minor} minor` : ""}
                          </Chip>
                        ) : (
                          <Chip variant="ai">First submission</Chip>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Waiting {formatDistanceToNow(version.created_at)}
                      </span>
                      <span className="inline-flex items-center text-sm font-medium text-primary">
                        Review
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {recent.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Recently decided</h2>
            <ul className="divide-y rounded-lg border bg-card">
              {recent.map(({ record, version }) => (
                <li
                  key={`${record.dmp_id}-${version.number}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {record.title}{" "}
                      <span className="font-normal text-muted-foreground">
                        · v{version.number}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {deciderName(version)} ·{" "}
                      {formatDistanceToNow(version.decided_at as Date, {
                        addSuffix: true,
                      })}
                      {version.note && ` · “${version.note}”`}
                    </p>
                  </div>
                  <StatusBadge status={version.status}>
                    {version.status === "rejected" ? "Sent back" : "Approved"}
                  </StatusBadge>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/review/${record.dmp_id}`}>View</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
};
