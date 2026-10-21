import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import { useProjectStore } from "@/store/projectStore";
import { CURRENT_USER_ID, setSessionUserId } from "@/config/current-user";
import { hashPassword, makeSalt, sameHash } from "@/config/password";
import type { Registration } from "@/schemas/user";
import { MOCK_ACCOUNT_TOKEN_LIMIT } from "@/api/mock/accounts";
import type { User } from "@/types/user";

/**
 * Accounts and sign-in, held in this browser. There is no server yet, so this
 * is a demo of the flow rather than a security boundary: passwords are stored
 * salted and hashed — never as typed — but anyone with the browser's storage
 * can read the hashes. A deployment moves all of this behind an API.
 */

interface Credential {
  user_id: string;
  salt: string;
  hash: string;
}

export type AuthResult =
  { ok: true } | { ok: false; error: string; field?: "username" | "email" };

/** The demo accounts. Both passwords are "demo1234". */
export const DEMO_ACCOUNTS = [
  { username: "aran", role: "researcher" as const },
  { username: "mali", role: "committee" as const },
];
export const DEMO_PASSWORD = "demo1234";

const SEED_CREDENTIALS: Record<string, Credential> = {
  aran: {
    user_id: CURRENT_USER_ID,
    salt: "seed-salt-aran-7f3c",
    hash: "f54abd2d5fae415556ed5ac2050ccddca05a0cc0047e2e27264bcac084bc62c7",
  },
  mali: {
    user_id: "user-2",
    salt: "seed-salt-mali-2b9e",
    hash: "4c6a6fe4602fad71d9a2713a93f56bb575df0c593f412314fed9b7f00e9996ed",
  },
};

/** Deliberately the same message either way: don't reveal which usernames exist. */
const BAD_SIGN_IN: AuthResult = {
  ok: false,
  error: "Username or password is incorrect.",
};

const normalise = (username: string) => username.trim().toLowerCase();
const makeId = () => Math.random().toString(36).substring(2, 10);

interface AuthState {
  userId: string | null;
  /** Keyed by lowercase username. */
  credentials: Record<string, Credential>;

  signIn: (username: string, password: string) => Promise<AuthResult>;
  /** Creates a researcher account and signs it in. */
  register: (form: Registration) => Promise<AuthResult>;
  isUsernameTaken: (username: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      userId: null,
      credentials: SEED_CREDENTIALS,

      signIn: async (username, password) => {
        const credential = get().credentials[normalise(username)];
        if (!credential) return BAD_SIGN_IN;
        const hash = await hashPassword(credential.salt, password);
        if (!sameHash(hash, credential.hash)) return BAD_SIGN_IN;
        // The account may outlive its user record (e.g. after a data reset).
        if (!useProjectStore.getState().getUser(credential.user_id))
          return BAD_SIGN_IN;
        set({ userId: credential.user_id });
        return { ok: true };
      },

      isUsernameTaken: (username) => normalise(username) in get().credentials,

      register: async (form) => {
        const username = normalise(form.username);
        if (get().isUsernameTaken(username))
          return {
            ok: false,
            field: "username",
            error: "That username is already taken.",
          };
        if (useProjectStore.getState().isEmailTaken(form.email))
          return {
            ok: false,
            field: "email",
            error: "An account with this email already exists.",
          };

        const institutional = form.account_type === "institutional";
        const user: User = {
          user_id: `user-${makeId()}`,
          title: form.title,
          name: form.name,
          surname: form.surname,
          email: form.email,
          // Sign-up only ever makes researchers; committee accounts are
          // granted by the institution, not chosen.
          role: "researcher",
          ai_token_limit: MOCK_ACCOUNT_TOKEN_LIMIT,
          ai_token_used: 0,
          username,
          account_type: form.account_type,
          phone: form.phone,
          orcid: form.orcid,
          affiliation: institutional
            ? {
                organization: form.organization as string,
                department: form.department,
                position: form.position,
              }
            : undefined,
          address: institutional ? undefined : form.address,
        };

        const salt = makeSalt();
        const hash = await hashPassword(salt, form.password);
        useProjectStore.getState().addUser(user);
        set((state) => ({
          credentials: {
            ...state.credentials,
            [username]: { user_id: user.user_id as string, salt, hash },
          },
          userId: user.user_id as string,
        }));
        return { ok: true };
      },

      logout: () => set({ userId: null }),
    }),
    {
      name: storageKey("auth"),
      storage: jsonStorage,
      version: 2,
      // v1 held only `userId`, picked without a password; nobody stays signed
      // in across the switch to real sign-in.
      migrate: () => ({ userId: null, credentials: SEED_CREDENTIALS }),
      // Demo accounts are always present, whatever was saved.
      merge: (persisted, current) => {
        const saved = persisted as Partial<AuthState> | undefined;
        return {
          ...current,
          ...saved,
          credentials: { ...SEED_CREDENTIALS, ...saved?.credentials },
        };
      },
      partialize: (state) => ({
        userId: state.userId,
        credentials: state.credentials,
      }),
    },
  ),
);

// Records written anywhere in the app are attributed to whoever is signed in.
setSessionUserId(useAuthStore.getState().userId);
useAuthStore.subscribe((state) => setSessionUserId(state.userId));

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

export const ACCOUNT_TYPE_LABELS: Record<
  NonNullable<User["account_type"]>,
  string
> = {
  institutional: "Institutional researcher",
  citizen: "Citizen researcher",
};
