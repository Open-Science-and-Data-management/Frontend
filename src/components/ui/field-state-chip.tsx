import * as React from "react";
import { Sparkles, UserCheck, Lock, CheckCircle2 } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type { FieldPermission } from "@/config/field-policy";

export type FieldChipState = FieldPermission | "confirmed";

interface FieldStateChipProps {
  state: FieldChipState;
}

const CONFIG: Record<
  FieldChipState,
  { label: string; variant: "ai" | "warn" | "neutral" | "ok"; icon: React.ReactNode }
> = {
  ai: { label: "AI", variant: "ai", icon: <Sparkles className="h-3 w-3" /> },
  human: { label: "Confirm", variant: "warn", icon: <UserCheck className="h-3 w-3" /> },
  locked: { label: "Locked", variant: "neutral", icon: <Lock className="h-3 w-3" /> },
  confirmed: { label: "Confirmed", variant: "ok", icon: <CheckCircle2 className="h-3 w-3" /> },
};

export const FieldStateChip: React.FC<FieldStateChipProps> = ({ state }) => {
  const { label, variant, icon } = CONFIG[state];
  return (
    <Chip variant={variant}>
      {icon}
      {label}
    </Chip>
  );
};
