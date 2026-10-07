import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage, storageKey } from "@/store/persist";
import type { Project, ProjectMember } from "@/types/project";
import type { FileRecord } from "@/types/file";
import type { User } from "@/types/user";
import { fileApi } from "@/api/fileApi";
import { useToastStore } from "@/store/toastStore";
import { notify } from "@/store/notificationStore";
import { CURRENT_USER_ID } from "@/config/current-user";

export { CURRENT_USER_ID } from "@/config/current-user";

const makeId = () => Math.random().toString(36).substring(2, 10);

const seedProjects: Project[] = [
  {
    project_id: "proj-1",
    project_name: "Urban Pollinator Genomics",
    description:
      "Genomic diversity survey of pollinator populations across metropolitan green corridors.",
    proposal_file_id: "file-1",
    status: "active",
    plan_mode: "institutional",
    created_at: new Date("2026-08-01T09:00:00"),
    updated_at: new Date("2026-09-12T14:30:00"),
  },
  {
    project_id: "proj-2",
    project_name: "Coastal Sediment Archive",
    description: "Long-term sediment core sampling and preservation planning.",
    // No committee on this one — the researcher signs their own plan off.
    status: "draft",
    plan_mode: "independent",
    created_at: new Date("2026-09-20T11:00:00"),
    updated_at: new Date("2026-09-20T11:00:00"),
  },
  {
    project_id: "proj-3",
    project_name: "Soil Microbiome Survey",
    description:
      "Amplicon sequencing of soil samples from organic and conventional rice paddies.",
    status: "active",
    plan_mode: "institutional",
    created_at: new Date("2026-09-28T10:00:00"),
    updated_at: new Date("2026-10-05T15:00:00"),
  },
];

const seedFiles: FileRecord[] = [
  {
    file_id: "file-1",
    project_id: "proj-1",
    uploaded_by: CURRENT_USER_ID,
    filename: "pollinator-proposal.docx",
    file_type: "docx",
    purpose: "proposal",
    metadata: { byte_size: 184320 },
    uploaded_at: new Date("2026-08-01T09:05:00"),
  },
  {
    file_id: "file-2",
    project_id: "proj-1",
    uploaded_by: CURRENT_USER_ID,
    filename: "ethics-approval.pdf",
    file_type: "pdf",
    purpose: "evidence",
    metadata: { byte_size: 96000 },
    uploaded_at: new Date("2026-08-14T16:20:00"),
  },
];

const seedUsers: User[] = [
  {
    user_id: CURRENT_USER_ID,
    title: "Dr.",
    name: "Aran",
    surname: "Suwannachot",
    email: "aran@example.edu",
    role: "researcher",
    ai_token_limit: 4500,
    ai_token_used: 0,
  },
  {
    user_id: "user-2",
    title: "Prof.",
    name: "Mali",
    surname: "Chaiyasit",
    email: "mali@example.edu",
    role: "committee",
    ai_token_limit: 4500,
    ai_token_used: 0,
  },
];

const seedMembers: ProjectMember[] = [
  {
    project_id: "proj-1",
    user_id: CURRENT_USER_ID,
    project_role: "researcher",
  },
  { project_id: "proj-1", user_id: "user-2", project_role: "committee" },
  {
    project_id: "proj-2",
    user_id: CURRENT_USER_ID,
    project_role: "researcher",
  },
  {
    project_id: "proj-3",
    user_id: CURRENT_USER_ID,
    project_role: "researcher",
  },
  { project_id: "proj-3", user_id: "user-2", project_role: "committee" },
];

const memberKey = (m: Pick<ProjectMember, "project_id" | "user_id">) =>
  `${m.project_id}::${m.user_id}`;

/**
 * One row per (project, user). The schema can't express that, so it's held
 * here: the first row for a pair wins, later duplicates are dropped.
 */
