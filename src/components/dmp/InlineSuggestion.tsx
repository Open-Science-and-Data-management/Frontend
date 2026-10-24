import React from "react";
import { Check, Sparkles, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useChatStore } from "@/store/chatStore";
import { useDmpStore } from "@/store/dmpStore";
import {
  NO_ENTRIES,
  scopeKey,
  useAiThread,
  type ThreadTurn,
} from "@/store/aiThread";
import type { ChatProposal } from "@/store/chatTools";
import { sameValue } from "@/utils/sameValue";
import { wordDiff } from "@/utils/wordDiff";
import { cn } from "@/utils/cn";

/** A plan field by key, or a field of one output by id (not position). */
export type FieldMatch =
  { path: string } | { datasetId: string; field: string };

const matches = (p: ChatProposal, match: FieldMatch) =>
  p.kind === "field" &&
  p.status === "pending" &&
  ("path" in match
    ? !p.datasetId && p.path === match.path
    : p.datasetId === match.datasetId && p.datasetField === match.field);

/**
 * An AI suggestion for one field, shown under it as a diff: the words that
 * go struck through, the words that come in highlighted. Wherever it came
 * from (the field's own regenerate, the chat, Improve) it lands here, and
 * nothing changes until the researcher accepts it.
 */
export const InlineSuggestion: React.FC<{
  match: FieldMatch;
  /** What the field holds now, to tell a suggestion that's gone out of date. */
  currentValue: unknown;
}> = ({ match, currentValue }) => {
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const entries = useAiThread(
    (s) => s.threads[scopeKey(currentDmpId)] ?? NO_ENTRIES,
  );
  const acceptProposal = useChatStore((s) => s.acceptProposal);
  const rejectProposal = useChatStore((s) => s.rejectProposal);

  // Newest first: the latest ask is the one worth deciding on here.
  const found: { entryId: string; proposal: ChatProposal }[] = [];
  entries.forEach((e) => {
    if (e.kind === "event") return;
    ((e as ThreadTurn).proposals ?? []).forEach((proposal) => {
      if (matches(proposal, match)) found.unshift({ entryId: e.id, proposal });
    });
  });

  if (found.length === 0) return null;
  const [{ entryId, proposal }] = found;
  const before =
    typeof proposal.beforeValue === "string"
      ? proposal.beforeValue
      : proposal.before;
  const after =
    typeof proposal.value === "string" ? proposal.value : proposal.after;
  const outOfDate = !sameValue(currentValue ?? "", proposal.beforeValue ?? "");

  return (
    <div
      role="region"
      aria-label="AI suggestion"
      className={cn(
        "rounded-md border p-3 text-sm",
        outOfDate
          ? "border-warn/50 bg-warn-subtle/30"
          : "border-ai/40 bg-ai-subtle/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-ai">
          <Sparkles className="h-3.5 w-3.5" />
          AI suggestion
        </p>
        {proposal.needsHumanConfirm && (
          <Chip variant="warn">
            <UserCheck className="h-3 w-3" />
            You decide
          </Chip>
        )}
      </div>

      {outOfDate ? (
        <p className="text-xs text-warn">
          The field changed after this was suggested, so it can&rsquo;t be
          applied any more.
        </p>
      ) : (
        <p className="whitespace-pre-wrap leading-relaxed">
          {wordDiff(before ?? "", after ?? "").map((part, i) =>
            part.kind === "same" ? (
              <span key={i}>{part.text}</span>
            ) : part.kind === "removed" ? (
              <del
                key={i}
                className="rounded-sm bg-destructive/10 text-destructive decoration-destructive/60"
              >
                {part.text}
              </del>
            ) : (
              <ins
                key={i}
                className="rounded-sm bg-ok-subtle text-ok no-underline"
              >
                {part.text}
              </ins>
            ),
          )}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!outOfDate && (
          <Button
            size="sm"
            onClick={() => acceptProposal(entryId, proposal.id)}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Accept
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => rejectProposal(entryId, proposal.id)}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          {outOfDate ? "Dismiss" : "Reject"}
        </Button>
        {found.length > 1 && (
          <span className="text-xs text-muted-foreground">
            {found.length - 1} older suggestion
            {found.length === 2 ? "" : "s"} in the assistant
          </span>
        )}
      </div>
    </div>
  );
};
