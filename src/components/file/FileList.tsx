import React from "react";
import { format } from "date-fns";
import { FileText, Download, Trash2, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { FilePurpose } from "@/schemas/shared";
import { fileApi } from "@/api/fileApi";
import { useProjectStore } from "@/store/projectStore";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/utils/cn";
import type { FileRecord } from "@/types/file";

const PURPOSE_LABELS: Record<FileRecord["purpose"], string> = {
  proposal: "Proposal",
  task_deliverable: "Deliverable",
  evidence: "Evidence",
};

const PURPOSE_VARIANTS: Record<FileRecord["purpose"], "ai" | "ok" | "neutral"> = {
  proposal: "ai",
  task_deliverable: "ok",
  evidence: "neutral",
};

export const formatBytes = (bytes: number | undefined) => {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface FileListProps {
  projectId: string;
}

export const FileList: React.FC<FileListProps> = ({ projectId }) => {
  const { files, projects, uploadFile, removeFile, uploadingFor } = useProjectStore();
  const toast = useToastStore((s) => s.toast);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [purpose, setPurpose] = React.useState<FileRecord["purpose"]>("evidence");

  // Superseded files sink below the current ones.
  const projectFiles = files
    .filter((f) => f.project_id === projectId)
    .sort(
      (a, b) =>
        Number(Boolean(a.superseded_at)) - Number(Boolean(b.superseded_at)),
    );
  const isUploading = uploadingFor === projectId;

  // A project holds exactly one proposal — once it has one, replacing it is
  // an explicit action on the Proposal card, not a purpose in this dropdown.
  const hasProposal = Boolean(
    projects.find((p) => p.project_id === projectId)?.proposal_file_id,
  );
  const purposeOptions = FilePurpose.options.filter(
    (option) => option !== "proposal" || !hasProposal,
  );
  const effectivePurpose = purposeOptions.includes(purpose)
    ? purpose
    : purposeOptions[0];

  const handleFiles = async (fileList: FileList | null) => {
    const picked = fileList?.[0];
    if (!picked) return;
    await uploadFile({ file: picked, projectId, purpose: effectivePurpose });
    toast({ title: `${picked.name} uploaded` });
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDownload = (record: FileRecord) => {
    const url = fileApi.getDownloadUrl(record.file_id as string);
    if (!url) {
      toast({
        title: "No local copy available",
        description: "This record was seeded — re-upload it to download.",
      });
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = record.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Files</h2>
          <p className="text-xs text-muted-foreground">
            Proposals, task deliverables, and supporting evidence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label="File purpose"
            className="w-36"
            value={effectivePurpose}
            onChange={(e) => setPurpose(e.target.value as FileRecord["purpose"])}
          >
            {purposeOptions.map((option) => (
              <option key={option} value={option}>
                {PURPOSE_LABELS[option]}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon className="mr-1.5 h-3.5 w-3.5" />
            Upload file
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            aria-label="Upload a file to this project"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {projectFiles.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No files yet"
          description="Upload a proposal, a task deliverable, or supporting evidence."
        />
      ) : (
        <ul className="space-y-2">
          {projectFiles.map((record) => (
            <li
              key={record.file_id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border bg-card p-3",
                record.superseded_at && "opacity-60",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{record.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(record.metadata?.byte_size)} ·{" "}
                    {format(record.uploaded_at, "PP")}
                    {record.superseded_at &&
                      ` · replaced ${format(record.superseded_at, "PP")}`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {record.superseded_at ? (
                  <Chip variant="neutral">Superseded</Chip>
                ) : (
                  <Chip variant={PURPOSE_VARIANTS[record.purpose]}>
                    {PURPOSE_LABELS[record.purpose]}
                  </Chip>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Download ${record.filename}`}
                  onClick={() => handleDownload(record)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  aria-label={`Remove ${record.filename}`}
                  onClick={async () => {
                    await removeFile(record.file_id as string);
                    toast({ title: `${record.filename} removed` });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
