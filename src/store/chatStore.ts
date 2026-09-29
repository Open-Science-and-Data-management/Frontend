import { create } from "zustand";
import { aiChat, estimateCost, type ChatContext } from "@/api/aiApi";
import { contributorFullName } from "@/schemas/contributor";
import { computeReadiness } from "@/hooks/useDmpReadiness";
import { useDmpStore } from "@/store/dmpStore";
import { useToastStore } from "@/store/toastStore";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  token_count?: number;
  at: Date;
}

const makeId = () => Math.random().toString(36).substring(2, 10);

// The assistant only ever sees the plan currently being edited.
const buildContext = (): ChatContext => {
  const { draft, confirmedFields, tokensLeft } = useDmpStore.getState();
  const { unmetItems } = computeReadiness(draft, confirmedFields);
  const costs = draft.cost ?? [];

  return {
    title: draft.title,
    beginDate: draft.begin_date,
    endDate: draft.end_date,
    ethicalIssues: draft.ethical_issues_exist,
    outputs: (draft.dataset ?? []).map((d) => ({
      title: d.title || "Untitled output",
      type: d.type,
      access: d.access,
    })),
    contributors: (draft.contributor ?? []).map((c) => ({
      name: contributorFullName(c) || "Unnamed",
      role: c.role,
      isContact: c.is_contact,
    })),
    costTotal: costs.reduce((sum, c) => sum + (c.value || 0), 0),
    currency: costs[0]?.currency_code,
    unmet: unmetItems.map((i) => i.label),
    tokensLeft: tokensLeft(),
  };
};

interface ChatState {
  messages: ChatMessage[];
  isThinking: boolean;
  send: (text: string) => Promise<void>;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isThinking: false,

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const dmp = useDmpStore.getState();
    const estimated = estimateCost.chat(trimmed);
    if (!dmp.hasTokensFor(estimated)) {
      useToastStore.getState().toast({
        title: "Not enough tokens left",
        description: `This reply needs about ${estimated.toLocaleString()} tokens and you have ${dmp.tokensLeft().toLocaleString()} left.`,
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
      const { reply, token_count } = await aiChat(trimmed, buildContext());
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

  clear: () => set({ messages: [] }),
}));
