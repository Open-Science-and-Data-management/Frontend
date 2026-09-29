import * as React from "react";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/utils/cn";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const ACCEPTED_EXTENSION = ".docx";

interface FileDropzoneProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  error?: string;
}

export const validateProposalFile = (file: File): string | null => {
  if (!file.name.toLowerCase().endsWith(ACCEPTED_EXTENSION)) {
    return "Only .docx files are supported.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "File is too large — please keep it under 20MB.";
  }
  return null;
};

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  file,
  onFileSelect,
  onRemove,
  error,
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const picked = files?.[0];
    if (picked) onFileSelect(picked);
  };

  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="proposal-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          isDragOver ? "border-primary bg-accent" : "border-border",
          error && "border-destructive",
        )}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drop your proposal here, or{" "}
          <span className="text-primary underline-offset-4">browse</span>
        </p>
        <p className="text-xs text-muted-foreground">.docx, up to 20MB</p>
        <input
          ref={inputRef}
          id="proposal-upload"
          type="file"
          accept=".docx"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {error && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
