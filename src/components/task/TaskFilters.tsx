import React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronLeft,
  FileText,
  FolderKanban,
  Flag,
  GitBranch,
  ListFilter,
  Search,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  TaskViewToggle,
  type TaskView,
} from "@/components/task/TaskViewToggle";
import { LifecycleStage, Priority, TaskStatus } from "@/types/task";
import type { Task } from "@/types/task";
import { cn } from "@/utils/cn";

const ALL = "all";
/** Everything still live — the default, so cancelled work doesn't clutter it. */
const ACTIVE = "active";
export type SortKey = "priority" | "due" | "stage" | "title";

const PRIORITY_ORDER: Record<Task["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};
const STAGE_ORDER = LifecycleStage.options;

export const SORT_LABELS: Record<SortKey, string> = {
  priority: "Priority",
  due: "Due date",
  stage: "Stage",
  title: "Title",
};

/**
 * Priority earns its keep when you're ordering the week, not just looking at
 * it — so it sorts as well as filters. Direction lives here too, so the
 * toolbar and a table heading can't disagree about it.
 */
export const useTaskFilters = (tasks: Task[]) => {
  const [query, setQuery] = React.useState("");
  const [priority, setPriority] = React.useState<string>(ALL);
  const [stage, setStage] = React.useState<string>(ALL);
  const [status, setStatus] = React.useState<string>(ACTIVE);
  const [sort, setSort] = React.useState<SortKey>("priority");
  const [descending, setDescending] = React.useState(false);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = tasks.filter(
      (t) =>
        (!q ||
          t.title.toLowerCase().includes(q) ||
          (t.details ?? "").toLowerCase().includes(q)) &&
        (priority === ALL || t.priority === priority) &&
        (stage === ALL || t.lifecycle_stage === stage) &&
        (status === ALL ||
          (status === ACTIVE ? t.status !== "cancelled" : t.status === status)),
    );

    const ordered = [...filtered].sort((a, b) => {
      switch (sort) {
        case "due":
          return (
            (a.end_date?.getTime() ?? Infinity) -
            (b.end_date?.getTime() ?? Infinity)
          );
        case "stage":
          return (
            STAGE_ORDER.indexOf(a.lifecycle_stage) -
            STAGE_ORDER.indexOf(b.lifecycle_stage)
          );
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return (
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            (a.end_date?.getTime() ?? Infinity) -
              (b.end_date?.getTime() ?? Infinity)
          );
      }
    });

    return descending ? ordered.reverse() : ordered;
  }, [tasks, query, priority, stage, status, sort, descending]);

  const isFiltered =
    query.trim() !== "" ||
    priority !== ALL ||
    stage !== ALL ||
    status !== ACTIVE;
  const isSorted = sort !== "priority" || descending;

  const clear = () => {
    setQuery("");
    setPriority(ALL);
    setStage(ALL);
    setStatus(ACTIVE);
  };
  const resetSort = () => {
    setSort("priority");
    setDescending(false);
  };

  return {
    visible,
    query,
    setQuery,
    priority,
    setPriority,
    stage,
    setStage,
    status,
    setStatus,
    sort,
    setSort,
    descending,
    setDescending,
    isFiltered,
    isSorted,
    clear,
    resetSort,
  };
};

type Filters = ReturnType<typeof useTaskFilters>;

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export interface PlanFilter {
  value: string;
  onChange: (value: string) => void;
  options: { dmp_id: string; title: string; count: number }[];
  /** Tasks across every plan, for the "all" option's count. */
  totalCount: number;
}

export interface ProjectFilter {
  value: string;
  onChange: (value: string) => void;
  /** Every project, including ones with no tasks yet. */
  options: { project_id: string; name: string; count: number }[];
  totalCount: number;
}

/** One narrowing dimension, so the menu and the chips share a description. */
interface Dimension {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
  fallback: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  /** Lower-case enum values read better title-cased; names don't. */
  titleCase?: boolean;
}

