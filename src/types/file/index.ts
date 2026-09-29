import { z } from "zod";
import { fileSchema, createFileSchema, fileMetadataSchema } from "@/schemas/file";

// Export types generated from Zod schemas
export type FileRecord = z.infer<typeof fileSchema>;
export type CreateFile = z.infer<typeof createFileSchema>;
export type FileMetadata = z.infer<typeof fileMetadataSchema>;

// Re-export shared enums used by File for convenience
export { FileType, FilePurpose } from "@/schemas/shared";
