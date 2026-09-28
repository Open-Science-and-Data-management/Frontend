import { z } from "zod";

//  Controlled vocabularies (enums)
export const YesNoUnknown   = z.enum(["yes", "no", "unknown"]);
export const DataAccess     = z.enum(["open", "shared", "closed"]);
export const DatasetType    = z.enum(["raw", "software", "publication", "other"]);
export const DatasetStatus  = z.enum(["planned", "collected", "processed", "preserved", "shared"]);
export const LifecycleStage = z.enum(["collect", "process", "analyse", "preserve", "share"]);
export const TaskStatus     = z.enum(["todo", "in_progress", "done", "cancelled"]);
export const Priority       = z.enum(["low", "medium", "high"]);
export const GeneratedBy    = z.enum(["ai", "user"]);

export const DmpStatus      = z.enum(["draft", "pending", "approved"]);
export const VersionStatus  = z.enum(["draft", "pending", "approved", "rejected"]);
export const EditType       = z.enum(["minor", "major"]);
export const Decision       = z.enum(["pending", "approved", "rejected"]);

export const UserRole       = z.enum(["admin", "chief", "committee", "researcher"]);
export const ProjectRole    = z.enum(["researcher", "committee", "chief"]);
export const ProjectStatus  = z.enum(["draft", "active", "done"]);

export const IdentifierType = z.enum(["doi", "handle", "url", "orcid", "ror", "other"]);
export const FilePurpose    = z.enum(["proposal", "task_deliverable", "evidence"]);
export const FileType       = z.enum(["docx", "pdf", "other"]);

// ISO 4217
export const CurrencyCode = z.string().length(3).default("THB");
// ISO 639-1/3
export const LanguageCode = z.string().min(2).max(3);
