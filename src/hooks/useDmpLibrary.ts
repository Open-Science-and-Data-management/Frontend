import React from "react";
import {
  buildDmpList,
  useDmpStore,
  type DmpRecord,
  type PlanVersion,
} from "@/store/dmpStore";

/**
 * Every saved plan, with the one open in the editor projected over its record
 * — the same list My DMPs shows, for screens that only read it.
 */
export const useDmpLibrary = (): DmpRecord[] => {
  const dmps = useDmpStore((s) => s.dmps);
  const draft = useDmpStore((s) => s.draft);
  const status = useDmpStore((s) => s.status);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const draftCreatedAt = useDmpStore((s) => s.draftCreatedAt);
  const draftUpdatedAt = useDmpStore((s) => s.draftUpdatedAt);
  const tasksGenerated = useDmpStore((s) => s.tasksGenerated);

  return React.useMemo(
    () =>
      buildDmpList({
        dmps,
        draft,
        status,
        currentDmpId,
        draftCreatedAt,
        draftUpdatedAt,
        tasksGenerated,
      }),
    [
      dmps,
      draft,
      status,
      currentDmpId,
      draftCreatedAt,
      draftUpdatedAt,
      tasksGenerated,
    ],
  );
};

export interface ReviewItem {
  record: DmpRecord;
  /** The version waiting on a decision. */
  version: PlanVersion;
  /** A change to a plan already in force, rather than its first submission. */
  isRevision: boolean;
}

/** Everything waiting on the committee, longest-waiting first. */
export const reviewQueue = (library: DmpRecord[]): ReviewItem[] =>
  library
    .flatMap((record) => {
      const version = record.versions.find((v) => v.status === "pending");
      return version
        ? [{ record, version, isRevision: record.active_version !== undefined }]
        : [];
    })
    .sort(
      (a, b) => a.version.created_at.getTime() - b.version.created_at.getTime(),
    );

export const usePendingReviewCount = (): number =>
  reviewQueue(useDmpLibrary()).length;

/**
 * What a reviewer reads: the version under decision if there is one, else
 * the version in force, else whatever has been drafted. Never the researcher's
 * unsubmitted edits when a submitted snapshot exists.
 */
export const reviewedSnapshot = (record: DmpRecord) => {
  const pending = record.versions.find((v) => v.status === "pending");
  const active = record.versions.find(
    (v) => v.number === record.active_version,
  );
  return pending?.snapshot ?? active?.snapshot ?? record.draft;
};
