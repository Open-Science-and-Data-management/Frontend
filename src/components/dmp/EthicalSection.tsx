import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { FormField } from "@/components/ui/form-field";
import { InlineSuggestion } from "@/components/dmp/InlineSuggestion";
import { dmpFieldPolicy } from "@/config/field-policy";
import { useDmpStore } from "@/store/dmpStore";
import { dmpDraftSchema } from "@/schemas/dmp";

/** Empty is fine — the report is optional; anything else must parse as a URL. */
const isValidReportUrl = (value: string | undefined) =>
  !value || dmpDraftSchema.shape.ethical_issues_report.safeParse(value).success;

export const EthicalSection: React.FC = () => {
  const { draft, setField, regenerateField, regeneratingFields } =
    useDmpStore();

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
            onCheckedChange={(checked) =>
              setField("ethical_issues_exist", checked)
            }
          />
          <span className="text-sm text-muted-foreground">
            {draft.ethical_issues_exist ? "Yes" : "No"}
          </span>
        </div>
      </FormField>

      {draft.ethical_issues_exist && (
        <>
          <FormField
            name="ethical_issues_description"
            label="Ethical issues description"
            policy={dmpFieldPolicy.ethical_issues_description}
            required
            hasText={Boolean(draft.ethical_issues_description?.trim())}
            onRegenerate={(direction) =>
              regenerateField(
                "ethical_issues_description",
                "Ethical issues description",
                direction,
              )
            }
            isRegenerating={regeneratingFields.ethical_issues_description}
            suggestion={
              <InlineSuggestion
                match={{ path: "ethical_issues_description" }}
                currentValue={draft.ethical_issues_description}
              />
            }
          >
            <Textarea
              id="ethical_issues_description"
              rows={3}
              value={draft.ethical_issues_description ?? ""}
              onChange={(e) =>
                setField("ethical_issues_description", e.target.value)
              }
              placeholder="Describe the ethical issues and how they're addressed"
            />
          </FormField>

          <FormField
            name="ethical_issues_report"
            label="Ethical issues report URL"
            policy={dmpFieldPolicy.ethical_issues_report}
            hint="Link to the ethics approval or review report, if one exists."
          >
            <Input
              id="ethical_issues_report"
              type="url"
              value={draft.ethical_issues_report ?? ""}
              invalid={!isValidReportUrl(draft.ethical_issues_report)}
              onChange={(e) =>
                setField("ethical_issues_report", e.target.value)
              }
              placeholder="https://ethics.university.edu/approvals/2025-041"
            />
            {!isValidReportUrl(draft.ethical_issues_report) && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                Enter a full URL, including https://
              </p>
            )}
          </FormField>
        </>
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
          onChange={(e) =>
            setField("indigenous_considerations", e.target.value)
          }
          placeholder="Leave blank if not applicable"
        />
      </FormField>
    </div>
  );
};
