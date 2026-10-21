import * as React from "react";
import { Lock } from "lucide-react";
import { FieldStateChip } from "@/components/ui/field-state-chip";
import { ConfidenceNote } from "@/components/ui/confidence-note";
import type { Provenance } from "@/api/aiContract";
import {
  RegeneratePopover,
  type RegenerateDirection,
} from "@/components/ui/regenerate-popover";
import { Tooltip } from "@/components/ui/tooltip";
import { regenerateMode, type FieldPolicy } from "@/config/field-policy";

export interface FormFieldProps {
  name: string;
  label: string;
  policy: FieldPolicy;
  required?: boolean;
  hint?: string;
  error?: string;
  /**
   * ai fields: where the value came from, as the analysis reported it. No
   * provenance, no note — the form never guesses a source.
   */
  provenance?: Provenance;
  onRegenerate?: (direction: RegenerateDirection) => void;
  isRegenerating?: boolean;
  /**
   * human prose: whether the researcher has written anything yet. The AI
   * only polishes their words, so a blank field gets no control.
   */
  hasText?: boolean;
  /** locked fields */
  isApproved?: boolean;
  lockedReason?: string;
  children: React.ReactNode;
}

/**
 * Renders a labeled field whose behavior (AI-editable / human-owned /
 * locked) is driven entirely by `policy.permission` — no per-field
 * branching should live outside this component.
 *
 * Human-owned fields are edited directly; the plan is confirmed once, at
 * submit, rather than field by field.
 */
export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  policy,
  required,
  hint,
  error,
  provenance,
  onRegenerate,
  isRegenerating,
  hasText,
  isApproved,
  lockedReason,
  children,
}) => {
  const { permission, editableBeforeApproval } = policy;
  const effectivelyLocked =
    permission === "locked" && (!editableBeforeApproval || Boolean(isApproved));
  // A "locked" field that's still editable pre-approval isn't locked yet —
  // don't show the Locked chip/icon until it actually takes effect.
  const chipState =
    permission === "locked" && !effectivelyLocked ? undefined : permission;
  const autoHint =
    permission === "locked" && editableBeforeApproval && !effectivelyLocked
      ? policy.isMajorTrigger
        ? "You can change this; once approved, a change goes back for sign-off"
        : "Editable until the plan is approved"
      : policy.isMajorTrigger
        ? "Changing this after approval needs sign-off again"
        : undefined;
  const effectiveHint = hint ?? autoHint;
  const mode = regenerateMode(policy);
  const offerRegenerate =
    mode !== null && onRegenerate && (mode === "apply" || hasText);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={name}
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
        <div className="flex items-center gap-1.5">
          {permission === "ai" && provenance && (
            <ConfidenceNote provenance={provenance} />
          )}
          {chipState && <FieldStateChip state={chipState} />}
          {/* Free text only, even if a caller passes a handler for a choice
              or a date. */}
          {offerRegenerate && (
            <RegeneratePopover
              fieldLabel={label}
              mode={mode}
              onRegenerate={onRegenerate}
              disabled={isRegenerating}
            />
          )}
          {permission === "locked" && effectivelyLocked && lockedReason && (
            <Tooltip content={lockedReason}>
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </Tooltip>
          )}
        </div>
      </div>

      {/* Locked while AI rewrites it, so typing can't race the reply. (If a
          value still moves — a chat suggestion accepted meanwhile — the
          rewrite comes back as an out-of-date suggestion, not an overwrite.) */}
      <fieldset
        disabled={isRegenerating}
        aria-busy={isRegenerating || undefined}
        className="contents"
      >
        {children}
      </fieldset>
      {isRegenerating && (
        <p className="text-xs text-ai" role="status">
          {mode === "suggest"
            ? "AI is polishing your wording…"
            : "AI is rewriting this…"}
        </p>
      )}

      {effectiveHint && !error && !isRegenerating && (
        <p className="text-xs text-muted-foreground">{effectiveHint}</p>
      )}
      {policy.noAiAssist && (
        <p className="text-xs text-muted-foreground">
          Only you write this. The assistant won't draft or reword it.
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
