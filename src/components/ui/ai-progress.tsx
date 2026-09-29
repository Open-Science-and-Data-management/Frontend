import * as React from "react";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { cn } from "@/utils/cn";

interface AiProgressProps {
  steps: string[];
  activeIndex: number;
  className?: string;
}

export const AiProgress: React.FC<AiProgressProps> = ({
  steps,
  activeIndex,
  className,
}) => {
  return (
    <ol className={cn("space-y-3", className)} aria-live="polite">
      {steps.map((step, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
        return (
          <li key={step} className="flex items-center gap-3 text-sm">
            {state === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />}
            {state === "active" && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ai" />
            )}
            {state === "pending" && (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span
              className={cn(
                state === "pending" && "text-muted-foreground",
                state === "active" && "font-medium",
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
