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

/** The fields a person may change about themselves; role and quota are not. */
export const userProfileSchema = userSchema
  .pick({ title: true, name: true, surname: true, email: true })
  .extend({
    title: z.string().trim().optional(),
    name: z.string().trim().min(1, "Name is required"),
    surname: z.string().trim().min(1, "Surname is required"),
    email: z.string().trim().email("Enter a valid email address"),
  });
export type UserProfile = z.infer<typeof userProfileSchema>;

export const userFullName = (u: Pick<User, "title" | "name" | "surname">) =>
  [u.title, u.name, u.surname].filter(Boolean).join(" ");

export const userInitials = (u: Pick<User, "name" | "surname">) =>
  `${u.name[0] ?? ""}${u.surname[0] ?? ""}`.toUpperCase();
