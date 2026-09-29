import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useDmpStore } from "@/store/dmpStore";

export const MyDrafts: React.FC = () => {
  const navigate = useNavigate();
  const { draft } = useDmpStore();
  const hasDraft = Boolean(draft.title || draft.description);

  return (
    <>
      <Helmet>
        <title>My Drafts | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">My Drafts</h1>
          <Button onClick={() => navigate("/upload")}>New DMP</Button>
        </div>

        {hasDraft ? (
          <button
            type="button"
            onClick={() => navigate("/dmp/create")}
            className="block w-full rounded-lg border bg-card p-5 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{draft.title || "Untitled DMP"}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {draft.description || "No description yet."}
                </p>
              </div>
              <StatusBadge status="draft" />
            </div>
          </button>
        ) : (
          <EmptyState
            icon={FileEdit}
            title="No drafts yet"
            description="Start from uploading a proposal or creating a blank plan."
            action={<Button onClick={() => navigate("/upload")}>Start a DMP</Button>}
          />
        )}
      </div>
    </>
  );
};
