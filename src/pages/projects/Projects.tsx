import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectCard } from "@/components/project/ProjectCard";
import { CreateProjectDialog } from "@/components/project/CreateProjectDialog";
import { useProjectStore } from "@/store/projectStore";

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const [createOpen, setCreateOpen] = React.useState(false);

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
              Each project holds one proposal, its DMP, files, and team.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>New project</Button>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create a project, then upload its proposal to generate a DMP."
            action={<Button onClick={() => setCreateOpen(true)}>New project</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.project_id} project={project} />
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(project) => navigate(`/projects/${project.project_id}`)}
      />
    </>
  );
};
