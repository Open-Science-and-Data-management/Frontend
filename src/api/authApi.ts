import { http, setAccessToken, type Session } from "@/api/http";
import type { Registration } from "@/schemas/user";
import type { User } from "@/types/user";

/**
 * Accounts and sessions on the backend (`/auth`, `/users`). The access token
 * from a session is kept by the HTTP client; the refresh token stays in its
 * httpOnly cookie, where scripts can't read it.
 */

const startSession = (session: Session) => {
  setAccessToken(session.access_token);
  return session.user as unknown as User;
};

export const authApi = {
  /** `POST /auth/sessions` */
  signIn: async (username: string, password: string) =>
    startSession(
      await http.post<Session>(
        "/auth/sessions",
        { username, password },
        { auth: false },
      ),
    ),

  /** `POST /users`: creates a researcher account and signs it in. */
  // The whole form, confirmation included: the server validates it with the
  // same `registrationSchema`, which checks the two passwords match.
  register: async (form: Registration) =>
    startSession(await http.post<Session>("/users", form, { auth: false })),

  /** `DELETE /auth/sessions/current`: revokes the refresh token. */
  signOut: async () => {
    try {
      await http.delete("/auth/sessions/current", { auth: false });
    } finally {
      setAccessToken(null);
    }
  },

  /** `GET /users/username-available` */
  isUsernameAvailable: async (username: string) =>
    (
      await http.get<{ available: boolean }>("/users/username-available", {
        query: { username },
        auth: false,
      })
    ).available,

  /** `GET /users/me` */
  me: () => http.get<User>("/users/me"),

  /** `PATCH /users/me`: title, name, surname, email. */
  updateMe: (
    patch: Partial<Pick<User, "title" | "name" | "surname" | "email">>,
  ) => http.patch<User>("/users/me", patch),
};
