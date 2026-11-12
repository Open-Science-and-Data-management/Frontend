import { create } from "zustand";
import type { ChatProposal, ChatRejection } from "@/store/chatTools";
import { runToolCall } from "@/store/chatTools";
import type { AiUsage } from "@/api/aiContract";
import { aiThreadApi, type ServerThreadEntry } from "@/api/aiThreadApi";
import { useToastStore } from "@/store/toastStore";
import { onSessionChange } from "@/config/current-user";
import type { DmpDraft } from "@/types/dmp";

/**
 * The plan's AI thread, as the server keeps it (`AI_THREAD_ENTRY`): chat
 * turns, proposals, and an event for every AI run. The server writes all of
 * it during each run; this store reads it back, and records decisions.
 *
 * The server keeps one decision per assistant entry. A turn can hold several
 * proposals, so each is decided here first; the entry's decision goes to the
 * server once all of its proposals are decided: `accepted` if any was,
 * `rejected` otherwise.
 *
 * Only the researcher who owns a thread can read it; signing out empties
 * this cache so the next person in the tab never sees it.
 */

export type AiAction =
  | "analyze_proposal"
  | "regenerate_field"
  | "batch_regenerate"
  | "generate_tasks"
  | "redraft_steps"
  | "chat";

export interface ThreadEvent {
  id: string;
  kind: "event";
  action: AiAction;
  summary: string;
  detail?: string;
  token_count: number;
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
  /** Shown while waiting; replaced by the server's copy on reload. */
  local?: boolean;
}

/** Where an AI request's reply belongs, taken when the request is made. */
export interface ThreadTicket {
  scope: string;
  epoch: number;
}

export type ThreadEntry = ThreadEvent | ThreadTurn;
export const UNSCOPED = "unscoped";
export const scopeKey = (dmpId: string | null | undefined) => dmpId ?? UNSCOPED;
const makeId = () => Math.random().toString(36).substring(2, 10);
export const NO_ENTRIES: ThreadEntry[] = [];

export interface ThreadPaging {
  loaded: boolean;
  loading: boolean;
  hasMore: boolean;
}

const ACTIONS: Record<string, AiAction> = {
  "analyze-proposal": "analyze_proposal",
  analyze_proposal: "analyze_proposal",
  "regenerate-field": "regenerate_field",
  suggest: "batch_regenerate",
  "generate-tasks": "generate_tasks",
  checklist: "redraft_steps",
  chat: "chat",
};

const SUMMARIES: Record<AiAction, string> = {
  analyze_proposal: "Read the proposal and drafted the plan",
  regenerate_field: "Suggested a rewrite of a field",
  batch_regenerate: "Suggested changes to several fields",
  generate_tasks: "Drafted tasks",
  redraft_steps: "Drafted a task checklist",
  chat: "Answered in the chat",
};

/** `{path, text|value}` pairs from a proposal payload, whatever its shape. */
const changesIn = (proposal: unknown): { path: string; value: unknown }[] => {
  if (!proposal || typeof proposal !== "object") return [];
  const p = proposal as Record<string, unknown>;
  if (typeof p.path === "string" && ("text" in p || "value" in p))
    return [{ path: p.path, value: p.text ?? p.value }];
  const list = Array.isArray(proposal)
    ? proposal
    : Array.isArray(p.proposals)
      ? p.proposals
      : Array.isArray(p.changes)
        ? p.changes
        : null;
  if (list) return list.flatMap((item) => changesIn(item));
  // A map of field path to new value.
  return Object.entries(p)
    .filter(([key]) => /^[a-z_]+(\[\d+\])?(\.[a-z_.]+)?$/.test(key))
    .map(([path, value]) => ({ path, value }));
};

/** Proposals the app can apply: checked against the field rules. */
const proposalsFor = (
  entry: ServerThreadEntry,
  draft: DmpDraft | undefined,
  decided: Record<string, ChatProposal["status"]>,
): ChatProposal[] => {
  if (!draft) return [];
  const status = entry.decision ?? "pending";
  return changesIn(entry.content?.proposal).flatMap((change, i) =>
    // Anything that isn't a real, writable field is dropped, never applied.
    runToolCall(
      { tool: "proposeFieldChange", path: change.path, value: change.value },
      { draft, planActive: false, unmet: [] },
    ).proposals.map((proposal) => {
      const id = `${entry.entry_id}:${i}`;
      return { ...proposal, id, status: decided[id] ?? status };
    }),
  );
};

