import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { FileText, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { DmpListCard } from "@/components/dmp/DmpListCard";
import { buildDmpList, useDmpStore, type DmpRecord } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import { useConfirm } from "@/components/ui/confirm-provider";

type StatusFilter = "all" | DmpRecord["status"] | "archived";
type SortKey = "updated" | "created" | "title" | "status";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Newest first" },
  { value: "title", label: "Title A–Z" },
  { value: "status", label: "Status" },
];

// Draft first: the plans still needing work should surface above finished ones.
const STATUS_ORDER: Record<DmpRecord["status"], number> = {
  draft: 0,
  pending: 1,
  approved: 2,
};

export const MyDmps: React.FC = () => {
  const navigate = useNavigate();
  const dmps = useDmpStore((s) => s.dmps);
  const draft = useDmpStore((s) => s.draft);
  const status = useDmpStore((s) => s.status);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const draftCreatedAt = useDmpStore((s) => s.draftCreatedAt);
  const draftUpdatedAt = useDmpStore((s) => s.draftUpdatedAt);
  const tasksGenerated = useDmpStore((s) => s.tasksGenerated);
  const openDmp = useDmpStore((s) => s.openDmp);
  const unarchiveDmp = useDmpStore((s) => s.unarchiveDmp);
  const confirm = useConfirm();
  const projects = useProjectStore((s) => s.projects);

  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = React.useState("all");
  const [sort, setSort] = React.useState<SortKey>("updated");

  const projectName = React.useCallback(
    (id?: string) =>
      projects.find((p) => p.project_id === id)?.project_name ?? undefined,
    [projects],
  );

  const all = React.useMemo(
    () =>
      buildDmpList({
        includeArchived: true,
        dmps,
        draft,
        status,
        currentDmpId,
        draftCreatedAt,
        draftUpdatedAt,
        tasksGenerated,
      }),
    [
      dmps,
      draft,
      status,
      currentDmpId,
      draftCreatedAt,
      draftUpdatedAt,
      tasksGenerated,
    ],
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = all.filter((dmp) => {
      // Archived plans show only under their own filter.
      if (statusFilter === "archived") {
        if (!dmp.archived_at) return false;
      } else {
        if (dmp.archived_at) return false;
        if (statusFilter !== "all" && dmp.status !== statusFilter) return false;
      }
      if (projectFilter !== "all" && dmp.project_id !== projectFilter)
        return false;
      if (!q) return true;
      return [dmp.title, dmp.description, projectName(dmp.project_id)]
        .filter(Boolean)
        .some((text) => (text as string).toLowerCase().includes(q));
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "created":
          return b.created_at.getTime() - a.created_at.getTime();
        case "status":
          return (
            STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
            b.updated_at.getTime() - a.updated_at.getTime()
          );
        default:
          return b.updated_at.getTime() - a.updated_at.getTime();
      }
    });
  }, [all, query, statusFilter, projectFilter, sort, projectName]);

  const isFiltered =
    query.trim() !== "" || statusFilter !== "all" || projectFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setProjectFilter("all");
  };

  const handleOpen = async (dmp: DmpRecord) => {
    if (dmp.archived_at) {
      const ok = await confirm({
        title: "Bring this plan back?",
        description: "It returns to your plans as it was when archived.",
        confirmLabel: "Unarchive",
      });
      if (!ok) return;
      unarchiveDmp(dmp.dmp_id);
    }
    // Editing an approved or pending plan isn't the researcher's call, so those
    // open on the status screen instead of the editor.
    const opened = openDmp(dmp.dmp_id) ?? dmp;
    navigate(opened.status === "draft" ? "/dmp/create" : "/dmp/status");
  };

  return (
    <>
      <Helmet>
        <title>My DMPs | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My DMPs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every plan you own: drafts, plans awaiting approval and approved
              ones.
            </p>
          </div>
          <Button onClick={() => navigate("/upload")}>New DMP</Button>
        </div>

        {all.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, description, or project"
                aria-label="Search DMPs"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                aria-label="Filter by status"
                className="sm:w-48"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>

              <Select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                aria-label="Filter by project"
                className="sm:w-52"
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.project_id} value={project.project_id}>
                    {project.project_name}
                  </option>
                ))}
              </Select>

              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort DMPs"
                className="sm:w-44"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Sort: {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {all.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {visible.length} of {all.length} plan
              {all.length === 1 ? "" : "s"}
            </p>
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}

        {all.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No DMPs yet"
            description="Start from uploading a proposal or creating a blank plan."
            action={
              <Button onClick={() => navigate("/upload")}>Start a DMP</Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="No DMPs match these filters"
            description="Try a different search term, status, or project."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4">
            {visible.map((dmp) => (
              <DmpListCard
                key={dmp.dmp_id}
                dmp={dmp}
                projectName={projectName(dmp.project_id)}
                isCurrent={dmp.dmp_id === currentDmpId}
                onOpen={handleOpen}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};
