import React from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  UserCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { ChatProposal } from "@/store/chatTools";
import { cn } from "@/utils/cn";

interface ChatProposalCardProps {
  proposal: ChatProposal;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * One suggested change, shown as a diff the person decides on. The assistant
 * never applies anything — this card is the only route from suggestion to
 * change, and it needs a click.
 */
export const ChatProposalCard: React.FC<ChatProposalCardProps> = ({
  proposal,
  onAccept,
  onReject,
}) => {
  const navigate = useNavigate();
  const settled = proposal.status !== "pending";

  return (
    <div
      className={cn(
        "rounded-md border p-3 text-xs",
        proposal.status === "accepted" && "border-ok/40 bg-ok-subtle/40",
        proposal.status === "rejected" && "opacity-60",
        proposal.status === "stale" && "border-warn/50 bg-warn-subtle/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-medium">{proposal.label}</p>
        {proposal.needsHumanConfirm && !settled && (
          <Chip variant="warn">
            <UserCheck className="h-3 w-3" />
            You decide
          </Chip>
        )}
        {proposal.status === "accepted" && <Chip variant="ok">Applied</Chip>}
        {proposal.status === "rejected" && (
          <Chip variant="neutral">Dismissed</Chip>
        )}
        {proposal.status === "stale" && (
          <Chip variant="warn">
            <AlertTriangle className="h-3 w-3" />
            Not applied
          </Chip>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-muted-foreground line-through">
          {proposal.before}
        </span>
        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate rounded bg-ai-subtle px-2 py-1 text-ai">
          {proposal.after}
        </span>
      </div>

      {proposal.needsHumanConfirm && !settled && (
        <p className="mt-2 text-muted-foreground">
          This field is yours to decide — accepting here is your confirmation,
          and you can check it in the form.
        </p>
      )}

      {proposal.status === "stale" && proposal.staleReason && (
        <p className="mt-2 text-warn">{proposal.staleReason}</p>
      )}

      {!settled && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={onAccept}>
            <Check className="mr-1 h-3.5 w-3.5" />
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={onReject}>
            <X className="mr-1 h-3.5 w-3.5" />
            Reject
          </Button>
          {proposal.section && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigate(`/dmp/create?section=${proposal.section}`)
              }
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Open in form
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
