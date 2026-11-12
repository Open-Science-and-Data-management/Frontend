import { http } from "@/api/http";

/**
 * The plan's AI thread on the backend (`AI_THREAD_ENTRY`). Only the
 * researcher who owns it can read it; the server writes every AI turn,
 * proposal and event itself, and the client only records decisions.
 */

export interface ServerThreadEntry {
  object: "ai_thread_entry";
  entry_id: string;
  dmp_id: string | null;
  kind: "user" | "assistant" | "event";
  content: Record<string, unknown> | null;
  token_count: number;
  decision: "accepted" | "rejected" | "stale" | null;
  hidden: boolean;
  created_at: string;
}

export const THREAD_PAGE_SIZE = 50;

export interface ThreadPage {
  /** Oldest first, ready to show. */
  entries: ServerThreadEntry[];
  /** Whether older entries exist before this page. */
  hasMore: boolean;
}

interface List<T> {
  data: T[];
  has_more: boolean;
}

export const aiThreadApi = {
  /** `GET /dmps/:scope/ai-thread?before=&limit=` */
  list: async (
    scope: string,
    opts: { before?: string; limit?: number } = {},
  ): Promise<ThreadPage> => {
    const page = await http.get<List<ServerThreadEntry>>(
      `/dmps/${scope}/ai-thread`,
      { query: { before: opts.before, limit: opts.limit ?? THREAD_PAGE_SIZE } },
    );
    return { entries: page.data, hasMore: page.has_more };
  },

  /** `PUT /dmps/:scope/ai-thread/:entry_id`: the decision on its proposal. */
  decide: (
    scope: string,
    entryId: string,
    status: "accepted" | "rejected" | "stale",
    staleReason?: string,
  ) =>
    http.put<ServerThreadEntry>(`/dmps/${scope}/ai-thread/${entryId}`, {
      status,
      ...(staleReason ? { stale_reason: staleReason } : {}),
    }),

  /** `POST /dmps/:scope/ai-thread/clear`: hides the chat, keeps the record. */
  clear: (scope: string) => http.post(`/dmps/${scope}/ai-thread/clear`),

  /** `POST /ai-thread/adopt`: an unscoped chat joins the plan it produced. */
  adopt: (to: string) => http.post("/ai-thread/adopt", { from: "unscoped", to }),
};
