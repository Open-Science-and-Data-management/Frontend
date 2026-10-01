import React from "react";
import { X, Send, Sparkles, Loader2, Eraser } from "lucide-react";
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
  const { isThinking, send, clear, acceptProposal, rejectProposal, acceptAll } =
    useChatStore();
  const tokensLeft = useDmpStore((s) => s.tokensLeft());
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
            {hasDraft && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {planTitle || "Untitled plan"}
                {section ? ` · ${section}` : ""}
              </p>
            )}
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
        {entries.length === 0 && !hasDraft && (
          <p className="text-sm text-muted-foreground">
            I answer questions about the plan you&rsquo;re working on, but there
            isn&rsquo;t one yet. Start a DMP and I&rsquo;ll be able to help with
            it.
          </p>
        )}

        {entries.length === 0 && hasDraft && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              I can answer questions about the plan you&rsquo;re editing. I
              suggest — I never change or approve anything on my own.
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
                      : "bg-muted",
                  )}
                >
                  {m.text}
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
            Thinking…
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
              hasDraft ? "Ask about this plan…" : "No plan to ask about yet"
            }
            aria-label="Message the AI assistant"
            disabled={isThinking || !hasDraft}
          />
          <Button
            type="submit"
            variant="ai"
            size="icon"
            aria-label="Send message"
            disabled={isThinking || !hasDraft || !value.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {value.trim()
            ? `This turn costs about ${estimateTurn(value).toLocaleString()} tokens · `
            : ""}
          {tokensLeft.toLocaleString()} tokens left
        </p>
      </form>
    </aside>
  );
};
