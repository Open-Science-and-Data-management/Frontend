import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import {
  backupBeforeMigrate,
  CURRENT_TASKS_VERSION,
  migrateTasks,
} from "@/store/taskMigrations";
import { actingUserId } from "@/config/current-user";
import { evidenceSatisfies } from "@/config/task-evidence";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import { planModeOf } from "@/config/plan-mode";
import type { Task, TaskChecklistItem, TaskEvidence } from "@/types/task";

// The seeded tasks belong to the approved seeded plan, since tasks only exist
// once a committee has approved the DMP they came from.
const SEED_DMP_ID = "dmp-pollinator";

const makeId = () => Math.random().toString(36).substring(2, 10);

/** What a caller supplies; the store fills in the rest. */
export type NewTask = Omit<
  Task,
  "task_id" | "checklist" | "evidence" | "progress_percent" | "status"
> &
  Partial<Pick<Task, "checklist" | "evidence" | "progress_percent" | "status">>;

/** Progress is the share of checklist steps done — never typed in. */
const progressFromChecklist = (checklist: TaskChecklistItem[]) => {
  if (checklist.length === 0) return 0;
  const done = checklist.filter((i) => i.done).length;
  return Math.round((done / checklist.length) * 100);
};

/**
 * Recomputes progress after a checklist change, and walks the status with it.
 * A task only reaches "done" through `completeTask`, which checks evidence.
 */
const withDerivedProgress = (
  task: Task,
  checklist: TaskChecklistItem[],
): Task => {
  const progress = progressFromChecklist(checklist);

  if (task.status === "cancelled") return { ...task, checklist };

  // Ticking every step doesn't close the task; evidence does.
  const status: Task["status"] =
    task.status === "done" ? "done" : progress > 0 ? "in_progress" : "todo";

  return { ...task, checklist, progress_percent: progress, status };
};

const step = (label: string, done = false): TaskChecklistItem => ({
  item_id: makeId(),
  label,
  done,
});

interface TaskState {
  tasks: Task[];
  addTask: (task: NewTask) => Task;
  addGeneratedTasks: (tasks: NewTask[]) => void;
  updateTask: (id: string, task: Partial<Task>) => void;

  /** Checklist: the only thing that moves progress. */
  addChecklistItem: (taskId: string, label: string) => void;
  renameChecklistItem: (taskId: string, itemId: string, label: string) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  removeChecklistItem: (taskId: string, itemId: string) => void;
  replaceChecklist: (taskId: string, labels: string[]) => void;

  /** Evidence: what makes closing the task legitimate. */
  setEvidence: (taskId: string, evidence: TaskEvidence) => void;
  clearEvidence: (taskId: string) => void;
  /** Refused when the stage demands evidence the task doesn't have. */
  completeTask: (taskId: string) => boolean;
  reopenTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;

  /**
   * Deletes a task only if no work is recorded on it. A task with evidence,
   * a ticked step, or a completion is the record of work done: it can be
   * cancelled, never deleted. Returns false when refused.
   */
  deleteTask: (id: string) => boolean;
  getTaskById: (id: string) => Task | undefined;
  /** Tasks belong to exactly one plan; the board never mixes them by accident. */
  getTasksForDmp: (dmpId: string) => Task[];
  /**
   * Swaps in a fresh AI breakdown for one plan. Tasks someone has already
   * worked on, and anything a person created, are kept.
   */
  replaceGeneratedTasks: (
    dmpId: string,
    tasks: NewTask[],
  ) => { added: number; removed: number; kept: number };
  /** A dataset dropped from the plan: its tasks are cancelled, never deleted. */
  cancelTasksForDataset: (
    dmpId: string,
    datasetId: string,
    datasetTitle?: string,
  ) => number;
  /** Offers to reopen tasks whose output came back; never acted on unasked. */
  reopenOffers: ReopenOffer[];
  offerReopen: (offer: Omit<ReopenOffer, "offer_id" | "created_at">) => void;
  /**
   * Reopens the chosen tasks of an offer, each to the status it had before it
   * was cancelled and linked to the output that came back. The rest stay
   * cancelled: the offer is answered, and closed.
   */
  reopenFromOffer: (offerId: string, taskIds: string[]) => number;
  dismissReopenOffer: (offerId: string) => void;
}

/** A task's plan mode, read through the plan to the project that owns it. */
const planModeFor = (dmpId: string) => {
  const dmp = useDmpStore.getState();
  const record = dmp.dmps.find((d) => d.dmp_id === dmpId);
  return planModeOf(
    record,
    useProjectStore.getState().projects,
    dmp.currentDmpId === dmpId ? dmp.draft.project_id : undefined,
  );
};

