import React from "react";
import { Check, Lock } from "lucide-react";
import type { Task } from "@/types/task";
import { cn } from "@/utils/cn";

const PRIORITY_BAR: Record<Task["priority"], string> = {
  high: "bg-destructive",
  medium: "bg-warn/70",
  low: "bg-transparent",
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  high: "high priority",
  medium: "medium priority",
  low: "low priority",
};

/**
 * Priority is the stripe down the left edge of a row, not another badge
 * competing with the stage tag. Medium is the default, so it stays quiet, and
 * low says nothing at all.
 */
export const TaskPriorityBar: React.FC<{
  priority: Task["priority"];
  className?: string;
}> = ({ priority, className }) => (
  <span
    role="img"
    aria-label={PRIORITY_LABEL[priority]}
    className={cn(
      "w-1 shrink-0 rounded-l-lg",
      PRIORITY_BAR[priority],
      className,
    )}
  />
);

const STAGE_DOTS: Record<Task["lifecycle_stage"], string> = {
  collect: "bg-primary/30",
  process: "bg-primary/50",
  analyse: "bg-primary/70",
  preserve: "bg-primary/85",
  share: "bg-primary",
};

/**
 * The one text tag a row keeps: the lifecycle stage, because it's what ties a
 * task to dataset progress. Deliberately one hue — green, amber, pink and red
 * already mean done, attention, AI and error here.
 */
export const TaskLifecycleTag: React.FC<{
  stage: Task["lifecycle_stage"];
  className?: string;
}> = ({ stage, className }) => (
  <span
    title={`Lifecycle stage: ${stage}`}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-md border border-input bg-muted/60 px-2 py-0.5 text-xs font-medium capitalize text-foreground",
      className,
    )}
  >
    <span
      className={cn("h-1.5 w-1.5 rounded-full", STAGE_DOTS[stage])}
      aria-hidden="true"
    />
    {stage}
  </span>
);

const STATUS_LABELS: Record<Task["status"], string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

/**
 * Status as the row's own box. It becomes a real control when the task can
 * legitimately be closed — self-declared work, or work whose evidence is
 * already attached. When evidence is still owed it stays a plain indicator and
 * the click falls through to open the task, where the rule is explained.
 */
export const TaskStatusBox: React.FC<{
  status: Task["status"];
  className?: string;
  /** Given, the box is a button that closes or reopens the task. */
  onToggle?: () => void;
  /** Why it can't be ticked yet; shown on hover. */
  blockedReason?: string;
  /** What the button does, for screen readers. */
  actionLabel?: string;
}> = ({ status, className, onToggle, blockedReason, actionLabel }) => {
  // The visual box stays 16px; the control around it does not. A 16px target
  // is below the 24px minimum, and a near-miss lands on the row instead —
  // which opens the task and reads as "the checkbox is broken".
  const box = cn(
    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
    status === "done"
      ? "border-ok bg-ok text-ok-foreground"
      : status === "cancelled"
        ? "border-input bg-muted text-muted-foreground"
        : "border-input",
  );

  const mark = (
    <>
      {status === "done" && <Check className="h-3 w-3" />}
      {status === "cancelled" && <span className="text-[10px]">–</span>}
    </>
  );

  if (onToggle) {
    return (
      <button
        type="button"
        aria-label={actionLabel ?? STATUS_LABELS[status]}
        aria-pressed={status === "done"}
        onClick={(e) => {
          // The row opens the task; this box is about closing it.
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <span className={cn(box, "group-hover:border-ok")}>{mark}</span>
      </button>
    );
  }

  // Gated: it can't be ticked until evidence exists, and it has to look
  // different from one that can — otherwise it just reads as broken.
  if (blockedReason) {
    return (
      <span
        role="img"
        aria-label={`${STATUS_LABELS[status]} — ${blockedReason}`}
        title={blockedReason}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-dashed border-warn/70 bg-warn-subtle text-warn",
          className,
        )}
      >
        <Lock className="h-2.5 w-2.5" />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={STATUS_LABELS[status]}
      className={cn(box, className)}
    >
      {mark}
    </span>
  );
};

export { STATUS_LABELS };
