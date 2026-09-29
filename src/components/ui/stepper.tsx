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
    <ol className={cn("flex items-center gap-2", className)}>
      {steps.map((step, i) => {
        const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming";
        return (
          <li key={step.label} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
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
              <span
                className={cn(
                  "text-sm",
                  state === "upcoming" ? "text-muted-foreground" : "font-medium",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px w-6 sm:w-10",
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
