import { z } from "zod";
import { contributorSchema, costSchema } from "@/schemas/contributor";

// Export types generated from Zod schemas
export type Contributor = z.infer<typeof contributorSchema>;
export type Cost = z.infer<typeof costSchema>;
