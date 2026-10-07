import type { DmpForm } from "../dmp/dmp.schema";
import { dayString } from "@/utils/calendarDate";
import type { Dataset } from "../dataset/dataset.schema";
import {
  contributorFullName,
  type Contributor,
} from "../contributor/contributor.schema";

/**
 * Export to the RDA DMP Common Standard for machine-actionable DMPs, v1.3.
 * Source: https://github.com/RDA-DMP-Common/RDA-DMP-Common-Standard
 * (examples/JSON/JSON-schema/1.3). Conformance is checked in mapper.test.ts
 * against the vendored schema.
 *
 * RDA is the flat, discipline-agnostic core that GCWG-RDA v3.0 extends, so it
 * carries less: no approval block, no classification fields. Protection and
 * security travel in `security_and_privacy`, which is where RDA puts them.
 */

export const RDA_SCHEMA_NAME = "RDA DMP Common Standard" as const;
export const RDA_SCHEMA_VERSION = "1.3" as const;

/**
 * RDA uses ISO 639-2 and, unlike GCWG-RDA v3.0, lists macrolanguage codes —
 * so zh stays zho and ar stays ara here. Checked against the schema in tests.
 */
export const ISO_639_1_TO_2: Record<string, string> = {
  aa: "aar",
  ab: "abk",
  ae: "ave",
  af: "afr",
  ak: "aka",
  am: "amh",
  an: "arg",
  ar: "ara",
  as: "asm",
  av: "ava",
  ay: "aym",
  az: "aze",
  ba: "bak",
  be: "bel",
  bg: "bul",
  bh: "bih",
  bi: "bis",
  bm: "bam",
  bn: "ben",
  bo: "bod",
  br: "bre",
  bs: "bos",
  ca: "cat",
  ce: "che",
  ch: "cha",
  co: "cos",
  cr: "cre",
  cs: "ces",
  cu: "chu",
  cv: "chv",
  cy: "cym",
  da: "dan",
  de: "deu",
  dv: "div",
  dz: "dzo",
  ee: "ewe",
  el: "ell",
  en: "eng",
  eo: "epo",
  es: "spa",
  et: "est",
  eu: "eus",
  fa: "fas",
  ff: "ful",
  fi: "fin",
  fj: "fij",
  fo: "fao",
  fr: "fra",
  fy: "fry",
  ga: "gle",
  gd: "gla",
  gl: "glg",
  gn: "grn",
  gu: "guj",
  gv: "glv",
  ha: "hau",
  he: "heb",
  hi: "hin",
  ho: "hmo",
  hr: "hrv",
  ht: "hat",
  hu: "hun",
  hy: "hye",
  hz: "her",
  ia: "ina",
  id: "ind",
  ie: "ile",
  ig: "ibo",
  ii: "iii",
  ik: "ipk",
  io: "ido",
  is: "isl",
  it: "ita",
  iu: "iku",
  ja: "jpn",
  jv: "jav",
  ka: "kat",
  kg: "kon",
  ki: "kik",
  kj: "kua",
  kk: "kaz",
  kl: "kal",
  km: "khm",
  kn: "kan",
  ko: "kor",
  kr: "kau",
  ks: "kas",
  ku: "kur",
  kv: "kom",
  kw: "cor",
  ky: "kir",
  la: "lat",
  lb: "ltz",
  lg: "lug",
  li: "lim",
  ln: "lin",
  lo: "lao",
  lt: "lit",
  lu: "lub",
  lv: "lav",
  mg: "mlg",
  mh: "mah",
  mi: "mri",
  mk: "mkd",
  ml: "mal",
  mn: "mon",
  mr: "mar",
  ms: "msa",
  mt: "mlt",
  my: "mya",
  na: "nau",
  nb: "nob",
  nd: "nde",
  ne: "nep",
  ng: "ndo",
  nl: "nld",
  nn: "nno",
  no: "nor",
  nr: "nbl",
  nv: "nav",
  ny: "nya",
  oc: "oci",
  oj: "oji",
  om: "orm",
  or: "ori",
  os: "oss",
  pa: "pan",
  pi: "pli",
  pl: "pol",
  ps: "pus",
  pt: "por",
  qu: "que",
  rm: "roh",
  rn: "run",
  ro: "ron",
  ru: "rus",
  rw: "kin",
  sa: "san",
  sc: "srd",
  sd: "snd",
  se: "sme",
  sg: "sag",
  si: "sin",
  sk: "slk",
  sl: "slv",
  sm: "smo",
  sn: "sna",
  so: "som",
  sq: "sqi",
  sr: "srp",
  ss: "ssw",
  st: "sot",
  su: "sun",
  sv: "swe",
  sw: "swa",
  ta: "tam",
  te: "tel",
  tg: "tgk",
  th: "tha",
  ti: "tir",
  tk: "tuk",
  tl: "tgl",
  tn: "tsn",
  to: "ton",
  tr: "tur",
  ts: "tso",
  tt: "tat",
  tw: "twi",
  ty: "tah",
  ug: "uig",
  uk: "ukr",
  ur: "urd",
  uz: "uzb",
  ve: "ven",
  vi: "vie",
  vo: "vol",
  wa: "wln",
  wo: "wol",
  xh: "xho",
  yi: "yid",
  yo: "yor",
  za: "zha",
  zh: "zho",
  zu: "zul",
};

