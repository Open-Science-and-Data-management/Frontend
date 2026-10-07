import { dmpSchema } from "@/schemas/dmp/dmp.schema";
import { approvalFromPlan, mapFormToMadmp } from "@/schemas/madmp/mapper";
import { MADMP_SCHEMA_VERSION } from "@/schemas/madmp/vocabularies";
import { mapFormToRda, RDA_SCHEMA_VERSION } from "@/schemas/rda/mapper";
import { contributorFullName } from "@/schemas/contributor/contributor.schema";
import type { DmpDraft } from "@/types/dmp";
import type { PlanMode } from "@/types/project";
import type { DmpRecord } from "@/store/dmpStore";

export type ExportFormat = "madmp" | "rda";

export const EXPORT_FORMATS: Record<
  ExportFormat,
  { label: string; detail: string; suffix: string }
> = {
  madmp: {
    label: `maDMP ${MADMP_SCHEMA_VERSION}`,
    detail: "GCWG-RDA standard, with approval and classifications",
    suffix: `madmp-${MADMP_SCHEMA_VERSION}`,
  },
  rda: {
    label: `RDA ${RDA_SCHEMA_VERSION}`,
    detail: "RDA DMP Common Standard, the widely supported core",
    suffix: `rda-${RDA_SCHEMA_VERSION}`,
  },
};

export interface ExportInput {
  draft: DmpDraft;
  /** The open plan's status, which the library record can lag behind. */
  status: DmpRecord["status"];
  record?: DmpRecord;
  dmpId: string;
  planMode: PlanMode;
  projectName?: string;
}

export type ExportResult =
  { ok: true; json: string; filename: string } | { ok: false; reason: string };

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "dmp";

/**
 * What an export describes. Once a plan has a version in force, that version's
 * snapshot — the plan as approved — and never the working draft, which may
 * hold edits nobody has signed off. Before that, the draft as it stands.
 */
export const exportSource = (
  input: Pick<ExportInput, "draft" | "record">,
): { plan: DmpDraft; version?: number } => {
  const record = input.record;
  const active = record?.versions.find(
    (v) => v.number === record.active_version,
  );
  return active
    ? { plan: active.snapshot, version: active.number }
    : { plan: input.draft };
};

/**
 * Builds a standards document from the plan as it stands. Both standards
 * require fields a draft can still be missing, so an incomplete plan is
 * refused with the reason rather than exported half-valid.
 */
export const buildExport = (
  format: ExportFormat,
  input: ExportInput,
): ExportResult => {
  const { plan } = exportSource(input);
  const parsed = dmpSchema.safeParse(plan);
  if (!parsed.success)
    return {
      ok: false,
      reason:
        "Finish the items on the readiness list first — both standards require them.",
    };

  const form = parsed.data;
  const record = input.record;
  const project = input.projectName ? { title: input.projectName } : undefined;
  const base = {
    dmpId: input.dmpId,
    created: record?.created_at,
    modified: record?.updated_at,
    project,
  };

  let doc: unknown;
  try {
    if (format === "rda") {
      doc = mapFormToRda(form, base);
    } else {
      const contact =
        form.contributor.find((c) => c.is_contact) ?? form.contributor[0];
      const active = record?.versions.find(
        (v) => v.number === record.active_version,
      );
      const pending = record?.versions.find((v) => v.status === "pending");
      doc = mapFormToMadmp(form, {
        ...base,
        approval: approvalFromPlan({
          status: input.status,
          planMode: input.planMode,
          // A plan approved before versions were kept has no decision date of
          // its own; its last update is the closest true date there is.
          decidedAt: active?.decided_at ?? record?.updated_at ?? new Date(),
          submittedAt: pending?.created_at,
          contactName: contributorFullName(contact),
          contactRole: contact.role,
          approver: active?.approver,
        }),
      });
    }
  } catch (error) {
    // A mapper refusing its own output is a bug, but the person still needs
    // to hear why nothing downloaded.
    console.error(error);
    return {
      ok: false,
      reason:
        "The plan couldn't be converted to this standard. Nothing was downloaded.",
    };
  }

  return {
    ok: true,
    json: JSON.stringify(doc, null, 2),
    filename: `${slug(form.title)}-${EXPORT_FORMATS[format].suffix}.json`,
  };
};

/** Hands the browser a file to save. */
export const downloadJson = (json: string, filename: string) => {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
