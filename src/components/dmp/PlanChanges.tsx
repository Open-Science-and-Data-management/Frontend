import React from "react";
import { Send, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDmpStore } from "@/store/dmpStore";
import { useToastStore } from "@/store/toastStore";
import { usePlanMode } from "@/hooks/usePlanMode";
import { activation } from "@/config/plan-mode";
import { countBy, diffPlans, editTypeOf } from "@/config/plan-diff";
import { cn } from "@/utils/cn";

/**
 * What the open draft would change about the plan in force, and the one action
 * that fits those changes.
 *
 * The split isn't a preference: a minor edit is applied and logged, anything
 * carrying a commitment becomes a numbered version somebody has to decide on.
 */
export const PlanChanges: React.FC = () => {
  const draft = useDmpStore((s) => s.draft);
  const dmps = useDmpStore((s) => s.dmps);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const saveMinorEdits = useDmpStore((s) => s.saveMinorEdits);
  const submitRevision = useDmpStore((s) => s.submitRevision);
  const finalize = useDmpStore((s) => s.finalize);
  const toast = useToastStore((s) => s.toast);
  const route = activation(usePlanMode(draft.project_id));

  const record = dmps.find((d) => d.dmp_id === currentDmpId);
  const active = record?.versions.find(
    (v) => v.number === record.active_version,
  );
  const pending = record?.versions.find((v) => v.status === "pending");
  const rejected = [...(record?.versions ?? [])]
    .reverse()
    .find((v) => v.status === "rejected");

  const changes = React.useMemo(
    () => (active ? diffPlans(active.snapshot, draft) : []),
    [active, draft],
  );

  if (!active) return null;

  const { minor, major } = countBy(changes);
  const needsReview = editTypeOf(changes) === "major" && changes.length > 0;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold">
          Version {active.number} is in force
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {changes.length === 0
            ? "Your edits match it — nothing outstanding."
            : `${minor} minor · ${major} needing a decision`}
        </p>
      </div>

      {pending && (
        <p className="flex items-start gap-1.5 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
          <Send className="mt-0.5 h-3 w-3 shrink-0" />
          Version {pending.number} is waiting on a decision. Version{" "}
          {active.number} keeps running until then.
        </p>
      )}

      {rejected && !pending && (
        <p className="flex items-start gap-1.5 rounded-md border border-warn/40 bg-warn-subtle/40 p-2 text-xs text-warn">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Version {rejected.number} came back: {rejected.note}
        </p>
      )}

      {changes.length > 0 && (
        <ul className="space-y-1.5">
          {changes.map((change) => (
            <li key={change.path} className="text-xs">
              <div className="flex items-start gap-1.5">
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded px-1 text-[10px] font-semibold uppercase leading-4",
                    change.edit_type === "major"
                      ? "bg-warn-subtle text-warn"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {change.edit_type}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{change.label}</span>
                  <span className="block truncate text-muted-foreground">
                    {change.from} → {change.to}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {changes.length > 0 &&
        (needsReview ? (
          <>
            <Button
              className="w-full"
              onClick={() => {
                if (route.by === "self") {
                  // Nobody to wait on: the version is raised and decided at once.
                  finalize();
                  toast({ title: "New version in force" });
                } else {
                  submitRevision();
                  toast({ title: "Revision submitted for approval" });
                }
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              {route.by === "self"
                ? "Finalize new version"
                : "Submit changes for approval"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {major === 1 ? "One change" : `${major} changes`} here{" "}
              {major === 1 ? "alters" : "alter"} what was agreed, so{" "}
              {route.by === "self"
                ? "this raises a new version on the record."
                : "your committee sees the plan again."}
            </p>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                saveMinorEdits();
                toast({ title: "Changes saved" });
              }}
            >
              <Check className="mr-2 h-4 w-4" />
              Save changes
            </Button>
            <p className="text-xs text-muted-foreground">
              Nothing here changes what was agreed, so it applies now and is
              recorded against version {active.number}.
            </p>
          </>
        ))}
    </div>
  );
};