export const uniqueMembers = (members: ProjectMember[]): ProjectMember[] => {
  const seen = new Set<string>();
  return members.filter((m) => {
    const key = memberKey(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

interface ProjectState {
  projects: Project[];
  files: FileRecord[];
  members: ProjectMember[];
  users: User[];
  currentProjectId: string | null;
  uploadingFor: string | null;

  getUser: (id: string) => User | undefined;
  updateUser: (id: string, patch: Partial<User>) => void;
  /** The researcher who owns a project's plans — who hears about decisions. */
  getResearcherFor: (projectId?: string) => User | undefined;
  /** Everyone who decides on plans, for review-request notifications. */
  getReviewers: () => User[];

  createProject: (input: {
    project_name: string;
    description?: string;
    plan_mode?: Project["plan_mode"];
  }) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  /**
   * Low-level: removes the project with its files and members, unconditionally.
   * Use `deleteProject` (store/projectActions), which refuses while plans remain.
   */
  removeProject: (id: string) => void;
  /**
   * Adds a member unless that user is already on the project. Returns false
   * for an existing member — changing their role is a separate decision, not
   * a side effect of adding them twice.
   */
  addMember: (
    projectId: string,
    userId: string,
    role: ProjectMember["project_role"],
  ) => boolean;
  setCurrentProject: (id: string | null) => void;

  getProject: (id: string) => Project | undefined;
  getProjectFiles: (id: string) => FileRecord[];
  getProjectMembers: (id: string) => ProjectMember[];
  getProposalFile: (project: Project) => FileRecord | undefined;

  uploadFile: (input: {
    file: File;
    projectId: string;
    purpose: FileRecord["purpose"];
  }) => Promise<FileRecord>;
  removeFile: (fileId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: seedProjects,
      files: seedFiles,
      members: seedMembers,
      users: seedUsers,
      currentProjectId: null,
      uploadingFor: null,

      getUser: (id) => get().users.find((u) => u.user_id === id),

      updateUser: (id, patch) =>
        set((state) => ({
          users: state.users.map((u) =>
            u.user_id === id ? { ...u, ...patch } : u,
          ),
        })),
      getResearcherFor: (projectId) => {
        const member = get().members.find(
          (m) => m.project_id === projectId && m.project_role === "researcher",
        );
        return member ? get().getUser(member.user_id) : undefined;
      },

      getReviewers: () =>
        get().users.filter((u) => u.role === "committee" || u.role === "chief"),

      createProject: ({ project_name, description, plan_mode }) => {
        const project: Project = {
          project_id: makeId(),
          project_name,
          description,
          status: "draft",
          plan_mode: plan_mode ?? "institutional",
          created_at: new Date(),
          updated_at: new Date(),
        };
        set((state) => ({ projects: [...state.projects, project] }));
        get().addMember(
          project.project_id as string,
          CURRENT_USER_ID,
          "researcher",
        );
        return project;
      },

      addMember: (projectId, userId, role) => {
        const key = memberKey({ project_id: projectId, user_id: userId });
        if (get().members.some((m) => memberKey(m) === key)) return false;
        set((state) => ({
          members: [
            ...state.members,
            { project_id: projectId, user_id: userId, project_role: role },
          ],
        }));
        return true;
      },

      updateProject: (id, patch) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.project_id === id
              ? { ...p, ...patch, updated_at: new Date() }
              : p,
          ),
        })),

      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.project_id !== id),
          files: state.files.filter((f) => f.project_id !== id),
          members: state.members.filter((m) => m.project_id !== id),
          currentProjectId:
            state.currentProjectId === id ? null : state.currentProjectId,
        })),

      setCurrentProject: (id) => set({ currentProjectId: id }),

      getProject: (id) => get().projects.find((p) => p.project_id === id),

      getProjectFiles: (id) => get().files.filter((f) => f.project_id === id),

      getProjectMembers: (id) =>
        get().members.filter((m) => m.project_id === id),

      getProposalFile: (project) =>
        get().files.find((f) => f.file_id === project.proposal_file_id),

      uploadFile: async ({ file, projectId, purpose }) => {
        set({ uploadingFor: projectId });
        try {
          const record = await fileApi.upload({
            file,
            projectId,
            uploadedBy: CURRENT_USER_ID,
            purpose,
          });

          // A project has exactly one *active* proposal. Earlier ones are kept
          // and stamped as superseded so the provenance trail survives.
          const supersededAt = new Date();
          const superseded =
            purpose === "proposal"
              ? get().files.filter(
                  (f) =>
                    f.project_id === projectId &&
                    f.purpose === "proposal" &&
                    !f.superseded_at,
                )
              : [];
          const supersededIds = new Set(superseded.map((f) => f.file_id));

          set((state) => ({
            files: [
              ...state.files.map((f) =>
                supersededIds.has(f.file_id)
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
                      ? {
                          ...p,
                          proposal_file_id: record.file_id,
                          updated_at: new Date(),
                        }
                      : p,
                  )
                : state.projects,
          }));

          if (superseded.length > 0) {
            useToastStore.getState().toast({
              title: "Proposal replaced",
              description: `${superseded[0].filename} kept as a previous version.`,
            });
            notify({
              user_id: CURRENT_USER_ID,
              type: "proposal_superseded",
              title: "Proposal replaced",
              message: `${superseded[0].filename} was superseded by ${record.filename}. The earlier version is kept for provenance.`,
              link: `/projects/${projectId}`,
              project_id: projectId,
            });
          }

          return record;
        } catch (err) {
          set({ uploadingFor: null });
          useToastStore.getState().toast({
            title: "Upload failed",
            description:
              err instanceof Error ? err.message : "Please try again.",
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
    }),
    {
      name: storageKey("projects"),
      storage: jsonStorage,
      version: 1,
      partialize: (state) => ({
        projects: state.projects,
        files: state.files,
        members: state.members,
        users: state.users,
      }),
      // Rows saved before the guard existed may repeat a pair; load them once.
      merge: (persisted, current) => {
        const saved = persisted as Partial<ProjectState> | undefined;
        return {
          ...current,
          ...saved,
          members: uniqueMembers(saved?.members ?? current.members),
        };
      },
    },
  ),
);
