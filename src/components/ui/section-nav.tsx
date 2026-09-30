import * as React from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";

export interface SectionNavItem {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
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
              "rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              horizontal ? "shrink-0 whitespace-nowrap" : "w-full",
              item.id === activeId &&
                !item.disabled &&
                "bg-accent text-accent-foreground",
              item.disabled
                ? "cursor-not-allowed text-muted-foreground/60"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {item.label}
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
