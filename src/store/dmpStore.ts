import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import type { DmpDraft } from "@/types/dmp";
import type { Dataset } from "@/types/dataset";
import type { Contributor, Cost } from "@/types/contributor";
import type { z } from "zod";
import type { DmpStatus as DmpStatusEnum } from "@/schemas/shared";
import { EditType, VersionStatus } from "@/schemas/shared";
import type { PlanMode } from "@/types/project";
import type { Coverage, RegenerateDirection } from "@/api/aiApi";
import type { ProvenanceMap } from "@/api/aiContract";
import {
  dmpsApi,
  readDraft,
  type DraftConflict,
  type ServerDmp,
  type ServerVersion,
} from "@/api/dmpsApi";
import { ApiError } from "@/api/http";
import { analyzeProposalStream, runAiAction } from "@/api/aiStream";
import { useToastStore } from "@/store/toastStore";
import { useAiThread } from "@/store/aiThread";
import { reportAiError, syncQuota } from "@/store/aiErrors";
import { sameValue } from "@/utils/sameValue";
import {
  isWordingOnly,
  regenerateMode,
  dmpFieldPolicy,
  datasetFieldPolicy,
  type FieldPolicy,
} from "@/config/field-policy";
import { getDomainProfile } from "@/schemas/dataset/domain-profiles";
import { diffPlans, type FieldChange } from "@/config/plan-diff";
import { onSessionChange } from "@/config/current-user";

/**
 * Plans, backed by the server (`/dmps`). The backend owns every decision and
 * every stored fact: drafts and their revision counter, versions, minor
 * edits, revisions, approvals, archiving, tasks created on approval, and the
 * notifications that go with them.
 *
 * The store keeps:
 * - `dmps`: the library, as the server last listed it;
 * - the open plan: its working `draft`, edited locally and autosaved whole
 *   (`PUT /dmps/:id/draft`) with its `draft_revision`, so two tabs can't
 *   overwrite each other. A `409 draft_conflict` is rebased: the server's
 *   draft is taken and only the fields changed here since the last save are
 *   applied on top.
 * Every workflow action saves pending edits first, calls the backend, then
 * reloads the plan from it.
 */

type DmpStatus = z.infer<typeof DmpStatusEnum>;

export interface BatchTarget {
  id: string;
  scope: "dmp" | "dataset";
  datasetId?: string;
  /** A free-text field the AI owns the wording of (`regenerateMode` "rewrite"). */
  key: string;
  label: string;
  group: string;
  value: string;
}

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);

/** Who decided a version, as it stood when they decided it. */
export interface Approver {
  user_id?: string;
  name: string;
  position: string;
  mbox?: string;
}

/**
 * A numbered version as the server reports it. `snapshot` is the content the
 * server shares with the client (`review_snapshot`): the pending version's
 * when one waits, otherwise the version in force's. A version the server
 * doesn't share content for has an empty snapshot.
 */
export interface PlanVersion {
  number: number;
  status: z.infer<typeof VersionStatus>;
  edit_type: z.infer<typeof EditType>;
  changes: FieldChange[];
  snapshot: DmpDraft;
  created_at: Date;
  decided_at?: Date;
  decided_by?: string;
  approver?: Approver;
  note?: string;
  minor_edits: {
    at: Date;
    by: string;
    changes: FieldChange[];
    restored_from?: number;
    during_pending?: number;
  }[];
  restored_from?: number;
  based_on?: { number: number; snapshot: DmpDraft };
  carried_minor_edits?: FieldChange[];
  dropped_minor_edits?: FieldChange[];
}

export type ArchiveResult = { ok: true } | { ok: false; reason: string };

export interface DmpRecord {
  dmp_id: string;
  project_id?: string;
  title: string;
  description: string;
  language?: string;
  status: DmpStatus;
  created_at: Date;
  updated_at: Date;
  /** Unknown until the plan's content has been fetched: lists don't send it. */
  dataset_count?: number;
  contributor_count?: number;
  /** True once the plan has tasks (the server creates them on approval). */
  tasks_generated: boolean;
  /** The author's working draft; reviewers get the content under review. */
  draft: DmpDraft;
  /** The content under review: pending, else in force, else the draft. */
  review_snapshot?: DmpDraft;
  provenance?: ProvenanceMap;
  versions: PlanVersion[];
  active_version?: number;
  archived_at?: Date;
  plan_mode?: PlanMode;
  researcher?: { user_id: string; name: string };
  draft_revision?: number;
  readiness?: ServerDmp["readiness"];
}

