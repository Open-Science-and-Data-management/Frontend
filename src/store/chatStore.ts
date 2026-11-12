import { create } from "zustand";
import { estimateCost } from "@/api/aiApi";
import { asAiError, totalTokens } from "@/api/aiContract";
import { runAiAction } from "@/api/aiStream";
import { describeAiError, reportAiError, syncQuota } from "@/store/aiErrors";
import { computeReadiness } from "@/hooks/useDmpReadiness";
import { isActive } from "@/config/plan-mode";
import { useDmpStore } from "@/store/dmpStore";
import { useTaskStore } from "@/store/taskStore";
import { useToastStore } from "@/store/toastStore";
import {
  useAiThread,
  type ThreadTicket,
  type ThreadTurn,
} from "@/store/aiThread";
import {
  guardBeforeApply,
  type ChatProposal,
  type ToolContext,
} from "@/store/chatTools";

export type ChatMessage = ThreadTurn;
const makeId = () => Math.random().toString(36).substring(2, 10);

export const estimateTurn = (message: string): number =>
  message.trim() ? estimateCost.chat(message) : 0;

interface ChatState {
  isThinking: boolean;
  /** The thread the reply in flight belongs to, so only it says "Thinking…". */
  pendingTicket: ThreadTicket | null;
  /**
   * Stops waiting for the reply in flight. The server has already processed
   * the prompt, so those tokens still count — the quota is re-read after.
   */
  stop: () => void;
  send: (text: string, scope?: { section?: string }) => Promise<void>;
  suggestChanges: (input: SuggestInput) => Promise<SuggestResult | null>;
  acceptProposal: (messageId: string, proposalId: string) => void;
  rejectProposal: (messageId: string, proposalId: string) => void;
  acceptAll: (messageId: string) => void;
  clear: () => void;
}

const withStatus = (
  entry: ThreadTurn,
  match: (p: ChatProposal) => boolean,
  status: ChatProposal["status"],
  staleReason?: string,
): ThreadTurn => ({
  ...entry,
  proposals: (entry.proposals ?? []).map((p) =>
    match(p) && p.status === "pending"
      ? { ...p, status, ...(staleReason ? { staleReason } : {}) }
      : p,
  ),
});

const currentContext = (): ToolContext => {
  const dmp = useDmpStore.getState();
  return {
    draft: dmp.draft,
    planActive: isActive(dmp.status),
    unmet: computeReadiness(dmp.draft).unmetItems.map((i) => i.label),
    activity: thread()
      .entriesFor(dmp.currentDmpId)
      .filter((e) => e.kind === "event")
      .map((e) => ({
        summary: (e as { summary: string }).summary,
        token_count: (e as { token_count: number }).token_count,
      })),
  };
};

const applyProposal = (proposal: ChatProposal) => {
  const dmp = useDmpStore.getState();

  if (proposal.kind === "task") {
    const task = proposal.task;
    if (!task) return;
    if (!dmp.currentDmpId) return;
    void useTaskStore.getState().addTask({
      dmp_id: dmp.currentDmpId,
      title: task.title,
      details: task.details,
      lifecycle_stage: task.lifecycle_stage,
      priority: task.priority,
    });
    return;
  }

  if (proposal.datasetId && proposal.datasetField) {
    const dataset = (dmp.draft.dataset ?? []).find(
      (d) => d.dataset_id === proposal.datasetId,
    );
    if (!dataset) return;

    dmp.updateDataset(
      proposal.datasetId,
      proposal.preservationField
        ? {
            preservation: {
              ...dataset.preservation,
              [proposal.preservationField]: proposal.value,
            },
          }
        : ({ [proposal.datasetField]: proposal.value } as never),
    );
    return;
  }

  if (proposal.path) {
    dmp.setField(proposal.path as never, proposal.value as never);
  }
};

export interface SuggestInput {
  source: "proposal" | "current";
  direction: string;
  filename?: string;
  targetIds?: string[];
}

export interface SuggestResult {
  entryId: string;
  /** Ready to review. */
  proposals: number;
  rejected: number;
  /** Came back after the plan had moved on; shown, marked out of date. */
  stale: number;
}

<<<<<<< Updated upstream
const asRegenerateDirection = (text: string): RegenerateDirection => {
  const trimmed = text.trim();
  if (/^shorter$/i.test(trimmed)) return { kind: "shorter" };
  if (/^(more formal|formal)$/i.test(trimmed)) return { kind: "formal" };
  return { kind: "custom", detail: trimmed || "clearer" };
};

