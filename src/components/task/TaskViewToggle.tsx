import React from "react";
import { CalendarRange, LayoutGrid, List, Table2 } from "lucide-react";
import { cn } from "@/utils/cn";

export type TaskView = "list" | "table" | "board" | "timeline";

const KEY = "tasks-view";

const VIEWS = [
  { id: "list", label: "List", icon: List },
  { id: "table", label: "Table", icon: Table2 },
  { id: "board", label: "Board", icon: LayoutGrid },
  { id: "timeline", label: "Timeline", icon: CalendarRange },
] as const;

/** Remembered per device, like the sidebar's collapsed state. */
export const useTaskView = (): [TaskView, (v: TaskView) => void] => {
  const [view, setView] = React.useState<TaskView>(() => {
    const stored = localStorage.getItem(KEY);
    return VIEWS.some((v) => v.id === stored) ? (stored as TaskView) : "list";
  });

  return [
    view,
    (next: TaskView) => {
      localStorage.setItem(KEY, next);
      setView(next);
    },
  ];
};

export const TaskViewToggle: React.FC<{
  view: TaskView;
  onChange: (v: TaskView) => void;
}> = ({ view, onChange }) => (
  <div
    role="group"
    aria-label="Task view"
    className="inline-flex rounded-md border p-0.5"
  >
    {VIEWS.map((option) => (
      <button
        key={option.id}
        type="button"
        aria-label={option.label}
        title={option.label}
        aria-pressed={view === option.id}
        onClick={() => onChange(option.id)}
        className={cn(
          "inline-flex items-center rounded px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          view === option.id
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <option.icon className="h-4 w-4" />
        {/* Four views don't fit the bar with labels; the icon carries it. */}
        <span className="sr-only">{option.label}</span>
      </button>
    ))}
  </div>
);