const date = (value: string | null | undefined) =>
  value ? new Date(value) : undefined;

const toVersion = (
  v: ServerVersion,
  plan: ServerDmp,
  shared: DmpDraft,
): PlanVersion => {
  const hasPending = (plan.versions ?? []).some((x) => x.status === "pending");
  // The server shares one snapshot: the pending version's, else the one in
  // force. Other versions' content isn't sent.
  const isShared =
    v.status === "pending" || (!hasPending && v.number === plan.active_version);
  return {
    number: v.number,
    status: v.status,
    edit_type: v.edit_type ?? "major",
    changes: (v.changes ?? []) as FieldChange[],
    snapshot: isShared ? shared : {},
    created_at: new Date(v.created_at),
    decided_at: date(v.decided_at),
    decided_by: v.decided_by ?? undefined,
    approver: v.approver?.name
      ? {
          name: v.approver.name,
          position: v.approver.position ?? "",
          mbox: v.approver.mbox,
        }
      : undefined,
    note: v.note ?? undefined,
    minor_edits: (v.minor_edits ?? []) as PlanVersion["minor_edits"],
    carried_minor_edits: v.carried_minor_edits as FieldChange[] | undefined,
    dropped_minor_edits: v.dropped_minor_edits as FieldChange[] | undefined,
  };
};

/** A server plan as the app's record. */
export const toRecord = (
  plan: ServerDmp,
  tasksGenerated = false,
): DmpRecord => {
  const shared = readDraft(plan.review_snapshot);
  const draft = plan.draft ? readDraft(plan.draft) : shared;
  return {
    dmp_id: plan.dmp_id,
    project_id: plan.project_id ?? undefined,
    title: plan.title || "Untitled DMP",
    description: plan.description ?? "",
    language: plan.language,
    status: plan.status,
    created_at: new Date(plan.created_at),
    updated_at: new Date(plan.updated_at),
    archived_at: date(plan.archived_at),
    plan_mode: plan.plan_mode ?? undefined,
    active_version: plan.active_version ?? undefined,
    researcher: plan.researcher,
    draft,
    review_snapshot: shared,
    draft_revision: plan.draft_revision,
    readiness: plan.readiness,
    versions: (plan.versions ?? [])
      .map((v) => toVersion(v, plan, shared))
      .sort((a, b) => a.number - b.number),
    ...(plan.draft || plan.review_snapshot
      ? {
          dataset_count: (draft.dataset ?? shared.dataset ?? []).length,
          contributor_count: (draft.contributor ?? shared.contributor ?? [])
            .length,
        }
      : {}),
    tasks_generated: tasksGenerated,
  };
};

/** True once the editor holds something worth listing. */
export const draftHasContent = (draft: DmpDraft) =>
  Boolean(
    draft.title ||
    draft.description ||
    draft.dataset?.length ||
    draft.contributor?.length,
  );

/**
 * The library as list screens see it: the plan open in the editor shows its
 * live draft over its record.
 */
export const buildDmpList = (state: {
  dmps: DmpRecord[];
  draft: DmpDraft;
  status: DmpStatus;
  currentDmpId: string | null;
  draftCreatedAt: Date;
  draftUpdatedAt: Date;
  tasksGenerated: boolean;
  includeArchived?: boolean;
}): DmpRecord[] => {
  const list = state.dmps.map((record) =>
    record.dmp_id === state.currentDmpId && draftHasContent(state.draft)
      ? {
          ...record,
          title: state.draft.title?.trim() || record.title,
          description: state.draft.description?.trim() ?? record.description,
          dataset_count: state.draft.dataset?.length ?? 0,
          contributor_count: state.draft.contributor?.length ?? 0,
          draft: state.draft,
        }
      : record,
  );
  return state.includeArchived ? list : list.filter((d) => !d.archived_at);
};

<<<<<<< Updated upstream
=======
/**
 * The research outputs of the version in force: what tasks are drafted from.
 * Empty when nothing is in force, or when the server doesn't share that
 * version's content (a revision is waiting).
 */
export const outputsInForce = (record?: DmpRecord): Dataset[] =>
  record?.versions.find((v) => v.number === record.active_version)?.snapshot
    .dataset ?? [];

