import { create } from "zustand";
import { tasksApi, type ServerReopenOffer, type TaskInput } from "@/api/tasksApi";
import { ApiError } from "@/api/http";
import { useToastStore } from "@/store/toastStore";
import { onSessionChange } from "@/config/current-user";
import type { Task, TaskChecklistItem, TaskEvidence } from "@/types/task";

/**
 * Tasks, backed by the server. The server decides what each action may do:
 * closing a task needs the evidence its stage requires, completing one moves
 * its output along the lifecycle, a task with recorded work can't be
 * deleted, and a finished task can't be cancelled or stripped of evidence.
 *
 * Small edits (a ticked step, a moved card) show at once and are replaced by
 * the server's copy; if the server refuses, they're rolled back and the
 * reason is shown.
 */

/** What a caller supplies; the server fills in the rest. */
export type NewTask = TaskInput & Pick<Task, "dmp_id" | "title">;

export interface ReopenOffer {
  offer_id: string;
  dmp_id: string;
  created_at: Date;
  items: {
    task_id: string;
    title: string;
    output_title: string;
    /** The status it had before it was cancelled. */
    restore_to: Task["status"];
    /** The output's id, when the offer matched it by id. */
    relink_to: string;
    /** Matched by the output's title (it came back under a new id). */
    relinked: boolean;
  }[];
}

const toOffer = (o: ServerReopenOffer): ReopenOffer => ({
  offer_id: o.offer_id,
  dmp_id: o.dmp_id,
  created_at: new Date(o.created_at),
  items: o.tasks.map((t) => ({
    task_id: t.task_id,
    title: t.title,
    output_title: o.dataset_title,
    restore_to: t.cancelled_from ?? "todo",
    relink_to: o.dataset_id ?? "",
    relinked: o.dataset_id === null,
  })),
});

/**
 * Whether a task carries recorded work (evidence, a ticked step, a
 * completion): such a task can be cancelled, never deleted. The server
 * enforces this; the UI only uses it to offer the right action.
 */
export const hasRecordedWork = (task: Task): boolean =>
  Boolean(task.evidence?.ref?.trim()) ||
  (task.checklist ?? []).some((item) => item.done) ||
  task.status === "done" ||
  Boolean(task.completed_at);

const progressOf = (checklist: TaskChecklistItem[]) =>
  checklist.length === 0
    ? 0
    : Math.round(
        (checklist.filter((i) => i.done).length / checklist.length) * 100,
      );

const fail = (title: string, err: unknown) =>
  useToastStore.getState().toast({
    title,
    description: err instanceof Error ? err.message : "Please try again.",
    variant: "destructive",
  });

