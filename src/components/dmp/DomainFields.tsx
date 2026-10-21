import React from "react";
import { dayString, fromDayString } from "@/utils/calendarDate";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import {
  getDomainProfile,
  validateDomainMetadata,
  type DomainField,
  type DomainFieldType,
} from "@/schemas/dataset/domain-profiles";
import type { FieldKind } from "@/config/field-policy";

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

/** Dates are stored as calendar dates but edited as yyyy-MM-dd. */
const asDateInput = (value: unknown) => {
  if (isBlank(value)) return "";
  return dayString(value instanceof Date ? value : new Date(String(value)));
};

/**
 * Renders whatever the selected domain profile declares.
 *
 * There is deliberately no per-domain branching here: a new domain added to
 * the registry shows up in this form without touching this file. The only
 * thing that varies is `field.type`.
 */

/**
 * A domain field's kind, from its input type. A one-line "text" field holds
 * a name or code (an organism, a station id), not prose to rephrase; only a
 * "textarea" is free text.
 */
const DOMAIN_FIELD_KIND: Record<DomainFieldType, FieldKind> = {
  text: "identifier",
  textarea: "prose",
  select: "choice",
  number: "number",
  date: "date",
  toggle: "boolean",
};

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
              set(field.key, fromDayString(e.target.value) ?? "")
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
          policy={{
            permission: field.permission ?? "ai",
            kind: DOMAIN_FIELD_KIND[field.type],
          }}
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
