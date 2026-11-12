import { http } from "@/api/http";
import type { Task, TaskEvidence } from "@/types/task";

/**
 * Tasks on the backend. The server decides everything that matters about a
 * task: whether its evidence allows closing it, what completing it does to
 * its output, what can be deleted (nothing with recorded work), and which
 * cancelled tasks may come back.
 */

type Wire = Omit<Task, "start_date" | "end_date" | "completed_at"> & {
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  cancelled_at?: string | null;
  dataset_title?: string | null;
  evidence: Omit<TaskEvidence, "attached_at"> & { attached_at: string | null };
};

interface List<T> {
  data: T[];
  has_more: boolean;
}

const date = (value: string | null | undefined) =>
  value ? new Date(value) : undefined;

/** `null` from the server reads as "not set" in the app. */
export const toTask = (t: Wire): Task =>
  ({
    ...t,
    dataset_id: t.dataset_id ?? undefined,
    details: t.details ?? undefined,
    start_date: date(t.start_date),
    end_date: date(t.end_date),
    completed_at: date(t.completed_at),
    completed_by: t.completed_by ?? undefined,
    cancelled_at: date(t.cancelled_at),
    cancelled_from: t.cancelled_from ?? undefined,
    cancel_reason: t.cancel_reason ?? undefined,
    evidence: {
      ...t.evidence,
      ref: t.evidence?.ref ?? undefined,
      label: t.evidence?.label ?? undefined,
      attached_at: date(t.evidence?.attached_at),
    },
  }) as unknown as Task;

export interface ServerReopenOffer {
  offer_id: string;
  dmp_id: string;
  dataset_id: string | null;
  dataset_title: string;
  created_at: string;
  tasks: {
    task_id: string;
    title: string;
    status: "cancelled";
    cancelled_from: Task["status"] | null;
  }[];
}

/** What a new task may carry; the server fills in the rest. */
export type TaskInput = Partial<
  Pick<
    Task,
    | "dmp_id"
    | "dataset_id"
    | "title"
    | "details"
    | "lifecycle_stage"
    | "priority"
    | "status"
    | "start_date"
    | "end_date"
  >
>;

const one = async (request: Promise<Wire>) => toTask(await request);

export const tasksApi = {
  /** `GET /tasks?dmp_id=` (or `project_id`), every page. */
  list: async (filter: { dmp_id?: string; project_id?: string }) => {
    const tasks: Task[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await http.get<List<Wire>>("/tasks", {
        query: { ...filter, limit: 100, starting_after: after },
      });
      tasks.push(...page.data.map(toTask));
      if (!page.has_more || page.data.length === 0) return tasks;
      after = page.data[page.data.length - 1].task_id as string;
    }
  },
  create: (input: TaskInput) => one(http.post<Wire>("/tasks", input)),
  /** Saves AI-drafted tasks; `replace` swaps out untouched AI tasks. */
  createGenerated: (
    dmpId: string,
    mode: "add" | "replace",
    tasks: TaskInput[],
  ) =>
    http.post<{
      added?: number;
      removed?: number;
      kept?: number;
      data?: Wire[];
    }>(`/dmps/${dmpId}/tasks/generated`, { mode, tasks }),
  update: (id: string, patch: TaskInput) =>
    one(http.patch<Wire>(`/tasks/${id}`, patch)),
  complete: (id: string) => one(http.post<Wire>(`/tasks/${id}/complete`)),
  reopen: (id: string) => one(http.post<Wire>(`/tasks/${id}/reopen`)),
  cancel: (id: string) => one(http.post<Wire>(`/tasks/${id}/cancel`)),
  remove: (id: string) => http.delete(`/tasks/${id}`),
  addStep: (id: string, label: string) =>
    one(http.post<Wire>(`/tasks/${id}/checklist`, { label })),
  updateStep: (id: string, itemId: string, patch: { label?: string; done?: boolean }) =>
    one(http.patch<Wire>(`/tasks/${id}/checklist/${itemId}`, patch)),
  removeStep: (id: string, itemId: string) =>
    one(http.delete<Wire>(`/tasks/${id}/checklist/${itemId}`)),
  replaceChecklist: (id: string, labels: string[]) =>
    one(http.put<Wire>(`/tasks/${id}/checklist`, { labels })),
  setEvidence: (id: string, evidence: TaskEvidence) =>
    one(http.put<Wire>(`/tasks/${id}/evidence`, evidence)),
  clearEvidence: (id: string) =>
    one(http.delete<Wire>(`/tasks/${id}/evidence`)),

  reopenOffers: async (dmpId: string) =>
    (await http.get<List<ServerReopenOffer>>(`/dmps/${dmpId}/reopen-offers`))
      .data,
  acceptOffer: (offerId: string, taskIds: string[]) =>
    http.post<{ reopened?: number }>(`/reopen-offers/${offerId}/accept`, {
      task_ids: taskIds,
    }),
  dismissOffer: (offerId: string) =>
    http.post(`/reopen-offers/${offerId}/dismiss`),
};
