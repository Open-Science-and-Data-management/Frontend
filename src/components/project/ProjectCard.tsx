import React from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, FileText, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { useProjectStore } from "@/store/projectStore";
import { useDmpLibrary } from "@/hooks/useDmpLibrary";
import type { Project } from "@/types/project";

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const { files, members } = useProjectStore();
  const id = project.project_id as string;
  const fileCount = files.filter((f) => f.project_id === id).length;
  const memberCount = members.filter((m) => m.project_id === id).length;
  const hasProposal = Boolean(project.proposal_file_id);
  const plans = useDmpLibrary().filter((d) => d.project_id === id);
  const awaitingReview = plans.some((d) =>
    d.versions.some((v) => v.status === "pending"),
  );

  return (
    <Link
      to={`/projects/${id}`}
      className="block rounded-lg border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold">{project.project_name}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {project.description || "No description yet."}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          {fileCount} {fileCount === 1 ? "file" : "files"}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>
        {!hasProposal && (
          <span className="text-warn">No proposal uploaded</span>
        )}
        {awaitingReview && (
          <span className="flex items-center gap-1.5 text-warn">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Waiting on the committee
          </span>
        )}
      </div>
    </Link>
  );
};
