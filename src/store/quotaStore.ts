import { create } from "zustand";
import type { AiQuota } from "@/api/aiContract";
import { http } from "@/api/http";
import { onSessionChange } from "@/config/current-user";

/** `GET /ai/quota`. A limit of 0 means no limit. */
const fetchQuota = async (): Promise<AiQuota> => {
  const q = await http.get<{
    limit: number;
    used: number;
    resets_at: string | null;
  }>("/ai/quota");
  return {
    limit: q.limit,
    used: q.used,
    resets_at: q.resets_at ? new Date(q.resets_at) : null,
  };
};

/**
 * The AI budget as the server last reported it. The server is the source of
 * truth — it enforces the limit and counts what each call cost — so this is
 * never added to locally; it's refreshed after every AI call instead. Not
 * persisted: a stale number from last week is worse than "loading".
 */
interface QuotaState {
  quota: AiQuota | null;
  status: "idle" | "loading" | "ready" | "error";
  refresh: () => Promise<void>;
  /** Null until the server has answered. */
  tokensLeft: () => number | null;
  /**
   * A pre-flight hint so the UI can explain before a call is refused. The
   * server decides; with no figure yet, the call is let through to it.
   */
  hasTokensFor: (cost: number) => boolean;
}

let inFlight: Promise<void> | null = null;

export const useQuotaStore = create<QuotaState>()((set, get) => ({
  quota: null,
  status: "idle",

  refresh: () => {
    // Several AI calls finishing together need one answer, not several.
    inFlight ??= (async () => {
      set((s) => ({ status: s.quota ? s.status : "loading" }));
      try {
        set({ quota: await fetchQuota(), status: "ready" });
      } catch {
        set({ status: "error" });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },

  tokensLeft: () => {
    const q = get().quota;
    if (!q) return null;
    // No limit: nothing to count down from.
    return q.limit === 0
      ? Number.POSITIVE_INFINITY
      : Math.max(0, q.limit - q.used);
  },

  hasTokensFor: (cost) => {
    const left = get().tokensLeft();
    return left === null || left >= cost;
  },
}));

/** "1,200 left" while known; nothing to claim while it isn't. */
export const formatTokensLeft = (left: number | null) =>
  left === null ? "…" : left === Number.POSITIVE_INFINITY ? "Unlimited" : left.toLocaleString();

onSessionChange(() => useQuotaStore.setState({ quota: null, status: "idle" }));
