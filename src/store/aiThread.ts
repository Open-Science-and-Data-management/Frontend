import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import type { ChatProposal, ChatRejection } from "@/store/chatTools";

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
          const carried = state.threads[from] ?? [];
          if (carried.length === 0 || from === to) return state;

          const { [from]: _dropped, ...rest } = state.threads;
          return {
            threads: {
              ...rest,
              [to]: capped([...carried, ...(state.threads[to] ?? [])]),
            },
          };
        }),

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
  },
) =>
  useAiThread.getState().append(dmpId, {
    id: makeId(),
    kind: "event",
    at: new Date(),
    ...event,
  });