const userText = (content: Record<string, unknown>) => {
  if (typeof content.text === "string") return content.text;
  const action = ACTIONS[String(content.action)] ?? "chat";
  const direction =
    typeof content.direction === "string" ? ` (${content.direction})` : "";
  return `${SUMMARIES[action]}${direction}`;
};

const toEntry = (
  entry: ServerThreadEntry,
  draft: DmpDraft | undefined,
  decided: Record<string, ChatProposal["status"]>,
): ThreadEntry => {
  const content = entry.content ?? {};
  const at = new Date(entry.created_at);
  if (entry.kind === "event") {
    const action = ACTIONS[String(content.action)] ?? "chat";
    return {
      id: entry.entry_id,
      kind: "event",
      action,
      summary: SUMMARIES[action],
      token_count: entry.token_count,
      usage: content.usage as AiUsage | undefined,
      at,
    };
  }
  if (entry.kind === "user")
    return { id: entry.entry_id, kind: "user", text: userText(content), at };
  const proposals = proposalsFor(entry, draft, decided);
  return {
    id: entry.entry_id,
    kind: "assistant",
    text: typeof content.text === "string" ? content.text : "",
    token_count: entry.token_count,
    at,
    proposals: proposals.length ? proposals : undefined,
  };
};

/** The draft a thread's proposals are checked against. */
const draftOf = async (scope: string) => {
  if (scope === UNSCOPED) return undefined;
  const { useDmpStore } = await import("@/store/dmpStore");
  return useDmpStore.getState().draftFor(scope);
};

const failed = (title: string, err: unknown) =>
  useToastStore.getState().toast({
    title,
    description: err instanceof Error ? err.message : undefined,
    variant: "destructive",
  });

interface AiThreadState {
  threads: Record<string, ThreadEntry[]>;
  /** Server entries, kept to re-map when the draft changes. */
  raw: Record<string, ServerThreadEntry[]>;
  paging: Record<string, ThreadPaging>;
  /** Per-proposal decisions not yet folded into an entry's decision. */
  decided: Record<string, ChatProposal["status"]>;
  /** Fetches the newest page once; later calls do nothing. */
  load: (dmpId: string | null | undefined) => Promise<void>;
  /** Fetches the newest page again (after an AI run). */
  reload: (dmpId: string | null | undefined) => Promise<void>;
  loadEarlier: (dmpId: string | null | undefined) => Promise<void>;
  /** A local turn shown while waiting, or a failure; not stored. */
  append: (dmpId: string | null | undefined, entry: ThreadEntry) => void;
  /** Records a proposal decision (see above). */
  updateEntry: (
    dmpId: string | null | undefined,
    entryId: string,
    update: (entry: ThreadEntry) => ThreadEntry,
  ) => void;
  adopt: (from: string, to: string) => void;
  adoptions: string[];
  ticket: (dmpId: string | null | undefined) => ThreadTicket;
  resolve: (ticket: ThreadTicket) => string;
  /** Hides the chat on the server; AI actions and accepted changes stay. */
  clear: (dmpId: string | null | undefined) => void;
  entriesFor: (dmpId: string | null | undefined) => ThreadEntry[];
}

