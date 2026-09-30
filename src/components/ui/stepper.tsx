import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

export interface StepperStep {
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  activeIndex: number;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  activeIndex,
  className,
}) => {
  return (
    <ol
      className={cn("flex flex-wrap items-center gap-y-2", className)}
      aria-label={`Step ${activeIndex + 1} of ${steps.length}`}
    >
      {steps.map((step, i) => {
        const state =
          i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming";
        return (
          <li key={step.label} className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  state === "done" && "bg-ok text-ok-foreground",
                  state === "active" && "bg-primary text-primary-foreground",
                  state === "upcoming" && "bg-muted text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {/* Narrow screens keep only the step you're on labelled —
                  five labels in a row is what forced the page to scroll. */}
              <span
                className={cn(
                  "text-sm",
                  state === "active" ? "inline" : "hidden md:inline",
                  state === "upcoming"
                    ? "text-muted-foreground"
                    : "font-medium",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mx-0.5 h-px w-3 sm:mx-1 sm:w-6 md:w-10",
                  state === "done" ? "bg-ok" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};
