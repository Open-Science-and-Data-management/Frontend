import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import { actingUserId } from "@/config/current-user";
import { useProjectStore } from "@/store/projectStore";
import type { ThreadEntry } from "@/store/aiThread";
import { keptOnClear } from "@/store/threadRetention";

/**
 * Stands in for the AI_THREAD_ENTRY table until the real backend exists. It
 * holds every row in full (no cap) and answers in pages, so the client
 * already works the way it will against Postgres.
 *
 * Every row belongs to the researcher who made it. The thread is their
 * working history with the assistant, not part of the plan the committee
 * reviews, so no one else reads it: not a reviewer, not an admin.
 */
interface ThreadRow {
  owner_id: string;
  /** dmp_id, or "unscoped" before the plan has one. */
  scope: string;
  entry: ThreadEntry;
  /** Hidden by "Clear conversation". Kept, never returned. */
  hidden_at?: Date;
}

const useThreadDb = create<{ rows: ThreadRow[] }>()(
  persist(() => ({ rows: [] as ThreadRow[] }), {
    name: storageKey("server/ai-thread"),
    storage: jsonStorage,
    version: 1,
  }),
);

/** Empties the table. For tests; "Reset demo data" drops its storage key. */
export const resetThreadDb = () => useThreadDb.setState({ rows: [] });

export const THREAD_PAGE_SIZE = 50;

export interface ThreadPage {
  /** Oldest first, ready to show. */
  entries: ThreadEntry[];
  /** Whether older entries exist before this page. */
  hasMore: boolean;
}

export class ThreadAccessError extends Error {}

const rows = () => useThreadDb.getState().rows;
const setRows = (update: (rows: ThreadRow[]) => ThreadRow[]) =>
  useThreadDb.setState((s) => ({ rows: update(s.rows) }));

/** Only researchers work with the assistant, so only they write a thread. */
const writer = () => {
  const id = actingUserId();
  const user = useProjectStore.getState().users.find((u) => u.user_id === id);
  if (user?.role !== "researcher")
    throw new ThreadAccessError("Only the researcher can use the assistant.");
  return id;
};

const visible = (owner: string, scope: string) => (row: ThreadRow) =>
  row.owner_id === owner && row.scope === scope && !row.hidden_at;

const time = (row: ThreadRow) => new Date(row.entry.at).getTime();

/** GET /dmps/:scope/ai-thread?before=:entryId&limit=50 */
export const listThread = async (
  scope: string,
  opts: { before?: string; limit?: number } = {},
): Promise<ThreadPage> => {
  const limit = opts.limit ?? THREAD_PAGE_SIZE;
  const mine = rows()
    .filter(visible(actingUserId(), scope))
    .sort((a, b) => time(a) - time(b));
  const end = opts.before
    ? mine.findIndex((r) => r.entry.id === opts.before)
    : mine.length;
  const stop = end < 0 ? mine.length : end;
  const start = Math.max(0, stop - limit);
  return {
    entries: mine.slice(start, stop).map((r) => r.entry),
    hasMore: start > 0,
  };
};

/** POST /dmps/:scope/ai-thread */
export const appendThreadEntry = async (scope: string, entry: ThreadEntry) => {
  const owner_id = writer();
  setRows((all) => [...all, { owner_id, scope, entry }]);
};

/** PUT /dmps/:scope/ai-thread/:entryId (a proposal accepted or rejected) */
export const updateThreadEntry = async (scope: string, entry: ThreadEntry) => {
  const owner = writer();
  setRows((all) =>
    all.map((r) =>
      visible(owner, scope)(r) && r.entry.id === entry.id ? { ...r, entry } : r,
    ),
  );
};

/**
 * POST /dmps/:scope/ai-thread/clear. Hides the chat, keeps the record of
 * what the AI did and what was accepted (see `keptOnClear`).
 */
export const clearThreadChat = async (scope: string) => {
  const owner = writer();
  const now = new Date();
  setRows((all) =>
    all.map((r) => {
      if (!visible(owner, scope)(r)) return r;
      const kept = keptOnClear(r.entry);
      return kept ? { ...r, entry: kept } : { ...r, hidden_at: now };
    }),
  );
};

/** POST /ai-thread/adopt: an unscoped conversation joins the plan it made. */
export const adoptThread = async (from: string, to: string) => {
  const owner = writer();
  setRows((all) =>
    all.map((r) => (visible(owner, from)(r) ? { ...r, scope: to } : r)),
  );
};
