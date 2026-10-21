import * as React from "react";
import { Sparkles } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useQuotaStore } from "@/store/quotaStore";
import { cn } from "@/utils/cn";

interface QuotaIndicatorProps {
  className?: string;
}

/** The budget as the server last reported it, or null while it hasn't. */
const useQuota = () => {
  const quota = useQuotaStore((s) => s.quota);
  const status = useQuotaStore((s) => s.status);
  return { quota, status };
};

/** Shown in place of a number the server hasn't given yet. */
const Pending: React.FC<{ status: string; className?: string }> = ({
  status,
  className,
}) => (
  <div
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground",
      className,
    )}
    data-testid="quota-left"
  >
    <Sparkles className="h-3.5 w-3.5" />
    {status === "error" ? "AI budget unavailable" : "Loading AI budget…"}
  </div>
);

const quotaState = (used: number, limit: number) => {
  const left = Math.max(0, limit - used);
  return {
    left,
    pct: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
    isEmpty: left === 0,
    isLow: left > 0 && left / limit <= 0.2,
  };
};

// A reset date only when the server has one: the policy isn't settled, and
// promising "the 1st" would be making it up.
const tooltipText = (used: number, limit: number, resetsAt: Date | null) =>
  `${used.toLocaleString()} of ${limit.toLocaleString()} tokens used${resetsAt ? ` · resets ${resetsAt.toLocaleDateString()}` : ""}`;

export const QuotaIndicator: React.FC<QuotaIndicatorProps> = ({
  className,
}) => {
  const { quota, status } = useQuota();
  if (!quota) return <Pending status={status} className={className} />;
  const { used, limit, resets_at } = quota;
  const { left, isEmpty, isLow } = quotaState(used, limit);

  return (
    <Tooltip content={tooltipText(used, limit, resets_at)}>
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
  const { quota, status } = useQuota();
  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? 0;
  const { left, pct, isEmpty, isLow } = quotaState(used, limit);

  const [spent, setSpent] = React.useState<number | null>(null);
  const previous = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!quota) return;
    // The first answer from the server is a reading, not a spend.
    const delta = previous.current === null ? 0 : used - previous.current;
    previous.current = used;
    if (delta <= 0) return;

    setSpent(delta);
    const timer = setTimeout(() => setSpent(null), 2600);
    return () => clearTimeout(timer);
  }, [quota, used]);

  if (!quota) return <Pending status={status} className={className} />;

  const tone = isEmpty
    ? "text-destructive"
    : isLow
      ? "text-warn"
      : "text-muted-foreground";

  return (
    <Tooltip content={tooltipText(used, limit, quota.resets_at)}>
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
