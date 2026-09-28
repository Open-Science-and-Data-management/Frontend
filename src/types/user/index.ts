import { z } from "zod";
import { userSchema } from "@/schemas/user";

// Export types generated from Zod schemas
export type User = z.infer<typeof userSchema>;

// Re-export shared enums used by User for convenience
export { UserRole } from "@/schemas/shared";
