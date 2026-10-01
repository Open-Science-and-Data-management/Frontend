import React from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  FileText,
  Flag,
  GitBranch,
  Search,
} from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  TaskViewToggle,
  type TaskView,
} from "@/components/task/TaskViewToggle";
import { LifecycleStage, Priority, TaskStatus } from "@/types/task";
import type { Task } from "@/types/task";

const ALL = "all";
/** Everything still live — the default, so cancelled work doesn't clutter it. */
const ACTIVE = "active";
type SortKey = "priority" | "due" | "stage" | "title";

const PRIORITY_ORDER: Record<Task["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};
const STAGE_ORDER = LifecycleStage.options;

/**
 * Priority earns its keep when you're ordering the week, not just looking at
 * it — so it sorts as well as filters.
 */
export const useTaskFilters = (tasks: Task[]) => {
  const [query, setQuery] = React.useState("");
  const [priority, setPriority] = React.useState<string>(ALL);
  const [stage, setStage] = React.useState<string>(ALL);
  const [status, setStatus] = React.useState<string>(ACTIVE);
  const [sort, setSort] = React.useState<SortKey>("priority");

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

    return [...filtered].sort((a, b) => {
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
  }, [tasks, query, priority, stage, status, sort]);

  const isFiltered =
    query.trim() !== "" ||
    priority !== ALL ||
    stage !== ALL ||
    status !== ACTIVE;
  const clear = () => {
    setQuery("");
    setPriority(ALL);
    setStage(ALL);
    setStatus(ACTIVE);
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
    isFiltered,
    clear,
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

export const TaskFilters: React.FC<
  Filters & {
    total: number;
    /**
     * Given, the plan select joins the other filters instead of sitting up in
     * the page header — narrowing by plan is the same kind of act as
     * narrowing by stage, so they belong on one line.
     */
    plan?: PlanFilter;
    /** Given, the view switch sits in the same bar as the filters. */
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
  isFiltered,
  clear,
  plan,
  view,
  onViewChange,
}) => (
  // Icons name the dimension, so the option text can stay short and the whole
  // row fits without wrapping on a laptop.
  <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
    <div className="relative w-full sm:w-40">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search tasks"
        placeholder="Search tasks"
        className="pl-9"
      />
    </div>

    {plan && (
      <Select
        value={plan.value}
        onChange={(e) => plan.onChange(e.target.value)}
        aria-label="Filter tasks by plan"
        icon={<FileText className="h-4 w-4" />}
        className="w-full sm:w-40"
      >
        <option value={ALL}>All plans ({plan.totalCount})</option>
        {plan.options.map((option) => (
          <option key={option.dmp_id} value={option.dmp_id}>
            {option.title} ({option.count})
          </option>
        ))}
      </Select>
    )}

    <Select
      value={priority}
      onChange={(e) => setPriority(e.target.value)}
      aria-label="Filter by priority"
      icon={<Flag className="h-4 w-4" />}
      className="w-full sm:w-36"
    >
      <option value={ALL}>Priority</option>
      {Priority.options.map((p) => (
        <option key={p} value={p} className="capitalize">
          {p}
        </option>
      ))}
    </Select>

    <Select
      value={stage}
      onChange={(e) => setStage(e.target.value)}
      aria-label="Filter by stage"
      icon={<GitBranch className="h-4 w-4" />}
      className="w-full sm:w-36"
    >
      <option value={ALL}>Stage</option>
      {LifecycleStage.options.map((s) => (
        <option key={s} value={s} className="capitalize">
          {s}
        </option>
      ))}
    </Select>

    <Select
      value={status}
      onChange={(e) => setStatus(e.target.value)}
      aria-label="Filter by status"
      icon={<CheckCircle2 className="h-4 w-4" />}
      className="w-full sm:w-32"
    >
      <option value={ACTIVE}>Active</option>
      {TaskStatus.options.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
      <option value={ALL}>All statuses</option>
    </Select>

    <Select
      value={sort}
      onChange={(e) => setSort(e.target.value as SortKey)}
      aria-label="Sort tasks"
      icon={<ArrowUpDown className="h-4 w-4" />}
      className="w-full sm:w-40"
    >
      <option value="priority">By priority</option>
      <option value="due">By due date</option>
      <option value="stage">By stage</option>
      <option value="title">By title</option>
    </Select>

    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:ml-auto">
      <span className="whitespace-nowrap">
        {visible.length} of {total}
      </span>
      {isFiltered && (
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear
        </Button>
      )}
      {view && onViewChange && (
        <TaskViewToggle view={view} onChange={onViewChange} />
      )}
    </div>
  </div>
);
