import React from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { dmpFieldPolicy } from "@/config/field-policy";
import {
  MADMP_SCHEMA_NAME,
  MADMP_SCHEMA_URI,
  MADMP_SCHEMA_VERSION,
} from "@/schemas/madmp/vocabularies";

export const SystemInfoSection: React.FC = () => {
  return (
    <div className="space-y-6">
      <FormField
        name="schema_version"
        label="Schema version"
        policy={dmpFieldPolicy.schema_version}
        lockedReason="Set by the app: every export is written to this version of the standard."
      >
        {/* What the export writes, whatever an older saved plan recorded. */}
        <Input
          id="schema_version"
          value={`${MADMP_SCHEMA_NAME} ${MADMP_SCHEMA_VERSION}`}
          disabled
        />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Exports validate against the{" "}
        <a
          href={MADMP_SCHEMA_URI}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          published {MADMP_SCHEMA_VERSION} schema
        </a>
        .
      </p>
      <p className="text-xs text-muted-foreground">
        More system-managed fields (plan ID, created/modified timestamps) will
        appear here once the plan is persisted by a backend.
      </p>
    </div>
  );
};
