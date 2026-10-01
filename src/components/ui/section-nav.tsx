import * as React from "react";
import { Check } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";

export interface SectionNavItem {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  /**
   * Readiness items still unmet in this section. 0 reads as complete, which
   * answers "which section still needs me?" without opening each one.
   */
  outstanding?: number;
}

interface SectionNavProps {
  items: SectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** "horizontal" is the small-screen tab strip; it scrolls rather than wraps. */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

export const SectionNav: React.FC<SectionNavProps> = ({
  items,
  activeId,
  onSelect,
  orientation = "vertical",
  className,
}) => {
  const horizontal = orientation === "horizontal";

  return (
    <nav
      aria-label="Plan sections"
      className={cn(
        horizontal ? "-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" : "space-y-1",
        className,
      )}
    >
      {items.map((item) => {
        const button = (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              horizontal ? "shrink-0 whitespace-nowrap" : "w-full",
              item.id === activeId &&
                !item.disabled &&
                "bg-accent text-accent-foreground",
              item.disabled
                ? "cursor-not-allowed text-muted-foreground/60"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <span className={horizontal ? "" : "flex-1"}>{item.label}</span>
            {item.outstanding !== undefined &&
              (item.outstanding > 0 ? (
                <span
                  title={`${item.outstanding} still needed`}
                  className="rounded-full bg-warn-subtle px-1.5 text-[10px] font-semibold leading-4 text-warn"
                >
                  {item.outstanding}
                </span>
              ) : (
                <Check
                  aria-label="Section complete"
                  className="h-3.5 w-3.5 shrink-0 text-ok"
                />
              ))}
          </button>
        );

        return item.disabled && item.disabledReason ? (
          <Tooltip key={item.id} content={item.disabledReason}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </nav>
  );
};
