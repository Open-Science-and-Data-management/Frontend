import React from "react";
import {
  X,
  Send,
  Sparkles,
  Loader2,
  Eraser,
  Square,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatProposalCard } from "@/components/dmp/ChatProposalCard";
import { Input } from "@/components/ui/input";
import { useLocation } from "react-router-dom";
import { estimateTurn, useChatStore } from "@/store/chatStore";
import {
  NO_ENTRIES,
  scopeKey,
  useAiThread,
  type ThreadEntry,
  type ThreadTurn,
} from "@/store/aiThread";
import { AiEventRow } from "@/components/dmp/AiEventRow";
import { useDmpStore } from "@/store/dmpStore";
import { formatTokensLeft, useQuotaStore } from "@/store/quotaStore";
import { cn } from "@/utils/cn";

// Kept in step with what the assistant can actually answer, so a suggestion
// never leads to the "I can only answer from this plan" fallback.
const SUGGESTIONS = [
  "Summarise this plan",
  "What is the current access?",
  "Explain protection level",
  "Change retention to 15 years for every output",
];

interface AiChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({ open, onClose }) => {
  const {
    isThinking,
    pendingTicket,
    send,
    stop,
    clear,
    acceptProposal,
    rejectProposal,
    acceptAll,
  } = useChatStore();
  const tokensLeft = useQuotaStore((s) => s.tokensLeft());
  const hasDraft = useDmpStore((s) =>
    Boolean(s.draft.title || s.draft.description),
  );
  const planTitle = useDmpStore((s) => s.draft.title);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  // One thread per plan: whatever the AI did to this plan, wherever it was
  // triggered from, shows up here.
  const entries = useAiThread(
    (s) => s.threads[scopeKey(currentDmpId)] ?? NO_ENTRIES,
  );
  const { pathname, search } = useLocation();
  // The assistant answers about the plan on screen, so it says which one.
  const section = pathname.startsWith("/dmp/create")
    ? (new URLSearchParams(search).get("section") ?? "general")
    : undefined;
  const [value, setValue] = React.useState("");
  // A reply on its way for another plan is that plan's business; here it
  // only blocks a second request, which the store can't run alongside.
  const thinkingHere = useAiThread((s) =>
    pendingTicket ? s.resolve(pendingTicket) === scopeKey(currentDmpId) : false,
  );
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, isThinking]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (text: string) => {
    setValue("");
    await send(text, { section });
  };

  return (
    <aside
      aria-label="AI assistant"
      // Full height on the right: from xl the shell reserves a column for it,
      // so it reads as part of the layout rather than a sheet thrown over it.
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l bg-card shadow-xl xl:shadow-none"
    >
      {/* h-16 so its bottom border lines up with the app header's. */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ai" />
          <div className="min-w-0">
            <h2 className="font-semibold leading-none">Ask AI</h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {planTitle || "Untitled plan"}
              {section ? ` · ${section}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Clear conversation"
              onClick={clear}
            >
              <Eraser className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Close AI assistant"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {/* The panel only exists in the editor, so there's always a plan —
            even one that's still blank and unsaved. */}
        {entries.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {hasDraft
                ? "I can answer questions about the plan you’re editing."
                : "This plan is still blank. I can explain any field while you fill it in."}{" "}
              I make suggestions. I never change or approve anything on my own.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {entries.map((entry: ThreadEntry) => {
          if (entry.kind === "event") {
            return <AiEventRow key={entry.id} event={entry} />;
          }
          const m = entry as ThreadTurn;
          const pending = (m.proposals ?? []).filter(
            (p) => p.status === "pending",
          );

          return (
            <div key={m.id} className="space-y-2">
              <div
                className={cn(
                  "flex",
                  m.kind === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm",
                    m.kind === "user"
                      ? "bg-primary text-primary-foreground"
                      : m.failed
                        ? "border border-destructive/40 bg-destructive/10 text-destructive"
                        : m.stopped
                          ? "bg-muted italic text-muted-foreground"
                          : "bg-muted",
                  )}
                >
                  {m.text}
                  {m.failed?.retryable && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7"
                      disabled={isThinking}
                      onClick={() => send(m.failed!.request, { section })}
                    >
                      <RotateCcw className="mr-1.5 h-3 w-3" />
                      Try again
                    </Button>
                  )}
                  {m.kind === "assistant" && m.token_count !== undefined && (
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {m.token_count.toLocaleString()} tokens
                    </span>
                  )}
                </div>
              </div>

              {/* Refusals are shown, not hidden — the reason is the point. */}
              {(m.rejections ?? []).map((r, i) => (
                <div
                  key={`${m.id}-r${i}`}
                  className="rounded-md border border-warn/40 bg-warn-subtle/40 p-2 text-xs text-warn"
                >
                  <span className="font-medium">{r.label}:</span> {r.reason}
                </div>
              ))}

              {(m.proposals ?? []).map((p) => (
                <ChatProposalCard
                  key={p.id}
                  proposal={p}
                  onAccept={() => acceptProposal(m.id, p.id)}
                  onReject={() => rejectProposal(m.id, p.id)}
                />
              ))}

              {pending.length > 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => acceptAll(m.id)}
                >
                  Accept all {pending.length}
                </Button>
              )}
            </div>
          );
        })}

        {isThinking && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {thinkingHere
              ? "Thinking…"
              : "Finishing a reply for another plan. It'll be saved there."}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="space-y-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              hasDraft ? "Ask about this plan…" : "Ask about any field…"
            }
            aria-label="Message the AI assistant"
            disabled={isThinking}
          />
          {isThinking ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Stop. Tokens already used still count."
              title="Stop. Tokens already used still count."
              onClick={stop}
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="ai"
              size="icon"
              aria-label="Send message"
              disabled={!value.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {value.trim()
            ? `This turn costs about ${estimateTurn(value).toLocaleString()} tokens · `
            : ""}
          {formatTokensLeft(tokensLeft)} tokens left
        </p>
      </form>
    </aside>
  );
};
