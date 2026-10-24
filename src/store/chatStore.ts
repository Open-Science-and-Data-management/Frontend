import { create } from "zustand";
import { sameValue } from "@/utils/sameValue";
import { aiApi, estimateCost, PROMPT_OVERHEAD, tokensIn } from "@/api/aiApi";
import {
  asAiError,
  NO_USAGE,
  totalTokens,
  type AiUsage,
} from "@/api/aiContract";
import { serve } from "@/api/mock/aiServer";
import { describeAiError, reportAiError, syncQuota } from "@/store/aiErrors";
import { formatTokensLeft, useQuotaStore } from "@/store/quotaStore";
import { planToolCalls } from "@/api/aiTools";
import {
  describeDirection,
  redraftFromProposal,
  type RegenerateDirection,
} from "@/api/aiApi";
import { recordAiEvent } from "@/store/aiThread";
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
  flagDrift,
  guardBeforeApply,
  prepareRewrite,
  runToolCall,
  type ChatProposal,
  type ChatRejection,
  type ToolContext,
} from "@/store/chatTools";

export type ChatMessage = ThreadTurn;
const makeId = () => Math.random().toString(36).substring(2, 10);

const TOOL_CALL_COST = 60;

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
    useTaskStore.getState().addTask({
      dmp_id: dmp.currentDmpId ?? "current-dmp",
      title: task.title,
      details: task.details,
      lifecycle_stage: task.lifecycle_stage,
      priority: task.priority,
      generated_by: "ai",
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

const asRegenerateDirection = (text: string): RegenerateDirection => {
  const trimmed = text.trim();
  if (/^shorter$/i.test(trimmed)) return { kind: "shorter" };
  if (/^(more formal|formal)$/i.test(trimmed)) return { kind: "formal" };
  return { kind: "custom", detail: trimmed || "clearer" };
};

/** "Which repository should I use?" and the like: advice, not plan content. */
const ASKS_FOR_ADVICE =
  /\b(?:recommend|which|what|should i)\b.*\b(?:repositor(?:y|ies)|tools?|software|licen[cs]es?|formats?|platforms?)\b|ควรใช้|แนะนำ/i;

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

    const quota = useQuotaStore.getState();
    const estimated = estimateTurn(trimmed);
    if (!quota.hasTokensFor(estimated)) {
      useToastStore.getState().toast({
        title: "Not enough tokens left",
        description: `This turn needs about ${estimated.toLocaleString()} tokens and you have ${formatTokensLeft(quota.tokensLeft())} left.`,
        variant: "destructive",
      });
      return;
    }

    // The question, and its answer, belong to the plan it was asked about —
    // and the answer is worked out from that plan as it was when asked.
    const ticket = thread().ticket(currentScope());
    const snapshot = currentContext();
    thread().append(ticket.scope, {
      id: makeId(),
      kind: "user",
      text: trimmed,
      at: new Date(),
    });
    set({ isThinking: true, pendingTicket: ticket });
    const signal = begin();

    try {
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
        // Advice needs grounding the assistant doesn't have yet (a repository
        // and guidance source). Saying so beats a generic "try asking…".
        (calls.length === 0 && ASKS_FOR_ADVICE.test(trimmed)
          ? "I can't recommend a repository, tool, licence or format yet: I don't have a trusted source to check advice against. Your institution's data steward or library can help. I can explain what a field means, or change one once you've decided."
          : "") ||
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
      );
      thread().append(target, {
        id: makeId(),
        kind: "assistant",
        text: reply,
        token_count: totalTokens(usage) + totalTokens(rewriteUsage),
        at: new Date(),
        proposals: checked.length ? checked : undefined,
        rejections: rejections.length ? rejections : undefined,
      });
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
    const targets = dmp
      .eligibleBatchTargets()
      .filter((t) => (targetIds ?? []).includes(t.id));

    const estimated =
      source === "proposal"
        ? estimateCost.chat(direction) * 2
        : targets.reduce(
            (sum, t) => sum + estimateCost.regenerateField(t.value),
            0,
          );

    const quota = useQuotaStore.getState();
    if (!quota.hasTokensFor(estimated)) {
      useToastStore.getState().toast({
        title: "Not enough tokens left",
        description: `This needs about ${estimated.toLocaleString()} tokens and you have ${formatTokensLeft(quota.tokensLeft())} left.`,
        variant: "destructive",
      });
      return null;
    }
    if (source === "current" && targets.length === 0) return null;

    // Suggestions are drafted against the plan as it is now, and checked
    // against the plan as it is when they come back.
    const ticket = thread().ticket(dmp.currentDmpId);
    const snapshot = currentContext();
    set({ isThinking: true, pendingTicket: ticket });
    const signal = begin();

    try {
      let fields: { path: string; value: unknown }[] = [];
      let usage: AiUsage;
      let summary: string;

      if (source === "proposal") {
        const result = await redraftFromProposal(
          {
            filename: filename ?? "the proposal",
            direction,
            current: snapshot.draft,
          },
          { signal },
        );
        fields = result.fields;
        usage = result.usage;
        summary = `Redrafted from ${filename ?? "the proposal"}${direction.trim() ? ` (${direction.trim()})` : ""}`;
      } else {
        const steer = asRegenerateDirection(direction);
        const datasets = snapshot.draft.dataset ?? [];

        const rewritten = await Promise.all(
          targets.map(async (target) => {
            const result = await aiApi.regenerateField(
              target.label,
              target.value,
              steer,
              "rewrite",
              { signal },
            );
            const index = datasets.findIndex(
              (d) => d.dataset_id === target.datasetId,
            );
            return {
              path:
                target.scope === "dmp"
                  ? target.key
                  : `dataset[${index}].${target.key}`,
              value: result.text,
              usage: result.usage,
            };
          }),
        );

        // A field that came back as it was isn't a change to decide on.
        fields = rewritten
          .filter(({ value }, i) => !sameValue(value, targets[i].value))
          .map(({ path, value }) => ({ path, value }));
        usage = rewritten.reduce<AiUsage>(
          (sum, r) => ({
            input_tokens: sum.input_tokens + r.usage.input_tokens,
            output_tokens: sum.output_tokens + r.usage.output_tokens,
            cached_input_tokens:
              sum.cached_input_tokens + r.usage.cached_input_tokens,
          }),
          NO_USAGE,
        );
        summary = fields.length
          ? `Rewrote ${fields.length} field${fields.length === 1 ? "" : "s"} (${describeDirection(steer)})`
          : `Checked ${targets.length} field${targets.length === 1 ? "" : "s"} (${describeDirection(steer)})`;
      }

      const proposals: ChatProposal[] = [];
      const rejections: ChatRejection[] = [];
      fields.forEach((field) => {
        const run = runToolCall(
          { tool: "proposeFieldChange", path: field.path, value: field.value },
          snapshot,
        );
        proposals.push(...run.proposals);
        rejections.push(...run.rejections);
      });

      const target = thread().resolve(ticket);
      const checked = flagDrift(
        proposals,
        useDmpStore.getState().draftFor(target),
      );
      const stale = checked.filter((p) => p.status === "stale").length;
      const token_count = totalTokens(usage);

      recordAiEvent(target, {
        action: source === "proposal" ? "analyze_proposal" : "batch_regenerate",
        summary,
        detail: `${checked.length} suggestion(s), ${rejections.length} refused${stale ? `, ${stale} out of date` : ""}.`,
        token_count,
        usage,
      });

      const entryId = makeId();
      thread().append(target, {
        id: entryId,
        kind: "assistant",
        text: checked.length
          ? `${summary}. ${checked.length} change${checked.length === 1 ? "" : "s"} to review. Nothing is applied until you accept it.${stale ? ` ${stale} no longer match${stale === 1 ? "es" : ""} the plan and ${stale === 1 ? "is" : "are"} marked out of date.` : ""}`
          : `${summary}, but nothing new came out of it.`,
        token_count,
        at: new Date(),
        proposals: checked.length ? checked : undefined,
        rejections: rejections.length ? rejections : undefined,
      });

      return {
        entryId,
        proposals: checked.length - stale,
        rejected: rejections.length,
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