>>>>>>> Stashed changes
export const createEmptyDataset = (type: Dataset["type"]): Dataset => {
  const base = {
    dataset_id: makeId(),
    title: "",
    status: "planned" as const,
    access: "shared" as const,
    personal_data: "no" as const,
    sensitive_data: "no" as const,
    protection_level: "",
    security_classification_level: "",
    keyword: [],
    domain: "generic" as const,
    domain_metadata: {},
    preservation: { doi_requested: false },
    distribution: [],
  };
  switch (type) {
    case "raw":
      return { ...base, type: "raw", schema_fields: [] };
    case "software":
      return { ...base, type: "software" };
    case "publication":
      return { ...base, type: "publication" };
    case "other":
      return { ...base, type: "other" };
  }
};

const createEmptyContributor = (): Contributor => ({
  contributor_id: makeId(),
  name: "",
  role: "",
  email: "",
  is_contact: false,
});

const createEmptyCost = (): Cost => ({
  cost_id: makeId(),
  title: "",
  value: 0,
  currency_code: "THB",
});

const batchLabel = (key: string) =>
  key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** A plan field, or a field of one research output (by id, not position). */
export type RegenerateTarget =
  | keyof DmpDraft
  | { datasetId: string; field: keyof Dataset | "preservation.statement" };

/** The key `regeneratingFields` uses, so a field can show it's busy. */
export const regenerateFlag = (target: RegenerateTarget) =>
  typeof target === "string"
    ? target
    : `dataset:${target.datasetId}:${String(target.field)}`;

const fieldOf = (draft: DmpDraft, target: RegenerateTarget) => {
  if (typeof target === "string")
    return {
      policy: dmpFieldPolicy[target],
      value: draft[target],
      path: target as string,
    };
  const index = (draft.dataset ?? []).findIndex(
    (d) => d.dataset_id === target.datasetId,
  );
  const dataset = (draft.dataset ?? [])[index];
  return {
    policy: datasetFieldPolicy[target.field],
    value:
      target.field === "preservation.statement"
        ? dataset?.preservation?.statement
        : dataset?.[target.field as keyof Dataset],
    path: index < 0 ? null : `dataset[${index}].${target.field}`,
  };
};

const withoutProvenance = (
  provenance: ProvenanceMap | null,
  paths: string[],
): ProvenanceMap | null => {
  if (!provenance || !paths.some((p) => p in provenance)) return provenance;
  const rest = { ...provenance };
  paths.forEach((p) => delete rest[p]);
  return rest;
};

/** Says what went wrong, in the person's terms, and returns false. */
const fail = (title: string, err: unknown) => {
  useToastStore.getState().toast({
    title,
    description:
      err instanceof ApiError || err instanceof Error
        ? err.message
        : "Please try again.",
    variant: "destructive",
  });
  return false;
};

interface DmpDraftState {
  draft: DmpDraft;
  regeneratingFields: Record<string, boolean>;
  coverage: Coverage | null;
  provenance: ProvenanceMap | null;
  status: DmpStatus;
  tasksGenerated: boolean;

  /** The library as the server last listed it. */
  dmps: DmpRecord[];
  /** Whether the library has been loaded from the server this session. */
  libraryStatus: "idle" | "loading" | "ready" | "error";
  currentDmpId: string | null;
  /** The open plan is being fetched. */
  opening: boolean;
  draftCreatedAt: Date;
  draftUpdatedAt: Date;
  /** The server's revision of the open draft (optimistic concurrency). */
  draftRevision: number;
  /** Autosave state of the open draft. */
  saveState: "saved" | "saving" | "unsaved" | "error";
  restoredFrom: number | null;

  /** `GET /dmps` (and archived ones), into `dmps`. */
  loadLibrary: () => Promise<void>;
  /** Re-reads one plan from the server into the library (and editor). */
  refreshDmp: (id: string) => Promise<DmpRecord | undefined>;
  /** Opens a plan in the editor: the cached record now, the server's next. */
  openDmp: (id: string) => DmpRecord | undefined;
  /** Saves any pending edits to the server now. */
  flushDraft: () => Promise<boolean>;
  unarchiveDmp: (id: string) => Promise<boolean>;

  activeVersion: () => PlanVersion | undefined;
  pendingVersion: () => PlanVersion | undefined;
  /** What the open draft changes, against the content the server shares. */
  pendingChanges: () => FieldChange[];
  saveMinorEdits: () => Promise<boolean>;
  submitRevision: () => Promise<boolean>;
  restoreVersion: (number: number) => Promise<boolean>;
  submitForApproval: () => Promise<boolean>;
  /** Committee and chief: decide the version of `dmpId` that's waiting. */
  approveDmp: (
    dmpId: string,
    approver: Approver,
    note?: string,
  ) => Promise<boolean>;
  returnDmp: (
    dmpId: string,
    approver: Approver,
    note: string,
  ) => Promise<boolean>;
  finalize: () => Promise<boolean>;
  /** Marks the plan the tasks were generated for — the open one by default. */
  markTasksGenerated: (dmpId?: string | null) => void;

