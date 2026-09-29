import React from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive by default — this exists mainly to guard discards. */
  variant?: "default" | "destructive";
}

type Resolver = (confirmed: boolean) => void;

const ConfirmContext = React.createContext<
  ((options: ConfirmOptions) => Promise<boolean>) | null
>(null);

/**
 * One dialog for the whole app, requested imperatively:
 *
 *   if (await confirm({ title: "Delete this task?" })) remove();
 *
 * Keeps discard guards from needing dialog state at every call site.
 */
export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const resolverRef = React.useRef<Resolver | null>(null);

  const confirm = React.useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const settle = (confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <ConfirmDialog
          open
          // Covers Esc, the close button and the overlay.
          onOpenChange={(open) => !open && settle(false)}
          title={options.title}
          description={options.description}
          confirmLabel={options.confirmLabel ?? "Discard"}
          cancelLabel={options.cancelLabel ?? "Keep"}
          confirmVariant={options.variant ?? "destructive"}
          onConfirm={() => settle(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
};
