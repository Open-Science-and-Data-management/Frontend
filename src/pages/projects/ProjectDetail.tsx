import React from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StatusBadge } from "@/components/ui/status-badge";
import { FileList, formatBytes } from "@/components/file/FileList";
import { userFullName } from "@/schemas/user";
import { useProjectStore } from "@/store/projectStore";
import { ProjectTasks } from "@/components/task/ProjectTasks";
import { useDmpStore, type DmpRecord } from "@/store/dmpStore";
import { useAuthStore, useCurrentUser } from "@/store/authStore";
import { useDmpLibrary } from "@/hooks/useDmpLibrary";
import { isReviewer } from "@/config/roles";
import { planModeOf, statusLabel } from "@/config/plan-mode";

export const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, files, members, getUser, getResearcherFor } =
    useProjectStore();
  const openDmp = useDmpStore((s) => s.openDmp);
  const library = useDmpLibrary();
  const userId = useAuthStore((s) => s.userId);
  // The committee reads a project; only its researcher works on it.
  const reviewer = isReviewer(useCurrentUser()?.role);

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
  const researcher = getResearcherFor(id);
  const plans = library
    .filter((d) => d.project_id === id)
    .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

  const openPlan = (plan: DmpRecord) => {
    // Same rule as My DMPs: drafts open in the editor, the rest on Status.
    const opened = openDmp(plan.dmp_id) ?? plan;
    navigate(opened.status === "draft" ? "/dmp/create" : "/dmp/status");
  };

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
              {reviewer && researcher && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Researcher: {userFullName(researcher)} · {researcher.email}
                </p>
              )}
            </div>
            <StatusBadge status={project.status} />
          </div>
        </div>
        <ProjectTasks projectId={id} readOnly={reviewer} />
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
                    : reviewer
                      ? "The proposal this project's plan was drafted from."
                      : "A project has one active proposal. Uploading another keeps this one as a previous version."}
                </p>
                {!reviewer && (
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/upload?project=${id}`)}
                  >
                    Replace proposal
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  No proposal uploaded yet.
                  {!reviewer && " The DMP is generated from it."}
                </p>
                {!reviewer && (
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => navigate(`/upload?project=${id}`)}
                  >
                    Upload proposal
                  </Button>
                )}
              </>
            )}
          </section>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold">
              Data Management Plan{plans.length > 1 ? "s" : ""}
            </h2>
            {plans.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {plans.map((plan) => {
                  const pending = plan.versions.find(
                    (v) => v.status === "pending",
                  );
                  return (
                    <li
                      key={plan.dmp_id}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium">
                          {plan.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={plan.status}>
                            {statusLabel(
                              plan.status,
                              planModeOf(plan, projects),
                            )}
                          </StatusBadge>
                          {plan.active_version !== undefined && (
                            <Chip variant="neutral">
                              v{plan.active_version} in force
                            </Chip>
                          )}
                          {pending && plan.active_version !== undefined && (
                            <Chip variant="warn">
                              v{pending.number} awaiting decision
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Updated{" "}
                          {formatDistanceToNow(plan.updated_at, {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {reviewer ? (
                        <Button
                          size="sm"
                          variant={pending ? "default" : "outline"}
                          asChild
                        >
                          <Link to={`/review/${plan.dmp_id}`}>
                            {pending ? "Review" : "View"}
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPlan(plan)}
                        >
                          Open
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : reviewer ? (
              <p className="mt-2 text-sm text-muted-foreground">
                The researcher hasn't started a plan for this project yet.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  No DMP yet. Generate one from the proposal, or fill it in by
                  hand.
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

        <FileList projectId={id} readOnly={reviewer} />

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
                      {member.user_id === userId && (
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
