import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import { useProjectStore } from "@/store/projectStore";
import { setSessionUserId } from "@/config/current-user";
import type { Registration } from "@/schemas/user";
import type { User } from "@/types/user";
import { authApi } from "@/api/authApi";
import { ApiError, configureHttp, type Session } from "@/api/http";

/**
 * Who is signed in. Accounts live on the server: sign-in and sign-up get a
 * session there (a short-lived access token held in memory by the HTTP
 * client, and an httpOnly refresh cookie the browser keeps). Only the user's
 * own record is remembered here, so the app can show who's signed in while
 * it checks the session again after a reload.
 */

export type AuthResult =
  { ok: true } | { ok: false; error: string; field?: "username" | "email" };

/** Deliberately the same message either way: don't reveal which usernames exist. */
const BAD_SIGN_IN: AuthResult = {
  ok: false,
  error: "Username or password is incorrect.",
};

/** A failed sign-in or sign-up, in words for the form. */
const failure = (err: unknown): AuthResult => {
  if (!(err instanceof ApiError))
    return { ok: false, error: "Something went wrong. Please try again." };
  switch (err.code) {
    case "invalid_credentials":
      return BAD_SIGN_IN;
    case "username_taken":
      return {
        ok: false,
        field: "username",
        error: "That username is already taken.",
      };
    case "email_taken":
      return {
        ok: false,
        field: "email",
        error: "An account with this email already exists.",
      };
    default:
      return { ok: false, error: err.message };
  }
};

interface AuthState {
  userId: string | null;
  /** The signed-in user's own record, as the server last returned it. */
  user: User | null;
  signIn: (username: string, password: string) => Promise<AuthResult>;
  /** Creates a researcher account and signs it in. */
  register: (form: Registration) => Promise<AuthResult>;
  /** Re-reads the signed-in user (`GET /users/me`); signs out if the session's gone. */
  restore: () => Promise<void>;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      userId: null,
      user: null,

      setUser: (user) => {
        // Session first: changing who's signed in empties the caches.
        set({ userId: user.user_id as string, user });
        useProjectStore.getState().addUser(user);
        useProjectStore.getState().updateUser(user.user_id as string, user);
      },

      signIn: async (username, password) => {
        try {
          get().setUser(await authApi.signIn(username, password));
          return { ok: true };
        } catch (err) {
          return failure(err);
        }
      },

      register: async (form) => {
        try {
          get().setUser(await authApi.register(form));
          return { ok: true };
        } catch (err) {
          return failure(err);
        }
      },

      restore: async () => {
        if (!get().userId) return;
        try {
          get().setUser(await authApi.me());
        } catch (err) {
          // No session to restore: the HTTP client has already signed out.
          if (!(err instanceof ApiError) || err.status !== 401) throw err;
        }
      },

      logout: () => {
        // Revokes the refresh token; signing out here doesn't wait for it.
        void authApi.signOut().catch(() => {});
        set({ userId: null, user: null });
      },
    }),
    {
      name: storageKey("auth"),
      storage: jsonStorage,
      version: 3,
      // Accounts used to live in the browser; nobody stays signed in across
      // the move to the server.
      migrate: () => ({ userId: null, user: null }),
      partialize: (state) => ({ userId: state.userId, user: state.user }),
    },
  ),
);

// A refreshed session may carry an updated user; a failed refresh means the
// person has to sign in again.
configureHttp({
  onSession: (session: Session) =>
    useAuthStore.getState().setUser(session.user as unknown as User),
  onSignedOut: () => useAuthStore.setState({ userId: null, user: null }),
});

// Records written anywhere in the app are attributed to whoever is signed in.
setSessionUserId(useAuthStore.getState().userId);
useAuthStore.subscribe((state) => setSessionUserId(state.userId));

/** The signed-in user, or undefined when nobody is. */
export const useCurrentUser = (): User | undefined => {
  const user = useAuthStore((s) => s.user);
  const cached = useProjectStore((s) =>
    user ? s.users.find((u) => u.user_id === user.user_id) : undefined,
  );
  return cached ?? user ?? undefined;
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

export const ACCOUNT_TYPE_LABELS: Record<
  NonNullable<User["account_type"]>,
  string
> = {
  institutional: "Institutional researcher",
  citizen: "Citizen researcher",
};
