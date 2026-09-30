import { create } from "zustand";
import { estimateCost, PROMPT_OVERHEAD, tokensIn } from "@/api/aiApi";
import { planToolCalls } from "@/api/aiTools";
import { computeReadiness } from "@/hooks/useDmpReadiness";
import { useDmpStore } from "@/store/dmpStore";
import { useTaskStore } from "@/store/taskStore";
import { useToastStore } from "@/store/toastStore";
import {
  runToolCall,
  type ChatProposal,
  type ChatRejection,
} from "@/store/chatTools";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  token_count?: number;
  at: Date;
  /** Diffs the person accepts or rejects; nothing is applied until they do. */
  proposals?: ChatProposal[];
  /** Things the system refused, with the reason it refused them. */
  rejections?: ChatRejection[];
}

const makeId = () => Math.random().toString(36).substring(2, 10);

/** Per tool call, on top of the turn. Kept visible so chat's cost is honest. */
const TOOL_CALL_COST = 60;

/**
 * What a turn will cost before it is sent. Only the message and a small
 * scope summary go up — the plan itself is read by tools when needed, rather
 * than being pasted into every turn.
 */
export const estimateTurn = (message: string): number =>
  message.trim() ? estimateCost.chat(message) : 0;

interface ChatState {
  messages: ChatMessage[];
  isThinking: boolean;
  send: (text: string) => Promise<void>;
  acceptProposal: (messageId: string, proposalId: string) => void;
  rejectProposal: (messageId: string, proposalId: string) => void;
  acceptAll: (messageId: string) => void;
  clear: () => void;
}

const setProposalStatus = (
  messages: ChatMessage[],
  messageId: string,
  match: (p: ChatProposal) => boolean,
  status: ChatProposal["status"],
) =>
  messages.map((m) =>
    m.id === messageId
      ? {
          ...m,
          proposals: (m.proposals ?? []).map((p) =>
            match(p) && p.status === "pending" ? { ...p, status } : p,
          ),
        }
      : m,
  );

/** The only place a proposal turns into a change — driven by a person's click. */
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

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isThinking: false,

  send: async (text) => {
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

    set((state) => ({
      messages: [
        ...state.messages,
        { id: makeId(), role: "user", text: trimmed, at: new Date() },
      ],
      isThinking: true,
    }));

    try {
      // The planner sees the message and a count — never the plan's prose, so
      // text carried in from an uploaded proposal can't choose the tools.
      const calls = planToolCalls(trimmed, {
        datasetCount: (dmp.draft.dataset ?? []).length,
        hasDraft: Boolean(dmp.draft.title || dmp.draft.description),
      });

      await new Promise((r) => setTimeout(r, 600));

      const ctx = {
        draft: dmp.draft,
        planApproved: dmp.status === "approved",
        unmet: computeReadiness(dmp.draft).unmetItems.map((i) => i.label),
      };

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
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: makeId(),
            role: "assistant",
            text: reply,
            token_count,
            at: new Date(),
            proposals: proposals.length ? proposals : undefined,
            rejections: rejections.length ? rejections : undefined,
          },
        ],
        isThinking: false,
      }));
    } catch {
      set({ isThinking: false });
      useToastStore.getState().toast({
        title: "Couldn't reach the assistant",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  },

  acceptProposal: (messageId, proposalId) => {
    const message = get().messages.find((m) => m.id === messageId);
    const proposal = message?.proposals?.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== "pending") return;

    applyProposal(proposal);
    set((state) => ({
      messages: setProposalStatus(
        state.messages,
        messageId,
        (p) => p.id === proposalId,
        "accepted",
      ),
    }));
  },

  rejectProposal: (messageId, proposalId) =>
    set((state) => ({
      messages: setProposalStatus(
        state.messages,
        messageId,
        (p) => p.id === proposalId,
        "rejected",
      ),
    })),

  acceptAll: (messageId) => {
    const message = get().messages.find((m) => m.id === messageId);
    (message?.proposals ?? [])
      .filter((p) => p.status === "pending")
      .forEach(applyProposal);

    set((state) => ({
      messages: setProposalStatus(
        state.messages,
        messageId,
        () => true,
        "accepted",
      ),
    }));
  },

  clear: () => set({ messages: [] }),
}));
