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
  estimateCost,
  type Coverage,
  type RegenerateDirection,
} from "@/api/aiApi";
import { useToastStore } from "@/store/toastStore";
import { notify } from "@/store/notificationStore";
import { CURRENT_USER_ID } from "@/config/current-user";
import { dmpFieldPolicy, datasetFieldPolicy } from "@/config/field-policy";

const TOKEN_LIMIT = 30000;

export interface BatchTarget {
  id: string;
  scope: "dmp" | "dataset";
  datasetId?: string;
  key: "title" | "description";
  label: string;
  group: string;
  value: string;
}

export interface BatchProposal extends BatchTarget {
  before: string;
  after: string;
  token_count: number;
}

const makeId = () => Math.random().toString(36).substring(2, 10);

/**
 * A saved plan in the researcher's library. `draft` carries the whole plan so a
 * record can be reopened in the editor; the summary fields on top are what the
 * list screen searches, filters, and sorts on without walking the payload.
 */
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
        dataset: [createEmptyDataset("raw"), createEmptyDataset("publication")],
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
          "Core sample measurements and imagery from the 2025 survey season, awaiting committee review.",
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
  ];

  return seeds.map((seed) => ({
    dmp_id: seed.dmp_id,
    status: seed.status,
    created_at: daysAgo(seed.created),
    updated_at: daysAgo(seed.updated),
    tasks_generated: seed.tasks_generated ?? false,
    draft: seed.draft,
    ...summarise(seed.draft),
  }));
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
      ...summarise(draft),
    });
  }

  return list;
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
  tokenUsed: number;
  tokenLimit: number;
  status: DmpStatus;
  tasksGenerated: boolean;

  /** Saved plans, every status. The one being edited is `currentDmpId`. */
  dmps: DmpRecord[];
  currentDmpId: string | null;
  draftCreatedAt: Date;
  draftUpdatedAt: Date;

  /** Files the open draft back into the library and checks out another. */
  openDmp: (id: string) => DmpRecord | undefined;
  deleteDmp: (id: string) => void;

  submitForApproval: () => void;
  /** Stand-in for the committee decision until their screens exist. */
  approve: () => void;
  markTasksGenerated: () => void;

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
  removeDataset: (id: string) => void;
  changeDatasetType: (id: string, type: Dataset["type"]) => void;

  hasToken: () => boolean;
  tokensLeft: () => number;
  hasTokensFor: (cost: number) => boolean;
  analyzeProposal: (
    file: File,
    projectId?: string,
  ) => Promise<{ coverage: Coverage }>;
  startManual: (projectId?: string) => void;
  regenerateField: (
    key: keyof DmpDraft,
    label: string,
    direction: RegenerateDirection,
  ) => Promise<void>;

  eligibleBatchTargets: () => BatchTarget[];
  batchRegenerate: (
    targetIds: string[],
    direction: RegenerateDirection,
  ) => Promise<BatchProposal[]>;
  applyBatchProposals: (proposals: BatchProposal[]) => void;

  resetDraft: () => void;
}

const emptyDraft: DmpDraft = {};

