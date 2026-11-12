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

