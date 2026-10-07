import { z } from "zod";

const ORCID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/**
 * A person named in the plan. Contributors need not have an account here, so
 * the link to one (`user_id`) is optional — set it when the person does have
 * an account, so anything that acts on contributors (assigning a task,
 * notifying someone) can reach them. One account links to at most one
 * contributor per plan. The link stays internal: exports identify people by
 * ORCID or email, never by our user ids.
 */
export const contributorSchema = z.object({
  contributor_id: z.string().optional(),
  title: z.string().optional(),
  name: z.string().min(1),
  surname: z.string().optional(),
  role: z.string().min(1),
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง").or(z.literal("")).optional(),
  orcid: z
    .string()
    .regex(ORCID, "รูปแบบ ORCID ไม่ถูกต้อง")
    .or(z.literal(""))
    .optional(),
  is_contact: z.boolean().default(false),
  /** The person's account, when they have one. */
  user_id: z.string().optional(),
});
export type Contributor = z.infer<typeof contributorSchema>;

/** Mirrors the schema's rule so the form can flag a bad address as it's typed. */
export const isValidEmail = (value: string | undefined): boolean =>
  !value || contributorSchema.shape.email.safeParse(value).success;

// maDMP exports a contributor as a single `name` string, so the parts are
// composed on the way out.
export const contributorFullName = (
  c: Pick<Contributor, "title" | "name" | "surname">,
) => [c.title, c.name, c.surname].filter(Boolean).join(" ");

/**
 * An account that looks like this contributor, by email, offered for linking
 * — never linked automatically: two people can share an inbox, or an old
 * address can be reassigned.
 */
export const suggestAccountFor = <
  U extends { user_id?: string; email: string },
>(
  contributor: Pick<Contributor, "email" | "user_id">,
  users: U[],
  takenUserIds: string[] = [],
): U | undefined => {
  const email = contributor.email?.trim().toLowerCase();
  if (contributor.user_id || !email) return undefined;
  return users.find(
    (u) =>
      u.email.trim().toLowerCase() === email &&
      !takenUserIds.includes(u.user_id as string),
  );
};
