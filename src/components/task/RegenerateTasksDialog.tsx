import React from "react";
import { formatTokensLeft, useQuotaStore } from "@/store/quotaStore";
import { reportAiError, syncQuota } from "@/store/aiErrors";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTaskStore } from "@/store/taskStore";
import type { DmpRecord } from "@/store/dmpStore";
import { recordAiEvent } from "@/store/aiThread";
import { useToastStore } from "@/store/toastStore";
import { estimateCost, generateTasks, TASK_DIRECTIONS } from "@/api/aiApi";
import { cn } from "@/utils/cn";

interface RegenerateTasksDialogProps {
  plan: DmpRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RegenerateTasksDialog: React.FC<RegenerateTasksDialogProps> = ({
  plan,
  open,
  onOpenChange,
}) => {
  const tasks = useTaskStore((s) => s.tasks);
  const replaceGeneratedTasks = useTaskStore((s) => s.replaceGeneratedTasks);
  const addGeneratedTasks = useTaskStore((s) => s.addGeneratedTasks);
  const hasTokensFor = useQuotaStore((s) => s.hasTokensFor);
  const tokensLeft = useQuotaStore((s) => s.tokensLeft);
  const toast = useToastStore((s) => s.toast);

  const [direction, setDirection] = React.useState("");
  const [running, setRunning] = React.useState(false);

  const allOutputs = plan.draft.dataset ?? [];
  // A new output added to an approved plan usually wants tasks of its own,
  // without disturbing the ones already running.
  const untouchedOutputs = allOutputs.filter(
    (d) =>
      !tasks.some(
        (t) => t.dmp_id === plan.dmp_id && t.dataset_id === d.dataset_id,
      ),
  );
  const [newOnly, setNewOnly] = React.useState(untouchedOutputs.length > 0);
  const outputs = newOnly ? untouchedOutputs : allOutputs;
  const cost = estimateCost.generateTasks(outputs.length);
  const affordable = hasTokensFor(cost);

  // Spelled out before the run: what goes, and what is protected.
  const planTasks = tasks.filter((t) => t.dmp_id === plan.dmp_id);
  const replaceable = planTasks.filter(
    (t) =>
      t.generated_by === "ai" &&
      t.status === "todo" &&
      t.progress_percent === 0 &&
      t.evidence.type === "none",
  );
  const protectedCount = planTasks.length - replaceable.length;

  const run = async () => {
    setRunning(true);
    try {
      const {
        tasks: proposed,
        token_count,
        usage,
      } = await generateTasks({
        outputs: outputs.map((d) => ({
          dataset_id: d.dataset_id,
          title: d.title || "Untitled output",
          type: d.type,
          access: d.access,
        })),
        beginDate: plan.draft.begin_date,
        endDate: plan.draft.end_date,
        direction,
      });

      const rows = proposed.map((t) => ({
        dmp_id: plan.dmp_id,
        dataset_id: t.dataset_id,
        title: t.title,
        details: t.details,
        lifecycle_stage: t.lifecycle_stage,
        priority: t.priority,
        generated_by: "ai" as const,
      }));

      // Adding tasks for a new output must not disturb the rest of the board.
      const result = newOnly
        ? { added: rows.length, removed: 0, kept: 0 }
        : replaceGeneratedTasks(plan.dmp_id, rows);
      if (newOnly) addGeneratedTasks(rows);

      recordAiEvent(plan.dmp_id, {
        action: "generate_tasks",
        summary: `Regenerated tasks for ${plan.title}`,
        detail: [
          direction.trim() || "no direction given",
          `${result.added} added, ${result.removed} replaced`,
        ].join(" · "),
        token_count,
        usage,
      });
      toast({
        title: `${result.added} tasks generated`,
        description: `${result.removed} replaced, ${result.kept} kept · ${token_count.toLocaleString()} tokens.`,
      });
      onOpenChange(false);
      setDirection("");
    } catch (err) {
      reportAiError(err, { what: "regenerate tasks", retry: run });
    } finally {
      setRunning(false);
      syncQuota();
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-card p-6 text-card-foreground shadow-lg focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">
                Regenerate tasks from the plan
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                AI re-reads {plan.title} and proposes a fresh breakdown. Tell it
                how you want the work split.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="-mx-1 mt-5 flex-1 space-y-4 overflow-y-auto px-1">
            <div>
              <label
                htmlFor="task-direction"
                className="mb-1 block text-sm font-medium"
              >
                Direction
              </label>
              <Textarea
                id="task-direction"
                rows={3}
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                placeholder="e.g. focus on preservation, or split each stage into smaller steps"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TASK_DIRECTIONS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    title={d.hint}
                    onClick={() => setDirection(d.label)}
                    className="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-ai hover:text-ai focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {untouchedOutputs.length > 0 && (
              <label className="flex items-start gap-2 rounded-md border bg-background p-3 text-xs">
                <input
                  type="checkbox"
                  checked={newOnly}
                  onChange={(e) => setNewOnly(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="font-medium text-foreground">
                    Only outputs without tasks yet
                  </span>{" "}
                  ({untouchedOutputs.length} of {allOutputs.length}). Adds tasks
                  for them and leaves the rest of the board alone.
                </span>
              </label>
            )}

            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  {newOnly ? 0 : replaceable.length}
                </span>{" "}
                untouched AI task
                {!newOnly && replaceable.length === 1 ? "" : "s"} will be
                replaced.
              </p>
              <p className="mt-1">
                <span className="font-medium text-foreground">
                  {protectedCount}
                </span>{" "}
                kept. Anything you wrote yourself or already backed with
                evidence is never discarded.
              </p>
              <p className="mt-2">
                Costs about {cost.toLocaleString()} tokens ·{" "}
                {formatTokensLeft(tokensLeft())} left.
              </p>
            </div>

            {outputs.length === 0 && (
              <p className="text-xs text-warn">
                This plan has no research outputs yet, so there's nothing to
                break into tasks.
              </p>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t pt-4">
            <DialogPrimitive.Close asChild>
              <Button variant="outline">Cancel</Button>
            </DialogPrimitive.Close>
            <Button
              variant="ai"
              isLoading={running}
              disabled={outputs.length === 0 || !affordable}
              onClick={run}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              Regenerate
            </Button>
          </div>

          {!affordable && (
            <p className="mt-2 text-right text-xs text-warn">
              Not enough tokens left.
            </p>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
