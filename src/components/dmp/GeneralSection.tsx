import React from "react";
import { dayString, fromDayString } from "@/utils/calendarDate";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { dmpFieldPolicy } from "@/config/field-policy";
import { IdentifierType, LANGUAGE_CODES } from "@/schemas/shared";
import { useDmpStore } from "@/store/dmpStore";
import type { RegenerateDirection } from "@/api/aiApi";

const toDateInputValue = (d: Date | undefined) => dayString(d);
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
const displayName = (code: string) => {
  try {
    const name = languageNames.of(code);
    return name && name !== code ? name : undefined;
  } catch {
    return undefined;
  }
};

const LANGUAGE_CHOICES = LANGUAGE_CODES.flatMap((code) => {
  const label = displayName(code);
  return label ? [{ code, label }] : [];
}).sort((a, b) => a.label.localeCompare(b.label));

export const GeneralSection: React.FC = () => {
  const { draft, regeneratingFields, setField, regenerateField } =
    useDmpStore();
  // Only what the analysis reported. Absent, the fields make no claim about
  // where their values came from.
  const provenance = useDmpStore((s) => s.provenance);

  const runRegenerate =
    (key: "title" | "description", label: string) =>
    (direction: RegenerateDirection) =>
      regenerateField(key, label, direction);

  return (
    <div className="space-y-6">
      <FormField
        name="title"
        label="Title"
        policy={dmpFieldPolicy.title}
        required
        provenance={provenance?.title}
        onRegenerate={runRegenerate("title", "Title")}
        isRegenerating={regeneratingFields.title}
      >
        <Input
          id="title"
          value={draft.title ?? ""}
          onChange={(e) => setField("title", e.target.value)}
          placeholder="e.g. Genomic Diversity Mapping of Urban Pollinator Populations"
        />
      </FormField>

      <FormField
        name="description"
        label="Description"
        policy={dmpFieldPolicy.description}
        required
        provenance={provenance?.description}
        onRegenerate={runRegenerate("description", "Description")}
        isRegenerating={regeneratingFields.description}
      >
        <Textarea
          id="description"
          rows={4}
          value={draft.description ?? ""}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="What is this project about, and why does it need a data management plan?"
        />
      </FormField>

      <FormField
        name="language"
        label="Language"
        policy={dmpFieldPolicy.language}
        required
        provenance={provenance?.language}
        hint="The language the plan itself is written in"
      >
        <Select
          id="language"
          className="max-w-64"
          value={draft.language ?? ""}
          onChange={(e) => setField("language", e.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {/* Keep an existing value selectable even if it has no display name */}
          {draft.language &&
            !LANGUAGE_CHOICES.some((o) => o.code === draft.language) && (
              <option value={draft.language}>{draft.language}</option>
            )}
          {LANGUAGE_CHOICES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label} ({option.code})
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        name="alternate_identifier"
        label="Alternate identifier"
        policy={dmpFieldPolicy.alternate_identifier}
      >
        <div className="flex gap-2">
          <Input
            id="alternate_identifier"
            className="flex-1"
            placeholder="Identifier value"
            value={draft.alternate_identifier?.identifier ?? ""}
            onChange={(e) =>
              setField("alternate_identifier", {
                type: draft.alternate_identifier?.type ?? "doi",
                identifier: e.target.value,
              })
            }
          />
          <Select
            aria-label="Identifier type"
            className="w-28"
            value={draft.alternate_identifier?.type ?? "doi"}
            onChange={(e) =>
              setField("alternate_identifier", {
                identifier: draft.alternate_identifier?.identifier ?? "",
                type: e.target.value as (typeof IdentifierType.options)[number],
              })
            }
          >
            {IdentifierType.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          name="begin_date"
          label="Begin date"
          policy={dmpFieldPolicy.begin_date}
          required
          lockedReason="The assistant can't change this; you can, and after approval it needs sign-off again."
        >
          <Input
            id="begin_date"
            type="date"
            value={toDateInputValue(draft.begin_date)}
            onChange={(e) =>
              setField("begin_date", fromDayString(e.target.value))
            }
          />
        </FormField>

        <FormField
          name="end_date"
          label="End date"
          policy={dmpFieldPolicy.end_date}
          required
          lockedReason="The assistant can't change this; you can, and after approval it needs sign-off again."
        >
          <Input
            id="end_date"
            type="date"
            value={toDateInputValue(draft.end_date)}
            onChange={(e) =>
              setField("end_date", fromDayString(e.target.value))
            }
          />
        </FormField>
      </div>
    </div>
  );
};
