import * as React from "react";
import { Diamond, AlertTriangle } from "lucide-react";
import type { Provenance } from "@/api/aiContract";
import { cn } from "@/utils/cn";

export type Confidence = "grounded" | "guessed";

/** Grounded only when the analysis named the proposal as the source. */
export const confidenceOf = (provenance: Provenance): Confidence =>
  provenance.source === "proposal" ? "grounded" : "guessed";

const sourceText = (provenance: Provenance) => {
  if (provenance.source === "none")
    return "The proposal doesn't cover this, so AI guessed. Please check it.";
  const where = provenance.section ? ` (${provenance.section})` : "";
  return provenance.quote
    ? `From the proposal${where}: “${provenance.quote}”`
    : `From the proposal${where}.`;
};

interface ConfidenceNoteProps {
  /**
   * Required on purpose: the note says where a value came from, so it's only
   * drawn from what the analysis reported — never assumed per field.
   */
  provenance: Provenance;
  className?: string;
}

export const ConfidenceNote: React.FC<ConfidenceNoteProps> = ({
  provenance,
  className,
}) => {
  const grounded = confidenceOf(provenance) === "grounded";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        grounded ? "text-ai" : "text-warn",
        className,
      )}
      title={sourceText(provenance)}
    >
      {grounded ? (
        <Diamond className="h-3 w-3 fill-current" />
      ) : (
        <AlertTriangle className="h-3 w-3" />
      )}
      {grounded ? "From proposal" : "AI guess, please check"}
    </span>
  );
};
