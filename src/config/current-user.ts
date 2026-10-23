/**
 * The seeded researcher. Seed data is attributed to them, and they are who
 * acts when nobody is signed in (tests, and store code run outside the app).
 */
export const CURRENT_USER_ID = "user-1";

let sessionUserId: string | null = null;
const sessionListeners = new Set<() => void>();

/** Set by the auth store on sign-in, sign-out and reload. */
export const setSessionUserId = (id: string | null) => {
  if (id === sessionUserId) return;
  sessionUserId = id;
  sessionListeners.forEach((listener) => listener());
};

/**
 * Runs when the person signed in changes. For in-memory caches of one
 * person's data, which must not outlive their session in a shared tab.
 */
export const onSessionChange = (listener: () => void) => {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
};

/**
 * Who is acting right now — what a record written this moment is attributed
 * to. Lives in config, not a store, so every store can ask without importing
 * the auth store (which itself depends on the project store).
 */
export const actingUserId = (): string => sessionUserId ?? CURRENT_USER_ID;
