import React from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { FileList, formatBytes } from "@/components/file/FileList";
import { userFullName } from "@/schemas/user";
import { useProjectStore, CURRENT_USER_ID } from "@/store/projectStore";
import { ProjectTasks } from "@/components/task/ProjectTasks";
import { useDmpStore } from "@/store/dmpStore";

export const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, files, members, getUser } = useProjectStore();
  const draft = useDmpStore((s) => s.draft);

  const project = projects.find((p) => p.project_id === projectId);

  if (!project) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-medium">Project not found</p>
        <Button variant="outline" asChild>
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  const id = project.project_id as string;
  const proposal = files.find((f) => f.file_id === project.proposal_file_id);
  const supersededProposals = files.filter(
    (f) => f.project_id === id && f.purpose === "proposal" && f.superseded_at,
  );
  const projectMembers = members.filter((m) => m.project_id === id);
  const hasDmp = draft.project_id === id && Boolean(draft.title);

  return (
    <>
      <Helmet>
        <title>{project.project_name} | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-8">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2"
            onClick={() => navigate("/projects")}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Projects
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {project.project_name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {project.description || "No description yet."}
              </p>
            </div>
            <StatusBadge status={project.status} />
          </div>
        </div>
        <ProjectTasks projectId={id as string} />
        <div className="grid gap-4 *:min-w-0 md:grid-cols-2">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold">Proposal</h2>
            {proposal ? (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <FileText className="h-8 w-8 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {proposal.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(proposal.metadata?.byte_size)} ·{" "}
                      {format(proposal.uploaded_at, "PP")}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {supersededProposals.length > 0
                    ? `${supersededProposals.length} earlier ${
                        supersededProposals.length === 1
                          ? "version"
                          : "versions"
                      } kept below for provenance.`
                    : "A project has one active proposal — uploading another keeps this as a previous version."}
                </p>
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/upload?project=${id}`)}
                >
                  Replace proposal
                </Button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  No proposal uploaded yet. The DMP is generated from it.
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={() => navigate(`/upload?project=${id}`)}
                >
                  Upload proposal
                </Button>
              </>
            )}
          </section>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold">Data Management Plan</h2>
            {hasDmp ? (
              <>
                <p className="mt-2 truncate text-sm font-medium">
                  {draft.title}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <StatusBadge status="draft" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/dmp/create")}
                  >
                    Continue editing
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  No DMP yet — generate one from the proposal, or fill it
                  manually.
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="ai"
                  onClick={() => navigate(`/upload?project=${id}`)}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Generate DMP
                </Button>
              </>
            )}
          </section>
        </div>

        <FileList projectId={id} />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Team</h2>
          <ul className="space-y-2">
            {projectMembers.map((member) => {
              const user = getUser(member.user_id);
              return (
                <li
                  key={`${member.project_id}-${member.user_id}`}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {user ? userFullName(user) : member.user_id}
                      {member.user_id === CURRENT_USER_ID && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </p>
                    {user?.email && (
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <Chip variant="neutral">{member.project_role}</Chip>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
};
