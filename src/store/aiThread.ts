import { create } from "zustand";
import type { ChatProposal, ChatRejection } from "@/store/chatTools";
import type { AiUsage } from "@/api/aiContract";
import { aiThreadApi } from "@/api/aiThreadApi";
import { keptOnClear } from "@/store/threadRetention";
import { useToastStore } from "@/store/toastStore";
import { onSessionChange } from "@/config/current-user";

export type AiAction =
  | "analyze_proposal"
  | "regenerate_field"
  | "batch_regenerate"
  | "generate_tasks"
  | "redraft_steps";

export interface ThreadEvent {
  id: string;
  kind: "event";
  action: AiAction;
  summary: string;
  detail?: string;
  token_count: number;
  /** The provider's split, when the call got far enough to report one. */
  usage?: AiUsage;
  at: Date;
}

export interface ThreadTurn {
  id: string;
  kind: "user" | "assistant";
  text: string;
  token_count?: number;
  at: Date;
  proposals?: ChatProposal[];
  rejections?: ChatRejection[];
  /** The reply never came: why, and whether asking again could help. */
  failed?: { retryable: boolean; request: string };
  /** The person stopped waiting for this reply. */
  stopped?: boolean;
}

/**
 * Where an AI request's reply belongs, taken when the request is made. A
 * request made before any plan existed follows that conversation into the
 * plan it was adopted by, so a late reply doesn't land in an emptied scope.
 */
export interface ThreadTicket {
  scope: string;
  /** How many adoptions out of the unscoped thread had happened. */
  epoch: number;
}

export type ThreadEntry = ThreadEvent | ThreadTurn;
export const UNSCOPED = "unscoped";
export const scopeKey = (dmpId: string | null | undefined) => dmpId ?? UNSCOPED;
const makeId = () => Math.random().toString(36).substring(2, 10);
export const NO_ENTRIES: ThreadEntry[] = [];

/** How much of a thread the client has from the server. */
export interface ThreadPaging {
  loaded: boolean;
  loading: boolean;
  /** Older entries are on the server, not yet fetched. */
  hasMore: boolean;
}

const at = (e: ThreadEntry) => new Date(e.at).getTime();

/**
 * Server entries joined with what's already here, oldest first. Local wins on
 * a clash: it may hold a status change the server hasn't echoed yet.
 */
const merge = (server: ThreadEntry[], local: ThreadEntry[]) => {
  const ids = new Set(local.map((e) => e.id));
  return [...server.filter((e) => !ids.has(e.id)), ...local].sort(
    (a, b) => at(a) - at(b),
  );
};

/**
 * Writes go through to the server in the background; the screen doesn't
 * wait. A failed write is said out loud, since the history would otherwise
 * quietly differ after a reload.
 */
const sync = (write: Promise<unknown>) =>
  void write.catch(() =>
    useToastStore.getState().toast({
      title: "Couldn't save to your AI history",
      description:
        "It's still on screen, but may be missing when you come back.",
      variant: "destructive",
    }),
  );

interface AiThreadState {
  /** A cache of what's been loaded or written this session. */
  threads: Record<string, ThreadEntry[]>;
  paging: Record<string, ThreadPaging>;
  /** Fetches the newest page once per session; later calls do nothing. */
  load: (dmpId: string | null | undefined) => Promise<void>;
  loadEarlier: (dmpId: string | null | undefined) => Promise<void>;
  append: (dmpId: string | null | undefined, entry: ThreadEntry) => void;
  updateEntry: (
    dmpId: string | null | undefined,
    entryId: string,
    update: (entry: ThreadEntry) => ThreadEntry,
  ) => void;
  adopt: (from: string, to: string) => void;
  /** Plans the unscoped thread was adopted into, oldest first. Not persisted. */
  adoptions: string[];
  ticket: (dmpId: string | null | undefined) => ThreadTicket;
  /** The scope a reply to this ticket belongs in now. */
  resolve: (ticket: ThreadTicket) => string;
  /** Drops the chat; the AI actions and accepted changes stay. */
  clear: (dmpId: string | null | undefined) => void;
  entriesFor: (dmpId: string | null | undefined) => ThreadEntry[];
}

