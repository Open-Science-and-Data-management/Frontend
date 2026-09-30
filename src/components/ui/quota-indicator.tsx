import * as React from "react";
import { Sparkles } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useDmpStore } from "@/store/dmpStore";
import { cn } from "@/utils/cn";

interface QuotaIndicatorProps {
  used: number;
  limit: number;
  className?: string;
}

const quotaState = (used: number, limit: number) => {
  const left = Math.max(0, limit - used);
  return {
    left,
    pct: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
    isEmpty: left === 0,
    isLow: left > 0 && left / limit <= 0.2,
  };
};

const tooltipText = (used: number, limit: number) =>
  `${used.toLocaleString()} of ${limit.toLocaleString()} tokens used · resets on the 1st of each month`;

export const QuotaIndicator: React.FC<QuotaIndicatorProps> = ({
  used,
  limit,
  className,
}) => {
  const { left, isEmpty, isLow } = quotaState(used, limit);

  return (
    <Tooltip content={tooltipText(used, limit)}>
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
          isEmpty && "border-destructive/40 bg-destructive/10 text-destructive",
          isLow && !isEmpty && "border-warn/40 bg-warn-subtle text-warn",
          !isLow && !isEmpty && "border-ai/30 bg-ai-subtle text-ai",
          className,
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {left.toLocaleString()} tokens left
      </div>
    </Tooltip>
  );
};

/**
 * The always-on AI budget meter. It reads the store directly rather than
 * taking a value, so every screen shows the same number, and it flashes what
 * an AI run just cost — the moment the spend actually matters to the user.
 */
export const QuotaBar: React.FC<{ className?: string }> = ({ className }) => {
  const used = useDmpStore((s) => s.tokenUsed);
  const limit = useDmpStore((s) => s.tokenLimit);
  const { left, pct, isEmpty, isLow } = quotaState(used, limit);

  const [spent, setSpent] = React.useState<number | null>(null);
  const previous = React.useRef(used);

  React.useEffect(() => {
    const delta = used - previous.current;
    previous.current = used;
    if (delta <= 0) return;

    setSpent(delta);
    const timer = setTimeout(() => setSpent(null), 2600);
    return () => clearTimeout(timer);
  }, [used]);

  const tone = isEmpty
    ? "text-destructive"
    : isLow
      ? "text-warn"
      : "text-muted-foreground";

  return (
    <Tooltip content={tooltipText(used, limit)}>
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 transition-colors",
          spent !== null && "border-ai/40 bg-ai-subtle",
          className,
        )}
      >
        <Sparkles
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isEmpty ? "text-destructive" : isLow ? "text-warn" : "text-ai",
          )}
        />

        <div
          role="progressbar"
          aria-label="AI token quota"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={limit}
          className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block"
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isEmpty ? "bg-destructive" : isLow ? "bg-warn" : "bg-ai",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        <span
          className={cn(
            "whitespace-nowrap text-xs font-medium tabular-nums",
            tone,
          )}
          data-testid="quota-left"
        >
          {isEmpty ? "No tokens left" : `${left.toLocaleString()} left`}
        </span>

        {/* Announced, not just shown: the cost of a run is easy to miss. */}
        <span aria-live="polite" className="sr-only">
          {spent !== null
            ? `${spent.toLocaleString()} tokens used, ${left.toLocaleString()} left`
            : ""}
        </span>
        {spent !== null && (
          <span className="text-xs font-semibold tabular-nums text-ai">
            −{spent.toLocaleString()}
          </span>
        )}
      </div>
    </Tooltip>
  );
};
