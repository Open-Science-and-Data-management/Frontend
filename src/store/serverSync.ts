import { projectsApi, type ServerMember } from "@/api/projectsApi";
import { dmpsApi } from "@/api/dmpsApi";
import { useProjectStore } from "@/store/projectStore";
import { toRecord, useDmpStore } from "@/store/dmpStore";
import { useTaskStore } from "@/store/taskStore";
import { useAuthStore } from "@/store/authStore";
import { isResearcher, isReviewer } from "@/config/roles";
import type { User } from "@/types/user";

/**
 * Fills the browser's caches from the backend. Pages read the stores; this
 * replaces what's in them with what the server says the signed-in person
 * can see.
 */

/**
 * A member the cache doesn't know yet gets a minimal record, so their name
 * shows on the project page. A full record (the signed-in user's own) is
 * never overwritten with this.
 */
const rememberMembers = (members: ServerMember[]) => {
  const store = useProjectStore.getState();
  members.forEach((m) => {
    if (store.getUser(m.user_id)) return;
    const [name = "", ...rest] = (m.user?.name ?? "").split(" ");
    store.addUser({
      user_id: m.user_id,
      name,
      surname: rest.join(" "),
      email: m.user?.email ?? "",
      role: m.project_role,
      ai_token_limit: 0,
    } as User);
  });
};

let loading: Promise<void> | null = null;

/** Projects, their members and their files. One load at a time. */
export const loadProjectsFromServer = (): Promise<void> => {
  loading ??= (async () => {
    try {
      const projects = await projectsApi.list();
      const perProject = await Promise.all(
        projects.map(async (p) => {
          const id = p.project_id as string;
          const [members, files] = await Promise.all([
            projectsApi.members(id),
            projectsApi.files(id),
          ]);
          return { members, files };
        }),
      );
      const members = perProject.flatMap((p) => p.members);
      rememberMembers(members);
      useProjectStore.setState({
        projects,
        members: members.map(({ project_id, user_id, project_role }) => ({
          project_id,
          user_id,
          project_role,
        })),
        files: perProject.flatMap((p) => p.files),
      });
    } finally {
      loading = null;
    }
  })();
  return loading;
};

/** `POST /projects`, then into the cache with its creator as member. */
export const createProjectOnServer = async (input: {
  project_name: string;
  description?: string;
}) => {
  const project = await projectsApi.create(input);
  const id = project.project_id as string;
  const members = await projectsApi.members(id);
  rememberMembers(members);
  useProjectStore.setState((state) => ({
    projects: [...state.projects, project],
    members: [
      ...state.members,
      ...members.map(({ project_id, user_id, project_role }) => ({
        project_id,
        user_id,
        project_role,
      })),
    ],
  }));
  return project;
};

/** Archives a file on the server and marks it archived in the cache. */
export const archiveFileOnServer = async (fileId: string) => {
  const archived = await projectsApi.archive(fileId);
  useProjectStore.setState((state) => ({
    files: state.files.map((f) => (f.file_id === fileId ? archived : f)),
  }));
};

/**
 * Everything a signed-in person sees, from the server: their account, their
 * projects, the plans they write or review, and the tasks of plans in force.
 * Run on sign-in and after a reload; each screen then reads the stores.
 */
export const loadAccountData = async (): Promise<void> => {
  await useAuthStore.getState().restore();
  const user = useAuthStore.getState().user;
  if (!user || !(isResearcher(user.role) || isReviewer(user.role))) return;

  await loadProjectsFromServer();

  if (isResearcher(user.role)) {
    await useDmpStore.getState().loadLibrary();
  } else {
    // Reviewers list plans per project; the server returns only the
    // institutional ones they may review.
    useDmpStore.setState({ libraryStatus: "loading" });
    const projects = useProjectStore.getState().projects;
    const plans = (
      await Promise.all(
        projects.map((p) =>
          dmpsApi.list({
            project_id: p.project_id as string,
            include: "versions",
          }),
        ),
      )
    ).flat();
    useDmpStore.setState({
      dmps: plans.map((plan) => toRecord(plan)),
      libraryStatus: "ready",
    });
  }

  // Tasks exist only for plans in force.
  const inForce = useDmpStore
    .getState()
    .dmps.filter((d) => d.active_version !== undefined && !d.archived_at)
    .map((d) => d.dmp_id);
  // Lists carry no plan content, and the task screens need the outputs of
  // each plan in force.
  if (isResearcher(user.role))
    await Promise.all(
      inForce.map((id) =>
        useDmpStore
          .getState()
          .refreshDmp(id)
          .catch(() => {}),
      ),
    );
  await useTaskStore.getState().loadForPlans(inForce);
  // The library knows which plans have tasks once they're loaded.
  const withTasks = new Set(useTaskStore.getState().tasks.map((t) => t.dmp_id));
  useDmpStore.setState((state) => ({
    dmps: state.dmps.map((d) => ({
      ...d,
      tasks_generated: withTasks.has(d.dmp_id),
    })),
  }));

  // A plan left open in the editor before a reload comes back.
  const open = useDmpStore.getState().currentDmpId;
  if (open && isResearcher(user.role)) {
    await useDmpStore
      .getState()
      .refreshDmp(open)
      .catch(() => useDmpStore.setState({ currentDmpId: null }));
  }
};
