import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ChecklistItem {
  label: string;
  done: boolean;
}

interface ReadyChecklistProps {
  items: ChecklistItem[];
}

export const ReadyChecklist: React.FC<ReadyChecklistProps> = ({ items }) => {
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Ready to submit?</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {doneCount} of {items.length} ready
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className={cn(!item.done && "text-muted-foreground")}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