const ToolbarButton: React.FC<{
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ icon: Icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-foreground",
    )}
  >
    <Icon className="h-4 w-4 shrink-0" />
    {label}
  </button>
);

const menuContent =
  "z-50 w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md";
const menuItem =
  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The view's toolbar: search, filter and sort are three small controls rather
 * than six permanent selects, and what you've actually narrowed by is spelled
 * out underneath as chips you can take off one at a time.
 */
export const TaskFilters: React.FC<
  Filters & {
    total: number;
    /** Given, narrowing by plan joins the other dimensions in the menu. */
    plan?: PlanFilter;
    /** Given, narrowing by project comes first — a plan belongs to one. */
    project?: ProjectFilter;
    /** Given, the view switch sits in the same toolbar. */
    view?: TaskView;
    onViewChange?: (v: TaskView) => void;
  }
> = ({
  visible,
  total,
  query,
  setQuery,
  priority,
  setPriority,
  stage,
  setStage,
  status,
  setStatus,
  sort,
  setSort,
  descending,
  setDescending,
  isSorted,
  clear,
  resetSort,
  plan,
  project,
  view,
  onViewChange,
}) => {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);
  const [drilled, setDrilled] = React.useState<string | null>(null);

  const dimensions: Dimension[] = [
    ...(project
      ? [
          {
            id: "project",
            label: "Project",
            icon: FolderKanban,
            value: project.value,
            fallback: ALL,
            onChange: project.onChange,
            options: [
              { value: ALL, label: `All projects (${project.totalCount})` },
              ...project.options.map((o) => ({
                value: o.project_id,
                label: `${o.name} (${o.count})`,
              })),
            ],
          },
        ]
      : []),
    ...(plan
      ? [
          {
            id: "plan",
            label: "Plan",
            icon: FileText,
            value: plan.value,
            fallback: ALL,
            onChange: plan.onChange,
            options: [
              { value: ALL, label: `All plans (${plan.totalCount})` },
              ...plan.options.map((o) => ({
                value: o.dmp_id,
                label: `${o.title} (${o.count})`,
              })),
            ],
          },
        ]
      : []),
    {
      id: "priority",
      label: "Priority",
      icon: Flag,
      titleCase: true,
      value: priority,
      fallback: ALL,
      onChange: setPriority,
      options: [
        { value: ALL, label: "Any priority" },
        ...Priority.options.map((p) => ({ value: p, label: p })),
      ],
    },
    {
      id: "stage",
      label: "Stage",
      icon: GitBranch,
      titleCase: true,
      value: stage,
      fallback: ALL,
      onChange: setStage,
      options: [
        { value: ALL, label: "Any stage" },
        ...LifecycleStage.options.map((s) => ({ value: s, label: s })),
      ],
    },
    {
      id: "status",
      label: "Status",
      icon: CheckCircle2,
      value: status,
      fallback: ACTIVE,
      onChange: setStatus,
      options: [
        { value: ACTIVE, label: "Active" },
        ...TaskStatus.options.map((s) => ({
          value: s,
          label: STATUS_LABELS[s],
        })),
        { value: ALL, label: "All statuses" },
      ],
    },
  ];

  const applied = dimensions.filter((d) => d.value !== d.fallback);
  const searchShowing = searchOpen || query !== "";
  const drilledDimension = dimensions.find((d) => d.id === drilled);
  const Direction = descending ? ArrowDown : ArrowUp;

  const labelOf = (dimension: Dimension) =>
    dimension.options.find((o) => o.value === dimension.value)?.label ??
    dimension.value;

  return (
    <div className="space-y-2" data-testid="task-toolbar">
      <div className="flex flex-wrap items-center gap-1">
        {searchShowing ? (
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => !query && setSearchOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                setSearchOpen(false);
              }
            }}
            aria-label="Search tasks"
            placeholder="Search tasks"
            className="h-8 w-44"
          />
        ) : (
          <ToolbarButton
            icon={Search}
            label="Search"
            onClick={() => setSearchOpen(true)}
          />
        )}

        <PopoverPrimitive.Root
          open={filterOpen}
          onOpenChange={(open) => {
            setFilterOpen(open);
            if (!open) setDrilled(null);
          }}
        >
          <PopoverPrimitive.Trigger asChild>
            <span>
              <ToolbarButton
                icon={ListFilter}
                label={
                  applied.length > 0 ? `Filter · ${applied.length}` : "Filter"
                }
                active={applied.length > 0}
              />
            </span>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={4}
              className={menuContent}
            >
              {drilledDimension ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDrilled(null)}
                    className={cn(menuItem, "text-muted-foreground")}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {drilledDimension.label}
                  </button>
                  <div className="my-1 border-t" />
                  {drilledDimension.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        drilledDimension.onChange(option.value);
                        setDrilled(null);
                      }}
                      className={cn(
                        menuItem,
                        drilledDimension.titleCase && "capitalize",
                      )}
                    >
                      <span className="flex-1 truncate">{option.label}</span>
                      {option.value === drilledDimension.value && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Narrow by
                  </p>
                  {dimensions.map((dimension) => (
                    <button
                      key={dimension.id}
                      type="button"
                      onClick={() => setDrilled(dimension.id)}
                      className={menuItem}
                    >
                      <dimension.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1">{dimension.label}</span>
                      <span
                        className={cn(
                          "max-w-24 truncate text-xs text-muted-foreground",
                          dimension.titleCase && "capitalize",
                        )}
                      >
                        {dimension.value === dimension.fallback
                          ? ""
                          : labelOf(dimension)}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>

        <PopoverPrimitive.Root open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverPrimitive.Trigger asChild>
            <span>
              <ToolbarButton
                icon={ArrowUpDown}
                label="Sort"
                active={isSorted}
              />
            </span>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={4}
              className={menuContent}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className={menuItem}
                >
                  <span className="flex-1">{SORT_LABELS[key]}</span>
                  {key === sort && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ))}
              <div className="my-1 border-t" />
              <button
                type="button"
                onClick={() => setDescending(!descending)}
                aria-label={descending ? "Sort ascending" : "Sort descending"}
                className={menuItem}
              >
                <Direction className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1">
                  {descending ? "Descending" : "Ascending"}
                </span>
              </button>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>

        <div className="ml-auto flex items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {visible.length} of {total}
          </span>
          {view && onViewChange && (
            <TaskViewToggle view={view} onChange={onViewChange} />
          )}
        </div>
      </div>

      {(applied.length > 0 || query !== "" || isSorted) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {query !== "" && (
            <Chip
              icon={Search}
              label={`"${query}"`}
              onRemove={() => setQuery("")}
            />
          )}
          {applied.map((dimension) => (
            <Chip
              key={dimension.id}
              icon={dimension.icon}
              label={labelOf(dimension)}
              titleCase={dimension.titleCase}
              onRemove={() => dimension.onChange(dimension.fallback)}
            />
          ))}
          {isSorted && (
            <Chip
              icon={Direction}
              label={SORT_LABELS[sort]}
              onRemove={resetSort}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              // Every chip comes off, the plan included — its state lives on
              // the page, so the hook's own reset can't reach it.
              dimensions.forEach(
                (d) => d.value !== d.fallback && d.onChange(d.fallback),
              );
              clear();
              resetSort();
            }}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};

/** An applied narrowing, worn where you can see it and take it off. */
const Chip: React.FC<{
  icon: LucideIcon;
  label: string;
  titleCase?: boolean;
  onRemove: () => void;
}> = ({ icon: Icon, label, titleCase, onRemove }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-md border border-input bg-muted/50 py-0.5 pl-2 pr-1 text-xs",
      titleCase && "capitalize",
    )}
  >
    <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
    <span className="max-w-44 truncate">{label}</span>
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label} filter`}
      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X className="h-3 w-3" />
    </button>
  </span>
);
