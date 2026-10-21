import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import type { ChatProposal, ChatRejection } from "@/store/chatTools";
import type { AiUsage } from "@/api/aiContract";

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
export const MAX_THREAD_ENTRIES = 200;

const capped = (entries: ThreadEntry[]) =>
  entries.length > MAX_THREAD_ENTRIES
    ? entries.slice(entries.length - MAX_THREAD_ENTRIES)
    : entries;

interface AiThreadState {
  threads: Record<string, ThreadEntry[]>;
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
  clear: (dmpId: string | null | undefined) => void;
  entriesFor: (dmpId: string | null | undefined) => ThreadEntry[];
}

export const useAiThread = create<AiThreadState>()(
  persist(
    (set, get) => ({
      threads: {},

      append: (dmpId, entry) =>
        set((state) => {
          const key = scopeKey(dmpId);
          return {
            threads: {
              ...state.threads,
              [key]: capped([...(state.threads[key] ?? []), entry]),
            },
          };
        }),

      updateEntry: (dmpId, entryId, update) =>
        set((state) => {
          const key = scopeKey(dmpId);
          return {
            threads: {
              ...state.threads,
              [key]: (state.threads[key] ?? []).map((e) =>
                e.id === entryId ? update(e) : e,
              ),
            },
          };
        }),

      adopt: (from, to) =>
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
              [to]: capped([...carried, ...(state.threads[to] ?? [])]),
            },
          };
        }),

      adoptions: [],

      ticket: (dmpId) => ({
        scope: scopeKey(dmpId),
        epoch: get().adoptions.length,
      }),

      resolve: ({ scope, epoch }) =>
        scope === UNSCOPED ? (get().adoptions[epoch] ?? UNSCOPED) : scope,

      clear: (dmpId) =>
        set((state) => ({
          threads: { ...state.threads, [scopeKey(dmpId)]: [] },
        })),

      entriesFor: (dmpId) => get().threads[scopeKey(dmpId)] ?? NO_ENTRIES,
    }),
    {
      name: storageKey("ai-thread"),
      storage: jsonStorage,
      version: 1,
      partialize: (state) => ({ threads: state.threads }),
    },
  ),
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
