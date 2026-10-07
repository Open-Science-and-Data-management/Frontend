import React from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { majorTriggers } from "@/config/plan-diff";

/** What sends an approved plan back for sign-off, from the policy itself. */
export const MajorEditList: React.FC<{ className?: string }> = ({
  className,
}) => (
  <ul className={className ?? "mt-2 grid gap-1 text-xs text-muted-foreground"}>
    {majorTriggers().map((label) => (
      <li key={label} className="flex gap-1.5">
        <span aria-hidden="true">·</span>
        {label}
      </li>
    ))}
  </ul>
);

/**
 * The way back into the editor once a plan is in force. Approval doesn't
 * freeze a plan; it changes what an edit costs, and that's said up front.
 */
export const EditApprovedPlan: React.FC<{
  activeVersion: number;
  bySelf: boolean;
}> = ({ activeVersion, bySelf }) => (
  <section
    aria-label="Edit this plan"
    className="rounded-lg border bg-card p-5 text-left"
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-prose">
        <h2 className="text-sm font-semibold">Keep the plan up to date</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Minor edits apply straight away and are recorded against version{" "}
          {activeVersion}.{" "}
          {bySelf
            ? `These raise version ${activeVersion + 1}, which you finalize:`
            : `These go back to your committee as version ${activeVersion + 1}, while version ${activeVersion} stays in force:`}
        </p>
        <MajorEditList />
      </div>
      <Button asChild size="sm">
        <Link to="/dmp/create?section=general">
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit plan
        </Link>
      </Button>
    </div>
  </section>
);
