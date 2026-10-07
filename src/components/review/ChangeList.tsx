import React from "react";
import type { FieldChange } from "@/config/plan-diff";
import { cn } from "@/utils/cn";

/**
 * What a revision changes, one row per field, tagged by whether it alters
 * what was agreed. Majors first: those are the ones the decision is about.
 */
export const ChangeList: React.FC<{ changes: FieldChange[] }> = ({
  changes,
}) => {
  const ordered = [...changes].sort(
    (a, b) => Number(b.edit_type === "major") - Number(a.edit_type === "major"),
  );

  return (
    <ul className="space-y-2">
      {ordered.map((change) => (
        <li key={change.path} className="flex items-start gap-2 text-sm">
          <span
            className={cn(
              "mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-semibold uppercase leading-5",
              change.edit_type === "major"
                ? "bg-warn-subtle text-warn"
                : "bg-muted text-muted-foreground",
            )}
          >
            {change.edit_type}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{change.label}</span>
            <span className="block break-words text-xs text-muted-foreground">
              <span className="line-through decoration-muted-foreground/60">
                {change.from}
              </span>{" "}
              → <span className="text-foreground">{change.to}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
};
