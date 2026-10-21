import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import type { DmpDraft } from "@/types/dmp";
import type { Dataset } from "@/types/dataset";
import type { Contributor, Cost } from "@/types/contributor";
import type { z } from "zod";
import type { DmpStatus as DmpStatusEnum } from "@/schemas/shared";

type DmpStatus = z.infer<typeof DmpStatusEnum>;
import {
  aiApi,
  describeDirection,
  estimateCost,
  isWordingOnly,
  type Coverage,
  type RegenerateDirection,
} from "@/api/aiApi";
import { useToastStore } from "@/store/toastStore";
import { sameValue } from "@/utils/sameValue";
import { AiError, totalTokens, type ProvenanceMap } from "@/api/aiContract";
import {
  recordAiEvent,
  scopeKey,
  useAiThread,
  UNSCOPED,
} from "@/store/aiThread";
import { useQuotaStore, formatTokensLeft } from "@/store/quotaStore";
import { useAssistantStore } from "@/store/assistantStore";
import { reportAiError, syncQuota } from "@/store/aiErrors";
import { flagDrift, runToolCall } from "@/store/chatTools";
import { notify } from "@/store/notificationStore";
import type { CreateNotification } from "@/types/notification";
import { actingUserId } from "@/config/current-user";
import {
  regenerateMode,
  dmpFieldPolicy,
  datasetFieldPolicy,
  type FieldPolicy,
} from "@/config/field-policy";
import { getDomainProfile } from "@/schemas/dataset/domain-profiles";
import {
  freezeSubmittedModes,
  isActive,
  resolvePlanMode,
} from "@/config/plan-mode";
import { useProjectStore } from "@/store/projectStore";
import type { PlanMode } from "@/types/project";
import { EditType, VersionStatus } from "@/schemas/shared";
import {
  applyChanges,
  diffPlans,
  editTypeOf,
  sameAt,
  type FieldChange,
} from "@/config/plan-diff";

export interface BatchTarget {
  id: string;
  scope: "dmp" | "dataset";
  datasetId?: string;
  /** A free-text field the AI writes outright (`regenerateMode` "apply"). */
  key: string;
  label: string;
  group: string;
  value: string;
}

const makeId = () => Math.random().toString(36).substring(2, 10);

/** A dataset only moves forward through these. */
const DATASET_STATUS_ORDER: Dataset["status"][] = [
  "planned",
  "collected",
  "processed",
  "preserved",
  "shared",
];

/** Which lifecycle stage finishing a task implies for its dataset. */
const STATUS_FOR_STAGE: Record<string, Dataset["status"]> = {
  collect: "collected",
  process: "processed",
  analyse: "processed",
  preserve: "preserved",
  share: "shared",
};

/**
 * A saved plan in the researcher's library. `draft` carries the whole plan so a
 * record can be reopened in the editor; the summary fields on top are what the
 * list screen searches, filters, and sorts on without walking the payload.
 */
/** Who decided a version, as it stood when they decided it. */
export interface Approver {
  /** Set when the approver is a member of the project's committee. */
  user_id?: string;
  name: string;
  position: string;
  mbox?: string;
}

/**
 * A numbered revision. Only edits that carry a commitment make one — see
 * plan-diff: a minor edit is applied to the version in force and logged on it.
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
  /**
   * The committee member who made the decision, recorded at the time — the
   * exports name them, and a later change of committee doesn't rewrite it.
   */
  approver?: Approver;
  /** Why it came back, when it came back. */
  note?: string;
  /** Minor edits folded into this version without re-review. */
  minor_edits: {
    at: Date;
    by: string;
    changes: FieldChange[];
    /** Set when the edit brought back an earlier version's content. */
    restored_from?: number;
    /** Set when the fix was made while this revision number waited. */
    during_pending?: number;
  }[];
  /** Set when this revision brought back an earlier version's content. */
  restored_from?: number;
  /**
   * The version in force when this revision was submitted, as it was then.
   * Minor fixes made to that version while this one waited are the difference
   * between this and its current snapshot, and are merged in on approval.
   */
  based_on?: { number: number; snapshot: DmpDraft };
  /** Minor fixes merged in from the version in force when this was approved. */
  carried_minor_edits?: FieldChange[];
  /** Fixes that couldn't be merged (their output was removed by this version). */
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
  dataset_count: number;
  contributor_count: number;
  tasks_generated: boolean;
  draft: DmpDraft;
  /** Where the AI's drafted values came from, when the analysis said. */
  provenance?: ProvenanceMap;
  versions: PlanVersion[];
  /** The version tasks and progress run against. */
  active_version?: number;
  /**
   * Set when the plan was archived. Plans are never deleted: a plan's tasks
   * and their evidence are the record of work actually done.
   */
  archived_at?: Date;
  /**
   * Pinned when the plan is first submitted, so the route it's on can't change
   * underneath it if its project's mode changes or the project is deleted.
   */
  plan_mode?: PlanMode;
}

