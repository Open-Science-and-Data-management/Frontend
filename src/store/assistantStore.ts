import { create } from "zustand";

/**
 * Whether the AI assistant is docked open. The plan editor owns the panel;
 * the app shell only reads this to make room for it. Not persisted: the
 * assistant belongs to the editor page, and closes with it.
 */
export const useAssistantStore = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
