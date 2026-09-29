import type { FileRecord } from "@/types/file";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const makeId = () => Math.random().toString(36).substring(2, 10);

// Stand-in for object storage. Real blobs live only for this session — a
// backend would return a durable URL instead. Keyed by file_id.
const blobStore = new Map<string, File>();

const detectFileType = (filename: string): FileRecord["file_type"] => {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".pdf")) return "pdf";
  return "other";
};

export interface UploadFileInput {
  file: File;
  projectId: string;
  uploadedBy: string;
  purpose: FileRecord["purpose"];
}

export const fileApi = {
  upload: async ({
    file,
    projectId,
    uploadedBy,
    purpose,
  }: UploadFileInput): Promise<FileRecord> => {
    await delay(700);

    const file_id = makeId();
    blobStore.set(file_id, file);

    return {
      file_id,
      project_id: projectId,
      uploaded_by: uploadedBy,
      filename: file.name,
      file_type: detectFileType(file.name),
      purpose,
      metadata: { byte_size: file.size, mime_type: file.type || undefined },
      uploaded_at: new Date(),
    };
  },

  remove: async (fileId: string): Promise<void> => {
    await delay(300);
    blobStore.delete(fileId);
  },

  // Returns a blob URL for files uploaded in this session, or null for
  // seeded/server-side records that have no local blob.
  getDownloadUrl: (fileId: string): string | null => {
    const blob = blobStore.get(fileId);
    return blob ? URL.createObjectURL(blob) : null;
  },
};
