import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A titled dashboard panel, with an optional "View all"-style link or action. */
export const DashboardSection: React.FC<{
  title: string;
  description?: string;
  /** A link in the header; `action` replaces it with anything else. */
  viewAll?: { to: string; label?: string };
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, viewAll, action, children }) => (
  <section className="rounded-lg border bg-card">
    <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action ??
        (viewAll && (
          <Button variant="ghost" size="sm" className="-mr-2 shrink-0" asChild>
            <Link to={viewAll.to}>
              {viewAll.label ?? "View all"}
              <ChevronRight className="ml-0.5 h-4 w-4" />
            </Link>
          </Button>
        ))}
    </div>
    <div className="px-5 pb-5">{children}</div>
  </section>
);
