import React from "react";
import {
  FileSearch,
  ListChecks,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { AiAction, ThreadEvent } from "@/store/aiThread";

const ICONS: Record<AiAction, React.ComponentType<{ className?: string }>> = {
  analyze_proposal: FileSearch,
  regenerate_field: Wand2,
  batch_regenerate: RefreshCw,
  generate_tasks: ListChecks,
  redraft_steps: Sparkles,
};

export const AiEventRow: React.FC<{ event: ThreadEvent }> = ({ event }) => {
  const Icon = ICONS[event.action];

  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-2.5 py-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{event.summary}</p>
        {event.detail && (
          <p className="mt-0.5 text-muted-foreground">{event.detail}</p>
        )}
      </div>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {event.token_count.toLocaleString()}
      </span>
    </div>
  );
};
