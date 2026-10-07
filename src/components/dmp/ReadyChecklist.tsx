import React from "react";
import { ChevronRight } from "lucide-react";
import {
  DMP_SECTIONS,
  SECTION_LABELS,
  type DmpSection,
  type ReadinessItem,
} from "@/hooks/useDmpReadiness";

interface ReadyChecklistProps {
  items: ReadinessItem[];
  /** Given, every row becomes a link to the section that owns the field. */
  onNavigate?: (section: DmpSection, fieldId?: string) => void;
}

/**
 * What the plan still needs, grouped under the section that owns it.
 *
 * Only unmet items appear: the section nav already reports what's done, and a
 * roll-call of satisfied rows buries the one or two that need you.
 */
export const ReadyChecklist: React.FC<ReadyChecklistProps> = ({
  items,
  onNavigate,
}) => {
  const groups = DMP_SECTIONS.map((id) => ({
    id,
    label: SECTION_LABELS[id],
    outstanding: items.filter((item) => item.section === id && !item.done),
  })).filter((group) => group.outstanding.length > 0);

  const total = groups.reduce((n, group) => n + group.outstanding.length, 0);

  if (total === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold text-ok">Ready to submit</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Every required field is filled in.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Before you submit</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {total} {total === 1 ? "item" : "items"} left in {groups.length}{" "}
        {groups.length === 1 ? "section" : "sections"}
      </p>

      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="flex-1">{group.label}</span>
              {/* The same pill the section nav uses, so the two agree on sight. */}
              <span className="rounded-full bg-warn-subtle px-1.5 text-[10px] leading-4 text-warn">
                {group.outstanding.length}
              </span>
            </p>

            <ul className="mt-1 space-y-0.5 border-l pl-2">
              {group.outstanding.map((item) => (
                <li key={item.label}>
                  {onNavigate ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(group.id, item.fieldId)}
                      className="flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1">{item.label}</span>
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ) : (
                    <span className="block px-1.5 py-1 text-sm">
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
