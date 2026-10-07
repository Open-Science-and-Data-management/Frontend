import React from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { KeywordInput } from "@/components/dmp/KeywordInput";
import { SchemaFieldTable } from "@/components/dmp/SchemaFieldTable";
import { DistributionList } from "@/components/dmp/DistributionList";
import { DomainFields } from "@/components/dmp/DomainFields";
import { datasetFieldPolicy } from "@/config/field-policy";
import {
  PROTECTION_LEVELS,
  PROTECTION_LEVEL_HINTS,
  SECURITY_CLASSIFICATION_LEVELS,
} from "@/schemas/madmp/vocabularies";
import {
  DomainKeyEnum,
  domainProfiles,
  foreignDomainKeys,
  getDomainProfile,
  type DomainKey,
} from "@/schemas/dataset/domain-profiles";
import {
  DatasetType,
  DatasetStatus,
  DataAccess,
  YesNoUnknown,
} from "@/schemas/shared";
import { useDmpStore } from "@/store/dmpStore";
import { useTaskStore } from "@/store/taskStore";
import { useToastStore } from "@/store/toastStore";
import type { Dataset } from "@/types/dataset";
import { cn } from "@/utils/cn";

/** True for a stored value that isn't on the v3.0 list — kept, but flagged. */
const legacy = (value: string, options: readonly string[]) =>
  Boolean(value) && !options.includes(value);

/**
 * maDMP v3.0 lets an institution use its own scale, provided the scale is
 * named and the level given — "Mahidol data classification", "Level 2".
 */
const OtherScheme: React.FC<{
  id: string;
  nomenclature?: string;
  level?: string;
  onChange: (nomenclature: string, level: string) => void;
}> = ({ id, nomenclature = "", level = "", onChange }) => (
  // Stacked: each sits in a half-width column, where side by side truncates.
  <div className="grid grid-cols-1 gap-2">
    <Input
      id={`${id}-scheme`}
      aria-label="Name of your classification scheme"
      placeholder="Scheme, e.g. university policy"
      value={nomenclature}
      onChange={(e) => onChange(e.target.value, level)}
    />
    <Input
      id={`${id}-level`}
      aria-label="Level within that scheme"
      placeholder="Level within it"
      value={level}
      onChange={(e) => onChange(nomenclature, e.target.value)}
    />
  </div>
);

interface DatasetCardProps {
  dataset: Dataset;
}

