import { http } from "@/api/http";
import type { FileRecord } from "@/types/file";
import type { Project, ProjectMember } from "@/types/project";

/**
 * Projects, their members and their files on the backend (`/projects`,
 * `/files`). Responses come back with ISO timestamps; these turn them into
 * the `Date`s the rest of the app works with.
 */

interface List<T> {
  object: "list";
  data: T[];
  has_more: boolean;
  total_count: number;
}

type Wire<T> = {
  [K in keyof T]: T[K] extends Date | undefined ? string | null : T[K];
};

/** A project as the server sends it: the frontend's shape, plus counts. */
export type ServerProject = Project & {
  file_count?: number;
  member_count?: number;
  awaiting_review?: boolean;
};

export type ServerMember = ProjectMember & {
  user?: { name?: string; email?: string };
};

const date = (value: unknown): Date | undefined =>
  typeof value === "string" ? new Date(value) : undefined;

/** `null` from the server reads as "not set" in the app. */
const orUndefined = <T>(value: T | null | undefined): T | undefined =>
  value ?? undefined;

const toProject = (p: Wire<ServerProject>): ServerProject => ({
  ...(p as unknown as ServerProject),
  description: orUndefined(p.description),
  proposal_file_id: orUndefined(p.proposal_file_id),
  created_at: date(p.created_at),
  updated_at: date(p.updated_at),
});

const toFile = (
  f: Wire<FileRecord> & { archived_at?: string | null },
): FileRecord => ({
  ...(f as unknown as FileRecord),
  uploaded_at: date(f.uploaded_at) ?? new Date(),
  superseded_at: date(f.superseded_at),
  ...(f.archived_at ? { archived_at: date(f.archived_at) } : {}),
});

/** Every page of a list endpoint, following `starting_after`. */
const all = async <T>(
  path: string,
  idOf: (item: T) => string,
  query: Record<string, unknown> = {},
): Promise<T[]> => {
  const items: T[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await http.get<List<T>>(path, {
      query: { ...query, limit: 100, starting_after: after },
    });
    items.push(...page.data);
    if (!page.has_more || page.data.length === 0) return items;
    after = idOf(page.data[page.data.length - 1]);
  }
};

export const projectsApi = {
  /** `GET /projects`: the ones the signed-in person may see. */
  list: async () =>
    (
      await all<Wire<ServerProject>>("/projects", (p) => p.project_id as string)
    ).map(toProject),

  /** `POST /projects`. The plan mode comes from the creator's account type. */
  create: async (input: { project_name: string; description?: string }) =>
    toProject(await http.post<Wire<ServerProject>>("/projects", input)),

  /** `GET /projects/:id/members` */
  members: async (projectId: string) =>
    (await http.get<List<ServerMember>>(`/projects/${projectId}/members`)).data,

  /** `GET /files?project_id=` */
  files: async (projectId: string) =>
    (
      await http.get<List<Wire<FileRecord>>>("/files", {
        query: { project_id: projectId },
      })
    ).data.map(toFile),

  /** `POST /projects/:id/files` (multipart: `file`, `purpose`). */
  upload: async (
    projectId: string,
    file: File,
    purpose: FileRecord["purpose"],
    signal?: AbortSignal,
  ) => {
    const form = new FormData();
    form.append("purpose", purpose);
    form.append("file", file);
    return toFile(
      await http.post<Wire<FileRecord>>(`/projects/${projectId}/files`, form, {
        signal,
      }),
    );
  },

  /** `GET /files/:id/content` */
  download: (fileId: string) =>
    http.get<Blob>(`/files/${fileId}/content`, { as: "blob" }),

  /** `POST /files/:id/archive`: out of the list, kept for the record. */
  archive: async (fileId: string) =>
    toFile(await http.post<Wire<FileRecord>>(`/files/${fileId}/archive`)),

  /** `DELETE /files/:id`. Refused (`409 file_in_use`) for task evidence. */
  remove: (fileId: string) => http.delete(`/files/${fileId}`),
};
