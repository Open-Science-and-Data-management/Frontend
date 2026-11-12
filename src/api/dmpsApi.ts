import { http } from "@/api/http";
import { dmpDraftSchema } from "@/schemas/dmp";
import type { DmpDraft } from "@/types/dmp";
import type { PlanMode } from "@/types/project";

/**
 * Plans on the backend (`/dmps`). The backend owns everything that decides
 * or stores: drafts and their revision counter, versions, minor edits,
 * revisions, approval and archiving. This module only moves data and turns
 * the wire format (ISO strings, `null`) into the app's types.
 */

export interface ServerVersion {
  number: number;
  status: "pending" | "approved" | "rejected";
  edit_type: "minor" | "major" | null;
  changes: unknown[];
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  approver: { name?: string; position?: string; mbox?: string } | null;
  note: string | null;
  minor_edits: unknown[];
  carried_minor_edits?: unknown[];
  dropped_minor_edits?: unknown[];
}

export interface ServerDmp {
  object: "dmp";
  dmp_id: string;
  project_id: string | null;
  title: string;
  description: string;
  language: string;
  status: "draft" | "pending" | "approved";
  plan_mode: PlanMode | null;
  active_version: number | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  researcher: { user_id: string; name: string };
  /** The pending version's content, else the version in force, else the draft. */
  review_snapshot?: Record<string, unknown>;
  /** The author's working draft: only sent to the author. */
  draft?: Record<string, unknown>;
  draft_revision?: number;
  versions?: ServerVersion[];
  readiness?: {
    complete: boolean;
    unmet_items: { label: string; section: string }[];
  };
}

interface List<T> {
  object: "list";
  data: T[];
  has_more: boolean;
  total_count: number;
}

/**
 * A draft as the editor works with it: dates as `Date`s. The shared schema
 * does the coercion; a draft it can't fully read (an older or partial one)
 * is kept as it came rather than dropped.
 */
export const readDraft = (raw: Record<string, unknown> | undefined): DmpDraft => {
  if (!raw) return {};
  const parsed = dmpDraftSchema.safeParse(raw);
  return (parsed.success ? parsed.data : raw) as DmpDraft;
};

/** Error details the backend attaches to `409 draft_conflict`. */
export interface DraftConflict {
  draft: Record<string, unknown>;
  draft_revision: number;
}

const INCLUDE_ALL = "draft,versions,readiness";

export const dmpsApi = {
  /** `GET /dmps`: a researcher's own plans, or a project's for reviewers. */
  list: async (query: {
    project_id?: string;
    archived?: boolean;
    status?: string[];
    q?: string;
    sort?: "updated" | "title" | "status";
    include?: string;
  } = {}) => {
    const plans: ServerDmp[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await http.get<List<ServerDmp>>("/dmps", {
        query: {
          ...query,
          archived: query.archived ? "true" : undefined,
          limit: 100,
          starting_after: after,
        },
      });
      plans.push(...page.data);
      if (!page.has_more || page.data.length === 0) return plans;
      after = page.data[page.data.length - 1].dmp_id;
    }
  },

  /** `GET /dmps/:id` with draft (author only), versions and readiness. */
  get: (dmpId: string, include = INCLUDE_ALL) =>
    http.get<ServerDmp>(`/dmps/${dmpId}`, { query: { include } }),

  /** `POST /dmps`: an empty plan, optionally on a project. */
  create: (projectId?: string) =>
    http.post<ServerDmp>("/dmps", projectId ? { project_id: projectId } : {}),

  /** `PUT /dmps/:id/draft`: the whole draft, guarded by its revision. */
  saveDraft: (dmpId: string, draft: DmpDraft, revision: number) =>
    http.put<{ draft_revision: number; draft: Record<string, unknown> }>(
      `/dmps/${dmpId}/draft`,
      { draft_revision: revision, draft },
    ),

  discard: (dmpId: string) =>
    http.post<ServerDmp>(`/dmps/${dmpId}/draft/discard`),
  restore: (dmpId: string, number: number, revision: number) =>
    http.post<ServerDmp>(`/dmps/${dmpId}/draft/restore`, {
      number,
      draft_revision: revision,
    }),
  archive: (dmpId: string) => http.post<ServerDmp>(`/dmps/${dmpId}/archive`),
  unarchive: (dmpId: string) =>
    http.post<ServerDmp>(`/dmps/${dmpId}/unarchive`),

  submit: (dmpId: string, revision: number) =>
    http.post<ServerDmp>(`/dmps/${dmpId}/submit`, {
      draft_revision: revision,
    }),
  finalize: (dmpId: string, revision: number) =>
    http.post<ServerDmp>(`/dmps/${dmpId}/finalize`, {
      draft_revision: revision,
    }),
  saveMinorEdits: (dmpId: string, revision: number) =>
    http.post<ServerVersion>(`/dmps/${dmpId}/minor-edits`, {
      draft_revision: revision,
    }),
  submitRevision: (dmpId: string, revision: number) =>
    http.post<ServerVersion>(`/dmps/${dmpId}/revisions`, {
      draft_revision: revision,
    }),

  /** Committee and chief only. */
  approve: (dmpId: string, number: number, position: string, note?: string) =>
    http.post<ServerVersion>(`/dmps/${dmpId}/versions/${number}/approve`, {
      position,
      ...(note?.trim() ? { note: note.trim() } : {}),
    }),
  reject: (dmpId: string, number: number, position: string, note: string) =>
    http.post<ServerVersion>(`/dmps/${dmpId}/versions/${number}/reject`, {
      position,
      note,
    }),
};