export const useAiThread = create<AiThreadState>()((set, get) => {
  const render = async (key: string) => {
    const draft = await draftOf(key);
    const local = (get().threads[key] ?? []).filter(
      (e) => e.kind !== "event" && (e as ThreadTurn).local,
    );
    set((s) => ({
      threads: {
        ...s.threads,
        [key]: [
          ...(s.raw[key] ?? []).map((e) => toEntry(e, draft, s.decided)),
          ...local,
        ],
      },
    }));
  };

  const fetchPage = async (key: string, before?: string) => {
    const paging = get().paging[key] ?? {
      loaded: false,
      loading: false,
      hasMore: false,
    };
    set((s) => ({
      paging: { ...s.paging, [key]: { ...paging, loading: true } },
    }));
    try {
      const page = await aiThreadApi.list(key, { before });
      set((s) => {
        const older = before ? page.entries : [];
        const newest = before ? (s.raw[key] ?? []) : page.entries;
        return {
          raw: { ...s.raw, [key]: [...older, ...newest] },
          paging: {
            ...s.paging,
            [key]: { loaded: true, loading: false, hasMore: page.hasMore },
          },
        };
      });
      // A reload replaces what the server now holds; local turns are done.
      if (!before)
        set((s) => ({
          threads: {
            ...s.threads,
            [key]: (s.threads[key] ?? []).filter(
              (e) => e.kind === "event" || !(e as ThreadTurn).local || (e as ThreadTurn).failed,
            ),
          },
        }));
      await render(key);
    } catch (err) {
      set((s) => ({
        paging: { ...s.paging, [key]: { ...paging, loading: false } },
      }));
      throw err;
    }
  };

  return {
    threads: {},
    raw: {},
    paging: {},
    decided: {},

    load: async (dmpId) => {
      const key = scopeKey(dmpId);
      const paging = get().paging[key];
      if (paging?.loaded || paging?.loading) return;
      await fetchPage(key).catch((err) =>
        failed("Couldn't load the AI history", err),
      );
    },

    reload: async (dmpId) => {
      await fetchPage(scopeKey(dmpId)).catch((err) =>
        failed("Couldn't load the AI history", err),
      );
    },

    loadEarlier: async (dmpId) => {
      const key = scopeKey(dmpId);
      const oldest = get().raw[key]?.[0];
      if (!get().paging[key]?.hasMore || !oldest) return;
      await fetchPage(key, oldest.entry_id).catch((err) =>
        failed("Couldn't load earlier entries", err),
      );
    },

    append: (dmpId, entry) => {
      const key = scopeKey(dmpId);
      set((s) => ({
        threads: {
          ...s.threads,
          [key]: [
            ...(s.threads[key] ?? []),
            entry.kind === "event" ? entry : { ...entry, local: true },
          ],
        },
      }));
    },

    updateEntry: (dmpId, entryId, update) => {
      const key = scopeKey(dmpId);
      const before = get().threads[key]?.find((e) => e.id === entryId);
      if (!before || before.kind === "event") return;
      const after = update(before) as ThreadTurn;
      const proposals = after.proposals ?? [];
      // Remember each proposal's decision; show it straight away.
      set((s) => ({
        decided: {
          ...s.decided,
          ...Object.fromEntries(proposals.map((p) => [p.id, p.status])),
        },
        threads: {
          ...s.threads,
          [key]: (s.threads[key] ?? []).map((e) =>
            e.id === entryId ? after : e,
          ),
        },
      }));
      if ((before as ThreadTurn).local) return;
      if (proposals.some((p) => p.status === "pending")) return;
      const status = proposals.some((p) => p.status === "accepted")
        ? "accepted"
        : proposals.every((p) => p.status === "stale")
          ? "stale"
          : "rejected";
      const reason = proposals.find((p) => p.staleReason)?.staleReason;
      void aiThreadApi
        .decide(key, entryId, status, reason)
        .then((saved) =>
          set((s) => ({
            raw: {
              ...s.raw,
              [key]: (s.raw[key] ?? []).map((e) =>
                e.entry_id === entryId ? saved : e,
              ),
            },
          })),
        )
        .catch((err) => failed("Couldn't save your decision", err));
    },

    adopt: (from, to) => {
      if (from === to) return;
      set((s) => ({
        adoptions: from === UNSCOPED ? [...s.adoptions, to] : s.adoptions,
      }));
      if (from !== UNSCOPED) return;
      void aiThreadApi
        .adopt(to)
        .then(() => get().reload(to))
        .catch((err) => failed("Couldn't move the conversation", err));
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
      void aiThreadApi
        .clear(key)
        .then(() => get().reload(key))
        .catch((err) => failed("Couldn't clear the conversation", err));
    },

    entriesFor: (dmpId) => get().threads[scopeKey(dmpId)] ?? NO_ENTRIES,
  };
});

onSessionChange(() =>
  useAiThread.setState({
    threads: {},
    raw: {},
    paging: {},
    decided: {},
    adoptions: [],
  }),
);

/**
 * A note about an AI run that the server didn't record itself, shown in the
 * thread for this session only.
 */
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