const summarise = (draft: DmpDraft) => ({
  title: draft.title?.trim() || "Untitled DMP",
  description: draft.description?.trim() || "",
  language: draft.language,
  project_id: draft.project_id,
  dataset_count: draft.dataset?.length ?? 0,
  contributor_count: draft.contributor?.length ?? 0,
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Seed library; stands in for plans fetched from the API. */
const seedDmps = (): DmpRecord[] => {
  const seeds: {
    dmp_id: string;
    status: DmpStatus;
    created: number;
    updated: number;
    tasks_generated?: boolean;
    /** Sent to the committee as v1 and still waiting on them. */
    submitted?: boolean;
    draft: DmpDraft;
  }[] = [
    {
      dmp_id: "dmp-pollinator",
      status: "approved",
      created: 96,
      updated: 12,
      tasks_generated: true,
      draft: {
        project_id: "proj-1",
        title: "Urban Pollinator Genomics Data Management Plan",
        description:
          "Sequencing and trait data for bee populations across three city districts, shared under CC-BY once the embargo lifts.",
        language: "eng",
        // Stable ids: the seeded tasks point at these, and a random id would
        // make every seeded task an orphan of an output that never existed.
        dataset: [
          {
            ...createEmptyDataset("raw"),
            dataset_id: "ds-pollinator-reads",
            title: "Pollinator genomic sequence reads",
          },
          {
            ...createEmptyDataset("publication"),
            dataset_id: "ds-pollinator-paper",
            title: "Population genomics manuscript",
          },
        ],
        contributor: [createEmptyContributor()],
      },
    },
    {
      dmp_id: "dmp-sediment",
      status: "pending",
      created: 40,
      updated: 3,
      draft: {
        project_id: "proj-2",
        title: "Coastal Sediment Archive DMP",
        description:
          "Core sample measurements and imagery from the 2025 survey season, ready for the researcher to finalize.",
        language: "eng",
        dataset: [createEmptyDataset("raw")],
        contributor: [createEmptyContributor()],
      },
    },
    {
      dmp_id: "dmp-sensor-pilot",
      status: "draft",
      created: 9,
      updated: 9,
      draft: {
        project_id: "proj-2",
        title: "Sensor Pilot Study",
        description:
          "Early draft covering the low-cost air-quality sensor trial. Datasets are still being scoped.",
        language: "eng",
        dataset: [],
        contributor: [],
      },
    },
    {
      dmp_id: "dmp-soil",
      status: "pending",
      created: 6,
      updated: 2,
      submitted: true,
      draft: {
        project_id: "proj-3",
        title: "Soil Microbiome Survey DMP",
        description:
          "16S amplicon reads and soil chemistry from 40 paddy plots, deposited openly once the main paper is accepted.",
        language: "eng",
        begin_date: new Date("2026-11-01T00:00:00"),
        end_date: new Date("2028-10-31T00:00:00"),
        ethical_issues_exist: false,
        contributor: [
          {
            contributor_id: "ct-soil-pi",
            title: "Dr.",
            name: "Aran",
            surname: "Suwannachot",
            role: "Principal investigator",
            email: "aran@example.edu",
            is_contact: true,
          },
        ],
        cost: [],
        dataset: [
          {
            ...createEmptyDataset("raw"),
            dataset_id: "ds-soil-reads",
            title: "16S amplicon sequence reads",
            description: "Raw FASTQ reads from 40 plots, two seasons.",
            access: "open",
            protection_level: "Standard",
            security_classification_level: "Public",
            keyword: ["soil", "microbiome", "16S"],
          },
          {
            ...createEmptyDataset("raw"),
            dataset_id: "ds-soil-chem",
            title: "Soil chemistry measurements",
            description: "pH, organic carbon and nitrogen per plot.",
            access: "shared",
            protection_level: "Standard",
            security_classification_level: "Internal",
          },
        ],
        schema_version: "FAIRer maDMP 1.2",
      },
    },
  ];

  const records = seeds.map((seed) => {
    const created = daysAgo(seed.created);
    // A plan that is already active got there through a version; without one
    // there would be nothing to diff the next edit against.
    const versions: PlanVersion[] = isActive(seed.status)
      ? [
          {
            number: 1,
            status: "approved",
            edit_type: "major",
            changes: [],
            snapshot: seed.draft,
            created_at: created,
            decided_at: daysAgo(seed.updated),
            minor_edits: [],
          },
        ]
      : seed.submitted
        ? [
            {
              number: 1,
              status: "pending",
              edit_type: "major",
              changes: [],
              snapshot: seed.draft,
              created_at: daysAgo(seed.updated),
              minor_edits: [],
            },
          ]
        : [];

    return {
      dmp_id: seed.dmp_id,
      status: seed.status,
      created_at: created,
      updated_at: daysAgo(seed.updated),
      tasks_generated: seed.tasks_generated ?? false,
      draft: seed.draft,
      versions,
      active_version: versions.length > 0 ? 1 : undefined,
      ...summarise(seed.draft),
    };
  });
  // Seeded plans past draft were "submitted" before the app ran; freeze them.
  return freezeSubmittedModes(records, useProjectStore.getState().projects);
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
 * The library as the list screen sees it. The plan open in the editor is not
 * copied into `dmps` on every keystroke — it's projected over its record here,
 * so there's one source of truth and no stale row.
 */
export const buildDmpList = (state: {
  dmps: DmpRecord[];
  draft: DmpDraft;
  status: DmpStatus;
  currentDmpId: string | null;
  draftCreatedAt: Date;
  draftUpdatedAt: Date;
  tasksGenerated: boolean;
  /** Archived plans are left out unless asked for (My DMPs' Archived filter). */
  includeArchived?: boolean;
}): DmpRecord[] => {
  const { dmps, draft, status, currentDmpId } = state;
  const live = draftHasContent(draft);
  const inLibrary = dmps.some((d) => d.dmp_id === currentDmpId);

  const list = dmps.map((record) =>
    live && record.dmp_id === currentDmpId
      ? {
          ...record,
          ...summarise(draft),
          status,
          tasks_generated: state.tasksGenerated,
          updated_at: state.draftUpdatedAt,
          draft,
        }
      : record,
  );

  if (live && currentDmpId && !inLibrary) {
    list.unshift({
      dmp_id: currentDmpId,
      status,
      created_at: state.draftCreatedAt,
      updated_at: state.draftUpdatedAt,
      tasks_generated: state.tasksGenerated,
      draft,
      // Not yet submitted, so it has no versions behind it.
      versions: [],
      ...summarise(draft),
    });
  }

  return state.includeArchived ? list : list.filter((d) => !d.archived_at);
};

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

interface DmpDraftState {
  draft: DmpDraft;
  regeneratingFields: Record<string, boolean>;
  coverage: Coverage | null;
  aiGenerated: boolean;
  /**
   * Per-field provenance for the open plan, as the analysis returned it.
   * Null when there is none — the form then claims nothing about sources.
   */
  provenance: ProvenanceMap | null;
  status: DmpStatus;
  tasksGenerated: boolean;

  /** Saved plans, every status. The one being edited is `currentDmpId`. */
  dmps: DmpRecord[];
  currentDmpId: string | null;
  draftCreatedAt: Date;
  draftUpdatedAt: Date;

  /** Files the open draft back into the library and checks out another. */
  openDmp: (id: string) => DmpRecord | undefined;
  /**
   * Sets a plan aside. Refused while the plan is in force — its tasks and
   * evidence are live work. There is deliberately no way to delete a plan.
   */
  archiveDmp: (id: string) => ArchiveResult;
  unarchiveDmp: (id: string) => void;

  /** The version tasks and progress run against, if the plan is active yet. */
  activeVersion: () => PlanVersion | undefined;
  /** A numbered revision waiting on a decision, if one is in flight. */
  pendingVersion: () => PlanVersion | undefined;
  /** What the open draft changes, measured against the version in force. */
  pendingChanges: () => FieldChange[];
  /** Minor-only edits go straight in, recorded against the active version. */
  saveMinorEdits: () => void;
  /** Anything major becomes the next numbered version, awaiting a decision. */
  /**
   * Submits the draft's major changes as the next version. Refused while
   * another revision is waiting: one decision at a time.
   */
  submitRevision: () => boolean;
  /**
   * What the draft changes that isn't already with the committee. With no
   * revision waiting, that's every change against the version in force; with
   * one waiting, only edits that match neither the version in force nor the
   * frozen revision.
   */
  newEdits: () => FieldChange[];
  /** Sends a pending revision back with a reason; the draft stays editable. */
  rejectRevision: (note: string, approver?: Approver) => void;
  /**
   * Loads a version's content into the working draft. Restoring the version in
   * force discards unsubmitted edits; restoring any other version is an
   * ordinary edit from then on — judged minor or major, saved or submitted
   * like any other. A version still waiting on a decision can't be restored.
   * Returns false when there's nothing to restore.
   */
  restoreVersion: (number: number) => boolean;
  /** The version the working draft was last restored from, if any. */
  restoredFrom: number | null;

  submitForApproval: () => void;
  /** Stand-in for the committee decision until their screens exist. */
  approve: (approver?: Approver) => void;
  /**
   * The committee's decision on whichever version of `dmpId` is waiting, from
   * the review queue — the plan needn't be the one open in the editor. Runs
   * the same path as `approve`, so carried-over fixes and the working copy
   * are handled identically. False when nothing is waiting.
   */
  approveDmp: (dmpId: string, approver: Approver, note?: string) => boolean;
  /**
   * Hands the waiting version of `dmpId` back with a reason. A revision leaves
   * the version in force running; a first submission goes back to draft.
   */
  returnDmp: (dmpId: string, approver: Approver, note: string) => boolean;
  /** The independent route to the same active state — no committee, no approval record. */
  finalize: () => void;
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
  /** False once an output has been dropped from the plan it belonged to. */
  datasetExists: (dmpId: string, datasetId: string) => boolean;
  /**
   * A finished task moves its dataset along the lifecycle. Status only ever
   * advances, so reopening a task never walks a dataset backwards.
   */
  advanceDatasetStatus: (
    dmpId: string,
    datasetId: string,
    stage: "collect" | "process" | "analyse" | "preserve" | "share",
  ) => void;
  removeDataset: (id: string) => void;
  changeDatasetType: (id: string, type: Dataset["type"]) => void;
  /** Switching domain drops metadata the new profile has no field for. */
  changeDatasetDomain: (id: string, domain: Dataset["domain"]) => void;

  /** A plan's working copy by thread scope — the open one, or its record. */
  draftFor: (scope: string) => DmpDraft | undefined;
  analyzeProposal: (
    file: File,
    projectId?: string,
    /** A steer from the researcher, used when the document is thin. */
    direction?: string,
    opts?: {
      signal?: AbortSignal;
      /** Draft this plan again in place, if it's still the open one. */
      replace?: string;
    },
  ) => Promise<{
    coverage: Coverage;
    dmpId: string;
    /** False when the person had moved to another plan meanwhile. */
    opened: boolean;
  }>;
  startManual: (projectId?: string) => void;
  /**
   * Rewrites one free-text field; anything else is refused. The AI's own
   * text is written in; the researcher's comes back as a suggestion.
   */
  regenerateField: (
    target: RegenerateTarget,
    label: string,
    direction: RegenerateDirection,
  ) => Promise<void>;

  eligibleBatchTargets: () => BatchTarget[];

  /**
   * Leaves the editor. A plan in force keeps everything and only loses
   * unsubmitted edits; an unsubmitted plan is archived, not deleted.
   */
  closeDraft: () => "discarded" | "kept" | "archived" | "cleared";
}

const emptyDraft: DmpDraft = {};

/** Who hears about a decision on a plan: the researcher on its project. */
const researcherIdFor = (projectId?: string) =>
  useProjectStore.getState().getResearcherFor(projectId)?.user_id ??
  actingUserId();

/** Every reviewer gets the same queue, so every reviewer hears of a new item. */
const notifyReviewers = (input: Omit<CreateNotification, "user_id">) =>
  useProjectStore
    .getState()
    .getReviewers()
    .forEach((reviewer) =>
      notify({ ...input, user_id: reviewer.user_id as string }),
    );

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

/** How to read, address and write one regenerable field. */
const fieldAccess = (target: RegenerateTarget) => {
  if (typeof target === "string")
    return {
      flag: regenerateFlag(target),
      policy: dmpFieldPolicy[target],
      read: (draft: DmpDraft) => draft[target],
      path: (_draft: DmpDraft): string | null => target,
      write: (store: DmpDraftState, value: unknown) =>
        store.setField(target, value as never),
    };
  const { datasetId, field } = target;
  const find = (draft: DmpDraft) =>
    (draft.dataset ?? []).find((d) => d.dataset_id === datasetId);
  const indexIn = (draft: DmpDraft) =>
    (draft.dataset ?? []).findIndex((d) => d.dataset_id === datasetId);
  const isStatement = field === "preservation.statement";
  return {
    flag: regenerateFlag(target),
    policy: datasetFieldPolicy[field],
    read: (draft: DmpDraft) =>
      isStatement ? find(draft)?.preservation?.statement : find(draft)?.[field],
    path: (draft: DmpDraft): string | null => {
      const i = indexIn(draft);
      return i < 0 ? null : `dataset[${i}].${field}`;
    },
    write: (store: DmpDraftState, value: unknown) =>
      store.updateDataset(
        datasetId,
        (isStatement
          ? {
              preservation: {
                ...find(store.draft)?.preservation,
                statement: value,
              },
            }
          : { [field]: value }) as Partial<Dataset>,
      ),
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

/** Writes the open draft into the library, inserting it if it's new. */
const commitDraft = (state: {
  dmps: DmpRecord[];
  draft: DmpDraft;
  status: DmpStatus;
  currentDmpId: string | null;
  draftCreatedAt: Date;
  draftUpdatedAt: Date;
  tasksGenerated: boolean;
  provenance?: ProvenanceMap | null;
}): DmpRecord[] => {
  if (!state.currentDmpId || !draftHasContent(state.draft)) return state.dmps;

  const existing = state.dmps.find((d) => d.dmp_id === state.currentDmpId);

  const record: DmpRecord = {
    dmp_id: state.currentDmpId,
    status: state.status,
    created_at: state.draftCreatedAt,
    updated_at: state.draftUpdatedAt,
    tasks_generated: state.tasksGenerated,
    draft: state.draft,
    provenance: state.provenance ?? undefined,
    // Version history belongs to the record, not to the open editor.
    versions: existing?.versions ?? [],
    active_version: existing?.active_version,
    plan_mode: existing?.plan_mode,
    archived_at: existing?.archived_at,
    ...summarise(state.draft),
  };

  return state.dmps.some((d) => d.dmp_id === record.dmp_id)
    ? state.dmps.map((d) => (d.dmp_id === record.dmp_id ? record : d))
    : [record, ...state.dmps];
};

export const useDmpStore = create<DmpDraftState>()(
  persist(
    (rawSet, get) => {
      // Every mutator already returns a new `draft`; stamping the edit time here
      // keeps "Last updated" honest without touching each one.
      //
      // A draft begun with no plan open gets its id the moment it has content,
      // so it can be filed — and whatever was said to the assistant about it
      // while it had none is adopted into its thread.
      const set: typeof rawSet = ((partial, replace) => {
        let minted: string | null = null;
        rawSet((state) => {
          let next =
            typeof partial === "function"
              ? (partial as (s: DmpDraftState) => Partial<DmpDraftState>)(state)
              : partial;
          if (!next || !("draft" in next)) return next;
          if (
            !state.currentDmpId &&
            !("currentDmpId" in next) &&
            next.draft &&
            draftHasContent(next.draft)
          ) {
            minted = makeId();
            next = {
              ...next,
              currentDmpId: minted,
              draftCreatedAt: new Date(),
            };
          }
          return "draftUpdatedAt" in next
            ? next
            : { ...next, draftUpdatedAt: new Date() };
        }, replace as false);
        if (minted) useAiThread.getState().adopt(UNSCOPED, minted);
      }) as typeof rawSet;

      /**
       * Moves whichever revision is waiting into force. With nothing waiting
       * — the independent researcher finalizing their own edits — the pending
       * version is created and decided in the same move, since there is no one
       * else for it to wait on.
       */
      /**
       * Version history lives on the library record, so the open plan has to
       * be filed there first — a plan fresh from analysis isn't yet, and its
       * versions (and who approved them) would otherwise go nowhere.
       */
      const fileOpenPlan = () =>
        rawSet((state) => ({ dmps: commitDraft(state) }));

      /** The mode to pin on first submission: the project's, as it is now. */
      const pinnedMode = (record: DmpRecord | undefined, projectId?: string) =>
        record?.plan_mode ??
        resolvePlanMode(useProjectStore.getState().projects, projectId);

      const activate = (decidedBy: string, approver?: Approver) => {
        fileOpenPlan();
        const state = get();
        const record = state.dmps.find((d) => d.dmp_id === state.currentDmpId);
        const waiting = record?.versions.find((v) => v.status === "pending");
        const changes = waiting ? waiting.changes : state.pendingChanges();
        // Edits in the working copy beyond both the version in force and the
        // revision being decided — the only part of it that's still news.
        const unsubmitted = waiting?.based_on ? state.newEdits() : [];

        const number =
          waiting?.number ??
          Math.max(0, ...(record?.versions ?? []).map((v) => v.number)) + 1;

        // Fixes made to the version in force while this waited would be lost
        // if its frozen snapshot simply replaced it, so they're replayed in.
        const inForce = record?.versions.find(
          (v) => v.number === record.active_version,
        );
        const merge =
          waiting?.based_on && inForce
            ? applyChanges(
                waiting.snapshot,
                inForce.snapshot,
                diffPlans(waiting.based_on.snapshot, inForce.snapshot),
              )
            : undefined;

        const decided = {
          number,
          status: "approved" as const,
          edit_type: editTypeOf(changes),
          changes,
          snapshot: merge?.plan ?? waiting?.snapshot ?? state.draft,
          based_on: waiting?.based_on,
          carried_minor_edits: merge?.applied.length
            ? merge.applied
            : undefined,
          dropped_minor_edits: merge?.skipped.length
            ? merge.skipped
            : undefined,
          created_at: waiting?.created_at ?? new Date(),
          decided_at: new Date(),
          decided_by: decidedBy,
          approver,
          minor_edits: waiting?.minor_edits ?? [],
          restored_from:
            waiting?.restored_from ?? state.restoredFrom ?? undefined,
        };

        // Rebase the working copy onto what's now in force: its approved
        // content, plus only those unsubmitted edits. Left as it was, a copy
        // that didn't carry the revision would read as an edit undoing it.
        const rebased = waiting?.based_on
          ? applyChanges(decided.snapshot, state.draft, unsubmitted).plan
          : undefined;

        set((current) => ({
          status: "approved",
          restoredFrom: null,
          ...(rebased ? { draft: rebased } : {}),
          dmps: current.dmps.map((d) =>
            d.dmp_id === current.currentDmpId
              ? {
                  ...d,
                  status: "approved" as const,
                  active_version: number,
                  plan_mode: pinnedMode(d, current.draft.project_id),
                  versions: waiting
                    ? d.versions.map((v) => (v.number === number ? decided : v))
                    : [...d.versions, decided],
                }
              : d,
          ),
        }));
      };

      /**
       * Runs `work` with `dmpId` as the open plan, then puts the editor back as
       * it was. Decisions reuse the open-plan paths above rather than a second
       * copy of their rules; in a real deployment the committee has its own
       * client, and this swap is only how one shared browser stands in for two.
       */
      const withPlanOpen = <T>(dmpId: string, work: () => T): T | undefined => {
        const before = get();
        if (before.currentDmpId === dmpId) return work();

        const editor = {
          draft: before.draft,
          status: before.status,
          currentDmpId: before.currentDmpId,
          draftCreatedAt: before.draftCreatedAt,
          draftUpdatedAt: before.draftUpdatedAt,
          tasksGenerated: before.tasksGenerated,
          coverage: before.coverage,
          provenance: before.provenance,
          aiGenerated: before.aiGenerated,
          restoredFrom: before.restoredFrom,
        };
        if (!get().openDmp(dmpId)) return undefined;
        const result = work();
        fileOpenPlan();

        // The plan that was open comes back from the library, so anything the
        // decision changed on its record is what the editor shows.
        const reopened = editor.currentDmpId
          ? get().dmps.find((d) => d.dmp_id === editor.currentDmpId)
          : undefined;
        rawSet(
          reopened
            ? {
                ...editor,
                draft: reopened.draft,
                status: reopened.status,
                tasksGenerated: reopened.tasks_generated,
              }
            : editor,
        );
        return result;
      };

      return {
        restoredFrom: null,
        draft: emptyDraft,
        regeneratingFields: {},
        coverage: null,
        provenance: null,
        aiGenerated: false,
        status: "draft",
        tasksGenerated: false,

        dmps: seedDmps(),
        currentDmpId: null,
        draftCreatedAt: new Date(),
        draftUpdatedAt: new Date(),

        openDmp: (id) => {
          const state = get();
          const target = state.dmps.find((d) => d.dmp_id === id);
          if (!target) return undefined;

          // Check the open draft back in first, or its edits would be dropped.
          const dmps = commitDraft(state);

          set({
            dmps,
            restoredFrom: null,
            draft: target.draft,
            status: target.status,
            currentDmpId: target.dmp_id,
            draftCreatedAt: target.created_at,
            draftUpdatedAt: target.updated_at,
            coverage: null,
            provenance: target.provenance ?? null,
            aiGenerated: false,
            // Carried on the record, so reopening an approved plan doesn't offer
            // to generate a second set of tasks.
            tasksGenerated: target.tasks_generated,
          });
          return target;
        },

        archiveDmp: (id) => {
          fileOpenPlan();
          const record = get().dmps.find((d) => d.dmp_id === id);
          if (!record)
            return { ok: false, reason: "That plan isn't in your library." };
          if (record.active_version !== undefined)
            return {
              ok: false,
              reason:
                "This plan is in force. Its tasks and evidence are the record of work done, so it can't be archived.",
            };

          set((state) => ({
            dmps: state.dmps.map((d) =>
              d.dmp_id === id ? { ...d, archived_at: new Date() } : d,
            ),
            // Archiving the plan that's open takes it out of the editor.
            ...(state.currentDmpId === id
              ? {
                  draft: emptyDraft,
                  currentDmpId: null,
                  status: "draft" as DmpStatus,
                  restoredFrom: null,
                  coverage: null,
                  provenance: null,
                  aiGenerated: false,
                  tasksGenerated: false,
                }
              : {}),
          }));
          return { ok: true };
        },

        unarchiveDmp: (id) =>
          set((state) => ({
            dmps: state.dmps.map((d) =>
              d.dmp_id === id ? { ...d, archived_at: undefined } : d,
            ),
          })),

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
          const active = get().activeVersion();
          // Before there is an active version there is nothing to diff against:
          // the whole plan is the change.
          return active ? diffPlans(active.snapshot, get().draft) : [];
        },

        newEdits: () => {
          const active = get().activeVersion();
          const waiting = get().pendingVersion();
          if (!active) return [];
          if (!waiting) return get().pendingChanges();
          const draft = get().draft;
          // Beyond the frozen revision, and not simply the version in force.
          return diffPlans(waiting.snapshot, draft).filter(
            (change) =>
              !change.target || !sameAt(draft, active.snapshot, change.target),
          );
        },

        saveMinorEdits: () => {
          fileOpenPlan();
          const waiting = get().pendingVersion();
          const changes = get().newEdits();
          const active = get().activeVersion();
          // The guard, not just the button: a major edit can't be slipped in
          // through the quiet path.
          if (!active || changes.length === 0) return;
          if (editTypeOf(changes) === "major") return;

          set((state) => ({
            dmps: state.dmps.map((d) =>
              d.dmp_id === state.currentDmpId
                ? {
                    ...d,
                    draft: state.draft,
                    ...summarise(state.draft),
                    updated_at: new Date(),
                    versions: d.versions.map((v) =>
                      v.number === active.number
                        ? {
                            ...v,
                            // With a revision waiting, only the fix lands on
                            // the version in force; the revision stays frozen.
                            snapshot: waiting
                              ? applyChanges(v.snapshot, state.draft, changes)
                                  .plan
                              : state.draft,
                            minor_edits: [
                              ...v.minor_edits,
                              {
                                at: new Date(),
                                by: actingUserId(),
                                changes,
                                restored_from: state.restoredFrom ?? undefined,
                                during_pending: waiting?.number,
                              },
                            ],
                          }
                        : v,
                    ),
                  }
                : d,
            ),
            restoredFrom: null,
          }));
        },

        submitRevision: () => {
          fileOpenPlan();
          // One decision at a time: a second revision would be built on a
          // version that may never be approved.
          if (get().pendingVersion()) return false;
          const base = get().activeVersion();
          const changes = get().pendingChanges();
          if (changes.length === 0) return false;

          const { draft, currentDmpId } = get();
          const edit_type = editTypeOf(changes);

          set((state) => ({
            dmps: state.dmps.map((d) => {
              if (d.dmp_id !== state.currentDmpId) return d;
              const next = Math.max(0, ...d.versions.map((v) => v.number)) + 1;
              return {
                ...d,
                draft: state.draft,
                ...summarise(state.draft),
                updated_at: new Date(),
                versions: [
                  ...d.versions,
                  {
                    number: next,
                    status: "pending" as const,
                    edit_type,
                    changes,
                    snapshot: state.draft,
                    created_at: new Date(),
                    minor_edits: [],
                    restored_from: state.restoredFrom ?? undefined,
                    based_on: base
                      ? {
                          number: base.number,
                          snapshot: structuredClone(base.snapshot),
                        }
                      : undefined,
                  },
                ],
              };
            }),
            restoredFrom: null,
          }));

          notify({
            user_id: researcherIdFor(draft.project_id),
            type: "dmp_submitted",
            title: "Revision submitted",
            message: `${draft.title?.trim() || "Your plan"} has changes waiting on a decision. The version in force keeps running.`,
            link: "/dmp/status",
            dmp_id: currentDmpId ?? undefined,
            project_id: draft.project_id,
          });
          notifyReviewers({
            type: "review_requested",
            title: "Revision to review",
            message: `${draft.title?.trim() || "A plan"} has changes that need a decision.`,
            link: `/review/${currentDmpId}`,
            dmp_id: currentDmpId ?? undefined,
            project_id: draft.project_id,
          });
          return true;
        },

        restoreVersion: (number) => {
          fileOpenPlan();
          const state = get();
          const record = state.dmps.find(
            (d) => d.dmp_id === state.currentDmpId,
          );
          const version = record?.versions.find((v) => v.number === number);
          if (!record || !version || version.status === "pending") return false;

          set({
            // A copy: later edits to the draft must never reach the record.
            draft: structuredClone(version.snapshot),
            restoredFrom: number === record.active_version ? null : number,
          });
          return true;
        },

        rejectRevision: (note, approver) => {
          fileOpenPlan();
          set((state) => ({
            dmps: state.dmps.map((d) =>
              d.dmp_id === state.currentDmpId
                ? {
                    ...d,
                    versions: d.versions.map((v) =>
                      v.status === "pending"
                        ? {
                            ...v,
                            status: "rejected" as const,
                            decided_at: new Date(),
                            decided_by: approver?.user_id ?? "committee",
                            approver,
                            note,
                          }
                        : v,
                    ),
                    // Nothing in force to fall back to: a returned first
                    // submission is a draft again, for the researcher to fix.
                    ...(d.active_version === undefined
                      ? { status: "draft" as const }
                      : {}),
                  }
                : d,
            ),
            ...(state.activeVersion() ? {} : { status: "draft" as DmpStatus }),
          }));
        },

        submitForApproval: () => {
          fileOpenPlan();
          // After the plan is active, submitting means raising a revision —
          // the first submission is the only one that isn't one.
          if (get().activeVersion()) {
            get().submitRevision();
            return;
          }

          set((state) => ({
            status: "pending",
            dmps: state.dmps.map((d) =>
              d.dmp_id === state.currentDmpId
                ? {
                    ...d,
                    draft: state.draft,
                    status: "pending" as const,
                    plan_mode: pinnedMode(d, state.draft.project_id),
                    // A plan sent back before keeps that history; this attempt
                    // is numbered after it.
                    versions: [
                      ...d.versions,
                      {
                        number:
                          Math.max(0, ...d.versions.map((v) => v.number)) + 1,
                        status: "pending" as const,
                        edit_type: "major" as const,
                        changes: [],
                        snapshot: state.draft,
                        created_at: new Date(),
                        minor_edits: [],
                      },
                    ],
                  }
                : d,
            ),
          }));
          const { draft, currentDmpId } = get();
          notify({
            user_id: researcherIdFor(draft.project_id),
            type: "dmp_submitted",
            title: "Plan submitted for approval",
            message: `${draft.title?.trim() || "Untitled DMP"} is waiting on the committee.`,
            link: "/dmp/status",
            dmp_id: currentDmpId ?? undefined,
            project_id: draft.project_id,
          });
          notifyReviewers({
            type: "review_requested",
            title: "New plan to review",
            message: `${draft.title?.trim() || "Untitled DMP"} was submitted for approval.`,
            link: `/review/${currentDmpId}`,
            dmp_id: currentDmpId ?? undefined,
            project_id: draft.project_id,
          });
        },

        approve: (approver) => {
          activate(approver?.user_id ?? "committee", approver);
          const { draft, currentDmpId } = get();
          notify({
            user_id: researcherIdFor(draft.project_id),
            type: "dmp_approved",
            title: "Your plan was approved",
            message: `${approver ? `${approver.name} (${approver.position})` : "The committee"} approved ${draft.title?.trim() || "your plan"}.`,
            link: "/dmp/status",
            dmp_id: currentDmpId ?? undefined,
            project_id: draft.project_id,
          });
        },

        approveDmp: (dmpId, approver, note) =>
          withPlanOpen(dmpId, () => {
            const waiting = get().pendingVersion();
            if (!waiting) return false;
            get().approve(approver);
            if (note?.trim())
              rawSet((state) => ({
                dmps: state.dmps.map((d) =>
                  d.dmp_id === dmpId
                    ? {
                        ...d,
                        versions: d.versions.map((v) =>
                          v.number === waiting.number
                            ? { ...v, note: note.trim() }
                            : v,
                        ),
                      }
                    : d,
                ),
              }));
            return true;
          }) ?? false,

        returnDmp: (dmpId, approver, note) =>
          withPlanOpen(dmpId, () => {
            const waiting = get().pendingVersion();
            if (!waiting) return false;
            const { draft } = get();
            get().rejectRevision(note, approver);
            notify({
              user_id: researcherIdFor(draft.project_id),
              type: "dmp_returned",
              title: `Version ${waiting.number} was sent back`,
              message: `${approver.name} (${approver.position}) on ${draft.title?.trim() || "your plan"}: ${note}`,
              link: "/dmps",
              dmp_id: dmpId,
              project_id: draft.project_id,
            });
            return true;
          }) ?? false,

        finalize: () => {
          // Same destination as approve(), reached by the researcher. Nothing
          // downstream can tell the two apart, which is the point.
          activate(actingUserId());
          const { draft, currentDmpId } = get();
          notify({
            user_id: researcherIdFor(draft.project_id),
            type: "dmp_finalized",
            title: "Plan finalized",
            message: `${draft.title?.trim() || "Your plan"} is active. You can break it into tasks now.`,
            link: "/dmp/status",
            dmp_id: currentDmpId ?? undefined,
            project_id: draft.project_id,
          });
        },

        markTasksGenerated: (dmpId = get().currentDmpId) => {
          const open = get().currentDmpId === dmpId;
          // Generation can finish after another plan was opened; the flag
          // and the notice belong to the plan the tasks are for.
          set((state) => ({
            tasksGenerated: open ? true : state.tasksGenerated,
            dmps: state.dmps.map((d) =>
              d.dmp_id === dmpId ? { ...d, tasks_generated: true } : d,
            ),
          }));
          const draft = open
            ? get().draft
            : (get().dmps.find((d) => d.dmp_id === dmpId)?.draft ?? {});
          const currentDmpId = dmpId;
          notify({
            user_id: researcherIdFor(draft.project_id),
            type: "tasks_generated",
            title: "Tasks are ready",
            message: `${draft.title?.trim() || "Your plan"} has been broken into tasks you can track.`,
            link: "/tasks",
            dmp_id: currentDmpId ?? undefined,
            project_id: draft.project_id,
          });
        },

        // Once a person has changed a value it's theirs, wherever it came from.
        setField: (key, value) =>
          set((state) => ({
            draft: { ...state.draft, [key]: value },
            provenance: withoutProvenance(state.provenance, [String(key)]),
          })),

        addContributor: () =>
          set((state) => {
            const list = state.draft.contributor ?? [];
            const next = createEmptyContributor();
            if (list.length === 0) next.is_contact = true;
            return { draft: { ...state.draft, contributor: [...list, next] } };
          }),

        updateContributor: (id, patch) =>
          set((state) => ({
            draft: {
              ...state.draft,
              contributor: (state.draft.contributor ?? []).map((c) =>
                c.contributor_id === id ? { ...c, ...patch } : c,
              ),
            },
          })),

        removeContributor: (id) =>
          set((state) => ({
            draft: {
              ...state.draft,
              contributor: (state.draft.contributor ?? []).filter(
                (c) => c.contributor_id !== id,
              ),
            },
          })),

        setPrimaryContact: (id) =>
          set((state) => ({
            draft: {
              ...state.draft,
              contributor: (state.draft.contributor ?? []).map((c) => ({
                ...c,
                is_contact: c.contributor_id === id,
              })),
            },
          })),

        addCost: () =>
          set((state) => ({
            draft: {
              ...state.draft,
              cost: [...(state.draft.cost ?? []), createEmptyCost()],
            },
          })),

        updateCost: (id, patch) =>
          set((state) => ({
            draft: {
              ...state.draft,
              cost: (state.draft.cost ?? []).map((c) =>
                c.cost_id === id ? { ...c, ...patch } : c,
              ),
            },
          })),

        removeCost: (id) =>
          set((state) => ({
            draft: {
              ...state.draft,
              cost: (state.draft.cost ?? []).filter((c) => c.cost_id !== id),
            },
          })),

        addDataset: (type) =>
          set((state) => ({
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
          const active = record?.versions.find(
            (v) => v.number === record.active_version,
          );
          // A plan in force answers from that version: an output removed in an
          // unapproved edit still exists, and its tasks still run.
          const list = active
            ? active.snapshot.dataset
            : state.currentDmpId === dmpId
              ? state.draft.dataset
              : record?.draft.dataset;
          return (list ?? []).some((d) => d.dataset_id === datasetId);
        },

        advanceDatasetStatus: (dmpId, datasetId, stage) => {
          const target = STATUS_FOR_STAGE[stage];

          const bump = (dataset: Dataset): Dataset =>
            dataset.dataset_id === datasetId &&
            DATASET_STATUS_ORDER.indexOf(target) >
              DATASET_STATUS_ORDER.indexOf(dataset.status)
              ? { ...dataset, status: target }
              : dataset;

          set((state) => ({
            // The plan may be the one open in the editor, filed in the
            // library, or both — keep the two in step.
            draft:
              state.currentDmpId === dmpId
                ? {
                    ...state.draft,
                    dataset: (state.draft.dataset ?? []).map(bump),
                  }
                : state.draft,
            dmps: state.dmps.map((record) =>
              record.dmp_id === dmpId
                ? {
                    ...record,
                    draft: {
                      ...record.draft,
                      dataset: (record.draft.dataset ?? []).map(bump),
                    },
                  }
                : record,
            ),
          }));
        },

        updateDataset: (id, patch) =>
          set((state) => {
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
          set((state) => ({
            draft: {
              ...state.draft,
              dataset: (state.draft.dataset ?? []).filter(
                (d) => d.dataset_id !== id,
              ),
            },
          })),

        changeDatasetDomain: (id, domain) =>
          set((state) => ({
            draft: {
              ...state.draft,
              dataset: (state.draft.dataset ?? []).map((d) => {
                if (d.dataset_id !== id) return d;
                // Profiles are strict, so a value the new domain doesn't know
                // about would fail validation forever. Same-named fields carry
                // over; everything else goes, and the card warns first.
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
          set((state) => ({
            draft: {
              ...state.draft,
              dataset: (state.draft.dataset ?? []).map((d) => {
                if (d.dataset_id !== id) return d;
                const fresh = createEmptyDataset(type);
                return {
                  ...fresh,
                  dataset_id: d.dataset_id,
                  title: d.title,
                  description: d.description,
                  status: d.status,
                  located_at: d.located_at,
                  access: d.access,
                  personal_data: d.personal_data,
                  sensitive_data: d.sensitive_data,
                  personal_data_plan: d.personal_data_plan,
                  protection_level: d.protection_level,
                  protection_level_other_nomenclature:
                    d.protection_level_other_nomenclature,
                  protection_level_other: d.protection_level_other,
                  security_classification_level:
                    d.security_classification_level,
                  security_classification_level_other_nomenclature:
                    d.security_classification_level_other_nomenclature,
                  security_classification_level_other:
                    d.security_classification_level_other,
                  data_quality_assurance: d.data_quality_assurance,
                  keyword: d.keyword,
                  language: d.language,
                  // The research domain is a separate axis from type; a type
                  // change must not reset it.
                  domain: d.domain,
                  domain_metadata: d.domain_metadata,
                  preservation: d.preservation,
                  distribution: d.distribution,
                };
              }),
            },
          })),

        draftFor: (scope) => {
          const state = get();
          if (scope === scopeKey(state.currentDmpId)) return state.draft;
          return state.dmps.find((d) => d.dmp_id === scope)?.draft;
        },

        analyzeProposal: async (file, projectId, direction, opts = {}) => {
          const estimated = estimateCost.analyzeProposal(file);
          const quota = useQuotaStore.getState();
          if (!quota.hasTokensFor(estimated)) {
            const err = new AiError({
              code: "quota_exceeded",
              retryable: false,
              userMessage: `This needs about ${estimated.toLocaleString()} tokens and you have ${formatTokensLeft(quota.tokensLeft())} left.`,
            });
            useToastStore.getState().toast({
              title: "Not enough tokens left",
              description: err.userMessage,
              variant: "destructive",
            });
            throw err;
          }

          // Which plan was open when this was asked. A new plan only takes
          // the editor over if the person is still where they started.
          const openAtRequest = get().currentDmpId;
          const ticket = useAiThread.getState().ticket(openAtRequest);

          try {
            const { draft, coverage, provenance, usage, token_count } =
              await aiApi.analyzeProposal(file, direction, {
                signal: opts.signal,
              });
            const now = new Date();
            const stillHere = get().currentDmpId === openAtRequest;
            // A second pass over the same thin draft replaces it rather than
            // filing a near-copy beside it.
            const replacing =
              stillHere &&
              opts.replace !== undefined &&
              opts.replace === openAtRequest;
            const dmpId = replacing ? (opts.replace as string) : makeId();
            const opened = {
              dmps: [] as DmpRecord[],
              draft: { ...draft, project_id: projectId },
              currentDmpId: dmpId,
              status: "draft" as DmpStatus,
              tasksGenerated: false,
              draftCreatedAt: now,
              draftUpdatedAt: now,
              coverage,
              provenance: provenance ?? null,
              aiGenerated: true,
            };

            if (stillHere) {
              set((state) => ({
                ...opened,
                // The plan that was open is filed before this one takes its
                // place — unless this is that plan, drafted again.
                dmps: replacing ? state.dmps : commitDraft(state),
              }));
            } else {
              // Filed, not opened: the person has moved on to another plan,
              // and having the editor switch under them would be worse.
              set((state) => ({
                dmps: commitDraft({ ...opened, dmps: state.dmps }),
              }));
            }

            // Anything said before a plan existed belongs to this plan now.
            if (ticket.scope === UNSCOPED || !stillHere)
              useAiThread.getState().adopt(UNSCOPED, dmpId);
            recordAiEvent(dmpId, {
              action: "analyze_proposal",
              summary: `Read ${file.name} and drafted the plan${direction?.trim() ? ` (${direction.trim()})` : ""}`,
              detail: `${(draft.dataset ?? []).length} research output(s), ${(draft.contributor ?? []).length} contributor(s) proposed.`,
              token_count,
              usage,
            });

            if (!stillHere)
              useToastStore.getState().toast({
                title: "Your new plan is ready",
                description: `Drafted from ${file.name}. It's in My DMPs, and the plan you're on wasn't changed.`,
                action: {
                  label: "Open it",
                  onClick: () => get().openDmp(dmpId),
                },
              });

            return { coverage, dmpId, opened: stillHere };
          } catch (err) {
            reportAiError(err, {
              what: "analyze this file",
              retry: () =>
                void get()
                  .analyzeProposal(file, projectId, direction, opts)
                  .catch(() => {}),
            });
            throw err;
          } finally {
            syncQuota();
          }
        },

        regenerateField: async (target, label, direction) => {
          const field = fieldAccess(target);
          // Free text, and nothing else. The form only offers the control on
          // such fields; this holds for every caller.
          const mode = regenerateMode(field.policy);
          if (!mode) return;
          const fieldName = field.flag;
          // The plan, and the plan as it was, that this rewrite was asked
          // for. A reply can take seconds; by then the person may be on
          // another plan or the field may have moved. Either way the rewrite
          // is kept — as a suggestion on its own plan — never written over
          // what's there now.
          const ticket = useAiThread.getState().ticket(get().currentDmpId);
          const snapshot = get().draft;
          const previousValue = field.read(snapshot);
          const currentText =
            typeof previousValue === "string" ? previousValue : "";
          // The researcher's own words get polished, never written for them:
          // nothing to start from, or a direction that adds content, and
          // there's no call at all.
          if (
            mode === "suggest" &&
            (!currentText.trim() || !isWordingOnly(direction))
          )
            return;
          const estimated = estimateCost.regenerateField(currentText);

          const quota = useQuotaStore.getState();
          if (!quota.hasTokensFor(estimated)) {
            useToastStore.getState().toast({
              title: "Not enough tokens left",
              description: `This needs about ${estimated.toLocaleString()} tokens and you have ${formatTokensLeft(quota.tokensLeft())} left.`,
              variant: "destructive",
            });
            return;
          }

          set((state) => ({
            regeneratingFields: {
              ...state.regeneratingFields,
              [fieldName]: true,
            },
          }));

          try {
            const { text, usage, token_count } = await aiApi.regenerateField(
              label,
              currentText,
              direction,
              mode,
            );

            const scope = useAiThread.getState().resolve(ticket);
            const stillOpen = scope === scopeKey(get().currentDmpId);
            const unchanged =
              stillOpen && sameValue(field.read(get().draft), previousValue);
            const summary =
              mode === "suggest"
                ? `Suggested a polish of ${label} (${describeDirection(direction)})`
                : `Rewrote ${label} (${describeDirection(direction)})`;

            if (
              mode === "suggest" &&
              unchanged &&
              sameValue(text, previousValue)
            ) {
              recordAiEvent(scope, {
                action: "regenerate_field",
                summary: `${summary}: nothing to change`,
                token_count,
                usage,
              });
              useToastStore.getState().toast({
                title: "Nothing to polish",
                description: `${label} already reads that way, so it's unchanged.`,
              });
              return;
            }

            if (mode === "suggest" || !unchanged) {
              // Built against the plan as it was asked about, then checked
              // against the plan as it is: stale if the field moved, pending
              // if the person simply went elsewhere.
              const path = field.path(snapshot);
              const { proposals } = path
                ? runToolCall(
                    { tool: "proposeFieldChange", path, value: text },
                    { draft: snapshot, planActive: false, unmet: [] },
                  )
                : { proposals: [] };
              const kept = flagDrift(proposals, get().draftFor(scope));
              useAiThread.getState().append(scope, {
                id: makeId(),
                kind: "assistant",
                text:
                  mode === "suggest" && unchanged
                    ? `${summary}. Your text stays as it is unless you accept this.`
                    : `${summary}. It wasn't applied. Review it here.`,
                token_count,
                at: new Date(),
                proposals: kept.length ? kept : undefined,
              });
              recordAiEvent(scope, {
                action: "regenerate_field",
                summary: `${summary} (kept as a suggestion)`,
                detail: text.slice(0, 120),
                token_count,
                usage,
              });
              if (mode === "suggest" && unchanged) {
                useAssistantStore.getState().setOpen(true);
                useToastStore.getState().toast({
                  title: "Suggestion ready",
                  description: `Your ${label.toLowerCase()} is unchanged. The polished version is in the assistant panel to accept or reject.`,
                });
                return;
              }
              useToastStore.getState().toast({
                title: `${label} wasn't changed`,
                description: stillOpen
                  ? "It changed while the rewrite was being written, so your version was kept. The rewrite is in the assistant panel, marked out of date."
                  : "You opened another plan before the rewrite was ready. It's saved as a suggestion on the plan it was for.",
              });
              return;
            }

            // Written like any edit, which also retires the field's
            // provenance: an AI rewrite isn't from the proposal.
            field.write(get(), text);

            recordAiEvent(scope, {
              action: "regenerate_field",
              summary,
              detail: text.slice(0, 120),
              token_count,
              usage,
            });

            useToastStore.getState().toast({
              title: `${label} regenerated`,
              description: `Used ${token_count.toLocaleString()} tokens.`,
              action: {
                label: "Undo",
                // Only undoes the rewrite itself: once the field holds
                // anything else, or another plan is open, there's nothing
                // of the AI's left to take back.
                onClick: () => {
                  const state = get();
                  if (
                    scopeKey(state.currentDmpId) !== scope ||
                    !sameValue(field.read(state.draft), text)
                  ) {
                    useToastStore.getState().toast({
                      title: "Nothing to undo",
                      description: `${label} has changed since the rewrite.`,
                    });
                    return;
                  }
                  field.write(state, previousValue);
                },
              },
            });
          } catch (err) {
            const e = reportAiError(err, {
              what: `regenerate ${label}`,
              retry: () => void get().regenerateField(target, label, direction),
            });
            // A call that failed part-way may still have cost something.
            if (totalTokens(e.usage) > 0)
              recordAiEvent(useAiThread.getState().resolve(ticket), {
                action: "regenerate_field",
                summary: `Rewrite of ${label} didn't finish`,
                token_count: totalTokens(e.usage),
                usage: e.usage,
              });
          } finally {
            set((state) => ({
              regeneratingFields: {
                ...state.regeneratingFields,
                [fieldName]: false,
              },
            }));
            syncQuota();
          }
        },

        // Only fields the policy marks "ai" are eligible. That structurally
        // excludes human-confirm and locked fields — AI never rewrites something
        // a person signed off on, or a system-owned value.
        eligibleBatchTargets: () => {
          const { draft } = get();
          const targets: BatchTarget[] = [];
          // The per-field rule, "apply" side only: the researcher's own text
          // is polished one field at a time, where they can see it.
          const prose = (policies: Record<string, FieldPolicy>) =>
            Object.keys(policies).filter(
              (key) =>
                !key.includes(".") && regenerateMode(policies[key]) === "apply",
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

          // An empty field has nothing to rewrite in a given direction.
          return targets.filter((t) => t.value.trim().length > 0);
        },

        startManual: (projectId) => {
          const now = new Date();
          set((state) => ({
            dmps: commitDraft(state),
            draft: { project_id: projectId },
            currentDmpId: makeId(),
            status: "draft" as DmpStatus,
            tasksGenerated: false,
            draftCreatedAt: now,
            draftUpdatedAt: now,
            coverage: null,
            provenance: null,
            aiGenerated: false,
          }));
        },

        // Discard: the plan leaves the library too, rather than being filed.
        closeDraft: () => {
          fileOpenPlan();
          const state = get();
          const record = state.dmps.find(
            (d) => d.dmp_id === state.currentDmpId,
          );
          const clear = () =>
            set({
              draft: emptyDraft,
              currentDmpId: null,
              status: "draft" as DmpStatus,
              restoredFrom: null,
              coverage: null,
              provenance: null,
              aiGenerated: false,
              tasksGenerated: false,
            });

          if (record?.active_version !== undefined) {
            // In force: drop unsubmitted edits, keep the plan and its work.
            get().restoreVersion(record.active_version);
            fileOpenPlan();
            clear();
            return "discarded";
          }
          // Waiting on its first decision: leaving the editor must not quietly
          // withdraw it from the committee. Keep it as submitted.
          const submitted = record?.versions.find(
            (v) => v.status === "pending",
          );
          if (record && submitted) {
            set({ draft: structuredClone(submitted.snapshot) });
            fileOpenPlan();
            clear();
            return "kept";
          }
          if (record) {
            get().archiveDmp(record.dmp_id);
            return "archived";
          }
          clear();
          return "cleared";
        },
      };
    },
    {
      name: storageKey("dmps"),
      storage: jsonStorage,
      version: 2,
      // v2: plans saved before modes were frozen get theirs now, so a later
      // change to their project can't move them between routes.
      migrate: (persisted, version) => {
        const state = persisted as { dmps?: DmpRecord[] };
        if (version < 2 && state?.dmps)
          state.dmps = freezeSubmittedModes(
            state.dmps,
            useProjectStore.getState().projects,
          );
        return state as never;
      },
      // The AI budget isn't here at all — the server holds it. And
      // `regeneratingFields` is in-flight UI state that must not outlive the
      // request it belongs to.
      partialize: (state) => ({
        draft: state.draft,
        dmps: state.dmps,
        currentDmpId: state.currentDmpId,
        status: state.status,
        tasksGenerated: state.tasksGenerated,
        provenance: state.provenance,
        coverage: state.coverage,
        aiGenerated: state.aiGenerated,
        draftCreatedAt: state.draftCreatedAt,
        draftUpdatedAt: state.draftUpdatedAt,
      }),
    },
  ),
);
