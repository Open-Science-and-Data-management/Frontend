import { z } from "zod";
import { UserRole } from "../shared/enums";

export const userSchema = z.object({
  user_id: z.string().optional(),
  title: z.string().optional(),
  name: z.string().min(1),
  surname: z.string().min(1),
  email: z.string().email(),
  role: UserRole,
  ai_token_limit: z.number().int().default(4500),
  ai_token_used: z.number().int().default(0),
});
export type User = z.infer<typeof userSchema>;

export const userFullName = (u: Pick<User, "title" | "name" | "surname">) =>
  [u.title, u.name, u.surname].filter(Boolean).join(" ");