  setField: <K extends keyof DmpDraft>(key: K, value: DmpDraft[K]) => void;
  addContributor: () => void;
  updateContributor: (id: string, patch: Partial<Contributor>) => void;
  removeContributor: (id: string) => void;
  setPrimaryContact: (id: string) => void;
  addCost: () => void;
  updateCost: (id: string, patch: Partial<Cost>) => void;
  removeCost: (id: string) => void;
  addDataset: (type: Dataset["type"]) => void;
  updateDataset: (id: string, patch: Partial<Dataset>) => void;
  /** False once an output has been dropped from the version in force. */
  datasetExists: (dmpId: string, datasetId: string) => boolean;
  removeDataset: (id: string) => void;
  changeDatasetType: (id: string, type: Dataset["type"]) => void;
  changeDatasetDomain: (id: string, domain: Dataset["domain"]) => void;

  /** A plan's working copy by thread scope — the open one, or its record. */
  draftFor: (scope: string) => DmpDraft | undefined;
  /**
   * `POST /ai/analyze-proposal` on an uploaded proposal. The server creates
   * the plan only if the analysis succeeds; it's then opened.
   */
  analyzeProposal: (input: {
    projectId: string;
    fileId: string;
    direction?: string;
    /** Redraft this plan in place. */
    replace?: string;
    signal?: AbortSignal;
  }) => Promise<{ coverage: Coverage; dmpId: string; opened: boolean }>;
  /** `POST /dmps`, then opens the new plan. */
  startManual: (projectId?: string) => Promise<string | undefined>;
  /** AI rewrite of one free-text field, kept as a suggestion to accept. */
  regenerateField: (
    target: RegenerateTarget,
    label: string,
    direction: RegenerateDirection,
  ) => Promise<void>;
  eligibleBatchTargets: () => BatchTarget[];
  /**
   * Leaves the editor. A submitted plan only loses unsubmitted edits; one
   * never submitted is archived. Nothing is deleted.
   */
  closeDraft: () => Promise<"discarded" | "kept" | "archived" | "cleared">;
}

const emptyDraft: DmpDraft = {};

// ── Autosave ──────────────────────────────────────────────────────────────

const SAVE_DELAY_MS = 800;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saving: Promise<boolean> | null = null;
/** The draft as the server last confirmed it: the base for rebasing. */
let lastSaved: DmpDraft = {};

/** Fields changed here since the last confirmed save. */
const changedKeys = (draft: DmpDraft) =>
  (Object.keys({ ...draft, ...lastSaved }) as (keyof DmpDraft)[]).filter(
    (key) => !sameValue(draft[key], lastSaved[key]),
  );

