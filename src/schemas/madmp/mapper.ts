import type { DmpForm } from "../dmp/dmp.schema";
import { contributorFullName } from "../contributor/contributor.schema";
import { madmpExportSchema, type MadmpExport } from "./madmp-export.schema";

const yn = (b: boolean): "yes" | "no" => (b ? "yes" : "no");
const nowIso = () => new Date().toISOString();

// map DmpForm (from react-hook-form) to maDMP export schema (for submission)
export function mapFormToMadmp(
  form: DmpForm,
  ids: { dmpDoi: string; projectStart?: string; projectEnd?: string },
): MadmpExport {
  const contact = form.contributor.find((c) => c.is_contact) ?? form.contributor[0];

  const out = {
    dmp: {
      title: form.title,
      description: form.description,
      language: form.language,
      created: nowIso(),
      modified: nowIso(),
      dmp_id: { identifier: ids.dmpDoi, type: "doi" },
      ethical_issues_exist: yn(form.ethical_issues_exist),
      ethical_issues_description: form.ethical_issues_description,
      contact: {
        name: contributorFullName(contact),
        contact_id: { identifier: contact.orcid || "unknown", type: "orcid" },
      },
      contributor: form.contributor.map((c) => ({
        name: contributorFullName(c),
        role: [c.role],
        contributor_id: c.orcid ? { identifier: c.orcid, type: "orcid" } : undefined,
      })),
      cost: form.cost.map((c) => ({
        title: c.title,
        description: c.description,
        value: c.value,
        currency_code: c.currency_code,
      })),
      project: [{ title: form.title, start: ids.projectStart, end: ids.projectEnd }],
      dataset: form.dataset.map((d) => ({
        title: d.title,
        type: d.type,
        description: d.description,
        dataset_id: { identifier: d.dataset_id ?? "unknown", type: "doi" },
        personal_data: d.personal_data,
        sensitive_data: d.sensitive_data,
        keyword: d.keyword,
        data_quality_assurance: d.data_quality_assurance ? [d.data_quality_assurance] : undefined,
        preservation_statement: d.preservation?.statement,
        distribution: d.distribution.map((dist) => ({
          title: dist.title,
          access_url: dist.access_url || undefined,
          download_url: dist.download_url || undefined,
          format: dist.format ? [dist.format] : undefined,
          byte_size: dist.byte_size,
          data_access: dist.data_access,
          license: dist.license ? [{ license_ref: dist.license, start_date: nowIso() }] : undefined,
        })),
        protection_level: d.protection_level,
        security_classification_level: d.security_classification_level,
      })),
      schema_version: form.schema_version,
    },
  };

  return madmpExportSchema.parse(out);
}
