import type { User } from "@/types/user";

/**
 * Which side of the app a user works on. Researchers author plans; everyone
 * else reads them and decides on them. Admin has no screens of its own yet,
 * so it lands on the reviewing side rather than in someone else's editor.
 */
export const isReviewer = (role: User["role"] | undefined): boolean =>
  role !== undefined && role !== "researcher";

/**
 * Where each side starts after signing in. Both start at "/", which shows each
 * side its own dashboard; kept as a function so that can change in one place.
 */
export const homePathFor = (_role: User["role"] | undefined): string => "/";
