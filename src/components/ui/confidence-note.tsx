import * as React from "react";
import { Diamond, AlertTriangle } from "lucide-react";
import { cn } from "@/utils/cn";

export type Confidence = "grounded" | "guessed";

interface ConfidenceNoteProps {
  confidence: Confidence;
  className?: string;
}

export const ConfidenceNote: React.FC<ConfidenceNoteProps> = ({
  confidence,
  className,
}) => {
  const grounded = confidence === "grounded";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        grounded ? "text-ai" : "text-warn",
        className,
      )}
      title={
        grounded
          ? "Grounded in the uploaded proposal"
          : "AI guessed this — please check it"
      }
    >
      {grounded ? (
        <Diamond className="h-3 w-3 fill-current" />
      ) : (
        <AlertTriangle className="h-3 w-3" />
      )}
      {grounded ? "From proposal" : "AI guessed — check this"}
    </span>
  );
};
