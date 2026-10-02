import { create } from "zustand";
import { aiApi, estimateCost, PROMPT_OVERHEAD, tokensIn } from "@/api/aiApi";
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
import { useAiThread, type ThreadTurn } from "@/store/aiThread";
import {
  guardBeforeApply,
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
  proposals: number;
  rejected: number;
}

const asRegenerateDirection = (text: string): RegenerateDirection => {
  const trimmed = text.trim();
  if (/^shorter$/i.test(trimmed)) return { kind: "shorter" };
  if (/^(more formal|formal)$/i.test(trimmed)) return { kind: "formal" };
  return { kind: "custom", detail: trimmed || "clearer" };
};

const thread = () => useAiThread.getState();
const currentScope = () => useDmpStore.getState().currentDmpId;

export const useChatStore = create<ChatState>((set) => ({
  isThinking: false,

  send: async (text, scope) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const dmp = useDmpStore.getState();
    const estimated = estimateTurn(trimmed);
    if (!dmp.hasTokensFor(estimated)) {
      useToastStore.getState().toast({
        title: "Not enough tokens left",
        description: `This turn needs about ${estimated.toLocaleString()} tokens and you have ${dmp.tokensLeft().toLocaleString()} left.`,
        variant: "destructive",
      });
      return;
    }

    thread().append(currentScope(), {
      id: makeId(),
      kind: "user",
      text: trimmed,
      at: new Date(),
    });
    set({ isThinking: true });

    try {
      const calls = planToolCalls(trimmed, {
        datasetCount: (dmp.draft.dataset ?? []).length,
        hasDraft: Boolean(dmp.draft.title || dmp.draft.description),
        section: scope?.section,
      });

      await new Promise((r) => setTimeout(r, 600));

      const ctx = currentContext();

      const answers: string[] = [];
      const proposals: ChatProposal[] = [];
      const rejections: ChatRejection[] = [];

      calls.forEach((call) => {
        const run = runToolCall(call, ctx);
        answers.push(...run.answers);
        proposals.push(...run.proposals);
        rejections.push(...run.rejections);
      });

      const reply =
        answers.join("\n\n") ||
        (proposals.length
          ? `I've drafted ${proposals.length} change${proposals.length === 1 ? "" : "s"} below. Nothing is applied until you accept it.`
          : rejections.length
            ? "I couldn't do that — see below."
            : "I can answer questions about this plan, explain a field, or suggest changes for you to review. Try “what is the current access?” or “change retention to 15 years for every output”.");

      const token_count =
        PROMPT_OVERHEAD.chat +
        tokensIn(trimmed) +
        tokensIn(reply) +
        calls.length * TOOL_CALL_COST;

      useDmpStore.setState((s) => ({ tokenUsed: s.tokenUsed + token_count }));
      thread().append(currentScope(), {
        id: makeId(),
        kind: "assistant",
        text: reply,
        token_count,
        at: new Date(),
        proposals: proposals.length ? proposals : undefined,
        rejections: rejections.length ? rejections : undefined,
      });
      set({ isThinking: false });
    } catch {
      set({ isThinking: false });
      useToastStore.getState().toast({
        title: "Couldn't reach the assistant",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  },

  suggestChanges: async ({ source, direction, filename, targetIds }) => {
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

    if (!dmp.hasTokensFor(estimated)) {
      useToastStore.getState().toast({
        title: "Not enough tokens left",
        description: `This needs about ${estimated.toLocaleString()} tokens.`,
        variant: "destructive",
      });
      return null;
    }
    if (source === "current" && targets.length === 0) return null;

    set({ isThinking: true });
    try {
      let fields: { path: string; value: unknown }[] = [];
      let token_count = 0;
      let summary: string;

      if (source === "proposal") {
        const result = await redraftFromProposal({
          filename: filename ?? "the proposal",
          direction,
          current: dmp.draft,
        });
        fields = result.fields;
        token_count = result.token_count;
        summary = `Redrafted from ${filename ?? "the proposal"}${direction.trim() ? ` (${direction.trim()})` : ""}`;
      } else {
        const steer = asRegenerateDirection(direction);
        const datasets = dmp.draft.dataset ?? [];

        const rewritten = await Promise.all(
          targets.map(async (target) => {
            const { text, token_count: spent } = await aiApi.regenerateField(
              target.label,
              target.value,
              steer,
            );
            const index = datasets.findIndex(
              (d) => d.dataset_id === target.datasetId,
            );
            return {
              path:
                target.scope === "dmp"
                  ? target.key
                  : `dataset[${index}].${target.key}`,
              value: text,
              spent,
            };
          }),
        );

        fields = rewritten.map(({ path, value }) => ({ path, value }));
        token_count = rewritten.reduce((sum, r) => sum + r.spent, 0);
        summary = `Rewrote ${fields.length} field${fields.length === 1 ? "" : "s"} (${describeDirection(steer)})`;
      }
      const ctx = currentContext();
      const proposals: ChatProposal[] = [];
      const rejections: ChatRejection[] = [];
      fields.forEach((field) => {
        const run = runToolCall(
          { tool: "proposeFieldChange", path: field.path, value: field.value },
          ctx,
        );
        proposals.push(...run.proposals);
        rejections.push(...run.rejections);
      });

      useDmpStore.setState((s) => ({ tokenUsed: s.tokenUsed + token_count }));
      recordAiEvent(dmp.currentDmpId, {
        action: source === "proposal" ? "analyze_proposal" : "batch_regenerate",
        summary,
        detail: `${proposals.length} suggestion(s), ${rejections.length} refused.`,
        token_count,
      });

      const entryId = makeId();
      thread().append(dmp.currentDmpId, {
        id: entryId,
        kind: "assistant",
        text: proposals.length
          ? `${summary}. ${proposals.length} change${proposals.length === 1 ? "" : "s"} to review — nothing is applied until you accept it.`
          : `${summary}, but nothing new came out of it.`,
        token_count,
        at: new Date(),
        proposals: proposals.length ? proposals : undefined,
        rejections: rejections.length ? rejections : undefined,
      });

      set({ isThinking: false });
      return {
        entryId,
        proposals: proposals.length,
        rejected: rejections.length,
      };
    } catch {
      set({ isThinking: false });
      useToastStore.getState().toast({
        title: "Couldn't draft the changes",
        variant: "destructive",
      });
      return null;
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
