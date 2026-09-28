import { z } from "zod";
import { madmpExportSchema } from "@/schemas/madmp";

// Export types generated from Zod schemas
export type MadmpExport = z.infer<typeof madmpExportSchema>;
