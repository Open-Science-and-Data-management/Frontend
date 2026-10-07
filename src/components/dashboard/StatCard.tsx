import React from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

/** One headline number, what it's of, and a line of context under a rule. */
export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  footer: React.ReactNode;
  to: string;
  /** Tints the icon, e.g. the AI budget in the AI colour. */
  iconClassName?: string;
}> = ({ label, value, icon: Icon, footer, to, iconClassName }) => (
  <Link
    to={to}
    className="flex flex-col rounded-lg border bg-card transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <div className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
      </div>
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground",
          iconClassName,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className="mt-auto truncate border-t px-4 py-2.5 text-xs text-muted-foreground">
      {footer}
    </p>
  </Link>
);
