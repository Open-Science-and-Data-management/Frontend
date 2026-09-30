import type { Task, TaskChecklistItem } from "@/types/task";

/**
 * Stored task shapes this app has had. Kept as a loose type on purpose: these
 * rows come off disk and may predate any of the fields we now rely on.
 */
export interface StoredChecklistItem {
  item_id?: string;
  /** v1–v3 grouped steps by evidence level; v4 has no levels. */
  level?: "basic" | "output" | "preserve_share";
  core?: boolean;
  title?: string;
  label?: string;
  done?: boolean;
  note?: string;
  /** v1 held one file inline; v2/v3 held a list. */
  file_id?: string;
  filename?: string;
  files?: { file_id: string; filename: string }[];
}

export interface StoredTask extends Record<string, unknown> {
  task_id?: string;
  details?: string;
  checklist?: StoredChecklistItem[];
  evidence?: Task["evidence"];
  status?: Task["status"];
}

/**
 * v1 and v2 stored no step titles — the label came from the level itself, so
 * it has to be reconstructed or every migrated step reads "Step".
 */
const LEVEL_LABELS: Record<string, string> = {
  basic: "Describe what was done",
  output: "Attach the deliverable",
  preserve_share: "Show it was deposited or published",
};

/** Later levels are better evidence of the task being finished. */
const LEVEL_RANK: Record<string, number> = {
  preserve_share: 3,
  output: 2,
  basic: 1,
};

const makeId = () => Math.random().toString(36).substring(2, 10);

const filesOf = (item: StoredChecklistItem) =>
  item.files?.length
    ? item.files
    : item.file_id && item.filename
      ? [{ file_id: item.file_id, filename: item.filename }]
      : [];

export const CURRENT_TASKS_VERSION = 4;

/**
 * Folds every earlier checklist shape into plain `{ item_id, label, done }`
 * steps, without losing what those steps carried: an attached file is promoted
 * to the task's evidence, and step notes are appended to the task's details.
 */
export const migrateTasks = (persisted: unknown, version: number): unknown => {
  const state = persisted as { tasks?: StoredTask[] } | undefined;
  if (version >= CURRENT_TASKS_VERSION || !state?.tasks) return persisted;

  return {
    ...state,
    tasks: state.tasks.map((task) => {
      const stored = task.checklist ?? [];

      const checklist: TaskChecklistItem[] = stored.map((item) => ({
        item_id: item.item_id ?? makeId(),
        label:
          item.label ??
          item.title ??
          (item.level ? LEVEL_LABELS[item.level] : undefined) ??
          "Step",
        done: Boolean(item.done),
      }));

      // The strongest file the old checklist held becomes the task's evidence,
      // rather than being dropped and leaving a closed task unprovable.
      const best = [...stored]
        .filter((item) => filesOf(item).length > 0)
        .sort(
          (a, b) =>
            (LEVEL_RANK[b.level ?? ""] ?? 0) - (LEVEL_RANK[a.level ?? ""] ?? 0),
        )[0];
      const promoted = best ? filesOf(best)[0] : undefined;

      const notes = stored
        .map((item) => item.note?.trim())
        .filter((note): note is string => Boolean(note));

      const done = checklist.filter((i) => i.done).length;

      return {
        ...task,
        checklist,
        evidence:
          task.evidence ??
          (promoted
            ? {
                type: "file" as const,
                ref: promoted.file_id,
                label: promoted.filename,
              }
            : { type: "none" as const }),
        // Notes had nowhere to go once steps became plain labels.
        details: notes.length
          ? [
              task.details,
              "From the earlier checklist:",
              ...notes.map((n) => `• ${n}`),
            ]
              .filter(Boolean)
              .join("\n")
          : task.details,
        progress_percent:
          checklist.length === 0
            ? 0
            : Math.round((done / checklist.length) * 100),
      };
    }),
  };
};

const BACKUP_SUFFIX = ".pre-v";

/**
 * Migrations can't be undone, so the payload is copied aside before one runs.
 * If a release migrates badly, the untouched original is still on disk.
 */
export const backupBeforeMigrate = (key: string, version: number) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) localStorage.setItem(`${key}${BACKUP_SUFFIX}${version}`, raw);
  } catch {
    // A browser that won't let us write is not a reason to block startup.
  }
};

export const backupKeyFor = (key: string, version: number) =>
  `${key}${BACKUP_SUFFIX}${version}`;

/** Lists the backups on disk, newest schema first. */
export const listBackups = (
  key: string,
): { key: string; version: number }[] => {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(`${key}${BACKUP_SUFFIX}`))
      .map((k) => ({
        key: k,
        version: Number(k.slice(`${key}${BACKUP_SUFFIX}`.length)),
      }))
      .sort((a, b) => b.version - a.version);
  } catch {
    return [];
  }
};

/** Puts a backup back under the live key. The caller reloads afterwards. */
export const restoreBackup = (key: string, backupKey: string): boolean => {
  try {
    const raw = localStorage.getItem(backupKey);
    if (!raw) return false;
    localStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
};
