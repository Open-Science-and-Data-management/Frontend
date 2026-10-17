import { useDmpStore, type DmpRecord } from "@/store/dmpStore";
import { findReopenCandidates, useTaskStore } from "@/store/taskStore";
import { notify } from "@/store/notificationStore";
import { CURRENT_USER_ID } from "@/config/current-user";
import { useProjectStore } from "@/store/projectStore";

/**
 * These fire when a version comes into force — often on a committee member's
 * click — but they're news for the plan's researcher, not whoever clicked.
 */
const researcherOf = (record: DmpRecord) =>
  useProjectStore.getState().getResearcherFor(record.project_id)?.user_id ??
  CURRENT_USER_ID;

const activeSnapshot = (record?: DmpRecord) =>
  record?.versions.find((v) => v.number === record.active_version)?.snapshot;

const outputIds = (record?: DmpRecord) =>
  new Set(
    (activeSnapshot(record)?.dataset ?? []).map((d) => d.dataset_id as string),
  );

/**
 * Consequences of a version coming into force that belong to other stores.
 *
 * Removing a research output from an approved plan is a major change: until
 * it's approved, the output is still in the plan in force and its tasks keep
 * running. So its tasks are cancelled here — when the version that drops it is
 * put in force — and never at the moment someone deletes it in the editor.
 *
 * Lives outside both stores because the task store already depends on the
 * plan store; this keeps the dependency one-way.
 */
export const installPlanEffects = () =>
  useDmpStore.subscribe((state, previous) => {
    state.dmps.forEach((record) => {
      const before = previous.dmps.find((d) => d.dmp_id === record.dmp_id);
      if (
        before?.active_version === undefined ||
        before.active_version === record.active_version
      )
        return;

      const beforeOutputs = activeSnapshot(before)?.dataset ?? [];
      const nowOutputs = activeSnapshot(record)?.dataset ?? [];
      const kept = outputIds(record);
      const dropped = beforeOutputs.filter(
        (d) => !kept.has(d.dataset_id as string),
      );
      const cancelled = dropped.reduce(
        (n, d) =>
          n +
          useTaskStore
            .getState()
            .cancelTasksForDataset(
              record.dmp_id,
              d.dataset_id as string,
              d.title,
            ),
        0,
      );

      if (cancelled > 0)
        notify({
          user_id: researcherOf(record),
          type: "tasks_cancelled",
          title: `${cancelled} task${cancelled === 1 ? "" : "s"} cancelled`,
          message: `Version ${record.active_version} removed the research output they belonged to. They stay on the board, marked cancelled.`,
          link: "/tasks",
          dmp_id: record.dmp_id,
          project_id: record.project_id,
        });

      // Outputs coming back: cancelled through governance, so undoing that is
      // a person's decision — offered, never done for them.
      const items = findReopenCandidates(
        useTaskStore.getState().tasks,
        record.dmp_id,
        beforeOutputs,
        nowOutputs,
      );
      if (items.length > 0) {
        useTaskStore.getState().offerReopen({
          dmp_id: record.dmp_id,
          version: record.active_version as number,
          items,
        });
        notify({
          user_id: researcherOf(record),
          type: "tasks_generated",
          title: `${items.length} cancelled task${items.length === 1 ? "" : "s"} can be reopened`,
          message: `Version ${record.active_version} brought back an output whose tasks were cancelled. Choose which to reopen.`,
          link: "/dmp/status",
          dmp_id: record.dmp_id,
          project_id: record.project_id,
        });
      }
    });
  });