export interface ReopenOffer {
  offer_id: string;
  dmp_id: string;
  /** The version that brought the outputs back. */
  version: number;
  created_at: Date;
  items: {
    task_id: string;
    title: string;
    output_title: string;
    /** The status it had before it was cancelled. */
    restore_to: Task["status"];
    /** The returned output's id; differs from the task's when relinking. */
    relink_to: string;
    relinked: boolean;
  }[];
}

/**
 * Tasks a version's returning outputs could reopen: cancelled because their
 * output was removed, and matched to the returning output by id — or, when it
 * came back under a new id, by the title it had when removed.
 */
export const findReopenCandidates = (
  tasks: Task[],
  dmpId: string,
  previous: { dataset_id?: string; title: string }[],
  next: { dataset_id?: string; title: string }[],
): ReopenOffer["items"] => {
  const before = new Set(previous.map((d) => d.dataset_id));
  const nextIds = new Set(next.map((d) => d.dataset_id));
  const returned = next.filter((d) => !before.has(d.dataset_id));

  return tasks.flatMap((task) => {
    if (
      task.dmp_id !== dmpId ||
      task.status !== "cancelled" ||
      task.cancel_reason !== "output_removed"
    )
      return [];
    const output =
      returned.find((d) => d.dataset_id === task.dataset_id) ??
      (!nextIds.has(task.dataset_id)
        ? returned.find(
            (d) =>
              d.title.trim().toLowerCase() ===
              task.cancelled_dataset_title?.trim().toLowerCase(),
          )
        : undefined);
    if (!output?.dataset_id) return [];
    return [
      {
        task_id: task.task_id as string,
        title: task.title,
        output_title: output.title,
        restore_to: task.cancelled_from ?? "todo",
        relink_to: output.dataset_id,
        relinked: output.dataset_id !== task.dataset_id,
      },
    ];
  });
};

/** Evidence, a ticked step, or a completion: proof of work that must survive. */
export const hasRecordedWork = (task: Task): boolean =>
  Boolean(task.evidence?.ref?.trim()) ||
  (task.checklist ?? []).some((item) => item.done) ||
  task.status === "done" ||
  Boolean(task.completed_at);

const mutate = (
  tasks: Task[],
  taskId: string,
  change: (task: Task) => Task,
): Task[] => tasks.map((t) => (t.task_id === taskId ? change(t) : t));

