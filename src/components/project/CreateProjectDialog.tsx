import React from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProjectStore } from "@/store/projectStore";
import { useCurrentUser } from "@/store/authStore";
import type { Project } from "@/types/project";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Project) => void;
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const createProject = useProjectStore((s) => s.createProject);
  // A citizen researcher has no committee, so their projects sign their own
  // plans off; everyone else's go to the institution's committee.
  const citizen = useCurrentUser()?.account_type === "citizen";
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const reset = () => {
    setName("");
    setDescription("");
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="New project"
      description="A project holds your proposal, its DMP, files, and team."
      confirmLabel="Create project"
      onConfirm={() => {
        if (!name.trim()) return;
        const project = createProject({
          project_name: name.trim(),
          description: description.trim() || undefined,
          plan_mode: citizen ? "independent" : "institutional",
        });
        reset();
        onOpenChange(false);
        onCreated?.(project);
      }}
    >
      <div className="space-y-3">
        <div>
          <label
            htmlFor="project-name"
            className="mb-1 block text-sm font-medium"
          >
            Project name
          </label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Urban Pollinator Genomics"
          />
        </div>
        <div>
          <label
            htmlFor="project-description"
            className="mb-1 block text-sm font-medium"
          >
            Description (optional)
          </label>
          <Textarea
            id="project-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
          />
        </div>
        <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
          {citizen
            ? "As a citizen researcher you finalize this project's plans yourself. There's no committee review."
            : "This project's plans go to your institution's committee for approval."}
        </p>
      </div>
    </ConfirmDialog>
  );
};