interface TaskState {
  tasks: Task[];
  /** Plans whose tasks have been loaded this session. */
  loadedFor: Record<string, boolean>;
  /** `GET /tasks?dmp_id=` for each plan, into `tasks`. */
  loadForPlans: (dmpIds: string[]) => Promise<void>;
  addTask: (task: NewTask) => Promise<Task | undefined>;
  addGeneratedTasks: (dmpId: string, tasks: NewTask[]) => Promise<boolean>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<boolean>;
  addChecklistItem: (taskId: string, label: string) => Promise<boolean>;
  renameChecklistItem: (taskId: string, itemId: string, label: string) => Promise<boolean>;
  toggleChecklistItem: (taskId: string, itemId: string) => Promise<boolean>;
  removeChecklistItem: (taskId: string, itemId: string) => Promise<boolean>;
  replaceChecklist: (taskId: string, labels: string[]) => Promise<boolean>;
  setEvidence: (taskId: string, evidence: TaskEvidence) => Promise<boolean>;
  clearEvidence: (taskId: string) => Promise<boolean>;
  /** False when the evidence doesn't meet what the task requires. */
  completeTask: (taskId: string) => Promise<boolean>;
  reopenTask: (taskId: string) => Promise<boolean>;
  cancelTask: (taskId: string) => Promise<boolean>;
  /** False when refused: a task with recorded work is cancelled, not deleted. */
  deleteTask: (id: string) => Promise<boolean>;
  /** Swaps untouched AI tasks for a fresh draft; worked-on tasks stay. */
  replaceGeneratedTasks: (
    dmpId: string,
    tasks: NewTask[],
  ) => Promise<{ added: number; removed: number; kept: number } | null>;
  reopenOffers: ReopenOffer[];
  loadReopenOffers: (dmpId: string) => Promise<void>;
  reopenFromOffer: (offerId: string, taskIds: string[]) => Promise<number>;
  dismissReopenOffer: (offerId: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>()((set, get) => {
  const put = (task: Task) =>
    set((s) => ({
      tasks: s.tasks.some((t) => t.task_id === task.task_id)
        ? s.tasks.map((t) => (t.task_id === task.task_id ? task : t))
        : [...s.tasks, task],
    }));

  /** Shows `optimistic` now, then the server's copy; rolls back on refusal. */
  const change = async (
    taskId: string,
    title: string,
    request: () => Promise<Task>,
    optimistic?: (task: Task) => Task,
  ) => {
    const before = get().tasks.find((t) => t.task_id === taskId);
    if (before && optimistic) put(optimistic(before));
    try {
      put(await request());
      return true;
    } catch (err) {
      if (before) put(before);
      fail(title, err);
      return false;
    }
  };

  const reloadPlan = async (dmpId: string) => {
    const fresh = await tasksApi.list({ dmp_id: dmpId });
    set((s) => ({
      tasks: [...s.tasks.filter((t) => t.dmp_id !== dmpId), ...fresh],
      loadedFor: { ...s.loadedFor, [dmpId]: true },
    }));
  };

  return {
    tasks: [],
    loadedFor: {},

    loadForPlans: async (dmpIds) => {
      await Promise.all(dmpIds.map((id) => reloadPlan(id)));
    },

    addTask: async (task) => {
      try {
        const created = await tasksApi.create(task);
        put(created);
        return created;
      } catch (err) {
        fail("The task wasn't created", err);
        return undefined;
      }
    },

    addGeneratedTasks: async (dmpId, tasks) => {
      try {
        await tasksApi.createGenerated(dmpId, "add", tasks);
        await reloadPlan(dmpId);
        return true;
      } catch (err) {
        fail("The tasks weren't saved", err);
        return false;
      }
    },

    replaceGeneratedTasks: async (dmpId, tasks) => {
      try {
        const result = await tasksApi.createGenerated(dmpId, "replace", tasks);
        await reloadPlan(dmpId);
        return {
          added: result.added ?? tasks.length,
          removed: result.removed ?? 0,
          kept: result.kept ?? 0,
        };
      } catch (err) {
        fail("The tasks weren't saved", err);
        return null;
      }
    },

    updateTask: (id, patch) =>
      change(
        id,
        "The task wasn't updated",
        () => tasksApi.update(id, patch as TaskInput),
        (t) => ({ ...t, ...patch }) as Task,
      ),

    addChecklistItem: (taskId, label) =>
      change(taskId, "The step wasn't added", () =>
        tasksApi.addStep(taskId, label),
      ),

    renameChecklistItem: (taskId, itemId, label) =>
      change(
        taskId,
        "The step wasn't renamed",
        () => tasksApi.updateStep(taskId, itemId, { label }),
        (t) => ({
          ...t,
          checklist: (t.checklist ?? []).map((i) =>
            i.item_id === itemId ? { ...i, label } : i,
          ),
        }),
      ),

    toggleChecklistItem: (taskId, itemId) => {
      const item = get()
        .tasks.find((t) => t.task_id === taskId)
        ?.checklist?.find((i) => i.item_id === itemId);
      if (!item) return Promise.resolve(false);
      return change(
        taskId,
        "The step wasn't updated",
        () => tasksApi.updateStep(taskId, itemId, { done: !item.done }),
        (t) => {
          const checklist = (t.checklist ?? []).map((i) =>
            i.item_id === itemId ? { ...i, done: !i.done } : i,
          );
          return { ...t, checklist, progress_percent: progressOf(checklist) };
        },
      );
    },

    removeChecklistItem: (taskId, itemId) =>
      change(
        taskId,
        "The step wasn't removed",
        () => tasksApi.removeStep(taskId, itemId),
        (t) => ({
          ...t,
          checklist: (t.checklist ?? []).filter((i) => i.item_id !== itemId),
        }),
      ),

    replaceChecklist: (taskId, labels) =>
      change(taskId, "The steps weren't saved", () =>
        tasksApi.replaceChecklist(taskId, labels),
      ),

    setEvidence: (taskId, evidence) =>
      change(taskId, "The evidence wasn't attached", () =>
        tasksApi.setEvidence(taskId, evidence),
      ),

    clearEvidence: (taskId) =>
      change(taskId, "The evidence wasn't removed", () =>
        tasksApi.clearEvidence(taskId),
      ),

    completeTask: async (taskId) => {
      try {
        put(await tasksApi.complete(taskId));
        return true;
      } catch (err) {
        // Missing evidence is explained by the caller, with what's needed.
        if (!(err instanceof ApiError && err.code === "evidence_required"))
          fail("The task wasn't closed", err);
        return false;
      }
    },

    reopenTask: (taskId) =>
      change(taskId, "The task wasn't reopened", () => tasksApi.reopen(taskId)),

    cancelTask: (taskId) =>
      change(taskId, "The task wasn't cancelled", () => tasksApi.cancel(taskId)),

    deleteTask: async (id) => {
      try {
        await tasksApi.remove(id);
        set((s) => ({ tasks: s.tasks.filter((t) => t.task_id !== id) }));
        return true;
      } catch (err) {
        fail(
          err instanceof ApiError && err.code === "task_has_recorded_work"
            ? "This task has recorded work"
            : "The task wasn't deleted",
          err,
        );
        return false;
      }
    },

    reopenOffers: [],

    loadReopenOffers: async (dmpId) => {
      try {
        const offers = (await tasksApi.reopenOffers(dmpId)).map(toOffer);
        set((s) => ({
          reopenOffers: [
            ...s.reopenOffers.filter((o) => o.dmp_id !== dmpId),
            ...offers,
          ],
        }));
      } catch (err) {
        fail("Couldn't load tasks to reopen", err);
      }
    },

    reopenFromOffer: async (offerId, taskIds) => {
      const offer = get().reopenOffers.find((o) => o.offer_id === offerId);
      try {
        const result = await tasksApi.acceptOffer(offerId, taskIds);
        set((s) => ({
          reopenOffers: s.reopenOffers.filter((o) => o.offer_id !== offerId),
        }));
        if (offer) await reloadPlan(offer.dmp_id);
        return result.reopened ?? taskIds.length;
      } catch (err) {
        fail("The tasks weren't reopened", err);
        return 0;
      }
    },

    dismissReopenOffer: async (offerId) => {
      try {
        await tasksApi.dismissOffer(offerId);
        set((s) => ({
          reopenOffers: s.reopenOffers.filter((o) => o.offer_id !== offerId),
        }));
      } catch (err) {
        fail("Couldn't dismiss it", err);
      }
    },
  };
});

onSessionChange(() =>
  useTaskStore.setState({ tasks: [], loadedFor: {}, reopenOffers: [] }),
);
