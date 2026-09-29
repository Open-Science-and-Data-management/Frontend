import { z } from "zod";

const ORCID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

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
