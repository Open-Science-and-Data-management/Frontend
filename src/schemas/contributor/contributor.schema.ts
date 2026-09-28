import { z } from "zod";

const ORCID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export const contributorSchema = z.object({
  contributor_id: z.string().optional(),
  name: z.string().min(1),
  role: z.string().min(1),
  orcid: z.string().regex(ORCID, "รูปแบบ ORCID ไม่ถูกต้อง").or(z.literal("")).optional(),
  is_contact: z.boolean().default(false),
});
export type Contributor = z.infer<typeof contributorSchema>;
