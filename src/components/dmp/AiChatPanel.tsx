import React from "react";
import { X, Send, Sparkles, Loader2, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatStore } from "@/store/chatStore";
import { useDmpStore } from "@/store/dmpStore";
import { cn } from "@/utils/cn";

// Kept in step with what the assistant can actually answer, so a suggestion
// never leads to the "I can only answer from this plan" fallback.
const SUGGESTIONS = [
  "What's missing before I submit?",
  "Summarise this plan",
  "List the research outputs",
  "How many tokens do I have left?",
];

interface AiChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({ open, onClose }) => {
  const { messages, isThinking, send, clear } = useChatStore();
  const tokensLeft = useDmpStore((s) => s.tokensLeft());
  const hasDraft = useDmpStore((s) =>
    Boolean(s.draft.title || s.draft.description),
  );
  const [value, setValue] = React.useState("");
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (text: string) => {
    setValue("");
    await send(text);
  };

  return (
    <aside
      aria-label="AI assistant"
      // Sits below the header so the toggle that opened it stays reachable.
      className="fixed bottom-0 right-0 top-16 z-30 flex w-full max-w-sm flex-col border-l bg-card shadow-xl"
    >
      <div className="flex items-center justify-between gap-2 border-b p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ai" />
          <h2 className="font-semibold">Ask AI</h2>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
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
        {messages.length === 0 && !hasDraft && (
          <p className="text-sm text-muted-foreground">
            I answer questions about the plan you&rsquo;re working on, but there
            isn&rsquo;t one yet. Start a DMP and I&rsquo;ll be able to help with
            it.
          </p>
        )}

        {messages.length === 0 && hasDraft && (
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

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
              )}
            >
              {m.text}
              {m.role === "assistant" && m.token_count !== undefined && (
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {m.token_count.toLocaleString()} tokens
                </span>
              )}
            </div>
          </div>
        ))}

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
            placeholder={hasDraft ? "Ask about this plan…" : "No plan to ask about yet"}
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
          {tokensLeft.toLocaleString()} tokens left · each reply costs a few
        </p>
      </form>
    </aside>
  );
};