export const toIso6392 = (code?: string): string | undefined => {
  const value = code?.trim().toLowerCase();
  if (!value) return undefined;
  return value.length === 3 ? value : ISO_639_1_TO_2[value];
};

/** Canonical deeds for the identifiers people actually type. */
const LICENCE_URLS: Record<string, string> = {
  "cc-by-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "cc-by-sa-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "cc-by-nc-4.0": "https://creativecommons.org/licenses/by-nc/4.0/",
  "cc-by-nd-4.0": "https://creativecommons.org/licenses/by-nd/4.0/",
  "cc-by-nc-sa-4.0": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  "cc-by-nc-nd-4.0": "https://creativecommons.org/licenses/by-nc-nd/4.0/",
  "cc0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  cc0: "https://creativecommons.org/publicdomain/zero/1.0/",
  mit: "https://opensource.org/licenses/MIT",
  "apache-2.0": "https://www.apache.org/licenses/LICENSE-2.0",
  "gpl-3.0": "https://www.gnu.org/licenses/gpl-3.0.html",
  "odbl-1.0": "https://opendatacommons.org/licenses/odbl/1-0/",
};

/**
 * RDA wants a link to the licence document. A URL passes through, a known
 * identifier becomes its deed, any other SPDX-style identifier its SPDX page.
 * Free text that is none of these can't honestly be turned into a link.
 */
export const licenceUrl = (licence?: string): string | undefined => {
  const value = licence?.trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  const known = LICENCE_URLS[value.toLowerCase().replace(/\s+/g, "-")];
  if (known) return known;
  return /^[A-Za-z0-9.+-]+$/.test(value)
    ? `https://spdx.org/licenses/${value}.html`
    : undefined;
};

export interface RdaContext {
  dmpId: string;
  created?: Date;
  modified?: Date;
  project?: { title: string; description?: string };
}

const yn = (b: boolean): "yes" | "no" => (b ? "yes" : "no");
const day = (d?: Date) => dayString(d) || undefined;
const blank = (s?: string) => (s?.trim() ? s.trim() : undefined);
const looksLikeDoi = (value: string) =>
  /^(https?:\/\/(dx\.)?doi\.org\/)?10\.\d{4,9}\//i.test(value);

const personId = (c: Contributor) =>
  c.orcid
    ? { identifier: c.orcid, type: "orcid" }
    : {
        identifier: c.email || `contributor:${c.contributor_id ?? c.name}`,
        type: "other",
      };

const DATASET_TYPE_LABEL: Record<Dataset["type"], string> = {
  raw: "dataset",
  software: "software",
  publication: "text",
  other: "other",
};

