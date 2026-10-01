import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "@/store/projectStore";
import type { FileRecord } from "@/types/file";

const docx = (name: string) =>
  new File(["proposal contents"], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

const state = () => useProjectStore.getState();
const filesFor = (projectId: string) =>
  state().files.filter((f) => f.project_id === projectId);
const proposals = (projectId: string) =>
  filesFor(projectId).filter((f) => f.purpose === "proposal");

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({
    projects: [
      {
        project_id: "p1",
        project_name: "Test project",
        status: "active",
        created_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-01"),
      },
    ],
    files: [],
    members: [],
  });
});

describe("a project has exactly one active proposal", () => {
  it("records the first upload as the project's proposal", async () => {
    const record = await state().uploadFile({
      file: docx("first.docx"),
      projectId: "p1",
      purpose: "proposal",
    });

    expect(record.filename).toBe("first.docx");
    expect(state().getProject("p1")?.proposal_file_id).toBe(record.file_id);
    expect(proposals("p1")).toHaveLength(1);
  });

  it("supersedes the earlier one instead of deleting it", async () => {
    const first = await state().uploadFile({
      file: docx("first.docx"),
      projectId: "p1",
      purpose: "proposal",
    });
    const second = await state().uploadFile({
      file: docx("second.docx"),
      projectId: "p1",
      purpose: "proposal",
    });

    const all = proposals("p1");
    // Both survive: provenance is the whole point of superseding.
    expect(all).toHaveLength(2);

    const previous = all.find((f) => f.file_id === first.file_id)!;
    const current = all.find((f) => f.file_id === second.file_id)!;
    expect(previous.superseded_at).toBeInstanceOf(Date);
    expect(current.superseded_at).toBeUndefined();
    expect(state().getProject("p1")?.proposal_file_id).toBe(second.file_id);
  });

  it("returns the active proposal, never a superseded one", async () => {
    await state().uploadFile({
      file: docx("first.docx"),
      projectId: "p1",
      purpose: "proposal",
    });
    const second = await state().uploadFile({
      file: docx("second.docx"),
      projectId: "p1",
      purpose: "proposal",
    });

    const project = state().getProject("p1")!;
    expect(state().getProposalFile(project)?.file_id).toBe(second.file_id);
  });

  it("leaves other projects' proposals alone", async () => {
    useProjectStore.setState((s) => ({
      projects: [
        ...s.projects,
        {
          project_id: "p2",
          project_name: "Other",
          status: "active" as const,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    }));

    const other = await state().uploadFile({
      file: docx("other.docx"),
      projectId: "p2",
      purpose: "proposal",
    });
    await state().uploadFile({
      file: docx("mine.docx"),
      projectId: "p1",
      purpose: "proposal",
    });

    const untouched = state().files.find((f) => f.file_id === other.file_id)!;
    expect(untouched.superseded_at).toBeUndefined();
  });

  it("does not supersede anything when the upload isn't a proposal", async () => {
    const first = await state().uploadFile({
      file: docx("first.docx"),
      projectId: "p1",
      purpose: "proposal",
    });
    await state().uploadFile({
      file: docx("evidence.csv"),
      projectId: "p1",
      purpose: "evidence",
    });

    const proposal = state().files.find((f) => f.file_id === first.file_id)!;
    expect(proposal.superseded_at).toBeUndefined();
    expect(state().getProject("p1")?.proposal_file_id).toBe(first.file_id);
  });
});

describe("removing files and projects", () => {
  it("clears the project's pointer when its proposal is removed", async () => {
    const record = await state().uploadFile({
      file: docx("first.docx"),
      projectId: "p1",
      purpose: "proposal",
    });

    await state().removeFile(record.file_id as string);

    expect(state().files).toHaveLength(0);
    expect(state().getProject("p1")?.proposal_file_id).toBeUndefined();
  });

  it("takes a project's files and members with it", () => {
    useProjectStore.setState({
      files: [
        { file_id: "f1", project_id: "p1", purpose: "proposal" } as FileRecord,
        { file_id: "f2", project_id: "p2", purpose: "proposal" } as FileRecord,
      ],
      members: [
        { project_id: "p1", user_id: "u1", project_role: "researcher" },
        { project_id: "p2", user_id: "u1", project_role: "researcher" },
      ],
    });

    state().removeProject("p1");

    expect(state().files.map((f) => f.file_id)).toEqual(["f2"]);
    expect(state().members.map((m) => m.project_id)).toEqual(["p2"]);
  });

  it("creates a project with the current user as a member", () => {
    const project = state().createProject({ project_name: "Fresh" });

    expect(project.project_id).toBeTruthy();
    expect(
      state().getProjectMembers(project.project_id as string),
    ).toHaveLength(1);
  });
});
