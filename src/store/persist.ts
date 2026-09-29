import { createJSONStorage } from "zustand/middleware";

/**
 * Only what `Date.prototype.toJSON` produces — a plain "2025-05-20" stays a
 * string, so date-shaped form values aren't turned into Dates by accident.
 */
const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * JSON storage that revives timestamps. The domain types hold real `Date`s
 * (`uploaded_at`, `end_date`, `updated_at`…) and code calls `.getTime()` on
 * them, so handing back strings after a reload would break at the first sort.
 */
export const jsonStorage = createJSONStorage(() => localStorage, {
  reviver: (_key, value) =>
    typeof value === "string" && ISO_TIMESTAMP.test(value)
      ? new Date(value)
      : value,
});

const PREFIX = "dmp-researcher";

export const storageKey = (name: string) => `${PREFIX}/${name}`;

/**
 * Drops every persisted store. Used by "Reset demo data" — seeds only apply to
 * a browser that has nothing saved, so stale data would otherwise outlive a
 * change to the seeds themselves.
 */
export const clearPersistedState = () => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(`${PREFIX}/`))
    .forEach((key) => localStorage.removeItem(key));
};
