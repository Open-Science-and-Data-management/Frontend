import React from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/utils/cn";

export type TaskView = "list" | "board";

const KEY = "tasks-view";

/** Remembered per device, like the sidebar's collapsed state. */
export const useTaskView = (): [TaskView, (v: TaskView) => void] => {
  const [view, setView] = React.useState<TaskView>(() =>
    localStorage.getItem(KEY) === "board" ? "board" : "list",
  );

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
    {(
      [
        { id: "list", label: "List", icon: List },
        { id: "board", label: "Board", icon: LayoutGrid },
      ] as const
    ).map((option) => (
      <button
        key={option.id}
        type="button"
        aria-pressed={view === option.id}
        onClick={() => onChange(option.id)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          view === option.id
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <option.icon className="h-4 w-4" />
        {option.label}
      </button>
    ))}
  </div>
);
