import * as React from "react";
import { Sparkles } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";

interface QuotaIndicatorProps {
  used: number;
  limit: number;
  className?: string;
}


interface QuotaBarProps {
  progress: number;
}

export const QuotaIndicator: React.FC<QuotaIndicatorProps> = ({
  used,
  limit,
  className,
}) => {
  const left = Math.max(0, limit - used);
  const isLow = left > 0 && left / limit <= 0.2;
  const isEmpty = left === 0;

  return (
    <Tooltip
      content={`${used.toLocaleString()} of ${limit.toLocaleString()} tokens used · resets on the 1st of each month`}
    >
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

export function QuotaBar({ progress }: QuotaBarProps) {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-muted/30">
      <div
        className="h-1 bg-primary transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
