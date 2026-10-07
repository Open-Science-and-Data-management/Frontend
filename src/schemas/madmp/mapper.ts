import type { DmpForm } from "../dmp/dmp.schema";
import { dayString } from "@/utils/calendarDate";
import type { Dataset } from "../dataset/dataset.schema";
import {
  contributorFullName,
  type Contributor,
} from "../contributor/contributor.schema";
import { madmpExportSchema, type MadmpExport } from "./madmp-export.schema";
import {
  MADMP_SCHEMA_URI,
  MADMP_SCHEMA_VERSION,
  PROTECTION_ORDER,
  SECURITY_ORDER,
  toIso6393,
  toProtectionLevel,
  toSecurityClassificationLevel,
  type ApprovalStatus,
  type ContactRole,
} from "./vocabularies";

/** Where identifiers minted by this app are registered. */
const REGISTRY = "DMP-Researcher";

export interface MadmpApproval {
  status: ApprovalStatus;
  description?: string;
  by_name?: string;
  by_position?: string;
  by_mbox?: string;
  date?: Date;
}

export interface MadmpContext {
  /** The plan's persistent identifier; a DOI when one has been minted. */
  dmpId: string;
  created?: Date;
  modified?: Date;
  /** The project the plan belongs to, when it has a name of its own. */
  project?: { title: string; description?: string };
  approval?: MadmpApproval;
}

const yn = (b: boolean): "yes" | "no" => (b ? "yes" : "no");
const day = (d?: Date) => dayString(d) || undefined;
const blank = (s?: string) => (s?.trim() ? s.trim() : undefined);

const looksLikeDoi = (value: string) =>
  /^(https?:\/\/(dx\.)?doi\.org\/)?10\.\d{4,9}\//i.test(value);

/** An id the standard can read: typed where we know the scheme, named where we don't. */
const idFor = <T extends string>(identifier: string, type: T | "other") =>
  type === "other"
    ? { identifier, type, registry_name: REGISTRY }
    : { identifier, type };

const personId = (c: Contributor) =>
  c.orcid
    ? idFor(c.orcid, "orcid" as const)
    : // No ORCID: the email is the best handle on the person, failing that our own id.
      idFor(c.email || `contributor:${c.contributor_id ?? c.name}`, "other");

const contactRole = (role: string): ContactRole =>
  /principal investigator|\bpi\b/i.test(role)
    ? "principalInvestigator"
    : /steward|custodian/i.test(role)
      ? "custodian"
      : "pointOfContact";

const DATASET_TYPE_LABEL: Record<Dataset["type"], string> = {
  raw: "raw data",
  software: "software",
  publication: "text",
  other: "other",
};

