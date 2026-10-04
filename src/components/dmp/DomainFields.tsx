import React from "react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  getDomainProfile,
  validateDomainMetadata,
  type DomainField,
} from "@/schemas/dataset/domain-profiles";

interface DomainFieldsProps {
  /** Scopes the generated input ids to one dataset. */
  datasetId: string;
  domain?: string;
  metadata: Record<string, unknown>;
  onChange: (metadata: Record<string, unknown>) => void;
}

/** An empty input means "not answered", not an empty string on the record. */
const isBlank = (value: unknown) =>
  value === "" || value === undefined || value === null;

const asText = (value: unknown) => (isBlank(value) ? "" : String(value));

/** Dates are stored as Dates but edited as yyyy-MM-dd. */
const asDateInput = (value: unknown) => {
  if (isBlank(value)) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

/**
 * Renders whatever the selected domain profile declares.
 *
 * There is deliberately no per-domain branching here: a new domain added to
 * the registry shows up in this form without touching this file. The only
 * thing that varies is `field.type`.
 */
export const DomainFields: React.FC<DomainFieldsProps> = ({
  datasetId,
  domain,
  metadata,
  onChange,
}) => {
  const profile = getDomainProfile(domain);

  // The same validation the plan is judged by, surfaced next to the input.
  const errors = React.useMemo(() => {
    const result = validateDomainMetadata(domain, metadata);
    if (result.success) return {};
    return Object.fromEntries(
      result.error.issues.map((issue) => [
        String(issue.path[0] ?? ""),
        issue.message,
      ]),
    );
  }, [domain, metadata]);

  if (profile.fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {profile.description} Pick a research domain above to record the details
        that field expects.
      </p>
    );
  }

  const set = (key: string, value: unknown) => {
    const next = { ...metadata };
    // Clearing a field removes the key — a stray "" would fail the profile's
    // own type check on the next parse.
    if (isBlank(value)) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const control = (field: DomainField) => {
    const inputId = `${field.key}-${datasetId}`;
    const value = metadata[field.key];

    switch (field.type) {
      case "textarea":
        return (
          <Textarea
            id={inputId}
            rows={2}
            value={asText(value)}
            onChange={(e) => set(field.key, e.target.value)}
          />
        );

      case "number":
        return (
          <Input
            id={inputId}
            type="number"
            value={asText(value)}
            onChange={(e) =>
              set(
                field.key,
                e.target.value === "" ? "" : Number(e.target.value),
              )
            }
          />
        );

      case "date":
        return (
          <Input
            id={inputId}
            type="date"
            value={asDateInput(value)}
            onChange={(e) =>
              set(
                field.key,
                e.target.value ? new Date(`${e.target.value}T00:00:00`) : "",
              )
            }
          />
        );

      case "select":
        return (
          <Select
            id={inputId}
            value={asText(value)}
            onChange={(e) => set(field.key, e.target.value)}
          >
            <option value="">Not specified</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        );

      case "toggle":
        return (
          <Toggle
            id={inputId}
            checked={value === true}
            onCheckedChange={(checked) => set(field.key, checked)}
          />
        );

      default:
        return (
          <Input
            id={inputId}
            value={asText(value)}
            onChange={(e) => set(field.key, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {profile.fields.map((field) => (
        <FormField
          key={field.key}
          name={`${field.key}-${datasetId}`}
          label={field.label}
          // A profile declares its own policy, so a policy-bearing domain
          // field is human-owned without field-policy knowing it exists.
          policy={{ permission: field.permission ?? "ai" }}
          required={field.required}
          hint={field.help}
          error={errors[field.key]}
        >
          {control(field)}
        </FormField>
      ))}
    </div>
  );
};
