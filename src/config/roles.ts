import type { User } from "@/types/user";

/**
 * Which side of the app a user works on. Researchers author plans; the
 * committee and its chief read them and decide on them.
 *
 * Admin is on neither side. It is an operational role (users, project
 * members, the AI quota), not an academic reviewer, so it gets no plan
 * access at all: least privilege, and separation of duties from the people
 * who approve. Its own screens don't exist yet.
 */
export const isReviewer = (role: User["role"] | undefined): boolean =>
  role === "committee" || role === "chief";

export const isResearcher = (role: User["role"] | undefined): boolean =>
  role === "researcher";

/** Who may see plans and the projects that hold them: authors and reviewers. */
export const seesPlans = (role: User["role"] | undefined): boolean =>
  isResearcher(role) || isReviewer(role);

/**
 * Where each side starts after signing in. Both start at "/", which shows each
 * side its own dashboard; kept as a function so that can change in one place.
 */
export const homePathFor = (_role: User["role"] | undefined): string => "/";