/** Domain values are JSON in the export, so dates leave as ISO strings. */
const exportableMetadata = (metadata: Record<string, unknown> = {}) => {
  const entries = Object.entries(metadata).map(([key, value]) => [
    key,
    // Domain dates are calendar days, exported as the day itself.
    value instanceof Date ? dayString(value) : value,
  ]);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/** The most restrictive of the plan's outputs speaks for the plan as a whole. */
const rollUp = <T extends string>(levels: (T | undefined)[], order: T[]) =>
  order.find((level) => levels.includes(level));

/**
 * The approval block, from what the plan itself knows. Independent plans were
 * never before a committee, which the standard records as "not applicable"
 * rather than leaving the reader to guess.
 */
export const approvalFromPlan = (plan: {
  status: "draft" | "pending" | "approved";
  planMode: "institutional" | "independent";
  /** When the version in force was decided, or the pending one submitted. */
  decidedAt?: Date;
  submittedAt?: Date;
  contactName: string;
  contactRole: string;
  approver?: { name: string; position: string; mbox?: string };
}): MadmpApproval => {
  if (plan.planMode === "independent")
    return {
      status: "not applicable",
      description:
        plan.status === "approved"
          ? "Independent plan, finalized by the researcher. No committee approval applies."
          : "Independent plan. No committee approval applies.",
    };

  if (plan.status === "approved")
    return {
      status: "approved",
      date: plan.decidedAt,
      by_name: plan.approver?.name ?? "Data management committee",
      by_position: plan.approver?.position ?? "Committee",
      by_mbox: plan.approver?.mbox,
      // Plans approved before approvers were recorded say so, not who.
      description: plan.approver
        ? undefined
        : "Approved by the committee; the individual approver was not recorded.",
    };

  if (plan.status === "pending")
    return {
      status: "submitted",
      date: plan.submittedAt,
      // Until a decision exists, the person on record is the one who submitted.
      by_name: plan.contactName,
      by_position: plan.contactRole,
      description: "Submitted for committee review; no decision yet.",
    };

  return { status: "not submitted" };
};

const distributionsFor = (
  dataset: DmpForm["dataset"][number],
  licenceStart: string | undefined,
) => {
  const protection = toProtectionLevel(dataset.protection_level, {
    nomenclature: dataset.protection_level_other_nomenclature,
    level: dataset.protection_level_other,
  });
  const security = toSecurityClassificationLevel(
    dataset.security_classification_level,
    {
      nomenclature: dataset.security_classification_level_other_nomenclature,
      level: dataset.security_classification_level_other,
    },
  );

  return dataset.distribution.map((dist, index) => ({
    title: dist.title,
    distribution_id: idFor(
      dist.distribution_id ?? `${dataset.dataset_id ?? "dataset"}-${index + 1}`,
      "other",
    ),
    data_access: dist.data_access,
    access_url: blank(dist.access_url),
    download_url: blank(dist.download_url),
    format: dist.format ? [dist.format] : undefined,
    byte_size: dist.byte_size,
    license:
      dist.license && licenceStart
        ? { license_ref: dist.license, start_date: licenceStart }
        : undefined,
    // Levels live on the distribution in v3.0, spelled in lower case there.
    protection_level: (protection
      ? protection.level.replace("Protected", "protected")
      : "unknown") as "unknown",
    protection_level_other_nomenclature: protection?.nomenclature,
    protection_level_other_level: protection?.otherLevel,
    security_classification_level: security?.level ?? "unknown",
    security_classification_level_other_nomenclature: security?.nomenclature,
    security_classification_level_other_level: security?.otherLevel,
    // v3.0 means to require this only when an "other" openness rating is
    // given, but its `if` checks the property without requiring it, so an
    // absent rating triggers the requirement on every distribution. We use no
    // such rating system, and say so.
    openness_other_rating_system: "not applicable",
  }));
};

/** Maps a validated plan to a GCWG-RDA maDMP v3.0 document. */
export function mapFormToMadmp(
  form: DmpForm,
  context: MadmpContext,
): MadmpExport {
  const contact =
    form.contributor.find((c) => c.is_contact) ?? form.contributor[0];
  const now = new Date();
  const licenceStart = day(form.begin_date);

  const protections = form.dataset.map((d) =>
    toProtectionLevel(d.protection_level, {
      nomenclature: d.protection_level_other_nomenclature,
      level: d.protection_level_other,
    }),
  );
  const securities = form.dataset.map((d) =>
    toSecurityClassificationLevel(d.security_classification_level, {
      nomenclature: d.security_classification_level_other_nomenclature,
      level: d.security_classification_level_other,
    }),
  );
  const planProtection = rollUp(
    protections.map((p) => p?.level),
    PROTECTION_ORDER,
  );
  const planSecurity = rollUp(
    securities.map((s) => s?.level),
    SECURITY_ORDER,
  );
  const otherOf = <T extends { level: string }>(
    list: (T | undefined)[],
    level?: string,
  ) => (level === "other" ? list.find((x) => x?.level === "other") : undefined);
  const protectionOther = otherOf(protections, planProtection);
  const securityOther = otherOf(securities, planSecurity);

  const approval = context.approval;
  const indigenous = blank(form.indigenous_considerations);

  const out = {
    dmp: {
      general_info: {
        title: form.title,
        description: blank(form.description),
        dmp_id: idFor(
          context.dmpId,
          looksLikeDoi(context.dmpId) ? "doi" : ("other" as const),
        ),
        created: (context.created ?? now).toISOString(),
        modified: (context.modified ?? now).toISOString(),
        language: toIso6393(form.language),
        protection_level: planProtection,
        protection_level_other_nomenclature: protectionOther?.nomenclature,
        protection_level_other_level: protectionOther?.otherLevel,
        security_classification_level: planSecurity,
        security_classification_level_other_nomenclature:
          securityOther?.nomenclature,
        security_classification_level_other_level: securityOther?.otherLevel,
        schema_version: MADMP_SCHEMA_VERSION,
        schema_version_uri: MADMP_SCHEMA_URI,
        ethical_issues_exist: yn(form.ethical_issues_exist),
        ethical_issues_description: blank(form.ethical_issues_description),
        ethical_issues_report: blank(form.ethical_issues_report),
        alternate_identifier: form.alternate_identifier
          ? [
              {
                identifier: idFor(
                  form.alternate_identifier.identifier,
                  (["doi", "handle", "url"] as const).find(
                    (t) => t === form.alternate_identifier?.type,
                  ) ?? "other",
                ),
              },
            ]
          : undefined,
      },
      contact: {
        name: contributorFullName(contact),
        mbox: contact.email ?? "",
        contact_id: personId(contact),
        role: contactRole(contact.role),
      },
      contributor: form.contributor.map((c) => ({
        name: contributorFullName(c),
        role: [c.role],
        mbox: blank(c.email),
        contributor_id: personId(c),
      })),
      approval: approval
        ? {
            status: approval.status,
            description: approval.description,
            by_name: approval.by_name,
            by_position: approval.by_position,
            by_mbox: approval.by_mbox,
            date: day(approval.date),
          }
        : undefined,
      project: [
        {
          title: context.project?.title ?? form.title,
          description: blank(context.project?.description),
          start: day(form.begin_date),
          end: day(form.end_date),
        },
      ],
      cost:
        form.cost.length > 0
          ? form.cost.map((c) => ({
              title: c.title,
              description: blank(c.description),
              value: c.value,
              currency_code: c.value > 0 ? c.currency_code : undefined,
            }))
          : undefined,
      // The plan holds this as free text, so the structured questions v3.0
      // asks alongside it are answered "unknown" rather than invented.
      indigenous_considerations: indigenous
        ? {
            exist: "yes" as const,
            description: indigenous,
            dmp_discussion: "unknown" as const,
            indigenous_control_over_data: "unknown" as const,
            traditional_knowledge: "unknown" as const,
          }
        : undefined,
      dataset: form.dataset.map((d) => ({
        title: d.title,
        dataset_id: idFor(d.dataset_id ?? d.title, "other"),
        description: blank(d.description),
        type: DATASET_TYPE_LABEL[d.type],
        // v3.0 repurposed `keyword` as a retention flag; subject keywords
        // belong in `subject`.
        subject:
          d.keyword.length > 0
            ? d.keyword.map((k) => ({ heading_name: k }))
            : undefined,
        language: d.language ? toIso6393(d.language) : undefined,
        personal_data: d.personal_data,
        sensitive_data: d.sensitive_data,
        data_quality_assurance: d.data_quality_assurance
          ? [d.data_quality_assurance]
          : undefined,
        preservation_statement: blank(d.preservation?.statement),
        distribution:
          d.distribution.length > 0
            ? distributionsFor(d, licenceStart)
            : undefined,
        domain: d.domain && d.domain !== "generic" ? d.domain : undefined,
        domain_metadata: exportableMetadata(d.domain_metadata),
      })),
    },
  };

  return madmpExportSchema.parse(stripUndefined(out));
}

/** JSON has no `undefined`; leaving the keys in would make them `null`-ish noise. */
const stripUndefined = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;
