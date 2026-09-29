import React from "react";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import {
  SECTION_LABELS,
  type DmpSection,
  type ReadinessItem,
} from "@/hooks/useDmpReadiness";
import { cn } from "@/utils/cn";

interface ReadyChecklistProps {
  items: ReadinessItem[];
  /** Given, every row becomes a link to the section that owns the field. */
  onNavigate?: (section: DmpSection) => void;
}

export const ReadyChecklist: React.FC<ReadyChecklistProps> = ({
  items,
  onNavigate,
}) => {
  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Ready to submit?</h3>
      <p
        className={cn(
          "mt-0.5 text-xs",
          allDone ? "text-ok" : "text-muted-foreground",
        )}
      >
        {doneCount} of {items.length} ready
      </p>

      <ul className="mt-3 space-y-1">
        {items.map((item) => {
          const body = (
            <>
              {item.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn("block", !item.done && "text-foreground")}>
                  {item.label}
                </span>
                {/* Naming the section answers "where do I go to fix this?" */}
                <span className="block text-xs text-muted-foreground">
                  {SECTION_LABELS[item.section]}
                </span>
              </span>
              {onNavigate && (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </>
          );

          return (
            <li key={item.label}>
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate(item.section)}
                  className="flex w-full items-start gap-2 rounded-md p-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-2 p-1.5 text-sm">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
