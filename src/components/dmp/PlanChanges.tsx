import React from "react";
import { useChangeText } from "@/hooks/useChangeText";
import { Send, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDmpStore } from "@/store/dmpStore";
import { useToastStore } from "@/store/toastStore";
import { useOpenPlanMode } from "@/hooks/usePlanMode";
import { activation } from "@/config/plan-mode";
import { countBy, diffPlans, editTypeOf, sameAt } from "@/config/plan-diff";
import { cn } from "@/utils/cn";
import { useConfirm } from "@/components/ui/confirm-provider";
import { MajorEditList } from "@/components/dmp/EditApprovedPlan";

/**
 * What the open draft would change about the plan in force, and the one action
 * that fits those changes.
 *
 * The split isn't a preference: a minor edit is applied and logged, anything
 * carrying a commitment becomes a numbered version somebody has to decide on.
 */
export const PlanChanges: React.FC = () => {
  const changeText = useChangeText();
  const draft = useDmpStore((s) => s.draft);
  const dmps = useDmpStore((s) => s.dmps);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const saveMinorEdits = useDmpStore((s) => s.saveMinorEdits);
  const submitRevision = useDmpStore((s) => s.submitRevision);
  const finalize = useDmpStore((s) => s.finalize);
  const restoreVersion = useDmpStore((s) => s.restoreVersion);
  const restoredFrom = useDmpStore((s) => s.restoredFrom);
  const confirm = useConfirm();
  const toast = useToastStore((s) => s.toast);
  const route = activation(useOpenPlanMode());

  const record = dmps.find((d) => d.dmp_id === currentDmpId);
  const active = record?.versions.find(
    (v) => v.number === record.active_version,
  );
  const pending = record?.versions.find((v) => v.status === "pending");
  const rejected = [...(record?.versions ?? [])]
    .reverse()
    .find((v) => v.status === "rejected");

  // With a revision waiting, its changes are already with the committee:
  // only what's new beyond it — and isn't just the version in force — counts.
  const changes = React.useMemo(() => {
    if (!active) return [];
    if (!pending) return diffPlans(active.snapshot, draft);
    return diffPlans(pending.snapshot, draft).filter(
      (c) => !c.target || !sameAt(draft, active.snapshot, c.target),
    );
  }, [active, pending, draft]);

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
          {pending
            ? changes.length === 0
              ? `Nothing new since you submitted version ${pending.number}.`
              : `${changes.length} new since you submitted version ${pending.number}`
            : changes.length === 0
              ? "Your edits match it — nothing outstanding."
              : `${minor} minor · ${major} needing a decision`}
        </p>
      </div>

      {changes.length === 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            What needs sign-off again
          </summary>
          <MajorEditList />
        </details>
      )}

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

      {restoredFrom !== null && changes.length > 0 && (
        <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
          These changes restore version {restoredFrom}.
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
                    {changeText(change)}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {changes.length > 0 &&
        (needsReview && pending ? (
          // One decision at a time.
          <p className="rounded-md border border-warn/40 bg-warn-subtle/40 p-2 text-xs text-warn">
            Version {pending.number} is still waiting on a decision. Changes
            that need sign-off can be submitted once it's decided — or keep only
            minor fixes here, and they can be saved now.
          </p>
        ) : needsReview ? (
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
              {pending
                ? `Save fix to version ${active.number}`
                : "Save changes"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {pending
                ? `Applies to version ${active.number} now. Version ${pending.number} stays exactly as submitted, and the fix is carried into it if it's approved.`
                : `Nothing here changes what was agreed, so it applies now and is recorded against version ${active.number}.`}
            </p>
          </>
        ))}

      {changes.length > 0 && (
        <button
          type="button"
          onClick={async () => {
            if (
              await confirm({
                title: "Discard these changes?",
                description: `Your draft goes back to version ${active.number}, the version in force. Nothing that's been submitted or decided is affected.`,
                confirmLabel: "Discard changes",
              })
            ) {
              restoreVersion(active.number);
              toast({ title: `Back to version ${active.number}` });
            }
          }}
          className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Discard changes and go back to version {active.number}
        </button>
      )}
    </div>
  );
};
