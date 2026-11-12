import { create } from "zustand";
import type { Project, ProjectMember } from "@/types/project";
import type { FileRecord } from "@/types/file";
import type { User } from "@/types/user";
import { fileApi } from "@/api/fileApi";
import { useToastStore } from "@/store/toastStore";
import { onSessionChange } from "@/config/current-user";

/**
 * Projects, their members and files, and the users the app has met: a
 * session cache of what the server returned (see `serverSync`), read by every
 * screen. The server decides what each person may see; nothing here is
 * persisted, so one account's data never outlives its session.
 */

/** The form an email is compared in — the same rule contributors match by. */
export const normaliseEmail = (email: string) => email.trim().toLowerCase();

interface ProjectState {
  projects: Project[];
  files: FileRecord[];
  members: ProjectMember[];
  users: User[];
  /** The project a file is being uploaded to, for its spinner. */
  uploadingFor: string | null;

  getUser: (id: string) => User | undefined;
  /** Updates the cached copy of a user (after the server saved it). */
  updateUser: (id: string, patch: Partial<User>) => void;
  addUser: (user: User) => void;
  /** The researcher member of a project. */
  getResearcherFor: (projectId?: string) => User | undefined;
  /** Updates the cached copy of a project (after the server changed it). */
  updateProject: (id: string, patch: Partial<Project>) => void;
  getProposalFile: (project: Project) => FileRecord | undefined;
  /** `POST /projects/:id/files`; the server supersedes an earlier proposal. */
  uploadFile: (input: {
    file: File;
    projectId: string;
    purpose: FileRecord["purpose"];
    signal?: AbortSignal;
  }) => Promise<FileRecord>;
  /** `DELETE /files/:id`; refused (409 file_in_use) for task evidence. */
  removeFile: (fileId: string) => Promise<void>;
}

const empty = {
  projects: [] as Project[],
  files: [] as FileRecord[],
  members: [] as ProjectMember[],
  users: [] as User[],
  uploadingFor: null as string | null,
};

export const useProjectStore = create<ProjectState>()((set, get) => ({
  ...empty,

  getUser: (id) => get().users.find((u) => u.user_id === id),

  updateUser: (id, patch) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.user_id === id ? { ...u, ...patch } : u,
      ),
    })),

  addUser: (user) =>
    set((state) =>
      state.users.some((u) => u.user_id === user.user_id)
        ? state
        : { users: [...state.users, user] },
    ),

  getResearcherFor: (projectId) => {
    const member = get().members.find(
      (m) => m.project_id === projectId && m.project_role === "researcher",
    );
    return member ? get().getUser(member.user_id) : undefined;
  },

  updateProject: (id, patch) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.project_id === id ? { ...p, ...patch } : p,
      ),
    })),

  getProposalFile: (project) =>
    get().files.find((f) => f.file_id === project.proposal_file_id),

  uploadFile: async ({ file, projectId, purpose, signal }) => {
    set({ uploadingFor: projectId });
    try {
      const record = await fileApi.upload({ file, projectId, purpose, signal });
      const supersededAt = new Date();
      set((state) => ({
        // The server keeps earlier proposals, marked superseded; mirror it.
        files: [
          ...state.files.map((f) =>
            purpose === "proposal" &&
            f.project_id === projectId &&
            f.purpose === "proposal" &&
            !f.superseded_at
              ? { ...f, superseded_at: supersededAt }
              : f,
          ),
          record,
        ],
        uploadingFor: null,
        projects:
          purpose === "proposal"
            ? state.projects.map((p) =>
                p.project_id === projectId
                  ? { ...p, proposal_file_id: record.file_id }
                  : p,
              )
            : state.projects,
      }));
      return record;
    } catch (err) {
      set({ uploadingFor: null });
      // Stopped on purpose: nothing went wrong.
      if (signal?.aborted) throw err;
      useToastStore.getState().toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      throw err;
    }
  },

  removeFile: async (fileId) => {
    await fileApi.remove(fileId);
    set((state) => ({
      files: state.files.filter((f) => f.file_id !== fileId),
      projects: state.projects.map((p) =>
        p.proposal_file_id === fileId
          ? { ...p, proposal_file_id: undefined }
          : p,
      ),
    }));
  },
}));

onSessionChange(() => useProjectStore.setState(empty));
