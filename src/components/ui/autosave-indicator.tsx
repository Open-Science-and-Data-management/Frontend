import * as React from "react";
import { Loader2, Check } from "lucide-react";

// Shows "Saving…" briefly whenever `value`'s identity changes, then
// "Saved · just now". Pass the object being edited (e.g. the draft) as
// `value` — a new reference on every edit is exactly the signal we want.
export const AutosaveIndicator: React.FC<{ value: unknown }> = ({ value }) => {
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setStatus("saving");
    const timer = setTimeout(() => setStatus("saved"), 500);
    return () => clearTimeout(timer);
  }, [value]);

  if (status === "idle") return null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      {status === "saving" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-ok" />
          Saved · just now
        </>
      )}
    </span>
  );
};