// Not persisted: the server keeps the thread, so it follows the researcher
// to another browser and survives clearing this one.
export const useAiThread = create<AiThreadState>()((set, get) => ({
  threads: {},
  paging: {},

  load: async (dmpId) => {
    const key = scopeKey(dmpId);
    const paging = get().paging[key];
    if (paging?.loaded || paging?.loading) return;
    set((s) => ({
      paging: {
        ...s.paging,
        [key]: { loaded: false, loading: true, hasMore: false },
      },
    }));
    try {
      const page = await aiThreadApi.list(key);
      set((s) => ({
        threads: {
          ...s.threads,
          [key]: merge(page.entries, s.threads[key] ?? []),
        },
        paging: {
          ...s.paging,
          [key]: { loaded: true, loading: false, hasMore: page.hasMore },
        },
      }));
    } catch {
      set((s) => ({
        paging: {
          ...s.paging,
          [key]: { loaded: false, loading: false, hasMore: false },
        },
      }));
    }
  },

  loadEarlier: async (dmpId) => {
    const key = scopeKey(dmpId);
    const paging = get().paging[key];
    const oldest = get().threads[key]?.[0];
    if (!paging?.hasMore || paging.loading || !oldest) return;
    set((s) => ({
      paging: { ...s.paging, [key]: { ...paging, loading: true } },
    }));
    try {
      const page = await aiThreadApi.list(key, { before: oldest.id });
      set((s) => ({
        threads: {
          ...s.threads,
          [key]: merge(page.entries, s.threads[key] ?? []),
        },
        paging: {
          ...s.paging,
          [key]: { loaded: true, loading: false, hasMore: page.hasMore },
        },
      }));
    } catch {
      set((s) => ({
        paging: { ...s.paging, [key]: { ...paging, loading: false } },
      }));
    }
  },

  append: (dmpId, entry) => {
    const key = scopeKey(dmpId);
    set((state) => ({
      threads: {
        ...state.threads,
        [key]: [...(state.threads[key] ?? []), entry],
      },
    }));
    sync(aiThreadApi.append(key, entry));
  },

  updateEntry: (dmpId, entryId, update) => {
    const key = scopeKey(dmpId);
    let updated: ThreadEntry | undefined;
    set((state) => ({
      threads: {
        ...state.threads,
        [key]: (state.threads[key] ?? []).map((e) =>
          e.id === entryId ? (updated = update(e)) : e,
        ),
      },
    }));
    if (updated) sync(aiThreadApi.update(key, updated));
  },

  adopt: (from, to) => {
    if (from !== to) sync(aiThreadApi.adopt(from, to));
    set((state) => {
      if (from === to) return state;
      // Recorded even when nothing is carried yet: a request still in
      // flight from the unscoped thread belongs to `to` from now on.
      const adoptions =
        from === UNSCOPED ? [...state.adoptions, to] : state.adoptions;
      const carried = state.threads[from] ?? [];
      if (carried.length === 0) return { adoptions };

      const { [from]: _dropped, ...rest } = state.threads;
      return {
        adoptions,
        threads: {
          ...rest,
          [to]: [...carried, ...(state.threads[to] ?? [])],
        },
      };
    });
  },

  adoptions: [],

  ticket: (dmpId) => ({
    scope: scopeKey(dmpId),
    epoch: get().adoptions.length,
  }),

  resolve: ({ scope, epoch }) =>
    scope === UNSCOPED ? (get().adoptions[epoch] ?? UNSCOPED) : scope,

  clear: (dmpId) => {
    const key = scopeKey(dmpId);
    set((state) => ({
      threads: {
        ...state.threads,
        [key]: (state.threads[key] ?? []).flatMap((e) => keptOnClear(e) ?? []),
      },
    }));
    sync(aiThreadApi.clear(key));
  },

  entriesFor: (dmpId) => get().threads[scopeKey(dmpId)] ?? NO_ENTRIES,
}));

// The thread is one researcher's private history. Whoever signs in next in
// this tab starts from the server, never from what the last person loaded.
onSessionChange(() =>
  useAiThread.setState({ threads: {}, paging: {}, adoptions: [] }),
);

export const recordAiEvent = (
  dmpId: string | null | undefined,
  event: {
    action: AiAction;
    summary: string;
    detail?: string;
    token_count: number;
    usage?: AiUsage;
  },
) =>
  useAiThread.getState().append(dmpId, {
    id: makeId(),
    kind: "event",
    at: new Date(),
    ...event,
  });
