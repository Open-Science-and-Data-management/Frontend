import React from "react";
import { FileSearch, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatStore } from "@/store/chatStore";
import { formatTokensLeft, useQuotaStore } from "@/store/quotaStore";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
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
 * The assistant's Improve mode: pick what to rework and how. The two sources
 * differ only in where the new wording comes from. What happens after is the
 * same either way: proposals in the plan's thread, accepted one at a time.
 */
export const AiImproveForm: React.FC<{
  /** The suggestions are in the thread; show the conversation. */
  onDone: () => void;
}> = ({ onDone }) => {
  const suggestChanges = useChatStore((s) => s.suggestChanges);
  const isThinking = useChatStore((s) => s.isThinking);
  const stop = useChatStore((s) => s.stop);

  const projectId = useDmpStore((s) => s.draft.project_id);
  // Subscribed so a field filled in meanwhile shows up in the list.
  useDmpStore((s) => s.draft);
  const eligibleBatchTargets = useDmpStore((s) => s.eligibleBatchTargets);
  const tokensLeft = useQuotaStore((s) => s.tokensLeft());
  const { projects, getProposalFile } = useProjectStore();

  const [source, setSource] = React.useState<Source>("current");
  const [direction, setDirection] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);

  const targets = eligibleBatchTargets();
  const project = projects.find((p) => p.project_id === projectId);
  const proposalFile = project ? getProposalFile(project) : undefined;

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
    if (outcome) {
      setDirection("");
      setSelected([]);
      onDone();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-sm text-muted-foreground">
          Suggestions come back in the conversation. Nothing changes until you
          accept it.
        </p>

        <div>
          <p className="mb-1.5 text-sm font-medium">Work from</p>
          <div role="radiogroup" aria-label="Source" className="grid gap-2">
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
              {targets.length > 0 && (
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
                  {selected.length === targets.length ? "Clear" : "Select all"}
                </Button>
              )}
            </div>

            {targets.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Nothing to rewrite yet. The fields AI can edit are still empty.
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
      </div>

      <div className="space-y-2 border-t p-3">
        <div className="flex gap-2">
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
            className="flex-1"
            isLoading={isThinking}
            disabled={!canRun}
            onClick={run}
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Suggest changes
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Costs about {Math.round(cost).toLocaleString()} tokens ·{" "}
          {formatTokensLeft(tokensLeft)} left
        </p>
      </div>
    </div>
  );
};
