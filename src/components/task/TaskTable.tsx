import React from "react";
import { dayString, fromDayString, toLocalDay } from "@/utils/calendarDate";
import { format } from "date-fns";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  CircleDot,
  FileText,
  Flag,
  GitBranch,
  Link2,
  ListChecks,
  MoreHorizontal,
  Paperclip,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LifecycleStage, Priority } from "@/types/task";
import type { Task } from "@/types/task";
import { hasRecordedWork, useTaskStore } from "@/store/taskStore";
import { useToastStore } from "@/store/toastStore";
import { usePlanModeFor } from "@/hooks/usePlanMode";
import { useDmpStore } from "@/store/dmpStore";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { ProgressBar } from "@/components/ui/progress-bar";
import { STATUS_LABELS, TaskStatusBox } from "@/components/task/TaskMeta";
import type { SortKey } from "@/components/task/TaskFilters";
import {
  REQUIREMENT_COPY,
  requirementFor,
  toggleState,
} from "@/config/task-evidence";
import { cn } from "@/utils/cn";

type ColumnId =
  | "status"
  | "name"
  | "state"
  | "stage"
  | "priority"
  | "dates"
  | "progress"
  | "evidence"
  | "plan";

interface Column {
  id: ColumnId;
  label: string;
  icon: LucideIcon;
  width: number;
  /** Set when the column heading can order the table. */
  sort?: SortKey;
  /** The row's identity: always shown, like a database's title property. */
  fixed?: boolean;
}

const COLUMNS: Column[] = [
  { id: "status", label: "Done", icon: CircleDashed, width: 44, fixed: true },
  {
    id: "name",
    label: "Task",
    icon: Type,
    width: 260,
    sort: "title",
    fixed: true,
  },
  { id: "state", label: "Status", icon: CircleDot, width: 116 },
  { id: "stage", label: "Stage", icon: GitBranch, width: 124, sort: "stage" },
  {
    id: "priority",
    label: "Priority",
    icon: Flag,
    width: 112,
    sort: "priority",
  },
  { id: "dates", label: "Dates", icon: CalendarDays, width: 158, sort: "due" },
  { id: "progress", label: "Progress", icon: ListChecks, width: 116 },
  { id: "evidence", label: "Evidence", icon: Paperclip, width: 150 },
  { id: "plan", label: "Plan", icon: FileText, width: 150 },
];

/** Width of the trailing cell that holds the row menu and the column menu. */
const GUTTER = 44;
const STORAGE_KEY = "tasks-table-columns";

const PRIORITY_DOT: Record<Task["priority"], string> = {
  high: "bg-destructive",
  medium: "bg-warn",
  low: "bg-muted-foreground/40",
};

const STAGE_DOT: Record<Task["lifecycle_stage"], string> = {
  collect: "bg-primary/30",
  process: "bg-primary/50",
  analyse: "bg-primary/70",
  preserve: "bg-primary/85",
  share: "bg-primary",
};

const STATE_DOT: Record<Task["status"], string> = {
  todo: "bg-muted-foreground/40",
  in_progress: "bg-primary",
  done: "bg-ok",
  cancelled: "bg-muted-foreground/30",
};

const EVIDENCE_ICON = {
  none: null,
  file: Paperclip,
  url: Link2,
  rdm_deposit: ShieldCheck,
} as const;

/** Which properties are showing, remembered per device like the view itself. */
const useVisibleColumns = () => {
  const [hidden, setHidden] = React.useState<ColumnId[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ColumnId[]) : [];
    } catch {
      return [];
    }
  });

  const toggle = (id: ColumnId) =>
    setHidden((previous) => {
      const next = previous.includes(id)
        ? previous.filter((c) => c !== id)
        : [...previous, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // A browser with site data blocked still gets a working table.
      }
      return next;
    });

  return [hidden, toggle] as const;
};

const toInput = (date?: Date) => dayString(date);

/** A cell that opens a list of values — the table's one editing gesture. */
const SelectCell: React.FC<{
  label: string;
  options: { value: string; label: string; dot?: string }[];
  value: string;
  onSelect: (value: string) => void;
  children: React.ReactNode;
}> = ({ label, options, value, onSelect, children }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex h-8 w-full items-center rounded px-1.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-44 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {option.dot && (
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full", option.dot)}
                  aria-hidden="true"
                />
              )}
              <span className="flex-1 capitalize">{option.label}</span>
              {option.value === value && (
                <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
            </button>
          ))}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};

