import React from "react";
import { Select } from "@/components/ui/select";
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
  const [priority, setPriority] = React.useState<string>(ALL);
  const [stage, setStage] = React.useState<string>(ALL);
  const [status, setStatus] = React.useState<string>(ACTIVE);
  const [sort, setSort] = React.useState<SortKey>("priority");

  const visible = React.useMemo(() => {
    const filtered = tasks.filter(
      (t) =>
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
  }, [tasks, priority, stage, status, sort]);

  const isFiltered = priority !== ALL || stage !== ALL || status !== ACTIVE;
  const clear = () => {
    setPriority(ALL);
    setStage(ALL);
    setStatus(ACTIVE);
  };

  return {
    visible,
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

export const TaskFilters: React.FC<
  Filters & {
    total: number;
    /** Given, the view switch sits in the same bar as the filters. */
    view?: TaskView;
    onViewChange?: (v: TaskView) => void;
  }
> = ({
  visible,
  total,
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
  view,
  onViewChange,
}) => (
  <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        aria-label="Filter by priority"
        className="w-full sm:w-40"
      >
        <option value={ALL}>All priorities</option>
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
        className="w-full sm:w-40"
      >
        <option value={ALL}>All stages</option>
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
        className="w-full sm:w-40"
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
        className="w-full sm:w-44"
      >
        <option value="priority">Sort: Priority</option>
        <option value="due">Sort: Due date</option>
        <option value="stage">Sort: Stage</option>
        <option value="title">Sort: Title</option>
      </Select>
    </div>

    <div className="flex items-center gap-2 text-sm text-muted-foreground sm:ml-auto">
      <span className="whitespace-nowrap">
        {visible.length} of {total}
      </span>
      {isFiltered && (
        <Button variant="ghost" size="sm" onClick={clear}>
          Clear
        </Button>
      )}
      {view && onViewChange && (
        <>
          <span
            className="mx-1 hidden h-6 w-px bg-border sm:block"
            aria-hidden="true"
          />
          <TaskViewToggle view={view} onChange={onViewChange} />
        </>
      )}
    </div>
  </div>
);
