import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { FormField } from "@/components/ui/form-field";
import { dmpFieldPolicy } from "@/config/field-policy";
import { useDmpStore } from "@/store/dmpStore";

export const EthicalSection: React.FC = () => {
  const { draft, setField } = useDmpStore();

  return (
    <div className="space-y-6">
      <FormField
        name="ethical_issues_exist"
        label="Ethical issues involved?"
        policy={dmpFieldPolicy.ethical_issues_exist}
        required
      >
        <div className="flex items-center gap-3">
          <Toggle
            id="ethical_issues_exist"
            checked={draft.ethical_issues_exist ?? false}
            onCheckedChange={(checked) => setField("ethical_issues_exist", checked)}
          />
          <span className="text-sm text-muted-foreground">
            {draft.ethical_issues_exist ? "Yes" : "No"}
          </span>
        </div>
      </FormField>

      {draft.ethical_issues_exist && (
        <FormField
          name="ethical_issues_description"
          label="Ethical issues description"
          policy={dmpFieldPolicy.ethical_issues_description}
          required
        >
          <Textarea
            id="ethical_issues_description"
            rows={3}
            value={draft.ethical_issues_description ?? ""}
            onChange={(e) => setField("ethical_issues_description", e.target.value)}
            placeholder="Describe the ethical issues and how they're addressed"
          />
        </FormField>
      )}

      <FormField
        name="indigenous_considerations"
        label="Indigenous data considerations"
        policy={dmpFieldPolicy.indigenous_considerations}
      >
        <Textarea
          id="indigenous_considerations"
          rows={2}
          value={draft.indigenous_considerations ?? ""}
          onChange={(e) => setField("indigenous_considerations", e.target.value)}
          placeholder="Leave blank if not applicable"
        />
      </FormField>
    </div>
  );
};
