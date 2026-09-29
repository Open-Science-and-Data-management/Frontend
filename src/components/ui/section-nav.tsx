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
}

export const SectionNav: React.FC<SectionNavProps> = ({
  items,
  activeId,
  onSelect,
}) => {
  return (
    <nav aria-label="Plan sections" className="space-y-1">
      {items.map((item) => {
        const button = (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => onSelect(item.id)}
            className={cn(
              "w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              item.id === activeId && !item.disabled && "bg-accent text-accent-foreground",
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
