import * as React from "react";
import { Lock } from "lucide-react";
import { FieldStateChip } from "@/components/ui/field-state-chip";
import {
  ConfidenceNote,
  type Confidence,
} from "@/components/ui/confidence-note";
import {
  RegeneratePopover,
  type RegenerateDirection,
} from "@/components/ui/regenerate-popover";
import { Tooltip } from "@/components/ui/tooltip";
import type { FieldPolicy } from "@/config/field-policy";

export interface FormFieldProps {
  name: string;
  label: string;
  policy: FieldPolicy;
  required?: boolean;
  hint?: string;
  error?: string;
  /** ai fields */
  confidence?: Confidence;
  onRegenerate?: (direction: RegenerateDirection) => void;
  isRegenerating?: boolean;
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
  confidence,
  onRegenerate,
  isRegenerating,
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
        : "Editable now — locks once the plan is approved"
      : policy.isMajorTrigger
        ? "Changing this after approval needs sign-off again"
        : undefined;
  const effectiveHint = hint ?? autoHint;

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
          {permission === "ai" && confidence && (
            <ConfidenceNote confidence={confidence} />
          )}
          {chipState && <FieldStateChip state={chipState} />}
          {permission === "ai" && onRegenerate && (
            <RegeneratePopover
              fieldLabel={label}
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

      {children}

      {effectiveHint && !error && (
        <p className="text-xs text-muted-foreground">{effectiveHint}</p>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
