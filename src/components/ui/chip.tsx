import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        ai: "bg-ai-subtle text-ai",
        ok: "bg-ok-subtle text-ok",
        warn: "bg-warn-subtle text-warn",
        outline: "border border-input text-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(chipVariants({ variant, className }))} {...props} />
  ),
);
Chip.displayName = "Chip";

export { Chip, chipVariants };
