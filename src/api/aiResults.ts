import { runAiAction, type StreamResult } from "@/api/aiStream";
import type { NewTask } from "@/store/taskStore";
import type { Task } from "@/types/task";

/**
 * Reads the structured results of AI actions. The model's JSON is checked
 * item by item; anything malformed is dropped rather than guessed at, and
 * nothing here is saved: callers show the result and save what's confirmed.
 */

const STAGES = new Set(["collect", "process", "analyse", "preserve", "share"]);
const PRIORITIES = new Set(["low", "medium", "high"]);

const listIn = (proposal: unknown, key: string): unknown[] => {
  if (Array.isArray(proposal)) return proposal;
  const value = (proposal as Record<string, unknown> | null)?.[key];
  return Array.isArray(value) ? value : [];
};

/** The last proposal of a run, where the final answer is. */
const finalProposal = (result: StreamResult) =>
  result.proposals[result.proposals.length - 1];

/**
 * `generate-tasks` on a plan in force. Only tasks for the given outputs (the
 * version in force's) are kept; a plan-wide task has no output.
 */
export const draftTasks = async (
  dmpId: string,
  opts: { direction?: string; datasetIds: string[]; signal?: AbortSignal },
): Promise<{ tasks: NewTask[]; result: StreamResult }> => {
  const result = await runAiAction(
    dmpId,
    "generate-tasks",
    {
      ...(opts.direction?.trim() ? { direction: opts.direction.trim() } : {}),
      dataset_ids: opts.datasetIds,
    },
    { signal: opts.signal },
  );
  const allowed = new Set(opts.datasetIds);
  const tasks = listIn(finalProposal(result), "tasks").flatMap((raw) => {
    const t = raw as Record<string, unknown>;
    const title = typeof t.title === "string" ? t.title.trim() : "";
    const stage = String(t.lifecycle_stage ?? "");
    if (!title || !STAGES.has(stage)) return [];
    const datasetId =
      typeof t.dataset_id === "string" && allowed.has(t.dataset_id)
        ? t.dataset_id
        : undefined;
    if (t.dataset_id && !datasetId) return [];
    return [
      {
        dmp_id: dmpId,
        title: title.slice(0, 200),
        details: typeof t.details === "string" ? t.details : undefined,
        lifecycle_stage: stage as Task["lifecycle_stage"],
        priority: (PRIORITIES.has(String(t.priority))
          ? t.priority
          : "medium") as Task["priority"],
        ...(datasetId ? { dataset_id: datasetId } : {}),
      },
    ];
  });
  return { tasks, result };
};

/** `checklist` for one task: its steps, as plain labels. */
export const draftChecklist = async (
  dmpId: string,
  taskId: string,
  direction?: string,
): Promise<{ steps: string[]; result: StreamResult }> => {
  const result = await runAiAction(dmpId, "checklist", {
    task_id: taskId,
    ...(direction?.trim() ? { direction: direction.trim() } : {}),
  });
  const steps = listIn(finalProposal(result), "steps")
    .map((s) =>
      typeof s === "string"
        ? s
        : typeof (s as Record<string, unknown>)?.label === "string"
          ? String((s as Record<string, unknown>).label)
          : "",
    )
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
  return { steps, result };
};
