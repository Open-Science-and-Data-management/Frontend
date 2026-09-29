import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";
import type { RegenerateDirection } from "@/api/aiApi";

export type { RegenerateDirection };

interface RegeneratePopoverProps {
  onRegenerate: (direction: RegenerateDirection) => void;
  disabled?: boolean;
  fieldLabel: string;
}

export const RegeneratePopover: React.FC<RegeneratePopoverProps> = ({
  onRegenerate,
  disabled,
  fieldLabel,
}) => {
  const [open, setOpen] = React.useState(false);
  const [customText, setCustomText] = React.useState("");

  const run = (direction: RegenerateDirection) => {
    onRegenerate(direction);
    setOpen(false);
    setCustomText("");
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`Regenerate ${fieldLabel} with AI`}
          className="h-7 w-7 text-ai hover:bg-ai-subtle hover:text-ai"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={6}
          className={cn(
            "z-50 w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Regenerate &ldquo;{fieldLabel}&rdquo;
          </p>
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => run({ kind: "shorter" })}
            >
              Shorter
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => run({ kind: "formal" })}
            >
              More formal
            </Button>
          </div>
          <form
            className="mt-2 flex gap-1 border-t pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (customText.trim()) {
                run({ kind: "custom", detail: customText.trim() });
              }
            }}
          >
            <Input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Emphasize X, or type your own…"
              className="h-8 text-xs"
              aria-label="Custom regenerate instruction"
            />
            <Button type="submit" variant="ai" size="sm" disabled={!customText.trim()}>
              Go
            </Button>
          </form>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
