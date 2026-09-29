import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
  {
    variants: {
      status: {
        draft: "bg-muted text-muted-foreground",
        active: "bg-primary/10 text-primary",
        done: "bg-ok-subtle text-ok",
        pending: "bg-warn-subtle text-warn",
        approved: "bg-ok-subtle text-ok",
        rejected: "bg-destructive/10 text-destructive",
        major: "bg-destructive/10 text-destructive",
        minor: "bg-warn-subtle text-warn",
      },
    },
    defaultVariants: { status: "draft" },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  className,
  status,
  children,
  ...props
}) => (
  <span className={cn(statusBadgeVariants({ status, className }))} {...props}>
    {children ?? status}
  </span>
);