export const useDmpStore = create<DmpDraftState>()(
  persist(
    (set, get) => {
      const touch = () => {
        set({ saveState: "unsaved", draftUpdatedAt: new Date() });
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          saveTimer = null;
          void get().flushDraft();
        }, SAVE_DELAY_MS);
      };

      /** Applies a change to the open draft and schedules the save. */
      const edit = (
        update: (state: DmpDraftState) => Partial<DmpDraftState>,
      ) => {
        set(update);
        touch();
      };

      const putRecord = (record: DmpRecord) =>
        set((state) => ({
          dmps: state.dmps.some((d) => d.dmp_id === record.dmp_id)
            ? state.dmps.map((d) => (d.dmp_id === record.dmp_id ? record : d))
            : [record, ...state.dmps],
        }));

      /** Loads a server plan into the editor (and the library). */
      const load = (plan: ServerDmp) => {
        const record = toRecord(
          plan,
          get().dmps.find((d) => d.dmp_id === plan.dmp_id)?.tasks_generated,
        );
        putRecord(record);
        if (get().currentDmpId === plan.dmp_id && plan.draft) {
          lastSaved = record.draft;
          set({
            draft: record.draft,
            draftRevision: plan.draft_revision ?? 0,
            status: record.status,
            draftCreatedAt: record.created_at,
            draftUpdatedAt: record.updated_at,
            saveState: "saved",
          });
        }
        return record;
      };

      /** Runs a workflow action on the open plan with a fresh revision. */
      const act = async (
        label: string,
        run: (id: string, revision: number) => Promise<unknown>,
      ) => {
        const id = get().currentDmpId;
        if (!id) return false;
        if (!(await get().flushDraft())) return false;
        try {
          await run(id, get().draftRevision);
          await get().refreshDmp(id);
          return true;
        } catch (err) {
          await get()
            .refreshDmp(id)
            .catch(() => undefined);
          return fail(label, err);
        }
      };

      return {
        draft: emptyDraft,
        regeneratingFields: {},
        coverage: null,
        provenance: null,
        status: "draft",
        tasksGenerated: false,
        dmps: [],
        libraryStatus: "idle",
        currentDmpId: null,
        opening: false,
        draftCreatedAt: new Date(),
        draftUpdatedAt: new Date(),
        draftRevision: 0,
        saveState: "saved",
        restoredFrom: null,

        loadLibrary: async () => {
          set({ libraryStatus: "loading" });
          try {
            const [live, archived] = await Promise.all([
              dmpsApi.list({ include: "versions" }),
              dmpsApi.list({ archived: true, include: "versions" }),
            ]);
            const known = new Map(get().dmps.map((d) => [d.dmp_id, d]));
            set({
              dmps: [...live, ...archived].map((p) => {
                const before = known.get(p.dmp_id);
                const record = toRecord(p, before?.tasks_generated);
                // Lists carry no content; keep what an earlier fetch had.
                return before && !p.draft && !p.review_snapshot
                  ? {
                      ...record,
                      draft: before.draft,
                      review_snapshot: before.review_snapshot,
                      dataset_count: before.dataset_count,
                      contributor_count: before.contributor_count,
                    }
                  : record;
              }),
              libraryStatus: "ready",
            });
          } catch (err) {
            set({ libraryStatus: "error" });
            throw err;
          }
        },

        refreshDmp: async (id) => {
          const plan = await dmpsApi.get(id);
          return load(plan);
        },

        openDmp: (id) => {
          if (get().currentDmpId === id && !get().opening)
            return get().dmps.find((d) => d.dmp_id === id);
          const cached = get().dmps.find((d) => d.dmp_id === id);
          lastSaved = cached?.draft ?? {};
          set({
            currentDmpId: id,
            opening: true,
            draft: cached?.draft ?? emptyDraft,
            status: cached?.status ?? "draft",
            draftRevision: cached?.draft_revision ?? 0,
            provenance: cached?.provenance ?? null,
            coverage: null,
            restoredFrom: null,
            saveState: "saved",
          });
          get()
            .refreshDmp(id)
            .catch((err) => fail("Couldn't open the plan", err))
            .finally(() => set({ opening: false }));
          return cached;
        },

        flushDraft: async () => {
          if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
          }
          if (saving) await saving;
          const id = get().currentDmpId;
          if (!id || get().saveState === "saved") return true;

          saving = (async () => {
            set({ saveState: "saving" });
            const attempt = async (draft: DmpDraft, revision: number) => {
              const saved = await dmpsApi.saveDraft(id, draft, revision);
              lastSaved = draft;
              set({ draftRevision: saved.draft_revision });
            };
            const draft = get().draft;
            try {
              try {
                await attempt(draft, get().draftRevision);
              } catch (err) {
                if (!(err instanceof ApiError) || err.code !== "draft_conflict")
                  throw err;
                // Someone saved first: take theirs, put ours on top.
                const conflict = err.details as unknown as DraftConflict;
                // Rebase what's on screen now, so typing during the failed
                // save isn't dropped.
                const current = get().draft;
                const theirs = readDraft(conflict.draft);
                const mine = changedKeys(current);
                const merged = { ...theirs } as Record<string, unknown>;
                mine.forEach((key) => {
                  merged[key] = current[key];
                });
                lastSaved = theirs;
                set({ draft: merged as DmpDraft });
                await attempt(merged as DmpDraft, conflict.draft_revision);
              }
              // Edits made while saving stay unsaved.
              set({
                saveState: sameValue(get().draft, lastSaved)
                  ? "saved"
                  : "unsaved",
              });
              if (get().saveState === "unsaved") touch();
              return true;
            } catch (err) {
              set({ saveState: "error" });
              return fail("Your changes weren't saved", err);
            } finally {
              saving = null;
            }
          })();
          return saving;
        },

        unarchiveDmp: async (id) => {
          try {
            putRecord(toRecord(await dmpsApi.unarchive(id)));
            return true;
          } catch (err) {
            return fail("Couldn't restore the plan", err);
          }
        },

        activeVersion: () => {
          const { dmps, currentDmpId } = get();
          const record = dmps.find((d) => d.dmp_id === currentDmpId);
          return record?.versions.find(
            (v) => v.number === record.active_version,
          );
        },

        pendingVersion: () => {
          const { dmps, currentDmpId } = get();
          return dmps
            .find((d) => d.dmp_id === currentDmpId)
            ?.versions.find((v) => v.status === "pending");
        },

        pendingChanges: () => {
          const { dmps, currentDmpId, draft } = get();
          const record = dmps.find((d) => d.dmp_id === currentDmpId);
          if (!record?.active_version || !record.review_snapshot) return [];
          return diffPlans(record.review_snapshot, draft);
        },

        saveMinorEdits: () =>
          act("Minor edits weren't saved", (id, rev) =>
            dmpsApi.saveMinorEdits(id, rev),
          ),

        submitRevision: () =>
          act("The revision wasn't submitted", (id, rev) =>
            dmpsApi.submitRevision(id, rev),
          ),

        restoreVersion: async (number) => {
          const ok = await act("That version wasn't restored", (id, rev) =>
            dmpsApi.restore(id, number, rev),
          );
          if (ok)
            set({
              restoredFrom:
                number === get().activeVersion()?.number ? null : number,
            });
          return ok;
        },

        submitForApproval: () =>
          act("The plan wasn't submitted", (id, rev) =>
            dmpsApi.submit(id, rev),
          ),

        finalize: () =>
          act("The plan wasn't finalized", (id, rev) =>
            dmpsApi.finalize(id, rev),
          ),

        approveDmp: async (dmpId, approver, note) => {
          try {
            const record = await get().refreshDmp(dmpId);
            const pending = record?.versions.find(
              (v) => v.status === "pending",
            );
            if (!pending) return false;
            await dmpsApi.approve(
              dmpId,
              pending.number,
              approver.position,
              note,
            );
            await get().refreshDmp(dmpId);
            return true;
          } catch (err) {
            return fail("The plan wasn't approved", err);
          }
        },

        returnDmp: async (dmpId, approver, note) => {
          try {
            const record = await get().refreshDmp(dmpId);
            const pending = record?.versions.find(
              (v) => v.status === "pending",
            );
            if (!pending) return false;
            await dmpsApi.reject(
              dmpId,
              pending.number,
              approver.position,
              note,
            );
            await get().refreshDmp(dmpId);
            return true;
          } catch (err) {
            return fail("The plan wasn't sent back", err);
          }
        },

        markTasksGenerated: (dmpId = get().currentDmpId) =>
          set((state) => ({
            tasksGenerated:
              dmpId === state.currentDmpId ? true : state.tasksGenerated,
            dmps: state.dmps.map((d) =>
              d.dmp_id === dmpId ? { ...d, tasks_generated: true } : d,
            ),
          })),

        setField: (key, value) =>
          edit((state) => ({
            draft: { ...state.draft, [key]: value },
            provenance: withoutProvenance(state.provenance, [String(key)]),
          })),

        addContributor: () =>
          edit((state) => {
            const list = state.draft.contributor ?? [];
            const next = createEmptyContributor();
            if (list.length === 0) next.is_contact = true;
            return { draft: { ...state.draft, contributor: [...list, next] } };
          }),

        updateContributor: (id, patch) =>
          edit((state) => ({
            draft: {
              ...state.draft,
              contributor: (state.draft.contributor ?? []).map((c) =>
                c.contributor_id === id ? { ...c, ...patch } : c,
              ),
            },
          })),

        removeContributor: (id) =>
          edit((state) => ({
            draft: {
              ...state.draft,
              contributor: (state.draft.contributor ?? []).filter(
                (c) => c.contributor_id !== id,
              ),
            },
          })),

        setPrimaryContact: (id) =>
          edit((state) => ({
            draft: {
              ...state.draft,
              contributor: (state.draft.contributor ?? []).map((c) => ({
                ...c,
                is_contact: c.contributor_id === id,
              })),
            },
          })),

        addCost: () =>
          edit((state) => ({
            draft: {
              ...state.draft,
              cost: [...(state.draft.cost ?? []), createEmptyCost()],
            },
          })),

        updateCost: (id, patch) =>
          edit((state) => ({
            draft: {
              ...state.draft,
              cost: (state.draft.cost ?? []).map((c) =>
                c.cost_id === id ? { ...c, ...patch } : c,
              ),
            },
          })),

        removeCost: (id) =>
          edit((state) => ({
            draft: {
              ...state.draft,
              cost: (state.draft.cost ?? []).filter((c) => c.cost_id !== id),
            },
          })),

        addDataset: (type) =>
          edit((state) => ({
            draft: {
              ...state.draft,
              dataset: [
                ...(state.draft.dataset ?? []),
                createEmptyDataset(type),
              ],
            },
          })),

        datasetExists: (dmpId, datasetId) => {
          const state = get();
          const record = state.dmps.find((d) => d.dmp_id === dmpId);
          // A plan in force answers from the content the server shares for
          // it, so an output removed in an unapproved edit still exists.
          const list = record?.active_version
            ? record.review_snapshot?.dataset
            : state.currentDmpId === dmpId
              ? state.draft.dataset
              : record?.draft.dataset;
          return (list ?? []).some((d) => d.dataset_id === datasetId);
        },

        updateDataset: (id, patch) =>
          edit((state) => {
            const index = (state.draft.dataset ?? []).findIndex(
              (d) => d.dataset_id === id,
            );
            return {
              draft: {
                ...state.draft,
                dataset: (state.draft.dataset ?? []).map((d) =>
                  d.dataset_id === id ? ({ ...d, ...patch } as Dataset) : d,
                ),
              },
              provenance: withoutProvenance(
                state.provenance,
                Object.keys(patch).map((k) => `dataset[${index}].${k}`),
              ),
            };
          }),

        removeDataset: (id) =>
          edit((state) => ({
            draft: {
              ...state.draft,
              dataset: (state.draft.dataset ?? []).filter(
                (d) => d.dataset_id !== id,
              ),
            },
          })),

        changeDatasetDomain: (id, domain) =>
          edit((state) => ({
            draft: {
              ...state.draft,
              dataset: (state.draft.dataset ?? []).map((d) => {
                if (d.dataset_id !== id) return d;
                // Profiles are strict: values the new domain has no field
                // for would fail validation forever, so they go.
                const known = new Set(
                  getDomainProfile(domain).fields.map((f) => f.key),
                );
                return {
                  ...d,
                  domain,
                  domain_metadata: Object.fromEntries(
                    Object.entries(d.domain_metadata ?? {}).filter(([key]) =>
                      known.has(key),
                    ),
                  ),
                };
              }),
            },
          })),

        changeDatasetType: (id, type) =>
          edit((state) => ({
            draft: {
              ...state.draft,
              dataset: (state.draft.dataset ?? []).map((d) => {
                if (d.dataset_id !== id) return d;
                const fresh = createEmptyDataset(type);
                const {
                  type: _old,
                  schema_fields: _fields,
                  ...kept
                } = d as Dataset & { schema_fields?: unknown };
                return { ...fresh, ...kept, type } as Dataset;
              }),
            },
          })),

        draftFor: (scope) => {
          const state = get();
          if (scope === state.currentDmpId) return state.draft;
          return state.dmps.find((d) => d.dmp_id === scope)?.draft;
        },

        analyzeProposal: async ({
          projectId,
          fileId,
          direction,
          replace,
          signal,
        }) => {
          const from = get().currentDmpId;
          try {
            const result = await analyzeProposalStream(
              {
                project_id: projectId,
                file_id: fileId,
                ...(replace ? { dmp_id: replace } : {}),
                ...(direction?.trim() ? { direction: direction.trim() } : {}),
              },
              { signal },
            );
            const dmpId = result.dmpId ?? replace;
            if (!dmpId) throw new Error("The analysis didn't produce a plan.");
            // Still where they started? Then take them to the new plan.
            const opened = get().currentDmpId === from;
            if (opened) get().openDmp(dmpId);
            const record = await get().refreshDmp(dmpId);
            // The server doesn't report coverage; a draft that leaves much of
            // the submission checklist open counts as thin.
            const unmet = record?.readiness?.unmet_items.length ?? 0;
            const coverage: Coverage = unmet > 3 ? "low" : "ok";
            set({ coverage });
            void get()
              .loadLibrary()
              .catch(() => undefined);
            return { coverage, dmpId, opened };
          } finally {
            syncQuota();
          }
        },

        startManual: async (projectId) => {
          try {
            const plan = await dmpsApi.create(projectId);
            get().openDmp(plan.dmp_id);
            load(plan);
            return plan.dmp_id;
          } catch (err) {
            fail("Couldn't start a new plan", err);
            return undefined;
          }
        },

        regenerateField: async (target, label, direction) => {
          const id = get().currentDmpId;
          if (!id) return;
          const field = fieldOf(get().draft, target);
          // Free text only; the researcher's own words only reworded.
          const mode = regenerateMode(field.policy);
          if (!mode || !field.path) return;
          const current = typeof field.value === "string" ? field.value : "";
          if (
            mode === "polish" &&
            (!current.trim() || !isWordingOnly(direction))
          )
            return;
          const flag = regenerateFlag(target);
          set((s) => ({
            regeneratingFields: { ...s.regeneratingFields, [flag]: true },
          }));
          try {
            if (!(await get().flushDraft())) return;
            await runAiAction(id, "regenerate-field", {
              path: field.path,
              label,
              mode,
              current_text: current,
              direction:
                direction.kind === "custom" || direction.kind === "emphasize"
                  ? `${direction.kind}: ${direction.detail}`
                  : direction.kind,
            });
            // The suggestion is on the plan's thread; it shows under the field.
            await useAiThread.getState().reload(id);
            useToastStore.getState().toast({
              title: `${label}: suggestion ready`,
              description:
                "Review it under the field. Nothing changes until you accept it.",
            });
          } catch (err) {
            reportAiError(err, {
              what: `regenerate ${label}`,
              retry: () => void get().regenerateField(target, label, direction),
            });
          } finally {
            set((s) => ({
              regeneratingFields: { ...s.regeneratingFields, [flag]: false },
            }));
            syncQuota();
          }
        },

        eligibleBatchTargets: () => {
          const { draft } = get();
          const targets: BatchTarget[] = [];
          // The per-field rule, "rewrite" side only: the researcher's own
          // text is polished one field at a time, where they can see it.
          const prose = (policies: Record<string, FieldPolicy>) =>
            Object.keys(policies).filter(
              (key) =>
                !key.includes(".") &&
                regenerateMode(policies[key]) === "rewrite",
            );
          const text = (value: unknown) =>
            typeof value === "string" ? value : "";

          prose(dmpFieldPolicy).forEach((key) => {
            targets.push({
              id: `dmp:${key}`,
              scope: "dmp",
              key,
              label: `Plan ${batchLabel(key).toLowerCase()}`,
              group: "Plan details",
              value: text(draft[key as keyof DmpDraft]),
            });
          });
          (draft.dataset ?? []).forEach((d) => {
            prose(datasetFieldPolicy).forEach((key) => {
              targets.push({
                id: `dataset:${d.dataset_id}:${key}`,
                scope: "dataset",
                datasetId: d.dataset_id as string,
                key,
                label: batchLabel(key),
                group: d.title || "Untitled output",
                value: text(d[key as keyof Dataset]),
              });
            });
          });
          return targets.filter((t) => t.value.trim().length > 0);
        },

        closeDraft: async () => {
          const id = get().currentDmpId;
          const record = get().dmps.find((d) => d.dmp_id === id);
          const clear = () => {
            lastSaved = {};
            set({
              currentDmpId: null,
              draft: emptyDraft,
              status: "draft",
              draftRevision: 0,
              saveState: "saved",
              coverage: null,
              provenance: null,
              restoredFrom: null,
            });
          };
          if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
          }
          if (!id) {
            clear();
            return "cleared";
          }
          try {
            if (record && record.versions.length > 0) {
              // Submitted: only the unsubmitted edits go.
              await dmpsApi.discard(id);
              await get().refreshDmp(id);
              clear();
              return "discarded";
            }
            // Never submitted: set aside, never deleted.
            putRecord(toRecord(await dmpsApi.archive(id)));
            clear();
            return "archived";
          } catch (err) {
            fail("Couldn't leave the plan", err);
            return "kept";
          }
        },
      };
    },
    {
      name: storageKey("dmps"),
      storage: jsonStorage,
      version: 4,
      // Only which plan was open: the server holds everything else.
      partialize: (state) => ({ currentDmpId: state.currentDmpId }),
      migrate: () => ({ currentDmpId: null }),
    },
  ),
);

// One account's plans never outlive its session in a shared tab.
onSessionChange(() => {
  lastSaved = {};
  useDmpStore.setState({
    dmps: [],
    libraryStatus: "idle",
    currentDmpId: null,
    draft: emptyDraft,
    status: "draft",
    draftRevision: 0,
    saveState: "saved",
    coverage: null,
    provenance: null,
    restoredFrom: null,
  });
});
