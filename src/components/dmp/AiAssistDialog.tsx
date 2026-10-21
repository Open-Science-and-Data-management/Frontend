import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { FileSearch, Sparkles, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatProposalCard } from "@/components/dmp/ChatProposalCard";
import { useChatStore } from "@/store/chatStore";
import { formatTokensLeft, useQuotaStore } from "@/store/quotaStore";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import { NO_ENTRIES, scopeKey, useAiThread } from "@/store/aiThread";
import type { ThreadTurn } from "@/store/aiThread";
import { estimateCost } from "@/api/aiApi";
import { cn } from "@/utils/cn";

type Source = "current" | "proposal";

const PRESETS: Record<Source, string[]> = {
  current: ["Shorter", "More formal", "Plainer language", "More specific"],
  proposal: [
    "Make everything openly shared",
    "Assume personal, sensitive data",
    "Focus on long-term preservation",
    "Include the analysis code as an output",
  ],
};

/**
 * Every "ask AI to change this plan" path, in one place. The two sources
 * differ only in where the new wording comes from — what happens after is
 * identical: proposals you accept one at a time, logged in the plan's thread.
 */
export const AiAssistDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const suggestChanges = useChatStore((s) => s.suggestChanges);
  const isThinking = useChatStore((s) => s.isThinking);
  const acceptProposal = useChatStore((s) => s.acceptProposal);
  const rejectProposal = useChatStore((s) => s.rejectProposal);
  const acceptAll = useChatStore((s) => s.acceptAll);

  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const projectId = useDmpStore((s) => s.draft.project_id);
  const tokensLeft = useQuotaStore((s) => s.tokensLeft());
  const stop = useChatStore((s) => s.stop);
  const eligibleBatchTargets = useDmpStore((s) => s.eligibleBatchTargets);
  const { projects, getProposalFile } = useProjectStore();
  const entries = useAiThread(
    (s) => s.threads[scopeKey(currentDmpId)] ?? NO_ENTRIES,
  );

  const [source, setSource] = React.useState<Source>("current");
  const [direction, setDirection] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [entryId, setEntryId] = React.useState<string | null>(null);

  const targets = React.useMemo(
    () => (open ? eligibleBatchTargets() : []),
    [open, eligibleBatchTargets],
  );
  const project = projects.find((p) => p.project_id === projectId);
  const proposalFile = project ? getProposalFile(project) : undefined;

  const result = entries.find((e) => e.id === entryId) as
    ThreadTurn | undefined;
  const pending = (result?.proposals ?? []).filter(
    (p) => p.status === "pending",
  );

  const cost =
    source === "proposal"
      ? estimateCost.chat(direction) * 2
      : targets
          .filter((t) => selected.includes(t.id))
          .reduce((sum, t) => sum + estimateCost.regenerateField(t.value), 0);

  const canRun =
    source === "proposal" ? Boolean(proposalFile) : selected.length > 0;

  const groups = targets.reduce<Record<string, typeof targets>>(
    (acc, target) => {
      (acc[target.group] ??= []).push(target);
      return acc;
    },
    {},
  );

  const run = async () => {
    const outcome = await suggestChanges({
      source,
      direction,
      filename: proposalFile?.filename,
      targetIds: selected,
    });
    if (outcome) setEntryId(outcome.entryId);
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEntryId(null);
          setDirection("");
          setSelected([]);
        }
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-card p-6 text-card-foreground shadow-lg focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">
                Ask AI to improve this plan
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                You review every change before it lands.
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
              <p className="mb-1.5 text-sm font-medium">Work from</p>
              <div
                role="radiogroup"
                aria-label="Source"
                className="grid gap-2 sm:grid-cols-2"
              >
                {(
                  [
                    {
                      id: "current" as const,
                      icon: Wand2,
                      title: "The current text",
                      note: "Rewrite fields that are already filled in.",
                    },
                    {
                      id: "proposal" as const,
                      icon: FileSearch,
                      title: "The proposal",
                      note: proposalFile
                        ? `Re-read ${proposalFile.filename}.`
                        : "No proposal on file for this project.",
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={source === option.id}
                    disabled={option.id === "proposal" && !proposalFile}
                    onClick={() => {
                      setSource(option.id);
                      setDirection("");
                    }}
                    className={cn(
                      "rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      source === option.id
                        ? "border-ai bg-ai-subtle"
                        : "hover:border-ai/40",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <option.icon className="h-3.5 w-3.5" />
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {option.note}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {source === "current" && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm font-medium">Fields to rewrite</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSelected(
                        selected.length === targets.length
                          ? []
                          : targets.map((t) => t.id),
                      )
                    }
                  >
                    {selected.length === targets.length
                      ? "Clear"
                      : "Select all"}
                  </Button>
                </div>

                {targets.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Nothing to rewrite yet. The fields AI can edit are still
                    empty.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(groups).map(([group, items]) => (
                      <div key={group}>
                        <p className="text-xs font-medium text-muted-foreground">
                          {group}
                        </p>
                        {items.map((target) => (
                          <label
                            key={target.id}
                            className="flex items-start gap-2 rounded px-1 py-1 text-sm hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 accent-primary"
                              checked={selected.includes(target.id)}
                              onChange={(e) =>
                                setSelected((prev) =>
                                  e.target.checked
                                    ? [...prev, target.id]
                                    : prev.filter((id) => id !== target.id),
                                )
                              }
                            />
                            <span className="min-w-0">
                              <span className="block">{target.label}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {target.value}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="assist-direction"
                className="mb-1 block text-sm font-medium"
              >
                Direction
              </label>
              <Textarea
                id="assist-direction"
                rows={2}
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                placeholder={
                  source === "proposal"
                    ? "e.g. assume the data is sensitive and keep it ten years"
                    : "e.g. shorter, or plainer language"
                }
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESETS[source].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDirection(preset)}
                    className="rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-ai hover:text-ai focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Costs about {Math.round(cost).toLocaleString()} tokens ·{" "}
              {formatTokensLeft(tokensLeft)} left.
            </p>

            {result && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs text-muted-foreground">{result.text}</p>
                {(result.rejections ?? []).map((r, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-warn/40 bg-warn-subtle/40 p-2 text-xs text-warn"
                  >
                    <span className="font-medium">{r.label}:</span> {r.reason}
                  </div>
                ))}
                {(result.proposals ?? []).map((p) => (
                  <ChatProposalCard
                    key={p.id}
                    proposal={p}
                    onAccept={() => acceptProposal(result.id, p.id)}
                    onReject={() => rejectProposal(result.id, p.id)}
                  />
                ))}
                {pending.length > 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => acceptAll(result.id)}
                  >
                    Accept all {pending.length}
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t pt-4">
            <DialogPrimitive.Close asChild>
              <Button variant="outline">Close</Button>
            </DialogPrimitive.Close>
            {isThinking && (
              // Tokens the AI already used aren't given back.
              <Button
                variant="outline"
                onClick={stop}
                title="Stop waiting. Tokens already used still count."
              >
                Stop
              </Button>
            )}
            <Button
              variant="ai"
              isLoading={isThinking}
              disabled={!canRun}
              onClick={run}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {result ? "Suggest again" : "Suggest changes"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
