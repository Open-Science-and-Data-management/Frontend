import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Sparkles, Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiProgress } from "@/components/ui/ai-progress";
import { estimateCost, type RegenerateDirection } from "@/api/aiApi";
import { useDmpStore, type BatchProposal } from "@/store/dmpStore";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/utils/cn";

type Stage = "select" | "running" | "preview";

const DIRECTIONS: { key: "shorter" | "formal"; label: string }[] = [
  { key: "shorter", label: "Shorter" },
  { key: "formal", label: "More formal" },
];

const RUN_STEPS = ["Reading selected fields", "Rewriting", "Preparing diff"];

interface BatchRegenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BatchRegenerateModal: React.FC<BatchRegenerateModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { eligibleBatchTargets, batchRegenerate, applyBatchProposals, tokensLeft } =
    useDmpStore();
  const toast = useToastStore((s) => s.toast);

  const [stage, setStage] = React.useState<Stage>("select");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [direction, setDirection] = React.useState<RegenerateDirection>({
    kind: "shorter",
  });
  const [customText, setCustomText] = React.useState("");
  const [proposals, setProposals] = React.useState<BatchProposal[]>([]);
  const [rejected, setRejected] = React.useState<string[]>([]);
  const [runStep, setRunStep] = React.useState(0);

  const targets = eligibleBatchTargets();

  const reset = () => {
    setStage("select");
    setSelected([]);
    setDirection({ kind: "shorter" });
    setCustomText("");
    setProposals([]);
    setRejected([]);
    setRunStep(0);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const estimated = targets
    .filter((t) => selected.includes(t.id))
    .reduce((sum, t) => sum + estimateCost.regenerateField(t.value), 0);

  const effectiveDirection: RegenerateDirection =
    customText.trim().length > 0
      ? { kind: "custom", detail: customText.trim() }
      : direction;

  const run = async () => {
    setStage("running");
    setRunStep(0);
    const timer = setInterval(
      () => setRunStep((s) => Math.min(s + 1, RUN_STEPS.length - 1)),
      320,
    );
    try {
      const result = await batchRegenerate(selected, effectiveDirection);
      clearInterval(timer);
      if (result.length === 0) {
        setStage("select");
        return;
      }
      setProposals(result);
      setStage("preview");
    } catch {
      clearInterval(timer);
      setStage("select");
      toast({ title: "Batch regenerate failed", variant: "destructive" });
    }
  };

  const accepted = proposals.filter((p) => !rejected.includes(p.id));

  const apply = () => {
    applyBatchProposals(accepted);
    const inverse = accepted.map((p) => ({ ...p, after: p.before }));
    toast({
      title: `${accepted.length} field${accepted.length === 1 ? "" : "s"} updated`,
      description: `Used ${proposals
        .reduce((s, p) => s + p.token_count, 0)
        .toLocaleString()} tokens.`,
      action: {
        label: "Undo",
        onClick: () => applyBatchProposals(inverse),
      },
    });
    close(false);
  };

  const grouped = targets.reduce<Record<string, typeof targets>>((acc, t) => {
    (acc[t.group] ||= []).push(t);
    return acc;
  }, {});

  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-card p-6 text-card-foreground shadow-lg focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-4 w-4 text-ai" />
                Batch regenerate
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {stage === "preview"
                  ? "Review each change — reject any you don't want before applying."
                  : "Only AI-drafted fields can be rewritten. Confirmed and locked fields are never touched."}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="-mx-1 mt-4 flex-1 overflow-y-auto px-1">
            {stage === "select" && (
              <>
                {targets.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No AI-drafted fields available to regenerate.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(grouped).map(([group, items]) => (
                      <div key={group}>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group}
                        </p>
                        <ul className="space-y-1.5">
                          {items.map((t) => (
                            <li key={t.id}>
                              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 hover:bg-accent/50">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 shrink-0"
                                  checked={selected.includes(t.id)}
                                  onChange={(e) =>
                                    setSelected((prev) =>
                                      e.target.checked
                                        ? [...prev, t.id]
                                        : prev.filter((id) => id !== t.id),
                                    )
                                  }
                                />
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium">
                                    {t.label}
                                  </span>
                                  <span className="line-clamp-2 block text-xs text-muted-foreground">
                                    {t.value}
                                  </span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {targets.length > 0 && (
                  <div className="mt-5 border-t pt-4">
                    <p className="mb-2 text-sm font-medium">Direction</p>
                    <div className="flex flex-wrap gap-2">
                      {DIRECTIONS.map((d) => (
                        <Button
                          key={d.key}
                          type="button"
                          size="sm"
                          variant={
                            customText.trim() === "" && direction.kind === d.key
                              ? "default"
                              : "outline"
                          }
                          onClick={() => {
                            setDirection({ kind: d.key });
                            setCustomText("");
                          }}
                        >
                          {d.label}
                        </Button>
                      ))}
                    </div>
                    <Input
                      className="mt-2"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Or describe your own direction…"
                      aria-label="Custom regenerate direction"
                    />
                  </div>
                )}
              </>
            )}

            {stage === "running" && (
              <div className="py-6">
                <AiProgress steps={RUN_STEPS} activeIndex={runStep} />
              </div>
            )}

            {stage === "preview" && (
              <ul className="space-y-3">
                {proposals.map((p) => {
                  const isRejected = rejected.includes(p.id);
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "rounded-md border p-3",
                        isRejected && "opacity-50",
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {p.group}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isRejected ? "outline" : "ghost"}
                          onClick={() =>
                            setRejected((prev) =>
                              isRejected
                                ? prev.filter((id) => id !== p.id)
                                : [...prev, p.id],
                            )
                          }
                        >
                          {isRejected ? (
                            <>
                              <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                              Restore
                            </>
                          ) : (
                            <>
                              <X className="mr-1.5 h-3.5 w-3.5" />
                              Reject
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-muted-foreground line-through">
                        {p.before}
                      </p>
                      <p className="mt-1 rounded bg-ok-subtle px-2 py-1 text-xs">
                        {p.after}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {stage === "select" &&
                (selected.length === 0
                  ? `${tokensLeft().toLocaleString()} tokens left`
                  : `~${estimated.toLocaleString()} tokens for ${selected.length} field${selected.length === 1 ? "" : "s"}`)}
              {stage === "preview" &&
                `${accepted.length} of ${proposals.length} will be applied`}
            </p>
            <div className="flex gap-2">
              <DialogPrimitive.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogPrimitive.Close>
              {stage === "select" && (
                <Button
                  variant="ai"
                  disabled={selected.length === 0}
                  onClick={run}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Regenerate {selected.length > 0 && selected.length}
                </Button>
              )}
              {stage === "preview" && (
                <Button disabled={accepted.length === 0} onClick={apply}>
                  <Check className="mr-2 h-4 w-4" />
                  Apply {accepted.length}
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