interface TaskRowProps {
  task: Task;
  columns: Column[];
  planLabel?: (dmpId: string) => string | undefined;
  onEdit: (task: Task) => void;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  columns,
  planLabel,
  onEdit,
}) => {
  const { updateTask, completeTask, reopenTask, cancelTask, deleteTask } =
    useTaskStore();
  const toast = useToastStore((s) => s.toast);
  const planModeFor = usePlanModeFor();
  const confirm = useConfirm();
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [draft, setDraft] = React.useState(task.title);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const id = task.task_id as string;
  const isDone = task.status === "done";
  const isCancelled = task.status === "cancelled";
  const { canToggle, blockedReason } = toggleState(
    task,
    planModeFor(task.dmp_id),
  );
  const orphaned = useDmpStore((s) =>
    task.dataset_id ? !s.datasetExists(task.dmp_id, task.dataset_id) : false,
  );

  const checklist = task.checklist ?? [];
  const doneSteps = checklist.filter((i) => i.done).length;
  const EvidenceIcon = EVIDENCE_ICON[task.evidence?.type ?? "none"];

  const toggle = () => {
    if (isDone) {
      reopenTask(id);
      return;
    }
    // Closing still runs the evidence rule — a table cell is not a shortcut
    // past the gate the tick box and the board both answer to.
    if (completeTask(id))
      toast({ title: "Task closed", description: task.title });
  };

  const commitTitle = () => {
    const next = draft.trim();
    setEditingTitle(false);
    if (!next) {
      setDraft(task.title);
      return;
    }
    if (next !== task.title) updateTask(id, { title: next });
  };

  const setDate = (field: "start_date" | "end_date", value: string) => {
    const next = fromDayString(value);
    const start = field === "start_date" ? next : task.start_date;
    const end = field === "end_date" ? next : task.end_date;

    if (start && end && end < start) {
      toast({
        title: "That ends before it starts",
        description: "Move the other date first.",
        variant: "destructive",
      });
      return;
    }
    updateTask(id, { [field]: next });
  };

  const dateLabel = () => {
    const { start_date: start, end_date: end } = task;
    if (!start && !end) return <span className="text-muted-foreground">—</span>;
    if (start && end)
      return `${format(toLocalDay(start), "d MMM")} → ${format(toLocalDay(end), "d MMM")}`;
    return format(toLocalDay((start ?? end) as Date), "d MMM yyyy");
  };

  const cell = (column: Column) => {
    switch (column.id) {
      case "status":
        return (
          <div className="flex justify-center">
            <TaskStatusBox
              status={task.status}
              onToggle={canToggle ? toggle : undefined}
              blockedReason={blockedReason}
              actionLabel={
                isDone ? `Reopen ${task.title}` : `Mark ${task.title} done`
              }
            />
          </div>
        );

      case "name":
        return editingTitle ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTitle();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDraft(task.title);
                setEditingTitle(false);
              }
            }}
            aria-label={`Rename ${task.title}`}
            className="h-8 w-full rounded border border-primary bg-background px-1.5 text-sm focus:outline-none"
          />
        ) : (
          <div className="group/name flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setDraft(task.title);
                setEditingTitle(true);
              }}
              aria-label={`Edit title of ${task.title}`}
              className="h-8 min-w-0 flex-1 truncate rounded px-1.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  (isDone || isCancelled) &&
                    "text-muted-foreground line-through",
                )}
              >
                {task.title}
              </span>
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(task)}
              className="h-6 shrink-0 px-1.5 text-xs opacity-0 transition-opacity focus-visible:opacity-100 group-hover/name:opacity-100"
            >
              Open
            </Button>
          </div>
        );

      case "state":
        return (
          <span className="flex h-8 items-center gap-1.5 px-1.5 text-xs">
            <span
              className={cn("h-2 w-2 rounded-full", STATE_DOT[task.status])}
              aria-hidden="true"
            />
            {STATUS_LABELS[task.status]}
          </span>
        );

      case "stage":
        return (
          <SelectCell
            label={`Stage of ${task.title}`}
            value={task.lifecycle_stage}
            options={LifecycleStage.options.map((stage) => ({
              value: stage,
              label: stage,
              dot: STAGE_DOT[stage],
            }))}
            onSelect={(value) =>
              updateTask(id, {
                lifecycle_stage: value as Task["lifecycle_stage"],
              })
            }
          >
            <span className="inline-flex items-center gap-1.5 rounded-md border border-input bg-muted/60 px-2 py-0.5 text-xs capitalize">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  STAGE_DOT[task.lifecycle_stage],
                )}
                aria-hidden="true"
              />
              {task.lifecycle_stage}
            </span>
          </SelectCell>
        );

      case "priority":
        return (
          <SelectCell
            label={`Priority of ${task.title}`}
            value={task.priority}
            options={Priority.options.map((priority) => ({
              value: priority,
              label: priority,
              dot: PRIORITY_DOT[priority],
            }))}
            onSelect={(value) =>
              updateTask(id, { priority: value as Task["priority"] })
            }
          >
            <span className="inline-flex items-center gap-1.5 text-xs capitalize">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  PRIORITY_DOT[task.priority],
                )}
                aria-hidden="true"
              />
              {task.priority}
            </span>
          </SelectCell>
        );

      case "dates":
        return (
          <PopoverPrimitive.Root>
            <PopoverPrimitive.Trigger asChild>
              <button
                type="button"
                aria-label={`Dates of ${task.title}`}
                className="flex h-8 w-full items-center rounded px-1.5 text-left text-xs transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {dateLabel()}
              </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                align="start"
                sideOffset={4}
                className="z-50 w-60 space-y-2 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md"
              >
                <label className="block text-xs font-medium text-muted-foreground">
                  Start
                  <input
                    type="date"
                    value={toInput(task.start_date)}
                    onChange={(e) => setDate("start_date", e.target.value)}
                    className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  />
                </label>
                <label className="block text-xs font-medium text-muted-foreground">
                  End
                  <input
                    type="date"
                    value={toInput(task.end_date)}
                    onChange={(e) => setDate("end_date", e.target.value)}
                    className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  />
                </label>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        );

      case "progress":
        return checklist.length === 0 ? (
          <span className="flex h-8 items-center px-1.5 text-xs text-muted-foreground">
            No steps
          </span>
        ) : (
          <div
            className="flex h-8 flex-col justify-center gap-1 px-1.5"
            title="Derived from the checklist — tick steps inside the task"
          >
            <span className="text-xs tabular-nums text-muted-foreground">
              {doneSteps}/{checklist.length} steps
            </span>
            <ProgressBar
              value={task.progress_percent}
              label={`${task.title} progress`}
            />
          </div>
        );

      case "evidence": {
        const requirement = requirementFor(task);
        if (EvidenceIcon)
          return (
            <span
              className={cn(
                "flex h-8 items-center gap-1.5 px-1.5 text-xs",
                task.evidence.type === "rdm_deposit" && "text-ok",
              )}
              title={task.evidence.label ?? task.evidence.ref}
            >
              <EvidenceIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {task.evidence.label ?? task.evidence.ref}
              </span>
            </span>
          );
        return (
          <span
            className={cn(
              "flex h-8 items-center px-1.5 text-xs",
              requirement === "declared" || isCancelled
                ? "text-muted-foreground"
                : "text-warn",
            )}
            title={REQUIREMENT_COPY[requirement].hint}
          >
            {requirement === "declared" || isCancelled
              ? "Not needed"
              : "Needed to close"}
          </span>
        );
      }

      case "plan":
        return (
          <span className="flex h-8 items-center gap-1 px-1.5 text-xs text-muted-foreground">
            <span className="truncate">{planLabel?.(task.dmp_id) ?? "—"}</span>
            {orphaned && (
              <span
                title="The research output this task belonged to was removed"
                className="shrink-0 rounded border border-dashed border-input px-1"
              >
                orphan
              </span>
            )}
          </span>
        );
    }
  };

  let offset = 0;

  return (
    <tr
      className={cn(
        "group border-b last:border-b-0 hover:bg-muted/50",
        isCancelled && "opacity-60",
      )}
    >
      {columns.map((column) => {
        const sticky = column.fixed;
        const left = offset;
        if (sticky) offset += column.width;

        return (
          <td
            key={column.id}
            style={sticky ? { left } : undefined}
            className={cn(
              "border-r p-1 align-middle",
              // A frozen cell paints its own background, so the row's
              // translucent hover can't reach it. Laying the same tint on as a
              // gradient over bg-card lands on exactly the row's colour.
              sticky &&
                "sticky z-10 bg-card group-hover:bg-gradient-to-r group-hover:from-muted/50 group-hover:to-muted/50",
            )}
          >
            {cell(column)}
          </td>
        );
      })}

      <td className="p-1">
        <PopoverPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverPrimitive.Trigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${task.title}`}
              className="h-7 w-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="end"
              sideOffset={4}
              className="z-50 w-44 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(task);
                }}
                className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                Open task
              </button>
              {/* Finished work is reopened, never cancelled over. */}
              {!isCancelled && !isDone && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    cancelTask(id);
                  }}
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  Cancel task
                </button>
              )}
              {/* Recorded work is evidence: only an untouched task can go. */}
              {!hasRecordedWork(task) && (
                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false);
                    if (
                      await confirm({
                        title: "Delete this task?",
                        description: "No work is recorded on it yet.",
                        confirmLabel: "Delete task",
                      })
                    )
                      deleteTask(id);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete task
                </button>
              )}
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      </td>
    </tr>
  );
};

interface TaskTableProps {
  tasks: Task[];
  planLabel?: (dmpId: string) => string | undefined;
  onEdit: (task: Task) => void;
  /** Given, the table gets its own "New task" row. */
  onCreate?: () => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  descending: boolean;
  onDescendingChange: (descending: boolean) => void;
}

/**
 * The spreadsheet view: one row per task, one column per property, edited in
 * place. Sorting is the filter bar's — a heading sets the same key the bar
 * shows, so the two can't disagree about how the table is ordered.
 */
export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  planLabel,
  onEdit,
  onCreate,
  sort,
  onSortChange,
  descending,
  onDescendingChange,
}) => {
  const [hidden, toggleColumn] = useVisibleColumns();
  const [propsOpen, setPropsOpen] = React.useState(false);

  // The plan column only means something when the table mixes several plans.
  const available = COLUMNS.filter((c) => c.id !== "plan" || planLabel);
  const columns = available.filter((c) => !hidden.includes(c.id));
  const width = columns.reduce((sum, c) => sum + c.width, GUTTER);

  // Ordering is the toolbar's — a heading sets the same key and direction the
  // Sort menu shows, so the two can't disagree about it.
  const order = (column: Column) => {
    if (!column.sort) return;
    if (column.sort === sort) {
      onDescendingChange(!descending);
      return;
    }
    onSortChange(column.sort);
    onDescendingChange(false);
  };

  let headOffset = 0;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="max-h-[70vh] overflow-auto">
        <table
          className="w-full table-fixed border-collapse text-sm"
          style={{ minWidth: width }}
        >
          <colgroup>
            {columns.map((column) => (
              <col key={column.id} style={{ width: column.width }} />
            ))}
            <col style={{ width: GUTTER }} />
          </colgroup>

          <thead>
            <tr className="border-b bg-muted/40">
              {columns.map((column) => {
                const sticky = column.fixed;
                const left = headOffset;
                if (sticky) headOffset += column.width;
                const active = column.sort && column.sort === sort;
                const Arrow = descending ? ChevronDown : ChevronUp;

                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={
                      active
                        ? descending
                          ? "descending"
                          : "ascending"
                        : undefined
                    }
                    style={sticky ? { left } : undefined}
                    className={cn(
                      "sticky top-0 border-r p-0 text-left font-normal",
                      sticky ? "z-30 bg-muted" : "z-20 bg-muted/40",
                    )}
                  >
                    <button
                      type="button"
                      disabled={!column.sort}
                      onClick={() => order(column)}
                      title={
                        column.sort ? `Sort by ${column.label}` : column.label
                      }
                      className={cn(
                        "flex h-9 w-full items-center gap-1.5 px-2 text-xs text-muted-foreground",
                        column.sort &&
                          "transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        active && "text-foreground",
                      )}
                    >
                      <column.icon className="h-3.5 w-3.5 shrink-0" />
                      <span
                        className={cn(
                          "truncate",
                          column.id === "status" && "sr-only",
                        )}
                      >
                        {column.label}
                      </span>
                      {active && <Arrow className="ml-auto h-3.5 w-3.5" />}
                    </button>
                  </th>
                );
              })}

              <th scope="col" className="sticky top-0 z-20 bg-muted/40 p-1">
                <PopoverPrimitive.Root
                  open={propsOpen}
                  onOpenChange={setPropsOpen}
                >
                  <PopoverPrimitive.Trigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Show or hide properties"
                      title="Properties"
                      className="h-7 w-7"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverPrimitive.Trigger>
                  <PopoverPrimitive.Portal>
                    <PopoverPrimitive.Content
                      align="end"
                      sideOffset={4}
                      className="z-50 w-52 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
                    >
                      <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        Properties
                      </p>
                      {available.map((column) => (
                        <button
                          key={column.id}
                          type="button"
                          disabled={column.fixed}
                          onClick={() => toggleColumn(column.id)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                        >
                          <column.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="flex-1">{column.label}</span>
                          {!hidden.includes(column.id) && (
                            <Check className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                      ))}
                    </PopoverPrimitive.Content>
                  </PopoverPrimitive.Portal>
                </PopoverPrimitive.Root>
              </th>
            </tr>
          </thead>

          <tbody>
            {tasks.map((task) => (
              <TaskRow
                key={task.task_id}
                task={task}
                columns={columns}
                planLabel={planLabel}
                onEdit={onEdit}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-2 py-1.5">
        {onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-3.5 w-3.5" />
            New task
          </button>
        ) : (
          <span />
        )}
        <span className="px-1.5 text-xs text-muted-foreground">
          Count {tasks.length}
        </span>
      </div>
    </div>
  );
};