const exportableMetadata = (metadata: Record<string, unknown> = {}) => {
  const entries = Object.entries(metadata).map(([key, value]) => [
    key,
    // Domain dates are calendar days, exported as the day itself.
    value instanceof Date ? dayString(value) : value,
  ]);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const classification = (
  label: string,
  level?: string,
  scheme?: string,
  other?: string,
) => {
  if (!level?.trim()) return undefined;
  const value =
    level === "other"
      ? [scheme, other].filter(Boolean).join(": ") || "other"
      : level;
  return { title: label, description: value };
};

export type RdaExport = { dmp: Record<string, unknown> };

/** Maps a validated plan to an RDA DMP Common Standard v1.3 document. */
export function mapFormToRda(form: DmpForm, context: RdaContext): RdaExport {
  const contact =
    form.contributor.find((c) => c.is_contact) ?? form.contributor[0];
  const now = new Date();
  const licenceStart = day(form.begin_date) ?? day(now);

  const out = {
    dmp: {
      title: form.title,
      description: blank(form.description),
      language: toIso6392(form.language) ?? "eng",
      created: (context.created ?? now).toISOString(),
      modified: (context.modified ?? now).toISOString(),
      dmp_id: {
        identifier: context.dmpId,
        type: looksLikeDoi(context.dmpId) ? "doi" : "other",
      },
      ethical_issues_exist: yn(form.ethical_issues_exist),
      ethical_issues_description: blank(form.ethical_issues_description),
      ethical_issues_report: blank(form.ethical_issues_report),
      alternate_identifier: form.alternate_identifier
        ? [
            {
              identifier: form.alternate_identifier.identifier,
              type: form.alternate_identifier.type,
            },
          ]
        : undefined,
      contact: {
        name: contributorFullName(contact),
        mbox: contact.email ?? "",
        contact_id: personId(contact),
      },
      contributor: form.contributor.map((c) => ({
        name: contributorFullName(c),
        mbox: blank(c.email),
        role: [c.role],
        contributor_id: personId(c),
      })),
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
              currency_code: c.currency_code,
            }))
          : undefined,
      dataset: form.dataset.map((d) => {
        const security = [
          classification(
            "Protection level",
            d.protection_level,
            d.protection_level_other_nomenclature,
            d.protection_level_other,
          ),
          classification(
            "Security classification",
            d.security_classification_level,
            d.security_classification_level_other_nomenclature,
            d.security_classification_level_other,
          ),
        ].filter(Boolean);

        return {
          title: d.title,
          dataset_id: { identifier: d.dataset_id ?? d.title, type: "other" },
          description: blank(d.description),
          type: DATASET_TYPE_LABEL[d.type],
          keyword: d.keyword.length > 0 ? d.keyword : undefined,
          language: toIso6392(d.language),
          personal_data: d.personal_data,
          sensitive_data: d.sensitive_data,
          data_quality_assurance: d.data_quality_assurance
            ? [d.data_quality_assurance]
            : undefined,
          preservation_statement: blank(d.preservation?.statement),
          security_and_privacy: security.length > 0 ? security : undefined,
          distribution:
            d.distribution.length > 0
              ? d.distribution.map((dist) => {
                  const url = licenceUrl(dist.license);
                  const unlinked = !url && blank(dist.license);
                  return {
                    title: dist.title,
                    // A licence that isn't a link is kept in words, not dropped.
                    description: unlinked ? `Licence: ${unlinked}` : undefined,
                    data_access: dist.data_access,
                    access_url: blank(dist.access_url),
                    download_url: blank(dist.download_url),
                    format: dist.format ? [dist.format] : undefined,
                    byte_size: dist.byte_size,
                    license: url
                      ? [{ license_ref: url, start_date: licenceStart }]
                      : undefined,
                  };
                })
              : undefined,
          // Extensions: RDA admits further fields, and these hold the plan's
          // only domain-specific detail.
          domain: d.domain && d.domain !== "generic" ? d.domain : undefined,
          domain_metadata: exportableMetadata(d.domain_metadata),
        };
      }),
    },
  };

  // JSON has no undefined; drop the keys rather than ship them.
  return JSON.parse(JSON.stringify(out)) as RdaExport;
}
