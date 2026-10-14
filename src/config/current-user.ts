/**
 * The seeded researcher. Seed data is attributed to them, and they are who
 * acts when nobody is signed in (tests, and store code run outside the app).
 */
export const CURRENT_USER_ID = "user-1";

let sessionUserId: string | null = null;

/** Set by the auth store on sign-in, sign-out and reload. */
export const setSessionUserId = (id: string | null) => {
  sessionUserId = id;
};

/**
 * Who is acting right now — what a record written this moment is attributed
 * to. Lives in config, not a store, so every store can ask without importing
 * the auth store (which itself depends on the project store).
 */
export const actingUserId = (): string => sessionUserId ?? CURRENT_USER_ID;
