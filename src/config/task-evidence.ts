import type { Task } from "@/types/task";

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
    hint: "General work with no tangible output — tick it when it's done.",
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

/** True when the attached evidence satisfies the task's requirement. */
export const evidenceSatisfies = (task: Task): boolean => {
  const requirement = requirementFor(task);
  if (requirement === "declared") return true;

  // Rows restored from disk predate this field, so don't assume it's there.
  const { type, ref } = task.evidence ?? { type: "none" as const };
  if (!ref?.trim()) return false;

  // Until the RDM integration lands, a link or file is accepted for
  // preserve/share too — it is flagged as awaiting verification rather than
  // blocking the work.
  return type === "file" || type === "url" || type === "rdm_deposit";
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
