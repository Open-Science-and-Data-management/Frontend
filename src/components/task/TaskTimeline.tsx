import React from "react";
import {
  addDays,
  differenceInCalendarDays,
  eachWeekOfInterval,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { CalendarPlus } from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { LifecycleStage } from "@/types/task";
import type { Task } from "@/types/task";
import { cn } from "@/utils/cn";

const DAY_WIDTH = 26;
const NAME_WIDTH = 220;

interface TaskTimelineProps {
  tasks: Task[];
  planLabel?: (dmpId: string) => string | undefined;
  onEdit: (task: Task) => void;
}

/** A task sits on the timeline if it has either end of a date range. */
const span = (task: Task) => {
  const start = task.start_date ?? task.end_date;
  const end = task.end_date ?? task.start_date;
  return start && end
    ? { start: startOfDay(start), end: startOfDay(end) }
    : null;
};

const BAR_TONE: Record<Task["status"], string> = {
  todo: "bg-muted-foreground/30 hover:bg-muted-foreground/40",
  in_progress: "bg-primary/25 hover:bg-primary/35",
  done: "bg-ok/30 hover:bg-ok/40",
  cancelled: "bg-muted opacity-60",
};

const PRIORITY_EDGE: Record<Task["priority"], string> = {
  high: "border-l-destructive",
  medium: "border-l-warn/70",
  low: "border-l-transparent",
};

interface DragState {
  taskId: string;
  mode: "move" | "resize";
  originX: number;
  start: Date;
  end: Date;
  deltaDays: number;
}

/**
 * The plan's work laid out against the calendar. Dates are ordinary editable
 * fields — no evidence gate — so bars can be dragged; status still can't be
 * changed from here, because that is what evidence is for.
 */
export const TaskTimeline: React.FC<TaskTimelineProps> = ({
  tasks,
  planLabel,
  onEdit,
}) => {
  const updateTask = useTaskStore((s) => s.updateTask);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  /**
   * A drag ends with a click event, and by then `drag` is already cleared —
   * without this, finishing a drag also opens the task.
   */
  const draggedRef = React.useRef(false);

  const scheduled = tasks.filter((t) => span(t));
  const unscheduled = tasks.filter((t) => !span(t));

  // The window covers every task plus today, padded out to whole weeks so the
  // header ticks line up.
  const { rangeStart, totalDays } = React.useMemo(() => {
    const points = scheduled.flatMap((t) => {
      const s = span(t)!;
      return [s.start, s.end];
    });
    points.push(startOfDay(new Date()));

    const min = new Date(Math.min(...points.map((d) => d.getTime())));
    const max = new Date(Math.max(...points.map((d) => d.getTime())));
    const from = startOfWeek(min, { weekStartsOn: 1 });
    const to = endOfWeek(max, { weekStartsOn: 1 });

    return {
      rangeStart: from,
      totalDays: Math.max(14, differenceInCalendarDays(to, from) + 1),
    };
  }, [scheduled]);

  const weeks = React.useMemo(
    () =>
      eachWeekOfInterval(
        { start: rangeStart, end: addDays(rangeStart, totalDays - 1) },
        { weekStartsOn: 1 },
      ),
    [rangeStart, totalDays],
  );

  const offsetOf = (date: Date) => differenceInCalendarDays(date, rangeStart);
  const todayOffset = offsetOf(startOfDay(new Date()));

  /** Where a bar sits, including the day offset of an in-flight drag. */
  const placement = (task: Task) => {
    const base = span(task);
    if (!base) return null;

    const active = drag?.taskId === task.task_id ? drag : null;
    const shift = active?.deltaDays ?? 0;

    const start =
      active?.mode === "move" ? addDays(base.start, shift) : base.start;
    const end = active ? addDays(base.end, shift) : base.end;

    const days = Math.max(1, differenceInCalendarDays(end, start) + 1);
    return {
      left: offsetOf(start) * DAY_WIDTH,
      width: days * DAY_WIDTH,
      start,
      end,
    };
  };

  const beginDrag = (
    event: React.PointerEvent,
    task: Task,
    mode: DragState["mode"],
  ) => {
    const base = span(task);
    if (!base || task.status === "cancelled") return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggedRef.current = false;
    setDrag({
      taskId: task.task_id as string,
      mode,
      originX: event.clientX,
      start: base.start,
      end: base.end,
      deltaDays: 0,
    });
  };

  const onDragMove = (event: React.PointerEvent) => {
    if (!drag) return;
    // Snapped to whole days: a timeline that lands between days is a lie.
    const deltaDays = Math.round((event.clientX - drag.originX) / DAY_WIDTH);
    if (deltaDays !== drag.deltaDays) {
      if (deltaDays !== 0) draggedRef.current = true;
      setDrag({ ...drag, deltaDays });
    }
  };

  const endDrag = () => {
    if (!drag) return;
    const { taskId, mode, start, end, deltaDays } = drag;
    setDrag(null);
    if (deltaDays === 0) return;

    if (mode === "move") {
      updateTask(taskId, {
        start_date: addDays(start, deltaDays),
        end_date: addDays(end, deltaDays),
      });
      return;
    }

    // Resizing only moves the far end, and never past the near one.
    const nextEnd = addDays(end, deltaDays);
    updateTask(taskId, {
      start_date: start,
      end_date: nextEnd < start ? start : nextEnd,
    });
  };

  const groups = LifecycleStage.options
    .map((stage) => ({
      stage,
      items: scheduled.filter((t) => t.lifecycle_stage === stage),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <div
          style={{
            width: NAME_WIDTH + totalDays * DAY_WIDTH,
            minWidth: "100%",
          }}
        >
          {/* Header: one tick per week, labelled with the week's Monday. */}
          <div className="flex border-b bg-muted/30">
            <div
              className="shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground"
              style={{ width: NAME_WIDTH }}
            >
              {scheduled.length} scheduled
            </div>
            <div
              className="relative"
              style={{ width: totalDays * DAY_WIDTH, height: 36 }}
            >
              {weeks.map((week) => (
                <div
                  key={week.toISOString()}
                  className="absolute top-0 h-full border-l pl-1 pt-2 text-[11px] text-muted-foreground"
                  style={{ left: offsetOf(week) * DAY_WIDTH }}
                >
                  {format(week, "d MMM")}
                </div>
              ))}
            </div>
          </div>

          <div
            className="relative"
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {/* Today, drawn once behind every row. */}
            {todayOffset >= 0 && todayOffset < totalDays && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-ai"
                style={{ left: NAME_WIDTH + todayOffset * DAY_WIDTH }}
              />
            )}

            {groups.map((group) => (
              <div key={group.stage}>
                <div className="flex border-b bg-muted/20">
                  <div
                    className="shrink-0 px-3 py-1 text-xs font-semibold capitalize text-muted-foreground"
                    style={{ width: NAME_WIDTH }}
                  >
                    {group.stage}
                  </div>
                  <div style={{ width: totalDays * DAY_WIDTH }} />
                </div>

                {group.items.map((task) => {
                  const place = placement(task)!;
                  const dragging = drag?.taskId === task.task_id;

                  return (
                    <div
                      key={task.task_id}
                      className="flex border-b last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => onEdit(task)}
                        className="shrink-0 truncate px-3 py-2 text-left text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ width: NAME_WIDTH }}
                        title={task.title}
                      >
                        <span
                          className={cn(
                            task.status === "done" &&
                              "text-muted-foreground line-through",
                          )}
                        >
                          {task.title}
                        </span>
                        {planLabel?.(task.dmp_id) && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {planLabel(task.dmp_id)}
                          </span>
                        )}
                      </button>

                      <div
                        className="relative py-1.5"
                        style={{ width: totalDays * DAY_WIDTH }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`${task.title}, ${format(place.start, "d MMM")} to ${format(place.end, "d MMM")}`}
                          onPointerDown={(e) => beginDrag(e, task, "move")}
                          onClick={() => {
                            if (draggedRef.current) {
                              draggedRef.current = false;
                              return;
                            }
                            onEdit(task);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onEdit(task);
                            }
                          }}
                          className={cn(
                            "absolute flex h-7 items-center rounded border-l-4 px-2 text-xs transition-colors",
                            BAR_TONE[task.status],
                            PRIORITY_EDGE[task.priority],
                            task.status === "cancelled"
                              ? "cursor-not-allowed"
                              : "cursor-grab active:cursor-grabbing",
                            dragging && "ring-2 ring-ring",
                          )}
                          style={{ left: place.left, width: place.width }}
                        >
                          {place.width >= 60 && task.progress_percent > 0 && (
                            <span className="truncate">
                              {task.progress_percent}%
                            </span>
                          )}
                          {task.status !== "cancelled" && (
                            <span
                              aria-hidden="true"
                              onPointerDown={(e) =>
                                beginDrag(e, task, "resize")
                              }
                              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r hover:bg-foreground/10"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {scheduled.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No tasks have dates yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dateless work would otherwise vanish from this view entirely. */}
      {unscheduled.length > 0 && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Not scheduled ({unscheduled.length}) — open a task to give it dates.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unscheduled.map((task) => (
              <button
                key={task.task_id}
                type="button"
                onClick={() => onEdit(task)}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CalendarPlus className="h-3 w-3 text-muted-foreground" />
                <span className="max-w-[18rem] truncate">{task.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