/** Writes the open draft into the library, inserting it if it's new. */
const commitDraft = (state: {
  dmps: DmpRecord[];
  draft: DmpDraft;
  status: DmpStatus;
  currentDmpId: string | null;
  draftCreatedAt: Date;
  draftUpdatedAt: Date;
  tasksGenerated: boolean;
}): DmpRecord[] => {
  if (!state.currentDmpId || !draftHasContent(state.draft)) return state.dmps;

  const record: DmpRecord = {
    dmp_id: state.currentDmpId,
    status: state.status,
    created_at: state.draftCreatedAt,
    updated_at: state.draftUpdatedAt,
    tasks_generated: state.tasksGenerated,
    draft: state.draft,
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
      const set: typeof rawSet = ((partial, replace) =>
        rawSet((state) => {
          const next =
            typeof partial === "function"
              ? (partial as (s: DmpDraftState) => Partial<DmpDraftState>)(state)
              : partial;
          return next && "draft" in next && !("draftUpdatedAt" in next)
            ? { ...next, draftUpdatedAt: new Date() }
            : next;
        }, replace as false)) as typeof rawSet;

      return {
        draft: emptyDraft,
        regeneratingFields: {},
        coverage: null,
        aiGenerated: false,
        tokenUsed: 0,
        tokenLimit: TOKEN_LIMIT,
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
            draft: target.draft,
            status: target.status,
            currentDmpId: target.dmp_id,
            draftCreatedAt: target.created_at,
            draftUpdatedAt: target.updated_at,
            coverage: null,
            aiGenerated: false,
            // Carried on the record, so reopening an approved plan doesn't offer
            // to generate a second set of tasks.
            tasksGenerated: target.tasks_generated,
          });
          return target;
        },

        deleteDmp: (id) =>
          set((state) => ({
            dmps: state.dmps.filter((d) => d.dmp_id !== id),
            ...(state.currentDmpId === id
              ? {
                  draft: emptyDraft,
                  currentDmpId: null,
                  status: "draft" as DmpStatus,
                  coverage: null,
                  aiGenerated: false,
                  tasksGenerated: false,
                }
              : {}),
          })),

        submitForApproval: () => {
          set({ status: "pending" });
          const { draft, currentDmpId } = get();
          notify({
            user_id: CURRENT_USER_ID,
            type: "dmp_submitted",
            title: "Plan submitted for approval",
            message: `${draft.title?.trim() || "Untitled DMP"} is waiting on the committee.`,
            link: "/dmp/status",
            dmp_id: currentDmpId ?? undefined,
            project_id: draft.project_id,
          });
        },

        approve: () => {
          set({ status: "approved" });
          const { draft, currentDmpId } = get();
          notify({
            user_id: CURRENT_USER_ID,
            type: "dmp_approved",
            title: "Your plan was approved",
            message: `The committee approved ${draft.title?.trim() || "your plan"}.`,
            link: "/dmp/status",
            dmp_id: currentDmpId ?? undefined,
            project_id: draft.project_id,
          });
        },

        markTasksGenerated: () => {
          set({ tasksGenerated: true });
          const { draft, currentDmpId } = get();
          notify({
            user_id: CURRENT_USER_ID,
            type: "tasks_generated",
            title: "Tasks are ready",
            message: `${draft.title?.trim() || "Your plan"} has been broken into tasks you can track.`,
            link: "/tasks",
            dmp_id: currentDmpId ?? undefined,
            project_id: draft.project_id,
          });
        },

        setField: (key, value) =>
          set((state) => ({ draft: { ...state.draft, [key]: value } })),

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

        updateDataset: (id, patch) =>
          set((state) => ({
            draft: {
              ...state.draft,
              dataset: (state.draft.dataset ?? []).map((d) =>
                d.dataset_id === id ? ({ ...d, ...patch } as Dataset) : d,
              ),
            },
          })),

        removeDataset: (id) =>
          set((state) => ({
            draft: {
              ...state.draft,
              dataset: (state.draft.dataset ?? []).filter(
                (d) => d.dataset_id !== id,
              ),
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
                  protection_level_other: d.protection_level_other,
                  security_classification_level:
                    d.security_classification_level,
                  security_classification_level_other:
                    d.security_classification_level_other,
                  data_quality_assurance: d.data_quality_assurance,
                  keyword: d.keyword,
                  language: d.language,
                  preservation: d.preservation,
                  distribution: d.distribution,
                };
              }),
            },
          })),

        hasToken: () => get().tokenUsed < get().tokenLimit,

        tokensLeft: () => Math.max(0, get().tokenLimit - get().tokenUsed),

        // Budget is spent per token, so an action is only allowed when the whole
        // estimated cost fits in what's left.
        hasTokensFor: (cost) => get().tokensLeft() >= cost,

        analyzeProposal: async (file, projectId) => {
          const estimated = estimateCost.analyzeProposal(file);
          if (!get().hasTokensFor(estimated)) {
            useToastStore.getState().toast({
              title: "Not enough tokens left",
              description: `This needs about ${estimated.toLocaleString()} tokens and you have ${get().tokensLeft().toLocaleString()} left this month.`,
              variant: "destructive",
            });
            throw new Error("Token budget exhausted");
          }

          try {
            const { draft, coverage, token_count } =
              await aiApi.analyzeProposal(file);
            const now = new Date();
            set((state) => ({
              // The plan that was open is filed before this one takes its place.
              dmps: commitDraft(state),
              draft: { ...draft, project_id: projectId },
              currentDmpId: makeId(),
              status: "draft" as DmpStatus,
              tasksGenerated: false,
              draftCreatedAt: now,
              draftUpdatedAt: now,
              coverage,
              aiGenerated: true,
              tokenUsed: state.tokenUsed + token_count,
            }));
            return { coverage };
          } catch (err) {
            // Parse/analysis failures don't consume tokens.
            useToastStore.getState().toast({
              title: "Couldn't analyze this file",
              description:
                err instanceof Error ? err.message : "Please try again.",
              variant: "destructive",
            });
            throw err;
          }
        },

        regenerateField: async (key, label, direction) => {
          const fieldName = String(key);
          const previousValue = get().draft[key];
          const currentText =
            typeof previousValue === "string" ? previousValue : "";
          const estimated = estimateCost.regenerateField(currentText);

          if (!get().hasTokensFor(estimated)) {
            useToastStore.getState().toast({
              title: "Not enough tokens left",
              description: `This needs about ${estimated.toLocaleString()} tokens and you have ${get().tokensLeft().toLocaleString()} left this month.`,
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
            const { text, token_count } = await aiApi.regenerateField(
              label,
              currentText,
              direction,
            );

            set((state) => ({
              draft: { ...state.draft, [key]: text },
              tokenUsed: state.tokenUsed + token_count,
              regeneratingFields: {
                ...state.regeneratingFields,
                [fieldName]: false,
              },
            }));

            useToastStore.getState().toast({
              title: `${label} regenerated`,
              description: `Used ${token_count.toLocaleString()} tokens.`,
              action: {
                label: "Undo",
                onClick: () =>
                  set((state) => ({
                    draft: { ...state.draft, [key]: previousValue },
                  })),
              },
            });
          } catch {
            set((state) => ({
              regeneratingFields: {
                ...state.regeneratingFields,
                [fieldName]: false,
              },
            }));
            useToastStore.getState().toast({
              title: "Regeneration failed",
              description: "Please try again.",
              variant: "destructive",
            });
          }
        },

        // Only fields the policy marks "ai" are eligible. That structurally
        // excludes human-confirm and locked fields — AI never rewrites something
        // a person signed off on, or a system-owned value.
        eligibleBatchTargets: () => {
          const { draft } = get();
          const keys = ["title", "description"] as const;
          const targets: BatchTarget[] = [];

          keys.forEach((key) => {
            if (dmpFieldPolicy[key]?.permission !== "ai") return;
            targets.push({
              id: `dmp:${key}`,
              scope: "dmp",
              key,
              label: key === "title" ? "Plan title" : "Plan description",
              group: "Plan details",
              value: (draft[key] as string | undefined) ?? "",
            });
          });

          (draft.dataset ?? []).forEach((d) => {
            keys.forEach((key) => {
              if (datasetFieldPolicy[key]?.permission !== "ai") return;
              targets.push({
                id: `dataset:${d.dataset_id}:${key}`,
                scope: "dataset",
                datasetId: d.dataset_id as string,
                key,
                label: key === "title" ? "Title" : "Description",
                group: d.title || "Untitled output",
                value: (d[key] as string | undefined) ?? "",
              });
            });
          });

          // An empty field has nothing to rewrite in a given direction.
          return targets.filter((t) => t.value.trim().length > 0);
        },

        batchRegenerate: async (targetIds, direction) => {
          // Re-derive from the policy rather than trusting the ids handed in.
          const targets = get()
            .eligibleBatchTargets()
            .filter((t) => targetIds.includes(t.id));
          if (targets.length === 0) return [];

          const estimated = targets.reduce(
            (sum, t) => sum + estimateCost.regenerateField(t.value),
            0,
          );
          if (!get().hasTokensFor(estimated)) {
            useToastStore.getState().toast({
              title: "Not enough tokens left",
              description: `This batch needs about ${estimated.toLocaleString()} tokens and you have ${get().tokensLeft().toLocaleString()} left.`,
              variant: "destructive",
            });
            return [];
          }

          const proposals = await Promise.all(
            targets.map(async (t) => {
              const { text, token_count } = await aiApi.regenerateField(
                t.label,
                t.value,
                direction,
              );
              return { ...t, before: t.value, after: text, token_count };
            }),
          );

          // The generation is billed whether or not the user accepts the result.
          const spent = proposals.reduce((sum, p) => sum + p.token_count, 0);
          set((state) => ({ tokenUsed: state.tokenUsed + spent }));

          return proposals;
        },

        applyBatchProposals: (proposals) =>
          set((state) => {
            let draft = { ...state.draft };
            proposals.forEach((p) => {
              if (p.scope === "dmp") {
                draft = { ...draft, [p.key]: p.after };
              } else {
                draft = {
                  ...draft,
                  dataset: (draft.dataset ?? []).map((d) =>
                    d.dataset_id === p.datasetId
                      ? ({ ...d, [p.key]: p.after } as Dataset)
                      : d,
                  ),
                };
              }
            });
            return { draft };
          }),

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
            aiGenerated: false,
          }));
        },

        // Discard: the plan leaves the library too, rather than being filed.
        resetDraft: () =>
          set((state) => ({
            dmps: state.dmps.filter((d) => d.dmp_id !== state.currentDmpId),
            draft: emptyDraft,
            currentDmpId: null,
            status: "draft" as DmpStatus,
            tasksGenerated: false,
            coverage: null,
            aiGenerated: false,
          })),
      };
    },
    {
      name: storageKey("dmps"),
      storage: jsonStorage,
      version: 1,
      // `tokenLimit` stays out so a change to the budget takes effect, and
      // `regeneratingFields` is in-flight UI state that must not outlive the
      // request it belongs to.
      partialize: (state) => ({
        draft: state.draft,
        dmps: state.dmps,
        currentDmpId: state.currentDmpId,
        status: state.status,
        tasksGenerated: state.tasksGenerated,
        tokenUsed: state.tokenUsed,
        coverage: state.coverage,
        aiGenerated: state.aiGenerated,
        draftCreatedAt: state.draftCreatedAt,
        draftUpdatedAt: state.draftUpdatedAt,
      }),
    },
  ),
);
