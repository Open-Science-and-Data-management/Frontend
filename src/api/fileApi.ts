import type { FileRecord } from "@/types/file";
import { projectsApi } from "@/api/projectsApi";

/** Project files on the server: upload, download, archive, delete. */
export interface UploadFileInput {
  file: File;
  projectId: string;
  purpose: FileRecord["purpose"];
  signal?: AbortSignal;
}

export const fileApi = {
  /** The server checks size and type, and supersedes an earlier proposal. */
  upload: ({
    file,
    projectId,
    purpose,
    signal,
  }: UploadFileInput): Promise<FileRecord> =>
    projectsApi.upload(projectId, file, purpose, signal),

  /** Refused (409 file_in_use) for a file a task uses as evidence. */
  remove: async (fileId: string): Promise<void> => {
    await projectsApi.remove(fileId);
  },

  /** Takes a file out of the list but keeps it with any task that uses it. */
  archive: (fileId: string) => projectsApi.archive(fileId),

  /** A blob URL for the file's contents; the caller revokes it. */
  download: async (fileId: string): Promise<string> =>
    URL.createObjectURL(await projectsApi.download(fileId)),
};
