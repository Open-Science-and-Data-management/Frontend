import { z } from "zod";
import { UserRole } from "../shared/enums";

export const userSchema = z.object({
  user_id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  role: UserRole,
  ai_quota_limit: z.number().int().default(10),
  ai_quota_used: z.number().int().default(0),
});
export type User = z.infer<typeof userSchema>;