export const DatasetCard: React.FC<DatasetCardProps> = ({ dataset }) => {
  const [expanded, setExpanded] = React.useState(true);
  const {
    updateDataset,
    changeDatasetType,
    changeDatasetDomain,
    removeDataset,
  } = useDmpStore();
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const cancelTasksForDataset = useTaskStore((s) => s.cancelTasksForDataset);
  const toast = useToastStore((s) => s.toast);
  const confirm = useConfirm();

  const id = dataset.dataset_id as string;
  const planInForce = useDmpStore(
    (s) =>
      s.dmps.find((d) => d.dmp_id === s.currentDmpId)?.active_version !==
      undefined,
  );
  const patch = (p: Partial<Dataset>) => updateDataset(id, p);

  const profile = getDomainProfile(dataset.domain);

  // Switching domain throws metadata away, so say which fields before doing it.
  const switchDomain = async (next: DomainKey) => {
    if (next === (dataset.domain ?? "generic")) return;
    const dropped = foreignDomainKeys(next, dataset.domain_metadata ?? {});

    if (dropped.length > 0) {
      const names = dropped.map(
        (key) => profile.fields.find((f) => f.key === key)?.label ?? key,
      );
      const ok = await confirm({
        title: `Clear ${names.length} ${profile.label} field${names.length === 1 ? "" : "s"}?`,
        description: `${domainProfiles[next].label} has no place for ${names.join(", ")}, so switching clears ${names.length === 1 ? "it" : "them"}.`,
        confirmLabel: "Switch domain",
      });
      if (!ok) return;
    }
    changeDatasetDomain(id, next);
  };

  const composeStatement = () => {
    const { repository, duration, format } = dataset.preservation ?? {};
    const parts = [
      repository && `Preserved in ${repository}`,
      format && `as ${format}`,
      duration && `for ${duration}`,
      dataset.preservation?.doi_requested && "with a DOI requested",
    ].filter(Boolean);
    const statement = parts.length
      ? `${parts.join(" ")}.`
      : "Add a repository, format, or duration above to compose a statement.";
    patch({ preservation: { ...dataset.preservation, statement } });
  };

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {dataset.title || "Untitled research output"}
          </span>
          <StatusBadge status="draft">{dataset.type}</StatusBadge>
          <span className="text-xs text-muted-foreground capitalize">
            {dataset.status}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="space-y-5 border-t p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor={`type-${id}`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Output type
              </label>
              <Select
                id={`type-${id}`}
                className="w-40"
                value={dataset.type}
                onChange={(e) =>
                  changeDatasetType(id, e.target.value as Dataset["type"])
                }
              >
                {DatasetType.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor={`status-${id}`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Status
              </label>
              <Select
                id={`status-${id}`}
                className="w-36"
                value={dataset.status}
                onChange={(e) =>
                  patch({ status: e.target.value as Dataset["status"] })
                }
              >
                {DatasetStatus.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor={`domain-${id}`}
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Research domain
              </label>
              <Select
                id={`domain-${id}`}
                className="w-44"
                value={dataset.domain ?? "generic"}
                onChange={(e) => void switchDomain(e.target.value as DomainKey)}
              >
                {DomainKeyEnum.options.map((option) => (
                  <option key={option} value={option}>
                    {domainProfiles[option].label}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto text-destructive hover:bg-destructive/10"
              onClick={async () => {
                if (
                  await confirm({
                    title: "Remove this research output?",
                    description: planInForce
                      ? "Removing an output is a major change, so it goes for sign-off. Its tasks keep running until then, and are cancelled — not deleted — once the change is in force."
                      : "Its distributions and preservation details go with it. Any open tasks for it are cancelled, not deleted, so the trail survives.",
                    confirmLabel: "Remove output",
                  })
                ) {
                  // In a plan in force the removal is only proposed; the tasks
                  // are cancelled when the version that drops it takes effect
                  // (store/planEffects). Otherwise it takes effect now.
                  const cancelled =
                    currentDmpId && !planInForce
                      ? cancelTasksForDataset(currentDmpId, id, dataset.title)
                      : 0;
                  removeDataset(id);
                  if (cancelled > 0) {
                    toast({
                      title: `${cancelled} task${cancelled === 1 ? "" : "s"} cancelled`,
                      description:
                        "They stay on the board for the record, marked cancelled.",
                    });
                  }
                }
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remove
            </Button>
          </div>

          <FormField
            name={`title-${id}`}
            label="Title"
            policy={datasetFieldPolicy.title}
            required
          >
            <Input
              id={`title-${id}`}
              value={dataset.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </FormField>

          <FormField
            name={`description-${id}`}
            label="Description"
            policy={datasetFieldPolicy.description}
          >
            <Textarea
              id={`description-${id}`}
              rows={2}
              value={dataset.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </FormField>

          <FormField
            name={`keyword-${id}`}
            label="Keywords"
            policy={datasetFieldPolicy.keyword}
          >
            <KeywordInput
              id={`keyword-${id}`}
              keywords={dataset.keyword}
              onChange={(keyword) => patch({ keyword })}
            />
          </FormField>

          <section
            aria-label="Domain details"
            className="space-y-3 rounded-lg border border-dashed p-3"
          >
            <div>
              <h4 className="text-sm font-medium">{profile.label} details</h4>
              <p className="text-xs text-muted-foreground">
                {profile.key === "generic"
                  ? "Core fields cover every domain."
                  : profile.description}
              </p>
            </div>
            <DomainFields
              datasetId={id}
              domain={dataset.domain}
              metadata={dataset.domain_metadata ?? {}}
              onChange={(domain_metadata) => patch({ domain_metadata })}
            />
          </section>

          <div>
            <label
              htmlFor={`located-${id}`}
              className="mb-1 block text-sm font-medium"
            >
              Located at
            </label>
            <Input
              id={`located-${id}`}
              value={dataset.located_at ?? ""}
              onChange={(e) => patch({ located_at: e.target.value })}
              placeholder="Storage location or system"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              name={`access-${id}`}
              label="Access"
              policy={datasetFieldPolicy.access}
              required
            >
              <Select
                id={`access-${id}`}
                value={dataset.access}
                onChange={(e) =>
                  patch({ access: e.target.value as Dataset["access"] })
                }
              >
                {DataAccess.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              name={`personal-${id}`}
              label="Personal data?"
              policy={datasetFieldPolicy.personal_data}
              required
            >
              <Select
                id={`personal-${id}`}
                value={dataset.personal_data}
                onChange={(e) =>
                  patch({
                    personal_data: e.target.value as Dataset["personal_data"],
                  })
                }
              >
                {YesNoUnknown.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              name={`sensitive-${id}`}
              label="Sensitive data?"
              policy={datasetFieldPolicy.sensitive_data}
              required
            >
              <Select
                id={`sensitive-${id}`}
                value={dataset.sensitive_data}
                onChange={(e) =>
                  patch({
                    sensitive_data: e.target.value as Dataset["sensitive_data"],
                  })
                }
              >
                {YesNoUnknown.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField
            name={`personal-plan-${id}`}
            label="Personal data handling plan"
            policy={datasetFieldPolicy.personal_data_plan}
          >
            <Textarea
              id={`personal-plan-${id}`}
              rows={2}
              value={dataset.personal_data_plan ?? ""}
              onChange={(e) => patch({ personal_data_plan: e.target.value })}
              placeholder="Leave blank if not applicable"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              name={`protection-${id}`}
              label="Protection level"
              policy={datasetFieldPolicy.protection_level}
              required
              hint={
                PROTECTION_LEVEL_HINTS[
                  dataset.protection_level as keyof typeof PROTECTION_LEVEL_HINTS
                ]
              }
            >
              <div className="space-y-2">
                <Select
                  id={`protection-${id}`}
                  value={dataset.protection_level}
                  onChange={(e) => patch({ protection_level: e.target.value })}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {PROTECTION_LEVELS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {/* A value from before maDMP v3.0 stays visible until changed. */}
                  {legacy(dataset.protection_level, PROTECTION_LEVELS) && (
                    <option value={dataset.protection_level}>
                      {dataset.protection_level} (earlier scale)
                    </option>
                  )}
                </Select>
                {dataset.protection_level === "other" && (
                  <OtherScheme
                    id={`protection-${id}`}
                    nomenclature={dataset.protection_level_other_nomenclature}
                    level={dataset.protection_level_other}
                    onChange={(nomenclature, level) =>
                      patch({
                        protection_level_other_nomenclature: nomenclature,
                        protection_level_other: level,
                      })
                    }
                  />
                )}
              </div>
            </FormField>

            <FormField
              name={`security-${id}`}
              label="Security classification"
              policy={datasetFieldPolicy.security_classification_level}
              required
            >
              <div className="space-y-2">
                <Select
                  id={`security-${id}`}
                  value={dataset.security_classification_level}
                  onChange={(e) =>
                    patch({ security_classification_level: e.target.value })
                  }
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {SECURITY_CLASSIFICATION_LEVELS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {legacy(
                    dataset.security_classification_level,
                    SECURITY_CLASSIFICATION_LEVELS,
                  ) && (
                    <option value={dataset.security_classification_level}>
                      {dataset.security_classification_level} (earlier scale)
                    </option>
                  )}
                </Select>
                {dataset.security_classification_level === "other" && (
                  <OtherScheme
                    id={`security-${id}`}
                    nomenclature={
                      dataset.security_classification_level_other_nomenclature
                    }
                    level={dataset.security_classification_level_other}
                    onChange={(nomenclature, level) =>
                      patch({
                        security_classification_level_other_nomenclature:
                          nomenclature,
                        security_classification_level_other: level,
                      })
                    }
                  />
                )}
              </div>
            </FormField>
          </div>

          <div>
            <label
              htmlFor={`dqa-${id}`}
              className="mb-1 block text-sm font-medium"
            >
              Data quality assurance
            </label>
            <Textarea
              id={`dqa-${id}`}
              rows={2}
              value={dataset.data_quality_assurance ?? ""}
              onChange={(e) =>
                patch({ data_quality_assurance: e.target.value })
              }
              placeholder="Leave blank if not applicable"
            />
          </div>

          {dataset.type === "raw" && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Schema fields</h3>
              <SchemaFieldTable
                fields={dataset.schema_fields}
                onChange={(schema_fields) => patch({ schema_fields })}
              />
            </div>
          )}

          {dataset.type === "software" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`repo-url-${id}`}
                  className="mb-1 block text-sm font-medium"
                >
                  Repository URL
                </label>
                <Input
                  id={`repo-url-${id}`}
                  value={dataset.repository_url ?? ""}
                  onChange={(e) => patch({ repository_url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div>
                <label
                  htmlFor={`sw-version-${id}`}
                  className="mb-1 block text-sm font-medium"
                >
                  Software version
                </label>
                <Input
                  id={`sw-version-${id}`}
                  value={dataset.software_version ?? ""}
                  onChange={(e) => patch({ software_version: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <h3 className="text-sm font-medium">Preservation</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                aria-label="Repository"
                placeholder="Repository"
                value={dataset.preservation?.repository ?? ""}
                onChange={(e) =>
                  patch({
                    preservation: {
                      ...dataset.preservation,
                      repository: e.target.value,
                    },
                  })
                }
              />
              <Input
                aria-label="Duration"
                placeholder="Duration (e.g. 10 years)"
                value={dataset.preservation?.duration ?? ""}
                onChange={(e) =>
                  patch({
                    preservation: {
                      ...dataset.preservation,
                      duration: e.target.value,
                    },
                  })
                }
              />
              <Input
                aria-label="Format"
                placeholder="Format"
                value={dataset.preservation?.format ?? ""}
                onChange={(e) =>
                  patch({
                    preservation: {
                      ...dataset.preservation,
                      format: e.target.value,
                    },
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Toggle
                checked={dataset.preservation?.doi_requested ?? false}
                onCheckedChange={(checked) =>
                  patch({
                    preservation: {
                      ...dataset.preservation,
                      doi_requested: checked,
                    },
                  })
                }
              />
              DOI requested
            </label>

            <FormField
              name={`statement-${id}`}
              label="Preservation statement"
              policy={datasetFieldPolicy["preservation.statement"]}
            >
              <div className="space-y-2">
                <Textarea
                  id={`statement-${id}`}
                  rows={2}
                  value={dataset.preservation?.statement ?? ""}
                  onChange={(e) =>
                    patch({
                      preservation: {
                        ...dataset.preservation,
                        statement: e.target.value,
                      },
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={composeStatement}
                >
                  Compose from above
                </Button>
              </div>
            </FormField>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Distribution</h3>
            <DistributionList
              datasetId={id}
              distributions={dataset.distribution}
              onChange={(distribution) => patch({ distribution })}
            />
          </div>
        </div>
      )}
    </div>
  );
};
