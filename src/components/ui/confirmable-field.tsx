import * as React from "react";
import { CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmableFieldProps {
  confirmed: boolean;
  onConfirm: () => void;
  onEdit: () => void;
  confirmedSummary: React.ReactNode;
  children: React.ReactNode;
}

// Human-required fields: AI can only suggest; a person must confirm before
// it counts. Confirming is reversible — Edit reopens the input.
export const ConfirmableField: React.FC<ConfirmableFieldProps> = ({
  confirmed,
  onConfirm,
  onEdit,
  confirmedSummary,
  children,
}) => {
  if (confirmed) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-ok/30 bg-ok-subtle px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-ok">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="text-foreground">{confirmedSummary}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="shrink-0"
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-warn/30 bg-warn-subtle/40 p-3">
      {children}
      <Button type="button" variant="ok" size="sm" onClick={onConfirm}>
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
        Confirm
      </Button>
    </div>
  );
};
