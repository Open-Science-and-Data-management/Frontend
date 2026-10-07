import {
  CheckCircle2,
  ClipboardCheck,
  FileUp,
  ListChecks,
  Send,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { Notification } from "@/types/notification";

/** How each kind of notification looks, wherever it's listed. */
export const NOTIFICATION_ICONS: Record<Notification["type"], LucideIcon> = {
  dmp_submitted: Send,
  dmp_approved: CheckCircle2,
  dmp_finalized: CheckCircle2,
  tasks_generated: ListChecks,
  tasks_cancelled: ListChecks,
  proposal_superseded: FileUp,
  review_requested: ClipboardCheck,
  dmp_returned: Undo2,
};

export const NOTIFICATION_TONES: Record<Notification["type"], string> = {
  dmp_submitted: "bg-warn-subtle text-warn",
  dmp_approved: "bg-ok-subtle text-ok",
  dmp_finalized: "bg-ok-subtle text-ok",
  tasks_generated: "bg-primary/10 text-primary",
  tasks_cancelled: "bg-primary/10 text-primary",
  proposal_superseded: "bg-muted text-muted-foreground",
  review_requested: "bg-ai-subtle text-ai",
  dmp_returned: "bg-warn-subtle text-warn",
};
