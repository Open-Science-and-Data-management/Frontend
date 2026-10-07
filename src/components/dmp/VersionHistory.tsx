import React from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useDmpStore, type PlanVersion } from "@/store/dmpStore";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/utils/cn";

const STATE: Record<
  "in_force" | "superseded" | "rejected" | "pending",
  { label: string; tone: string }
> = {
  in_force: { label: "In force", tone: "bg-ok-subtle text-ok" },
  superseded: {
    label: "Approved earlier",
    tone: "bg-muted text-muted-foreground",
  },
  rejected: { label: "Sent back", tone: "bg-warn-subtle text-warn" },
  pending: {
    label: "Waiting on a decision",
    tone: "bg-accent text-accent-foreground",
  },
};

const stateOf = (v: PlanVersion, active?: number) =>
  v.status === "pending"
    ? "pending"
    : v.status === "rejected"
      ? "rejected"
      : v.number === active
        ? "in_force"
        : "superseded";

/**
 * Every version of the plan, newest first, with a way to bring an earlier one
 * back. Restoring only loads it into the editor: from there it's an ordinary
 * edit against the version in force, minor or major like any other.
 */
export const VersionHistory: React.FC = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToastStore((s) => s.toast);
  const restoreVersion = useDmpStore((s) => s.restoreVersion);
  const record = useDmpStore((s) =>
    s.dmps.find((d) => d.dmp_id === s.currentDmpId),
  );
  if (!record || record.versions.length === 0) return null;

  const active = record.active_version;
  const versions = [...record.versions].sort((a, b) => b.number - a.number);

  const restore = async (v: PlanVersion) => {
    const reopening = v.status === "rejected";
    const ok = await confirm({
      title: `Restore version ${v.number}?`,
      description: reopening
        ? `Its changes come back into the editor so you can fix them and submit again. Version ${active} stays in force meanwhile. Unsubmitted edits are replaced.`
        : `Its content replaces your working draft. If that differs from version ${active} in a way that needs sign-off, it goes back for approval like any other change. Unsubmitted edits are replaced.`,
      confirmLabel: `Restore version ${v.number}`,
    });
    if (!ok || !restoreVersion(v.number)) return;
    toast({
      title: `Version ${v.number} loaded into the editor`,
      description: "Review the changes, then save or submit them.",
    });
    navigate("/dmp/create?section=general");
  };

  return (
    <section
      aria-label="Version history"
      className="rounded-lg border bg-card p-5 text-left"
    >
      <h2 className="text-sm font-semibold">Version history</h2>
      <ol className="mt-3 divide-y">
        {versions.map((v) => {
          const state = STATE[stateOf(v, active)];
          const when = v.decided_at ?? v.created_at;
          const canRestore = v.status !== "pending" && v.number !== active;
          return (
            <li
              key={v.number}
              className="flex flex-wrap items-start gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">Version {v.number}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 text-[11px] font-medium leading-5",
                      state.tone,
                    )}
                  >
                    {state.label}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {v.edit_type}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(when, "d MMM yyyy")}
                  {v.approver &&
                    ` · ${v.approver.name} (${v.approver.position})`}
                  {v.number > 1 &&
                    ` · ${v.changes.length} change${v.changes.length === 1 ? "" : "s"}`}
                  {v.minor_edits.length > 0 &&
                    ` · ${v.minor_edits.length} minor edit${v.minor_edits.length === 1 ? "" : "s"} since`}
                  {v.restored_from !== undefined &&
                    ` · restores version ${v.restored_from}`}
                </p>
                {v.note && <p className="mt-1 text-xs text-warn">“{v.note}”</p>}
              </div>
              {canRestore && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void restore(v)}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Restore
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};
