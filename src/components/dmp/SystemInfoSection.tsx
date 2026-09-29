import React from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { dmpFieldPolicy } from "@/config/field-policy";
import { useDmpStore } from "@/store/dmpStore";

export const SystemInfoSection: React.FC = () => {
  const { draft } = useDmpStore();

  return (
    <div className="space-y-6">
      <FormField
        name="schema_version"
        label="Schema version"
        policy={dmpFieldPolicy.schema_version}
        lockedReason="Fixed by the system to match the FAIRer maDMP schema this app implements."
      >
        <Input id="schema_version" value={draft.schema_version ?? "FAIRer maDMP 1.2"} disabled />
      </FormField>
      <p className="text-xs text-muted-foreground">
        More system-managed fields (plan ID, created/modified timestamps) will
        appear here once the plan is persisted by a backend.
      </p>
    </div>
  );
};
