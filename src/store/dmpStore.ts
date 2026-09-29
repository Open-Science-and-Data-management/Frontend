import { create } from "zustand";
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

export const datasetConfirmKey = (datasetId: string, field: string) =>
  `dataset:${datasetId}:${field}`;

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
  confirmedFields: Record<string, boolean>;
  regeneratingFields: Record<string, boolean>;
  coverage: Coverage | null;
  aiGenerated: boolean;
  tokenUsed: number;
  tokenLimit: number;
  status: DmpStatus;
  tasksGenerated: boolean;

  submitForApproval: () => void;
  /** Stand-in for the committee decision until their screens exist. */
  approve: () => void;
  markTasksGenerated: () => void;

  setField: <K extends keyof DmpDraft>(key: K, value: DmpDraft[K]) => void;
  confirmField: (key: string) => void;
  unconfirmField: (key: string) => void;

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

export const useDmpStore = create<DmpDraftState>((set, get) => ({
  draft: emptyDraft,
  confirmedFields: {},
  regeneratingFields: {},
  coverage: null,
  aiGenerated: false,
  tokenUsed: 0,
  tokenLimit: TOKEN_LIMIT,
  status: "draft",
  tasksGenerated: false,

  submitForApproval: () => set({ status: "pending" }),
  approve: () => set({ status: "approved" }),
  markTasksGenerated: () => set({ tasksGenerated: true }),

  setField: (key, value) =>
    set((state) => ({ draft: { ...state.draft, [key]: value } })),

  confirmField: (key) =>
    set((state) => ({
      confirmedFields: { ...state.confirmedFields, [key]: true },
    })),

  unconfirmField: (key) =>
    set((state) => ({
      confirmedFields: { ...state.confirmedFields, [key]: false },
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
        dataset: [...(state.draft.dataset ?? []), createEmptyDataset(type)],
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
        dataset: (state.draft.dataset ?? []).filter((d) => d.dataset_id !== id),
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
            security_classification_level: d.security_classification_level,
            security_classification_level_other: d.security_classification_level_other,
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
      const { draft, coverage, token_count } = await aiApi.analyzeProposal(file);
      set((state) => ({
        draft: { ...draft, project_id: projectId },
        coverage,
        aiGenerated: true,
        confirmedFields: {},
        tokenUsed: state.tokenUsed + token_count,
      }));
      return { coverage };
    } catch (err) {
      // Parse/analysis failures don't consume tokens.
      useToastStore.getState().toast({
        title: "Couldn't analyze this file",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      throw err;
    }
  },

  regenerateField: async (key, label, direction) => {
    const fieldName = String(key);
    const previousValue = get().draft[key];
    const currentText = typeof previousValue === "string" ? previousValue : "";
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
      regeneratingFields: { ...state.regeneratingFields, [fieldName]: true },
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
        regeneratingFields: { ...state.regeneratingFields, [fieldName]: false },
      }));

      useToastStore.getState().toast({
        title: `${label} regenerated`,
        description: `Used ${token_count.toLocaleString()} tokens.`,
        action: {
          label: "Undo",
          onClick: () =>
            set((state) => ({ draft: { ...state.draft, [key]: previousValue } })),
        },
      });
    } catch {
      set((state) => ({
        regeneratingFields: { ...state.regeneratingFields, [fieldName]: false },
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
    const targets = get().eligibleBatchTargets().filter((t) =>
      targetIds.includes(t.id),
    );
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

  startManual: (projectId) =>
    set({
      draft: { project_id: projectId },
      confirmedFields: {},
      coverage: null,
      aiGenerated: false,
    }),

  resetDraft: () =>
    set({
      draft: emptyDraft,
      confirmedFields: {},
      coverage: null,
      aiGenerated: false,
    }),
}));