const updateChecklist = (
  task: Task,
  change: (checklist: TaskChecklistItem[]) => TaskChecklistItem[],
) => withDerivedProgress(task, change(task.checklist ?? []));

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [
        {
          task_id: "1",
          dmp_id: SEED_DMP_ID,
          dataset_id: "ds-pollinator-reads",
          title: "Deposit the sequence reads",
          details: "Upload the raw reads to the repository and record the DOI.",
          status: "done",
          priority: "high",
          lifecycle_stage: "preserve",
          progress_percent: 100,
          checklist: [
            step("Package the reads for deposit", true),
            step("Upload to the repository", true),
            step("Record the DOI", true),
          ],
          evidence: {
            type: "rdm_deposit",
            ref: "https://doi.org/10.5281/zenodo.1234567",
            label: "10.5281/zenodo.1234567",
            attached_at: new Date("2026-09-18T09:00:00"),
          },
          completed_at: new Date("2026-09-18T09:05:00"),
          completed_by: actingUserId(),
          generated_by: "ai",
        },
        {
          task_id: "2",
          dmp_id: SEED_DMP_ID,
          dataset_id: "ds-pollinator-reads",
          title: "Run QC on the sequencing batch",
          details: "Check read quality and record the failures.",
          status: "in_progress",
          priority: "medium",
          lifecycle_stage: "process",
          progress_percent: 50,
          checklist: [
            step("Run the QC pipeline", true),
            step("Write up the failures", false),
          ],
          evidence: { type: "none" },
          end_date: new Date("2026-10-09T23:59:59"),
          generated_by: "ai",
        },
        {
          task_id: "3",
          dmp_id: SEED_DMP_ID,
          title: "Agree the weekly data review slot",
          details: "General coordination, not tied to an output.",
          status: "todo",
          priority: "low",
          lifecycle_stage: "collect",
          progress_percent: 0,
          checklist: [step("Ask the team for a slot")],
          evidence: { type: "none" },
          end_date: new Date("2026-10-15T23:59:59"),
          generated_by: "user",
        },
      ],

      addTask: (task) => {
        const created: Task = {
          progress_percent: 0,
          status: "todo",
          checklist: [],
          evidence: { type: "none" },
          ...task,
          task_id: makeId(),
        };
        set((state) => ({ tasks: [...state.tasks, created] }));
        return created;
      },

      addGeneratedTasks: (tasks) =>
        set((state) => ({
          tasks: [
            ...state.tasks,
            ...tasks.map((task) => ({
              progress_percent: 0,
              status: "todo" as const,
              checklist: [],
              evidence: { type: "none" as const },
              ...task,
              task_id: makeId(),
            })),
          ],
        })),

      updateTask: (id, updatedTask) =>
        set((state) => ({
          tasks: mutate(state.tasks, id, (task) => {
            // A closed task was judged against the rule its output implied.
            // Re-pointing it afterwards would rewrite that judgement, so the
            // link is fixed until the task is reopened.
            const patch =
              task.status === "done" && "dataset_id" in updatedTask
                ? { ...updatedTask, dataset_id: task.dataset_id }
                : updatedTask;
            return { ...task, ...patch };
          }),
        })),

      addChecklistItem: (taskId, label) =>
        set((state) => ({
          tasks: mutate(state.tasks, taskId, (task) =>
            updateChecklist(task, (list) => [
              ...list,
              step(label.trim() || "Untitled step"),
            ]),
          ),
        })),

      renameChecklistItem: (taskId, itemId, label) =>
        set((state) => ({
          tasks: mutate(state.tasks, taskId, (task) => ({
            ...task,
            checklist: (task.checklist ?? []).map((i) =>
              i.item_id === itemId
                ? { ...i, label: label.trim() || i.label }
                : i,
            ),
          })),
        })),

      toggleChecklistItem: (taskId, itemId) =>
        set((state) => ({
          tasks: mutate(state.tasks, taskId, (task) =>
            updateChecklist(task, (list) =>
              list.map((i) =>
                i.item_id === itemId ? { ...i, done: !i.done } : i,
              ),
            ),
          ),
        })),

      removeChecklistItem: (taskId, itemId) =>
        set((state) => ({
          tasks: mutate(state.tasks, taskId, (task) =>
            updateChecklist(task, (list) =>
              list.filter((i) => i.item_id !== itemId),
            ),
          ),
        })),

      replaceChecklist: (taskId, labels) =>
        set((state) => ({
          tasks: mutate(state.tasks, taskId, (task) =>
            updateChecklist(task, (list) => {
              // Steps already ticked survive a re-draft of the list.
              const kept = list.filter((i) => i.done);
              const fresh = labels
                .filter(
                  (l) =>
                    !kept.some(
                      (k) => k.label.toLowerCase() === l.trim().toLowerCase(),
                    ),
                )
                .map((l) => step(l));
              return [...kept, ...fresh];
            }),
          ),
        })),

      setEvidence: (taskId, evidence) =>
        set((state) => ({
          tasks: mutate(state.tasks, taskId, (task) => ({
            ...task,
            evidence: { ...evidence, attached_at: new Date() },
            file_id: evidence.type === "file" ? evidence.ref : task.file_id,
          })),
        })),

      clearEvidence: (taskId) =>
        set((state) => ({
          tasks: mutate(state.tasks, taskId, (task) => ({
            ...task,
            evidence: { type: "none" },
          })),
        })),

      completeTask: (taskId) => {
        const task = get().tasks.find((t) => t.task_id === taskId);
        // The trust boundary: some stages can't be closed on a tick alone, and
        // an independent plan — with no committee behind it — asks for more.
        if (!task || !evidenceSatisfies(task, planModeFor(task.dmp_id)))
          return false;

        set((state) => ({
          tasks: mutate(state.tasks, taskId, (t) => ({
            ...t,
            status: "done",
            progress_percent: 100,
            checklist: (t.checklist ?? []).map((i) => ({ ...i, done: true })),
            completed_at: new Date(),
            completed_by: actingUserId(),
          })),
        }));

        // Finishing work on a dataset is what moves it along the lifecycle.
        if (task.dataset_id) {
          useDmpStore
            .getState()
            .advanceDatasetStatus(
              task.dmp_id,
              task.dataset_id,
              task.lifecycle_stage,
            );
        }
        return true;
      },

      reopenTask: (taskId) =>
        set((state) => ({
          tasks: mutate(state.tasks, taskId, (task) => {
            const progress = progressFromChecklist(task.checklist ?? []);
            return {
              ...task,
              status: progress > 0 ? "in_progress" : "todo",
              progress_percent: progress,
              completed_at: undefined,
              completed_by: undefined,
            };
          }),
        })),

      cancelTask: (taskId) =>
        set((state) => ({
          // Finished work stays finished: cancelling would overwrite the
          // record of its completion. Reopen it first if it really changed.
          tasks: mutate(state.tasks, taskId, (task) =>
            task.status === "done" || task.status === "cancelled"
              ? task
              : {
                  ...task,
                  status: "cancelled",
                  cancelled_from: task.status,
                  cancel_reason: "manual",
                  cancelled_at: new Date(),
                },
          ),
        })),

      deleteTask: (id) => {
        const task = get().tasks.find((t) => t.task_id === id);
        if (!task || hasRecordedWork(task)) return false;
        set((state) => ({
          tasks: state.tasks.filter((t) => t.task_id !== id),
        }));
        return true;
      },

      getTaskById: (id) => get().tasks.find((task) => task.task_id === id),

      getTasksForDmp: (dmpId) => get().tasks.filter((t) => t.dmp_id === dmpId),

      replaceGeneratedTasks: (dmpId, tasks) => {
        const before = get().tasks;
        // Only untouched AI tasks are swapped out — work is never discarded.
        const isReplaceable = (t: Task) =>
          t.dmp_id === dmpId &&
          t.generated_by === "ai" &&
          t.status === "todo" &&
          t.progress_percent === 0 &&
          t.evidence.type === "none";

        const kept = before.filter((t) => !isReplaceable(t));
        const removed = before.length - kept.length;
        const added = tasks.map((task) => ({
          progress_percent: 0,
          status: "todo" as const,
          checklist: [],
          evidence: { type: "none" as const },
          ...task,
          task_id: makeId(),
        }));

        set({ tasks: [...kept, ...added] });
        return {
          added: added.length,
          removed,
          kept: kept.filter((t) => t.dmp_id === dmpId).length,
        };
      },

      cancelTasksForDataset: (dmpId, datasetId, datasetTitle) => {
        const affected = get().tasks.filter(
          (t) =>
            t.dmp_id === dmpId &&
            t.dataset_id === datasetId &&
            t.status !== "done" &&
            t.status !== "cancelled",
        );

        set((state) => ({
          tasks: state.tasks.map((t) =>
            affected.some((a) => a.task_id === t.task_id)
              ? {
                  ...t,
                  status: "cancelled" as const,
                  cancelled_from: t.status,
                  cancel_reason: "output_removed" as const,
                  cancelled_dataset_title: datasetTitle,
                  cancelled_at: new Date(),
                }
              : t,
          ),
        }));
        return affected.length;
      },

      reopenOffers: [],

      offerReopen: (offer) =>
        set((state) => ({
          reopenOffers: [
            ...state.reopenOffers,
            {
              ...offer,
              offer_id: Math.random().toString(36).slice(2, 10),
              created_at: new Date(),
            },
          ],
        })),

      reopenFromOffer: (offerId, taskIds) => {
        const offer = get().reopenOffers.find((o) => o.offer_id === offerId);
        if (!offer) return 0;
        const chosen = offer.items.filter((i) => taskIds.includes(i.task_id));
        set((state) => ({
          tasks: state.tasks.map((t) => {
            const item = chosen.find((i) => i.task_id === t.task_id);
            // Only still-cancelled tasks: anything reopened since is left be.
            if (!item || t.status !== "cancelled") return t;
            return {
              ...t,
              status: item.restore_to,
              dataset_id: item.relink_to,
              cancelled_from: undefined,
              cancel_reason: undefined,
              cancelled_dataset_title: undefined,
              cancelled_at: undefined,
            };
          }),
          reopenOffers: state.reopenOffers.filter(
            (o) => o.offer_id !== offerId,
          ),
        }));
        return chosen.length;
      },

      dismissReopenOffer: (offerId) =>
        set((state) => ({
          reopenOffers: state.reopenOffers.filter(
            (o) => o.offer_id !== offerId,
          ),
        })),
    }),
    {
      name: storageKey("tasks"),
      storage: jsonStorage,
      // Bump when the shape of a stored task changes.
      version: CURRENT_TASKS_VERSION,
      migrate: (persisted, version) => {
        if (version >= CURRENT_TASKS_VERSION) return persisted;

        // Copied aside first: a migration can't be undone, and a bad one
        // would otherwise be overwritten by the next save.
        backupBeforeMigrate(storageKey("tasks"), version);

        try {
          return migrateTasks(persisted, version);
        } catch {
          // Rather than hand back half-migrated rows, start clean — the
          // untouched payload is still on disk under its backup key.
          return { tasks: [] };
        }
      },
      partialize: (state) => ({
        tasks: state.tasks,
        reopenOffers: state.reopenOffers,
      }),
    },
  ),
);
