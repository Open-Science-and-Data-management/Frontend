import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import { useProjectStore } from "@/store/projectStore";
import type { User } from "@/types/user";

/**
 * Demo sign-in: who is using the app, picked from the seeded user directory.
 * There is no password and no server — it exists so the researcher and
 * committee sides can be tried from one browser, not as a security boundary.
 */
interface AuthState {
  userId: string | null;
  login: (userId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      login: (userId) => set({ userId }),
      logout: () => set({ userId: null }),
    }),
    {
      name: storageKey("auth"),
      storage: jsonStorage,
      version: 1,
    },
  ),
);

/** The signed-in user, or undefined when nobody is (or the id no longer resolves). */
export const useCurrentUser = (): User | undefined => {
  const userId = useAuthStore((s) => s.userId);
  return useProjectStore((s) => s.users.find((u) => u.user_id === userId));
};

export const ROLE_LABELS: Record<User["role"], string> = {
  researcher: "Researcher",
  committee: "Committee",
  chief: "Chief",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<User["role"], string> = {
  researcher: "Drafts DMPs from proposals and submits them for approval.",
  committee: "Reviews submitted DMPs and approves or sends them back.",
  chief: "Oversees the committee's decisions.",
  admin: "Manages users and settings.",
};