=======
>>>>>>> Stashed changes
const thread = () => useAiThread.getState();
const currentScope = () => useDmpStore.getState().currentDmpId;

/** The request in flight, so Stop can reach it. One at a time. */
let controller: AbortController | null = null;

const begin = () => {
  controller = new AbortController();
  return controller.signal;
};

/** Spend was counted by the server; ask it what's left. */
const settle = (set: (s: Partial<ChatState>) => void) => {
  controller = null;
  set({ isThinking: false, pendingTicket: null });
  syncQuota();
};

export const useChatStore = create<ChatState>((set, get) => ({
  isThinking: false,
  pendingTicket: null,

  stop: () => controller?.abort(),

  send: async (text, scope) => {
    const trimmed = text.trim();
    if (!trimmed || get().isThinking) return;

    // The question, and its answer, belong to the plan it was asked about.
    const ticket = thread().ticket(currentScope());
    const pendingId = makeId();
    thread().append(ticket.scope, {
      id: pendingId,
      kind: "user",
      text: trimmed,
      at: new Date(),
    });
    set({ isThinking: true, pendingTicket: ticket });
    const signal = begin();

    try {
<<<<<<< Updated upstream
      const calls = planToolCalls(trimmed, {
        datasetCount: (snapshot.draft.dataset ?? []).length,
        hasDraft: Boolean(snapshot.draft.title || snapshot.draft.description),
        section: scope?.section,
      });

      const answers: string[] = [];
      const proposals: ChatProposal[] = [];
      const rejections: ChatRejection[] = [];
      // What drafting rewrites cost, on top of the chat turn itself.
      let rewriteUsage: AiUsage = NO_USAGE;
      for (const call of calls) {
        if (call.tool === "proposeRewrite") {
          // Drafted like the field's own regenerate, under the same rules,
          // then proposed like any other change: nothing is written in.
          const check = prepareRewrite(call.path, call.direction, snapshot);
          if (!check.ok) {
            rejections.push(check.rejection);
            continue;
          }
          const result = await aiApi.regenerateField(
            check.label,
            check.current,
            call.direction,
            check.mode,
            { signal },
          );
          rewriteUsage = {
            input_tokens: rewriteUsage.input_tokens + result.usage.input_tokens,
            output_tokens:
              rewriteUsage.output_tokens + result.usage.output_tokens,
            cached_input_tokens:
              rewriteUsage.cached_input_tokens +
              result.usage.cached_input_tokens,
          };
          if (sameValue(result.text, check.current)) {
            answers.push(
              `${check.label} already reads that way, so there's nothing to change.`,
            );
            continue;
          }
          const run = runToolCall(
            { tool: "proposeFieldChange", path: call.path, value: result.text },
            snapshot,
          );
          proposals.push(...run.proposals);
          rejections.push(...run.rejections);
          continue;
        }
        const run = runToolCall(call, snapshot);
        answers.push(...run.answers);
        proposals.push(...run.proposals);
        rejections.push(...run.rejections);
      }

      const reply =
        answers.join("\n\n") ||
        (proposals.length
          ? `I've drafted ${proposals.length} change${proposals.length === 1 ? "" : "s"} below. Nothing is applied until you accept it.`
          : rejections.length
            ? "I couldn't do that. The reason is below."
            : "I can answer questions about this plan, explain a field, or suggest changes for you to review. Try “what’s still needed before I submit?”, “make the description shorter” or “change retention to 15 years for every output”.");

      const usage = await serve({
        input: PROMPT_OVERHEAD.chat + tokensIn(trimmed),
        output: tokensIn(reply) + calls.length * TOOL_CALL_COST,
        ms: 600,
        signal,
      });

      // Recorded on its own plan even if another is open now; suggestions
      // that no longer match that plan are shown as out of date.
      const target = thread().resolve(ticket);
      const checked = flagDrift(
        proposals,
        useDmpStore.getState().draftFor(target),
=======
      // Pending edits first, so the assistant reads the plan as it is.
      await useDmpStore.getState().flushDraft();
      await runAiAction(
        ticket.scope,
        "chat",
        { message: trimmed, ...(scope?.section ? { section: scope.section } : {}) },
        { signal },
>>>>>>> Stashed changes
      );
      // The server wrote both turns; show its copy.
      await thread().reload(thread().resolve(ticket));
    } catch (err) {
      const e = asAiError(err);
      thread().append(thread().resolve(ticket), {
        id: makeId(),
        kind: "assistant",
        text:
          e.code === "aborted"
            ? "Stopped. Tokens already used still count."
            : describeAiError(e),
        token_count: totalTokens(e.usage) || undefined,
        at: new Date(),
        ...(e.code === "aborted"
          ? { stopped: true }
          : { failed: { retryable: e.retryable, request: trimmed } }),
      });
    } finally {
      settle(set);
    }
  },

  suggestChanges: async ({ source, direction, filename, targetIds }) => {
    if (get().isThinking) return null;
    const dmp = useDmpStore.getState();
    const scope = dmp.currentDmpId;
    if (!scope) return null;
    const targets = dmp
      .eligibleBatchTargets()
      .filter((t) => (targetIds ?? []).includes(t.id));
    if (source === "current" && targets.length === 0) return null;

    const ticket = thread().ticket(scope);
    set({ isThinking: true, pendingTicket: ticket });
    const signal = begin();
    try {
      await dmp.flushDraft();
      const result = await runAiAction(
        scope,
        "suggest",
        {
          source,
          direction: direction.trim() || undefined,
          ...(source === "proposal" && filename ? { filename } : {}),
          ...(source === "current"
            ? {
                fields: targets.map((t) => ({
                  path:
                    t.scope === "dmp"
                      ? t.key
                      : `dataset[${(dmp.draft.dataset ?? []).findIndex((d) => d.dataset_id === t.datasetId)}].${t.key}`,
                  label: t.label,
                  text: t.value,
                })),
              }
            : {}),
        },
        { signal },
      );
      await thread().reload(scope);
      const turn = thread()
        .entriesFor(scope)
        .find((e) => e.id === result.entryId) as ThreadTurn | undefined;
      const proposals = turn?.proposals ?? [];
      const stale = proposals.filter((p) => p.status === "stale").length;
      return {
        entryId: result.entryId ?? "",
        proposals: proposals.length - stale,
        rejected: 0,
        stale,
      };
    } catch (err) {
      reportAiError(err, {
        what: "draft the changes",
        retry: () =>
          void get().suggestChanges({ source, direction, filename, targetIds }),
      });
      return null;
    } finally {
      settle(set);
    }
  },

  acceptProposal: (messageId, proposalId) => {
    const scope = currentScope();
    const entry = thread()
      .entriesFor(scope)
      .find((e) => e.id === messageId) as ThreadTurn | undefined;
    const proposal = entry?.proposals?.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== "pending") return;
    const guard = guardBeforeApply(proposal, currentContext());
    if (!guard.ok) {
      thread().updateEntry(scope, messageId, (e) =>
        withStatus(
          e as ThreadTurn,
          (p) => p.id === proposalId,
          "stale",
          guard.reason,
        ),
      );
      return;
    }

    applyProposal(proposal);
    thread().updateEntry(scope, messageId, (e) =>
      withStatus(e as ThreadTurn, (p) => p.id === proposalId, "accepted"),
    );
  },

  rejectProposal: (messageId, proposalId) =>
    thread().updateEntry(currentScope(), messageId, (e) =>
      withStatus(e as ThreadTurn, (p) => p.id === proposalId, "rejected"),
    ),

  acceptAll: (messageId) => {
    const scope = currentScope();
    const entry = thread()
      .entriesFor(scope)
      .find((e) => e.id === messageId) as ThreadTurn | undefined;
    const pending = (entry?.proposals ?? []).filter(
      (p) => p.status === "pending",
    );

    const outcomes = new Map<string, string | undefined>();
    pending.forEach((proposal) => {
      const guard = guardBeforeApply(proposal, currentContext());
      if (guard.ok) {
        applyProposal(proposal);
        outcomes.set(proposal.id, undefined);
      } else {
        outcomes.set(proposal.id, guard.reason ?? "Couldn't apply this one.");
      }
    });

    thread().updateEntry(scope, messageId, (e) => {
      const turn = e as ThreadTurn;
      return {
        ...turn,
        proposals: (turn.proposals ?? []).map((p) =>
          outcomes.has(p.id)
            ? outcomes.get(p.id)
              ? {
                  ...p,
                  status: "stale" as const,
                  staleReason: outcomes.get(p.id),
                }
              : { ...p, status: "accepted" as const }
            : p,
        ),
      };
    });

    const skipped = [...outcomes.values()].filter(Boolean).length;
    if (skipped > 0) {
      useToastStore.getState().toast({
        title: `${skipped} change${skipped === 1 ? "" : "s"} not applied`,
        description: "The plan moved on since they were suggested.",
      });
    }
  },

  clear: () => thread().clear(currentScope()),
}));
