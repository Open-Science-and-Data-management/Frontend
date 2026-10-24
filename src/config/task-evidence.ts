import type { Task } from "@/types/task";
import type { PlanMode } from "@/types/project";

/**
 * What has to exist before a task can be closed. The rule comes from the work
 * itself, not from who is ticking the box:
 *  - declared        general work with no tangible output — self-declared
 *  - evidence_linked collect/process/analyse — a file or link to the output
 *  - system_verified preserve/share — a DOI/URL issued by the repository
 */
export type EvidenceRequirement =
  "declared" | "evidence_linked" | "system_verified";

export const requirementFor = (task: {
  dataset_id?: string;
  lifecycle_stage: Task["lifecycle_stage"];
}): EvidenceRequirement => {
  // No dataset means no artefact to point at; the researcher's word is the record.
  if (!task.dataset_id) return "declared";

  return task.lifecycle_stage === "preserve" || task.lifecycle_stage === "share"
    ? "system_verified"
    : "evidence_linked";
};

export const REQUIREMENT_COPY: Record<
  EvidenceRequirement,
  { label: string; hint: string }
> = {
  declared: {
    label: "Self-declared",
    hint: "General work with no tangible output. Tick it off when it's done.",
  },
  evidence_linked: {
    label: "Evidence required",
    hint: "Attach the output file or a link to it before closing this task.",
  },
  system_verified: {
    label: "Repository record required",
    hint: "Closing this needs the DOI or URL the repository issued.",
  },
};

/**
 * True when the attached evidence satisfies the task's requirement.
 *
 * Independent plans have no committee reading them, so evidence is the only
 * gate left: preserve and share must carry the repository's own record, not
 * just a link someone typed.
 */
export const evidenceSatisfies = (
  task: Task,
  mode: PlanMode = "institutional",
): boolean => {
  const requirement = requirementFor(task);
  if (requirement === "declared") return true;

  // Rows restored from disk predate this field, so don't assume it's there.
  const { type, ref } = task.evidence ?? { type: "none" as const };
  if (!ref?.trim()) return false;

  if (requirement === "system_verified" && mode === "independent")
    return type === "rdm_deposit";

  // Until the RDM integration lands, a link or file is accepted for
  // preserve/share too — it is flagged as awaiting verification rather than
  // blocking the work.
  return type === "file" || type === "url" || type === "rdm_deposit";
};

/** Why a task can't be closed yet, in the terms its plan mode sets. */
export const requirementHint = (
  requirement: EvidenceRequirement,
  mode: PlanMode = "institutional",
): string =>
  requirement === "system_verified" && mode === "independent"
    ? "Closing this needs the DOI the repository issued. With no committee reviewing the plan, a plain link isn't enough."
    : REQUIREMENT_COPY[requirement].hint;

/**
 * Whether the tick box is a real control for this task, and if not, why not.
 * The rule is the same wherever a row is drawn — list, board, or table — so
 * every view asks the same function rather than re-deriving it.
 */
export const toggleState = (
  task: Task,
  mode: PlanMode = "institutional",
): { canToggle: boolean; blockedReason?: string } => {
  const isCancelled = task.status === "cancelled";
  const canToggle =
    !isCancelled && (task.status === "done" || evidenceSatisfies(task, mode));

  return {
    canToggle,
    blockedReason:
      canToggle || isCancelled
        ? undefined
        : requirementHint(requirementFor(task), mode),
  };
};

/** Accepted for now, but not yet proof the repository issued it. */
export const awaitingVerification = (task: Task): boolean =>
  requirementFor(task) === "system_verified" &&
  task.evidence?.type !== "rdm_deposit" &&
  Boolean(task.evidence?.ref?.trim());

/** Looks like a DOI — which says nothing about *what* it identifies. */
export const looksLikeDoi = (value: string): boolean =>
  /(^|\/)10\.\d{4,9}\/\S+$/i.test(value.trim());

/**
 * Classifies evidence a person pasted in. It is never `rdm_deposit`: a DOI
 * string alone can't tell a dataset deposit from a journal article, and
 * `rdm_deposit` is the one tier a researcher shouldn't be able to grant
 * themselves. Only the repository integration may set it.
 */
export const classifyPastedEvidence = (
  value: string,
): { type: "url"; ref: string; label: string } => {
  const ref = value.trim();
  return {
    type: "url",
    ref,
    label: looksLikeDoi(ref)
      ? ref.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      : ref.replace(/^https?:\/\//, ""),
  };
};
