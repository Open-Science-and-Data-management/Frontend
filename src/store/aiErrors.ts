import { asAiError, type AiError } from "@/api/aiContract";
import { useQuotaStore } from "@/store/quotaStore";
import { useToastStore } from "@/store/toastStore";

/** What to say when the budget is spent — a reset date only if the server gave one. */
export const quotaSpentMessage = (resetsAt: Date | null) =>
  resetsAt
    ? `You've used your AI budget. It resets on ${resetsAt.toLocaleDateString()}. You can keep editing by hand meanwhile.`
    : "You've used your AI budget. You can keep editing by hand.";

/** The words a person sees for a failed AI call. */
export const describeAiError = (err: AiError) =>
  err.code === "quota_exceeded" ? quotaSpentMessage(err.resets_at) : err.userMessage;

/**
 * Tells the person an AI call failed — or was stopped, which isn't a
 * failure — and offers to try again only when trying again could help.
 */
export const reportAiError = (
  err: unknown,
  opts: { what: string; retry?: () => void },
) => {
  const e = asAiError(err);
  const { toast } = useToastStore.getState();
  if (e.code === "aborted") {
    toast({ title: "Stopped", description: e.userMessage });
    return e;
  }
  toast({
    title: `Couldn't ${opts.what}`,
    description: describeAiError(e),
    variant: "destructive",
    action:
      e.retryable && opts.retry
        ? { label: "Try again", onClick: opts.retry }
        : undefined,
  });
  return e;
};

/**
 * After every AI call, ask the server what's left. Its count is the truth —
 * including for calls that were stopped or failed part-way.
 */
export const syncQuota = () => void useQuotaStore.getState().refresh();
