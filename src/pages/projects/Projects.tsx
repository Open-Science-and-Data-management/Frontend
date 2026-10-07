import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectCard } from "@/components/project/ProjectCard";
import { CreateProjectDialog } from "@/components/project/CreateProjectDialog";
import { useProjectStore } from "@/store/projectStore";
import { useCurrentUser } from "@/store/authStore";
import { isReviewer } from "@/config/roles";

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const allProjects = useProjectStore((s) => s.projects);
  const reviewer = isReviewer(useCurrentUser()?.role);
  const [createOpen, setCreateOpen] = React.useState(false);

  // Independent projects sign their own plans off; the committee has no part
  // in them, so they don't appear on its side.
  const projects = reviewer
    ? allProjects.filter((p) => p.plan_mode === "institutional")
    : allProjects;

  return (
    <>
      <Helmet>
        <title>Projects | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {reviewer
                ? "Projects whose plans your committee approves — their plans, files, and progress."
                : "Each project holds one proposal, its DMP, files, and team."}
            </p>
          </div>
          {!reviewer && (
            <Button onClick={() => setCreateOpen(true)}>New project</Button>
          )}
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description={
              reviewer
                ? "Projects appear here once researchers create them."
                : "Create a project, then upload its proposal to generate a DMP."
            }
            action={
              reviewer ? undefined : (
                <Button onClick={() => setCreateOpen(true)}>New project</Button>
              )
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.project_id} project={project} />
            ))}
          </div>
        )}
      </div>

      {!reviewer && (
        <CreateProjectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(project) => navigate(`/projects/${project.project_id}`)}
        />
      )}
    </>
  );
};
