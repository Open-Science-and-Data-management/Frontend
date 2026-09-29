import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  X,
  Check,
  Lock,
  Paperclip,
  FileText,
  Upload as UploadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Chip } from "@/components/ui/chip";
import { useTaskStore } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
import { useDmpStore } from "@/store/dmpStore";
import { useToastStore } from "@/store/toastStore";
import { TASK_EVIDENCE_LEVELS } from "@/types/task";
import type { Task, TaskEvidenceLevelValue } from "@/types/task";
import type { FileRecord } from "@/types/file";
import { cn } from "@/utils/cn";

export const LEVEL_META: Record<
  TaskEvidenceLevelValue,
  {
    label: string;
    short: string;
    description: string;
    evidence: "note" | "file";
  }
> = {
  basic: {
    label: "Basic",
    short: "Basic",
    description: "Describe what was actually done.",
    evidence: "note",
  },
  output: {
    label: "Output",
    short: "Output",
    description: "Attach the deliverable this task produced.",
    evidence: "file",
  },
  preserve_share: {
    label: "Preserve & share",
    short: "Preserve",
    description:
      "Attach proof it was deposited or published — a receipt, DOI record, or repository confirmation.",
    evidence: "file",
  },
};

// The output level's file is the deliverable itself; preserve/share evidence
// is supporting proof.
const purposeForLevel = (
  level: TaskEvidenceLevelValue,
): FileRecord["purpose"] =>
  level === "output" ? "task_deliverable" : "evidence";

interface TaskProgressDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TaskProgressDialog: React.FC<TaskProgressDialogProps> = ({
  task,
  open,
  onOpenChange,
}) => {
  const setChecklistItem = useTaskStore((s) => s.setChecklistItem);
  const { projects, uploadFile } = useProjectStore();
  const draftProjectId = useDmpStore((s) => s.draft.project_id);
  const dmps = useDmpStore((s) => s.dmps);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const toast = useToastStore((s) => s.toast);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  // Evidence belongs to the project behind this task's own plan, not whichever
  // plan happens to be open in the editor. The draft wins only when the task
  // does belong to it, since its record may not be committed yet.
  const projectId =
    (task.dmp_id === currentDmpId ? draftProjectId : undefined) ??
    dmps.find((d) => d.dmp_id === task.dmp_id)?.project_id ??
    draftProjectId ??
    projects[0]?.project_id;

  const itemFor = (level: TaskEvidenceLevelValue) =>
    (task.checklist ?? []).find((i) => i.level === level);

  const done = (task.checklist ?? []).filter((i) => i.done).length;

  const attach = async (level: TaskEvidenceLevelValue, file: File) => {
    if (!projectId) {
      toast({
        title: "No project to attach evidence to",
        description: "Create a project first.",
        variant: "destructive",
      });
      return;
    }
    setUploading(level);
    try {
      const record = await uploadFile({
        file,
        projectId,
        purpose: purposeForLevel(level),
      });
      setChecklistItem(task.task_id as string, level, {
        file_id: record.file_id,
        filename: record.filename,
      });
      toast({ title: `${file.name} attached` });
    } finally {
      setUploading(null);
    }
  };

  const canComplete = (level: TaskEvidenceLevelValue) => {
    const item = itemFor(level);
    if (!item) return false;
    return LEVEL_META[level].evidence === "file"
      ? Boolean(item.file_id)
      : Boolean(item.note?.trim());
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-card p-6 text-card-foreground shadow-lg focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-lg font-semibold">
                {task.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Progress is earned by evidence — each level needs proof before
                it can be ticked.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {done} of {TASK_EVIDENCE_LEVELS.length} levels evidenced
              </span>
              <span className="tabular-nums">{task.progress_percent}%</span>
            </div>
            <ProgressBar
              value={task.progress_percent}
              label={`${task.title} progress`}
            />
          </div>

          <ol className="-mx-1 mt-5 flex-1 space-y-3 overflow-y-auto px-1">
            {TASK_EVIDENCE_LEVELS.map((level, index) => {
              const meta = LEVEL_META[level];
              const item = itemFor(level);
              const ready = canComplete(level);
              const isDone = Boolean(item?.done);
              // Levels are a ladder: you can't claim a later one first.
              const locked =
                index > 0 &&
                !(task.checklist ?? []).find(
                  (i) => i.level === TASK_EVIDENCE_LEVELS[index - 1],
                )?.done;

              return (
                <li
                  key={level}
                  className={cn(
                    "rounded-md border p-3",
                    isDone && "border-ok/40 bg-ok-subtle/40",
                    locked && !isDone && "opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          isDone
                            ? "bg-ok text-ok-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span className="text-sm font-medium">{meta.label}</span>
                      {locked && !isDone && (
                        <Chip variant="neutral">
                          <Lock className="h-3 w-3" />
                          Earlier level first
                        </Chip>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isDone ? "outline" : "ok"}
                      disabled={locked || (!isDone && !ready)}
                      onClick={() =>
                        setChecklistItem(task.task_id as string, level, {
                          done: !isDone,
                        })
                      }
                    >
                      {isDone ? "Undo" : "Mark done"}
                    </Button>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {meta.description}
                  </p>

                  {meta.evidence === "note" ? (
                    <Textarea
                      className="mt-2"
                      rows={2}
                      aria-label={`${meta.label} evidence note`}
                      placeholder="What was done?"
                      value={item?.note ?? ""}
                      disabled={locked || isDone}
                      onChange={(e) =>
                        setChecklistItem(task.task_id as string, level, {
                          note: e.target.value,
                        })
                      }
                    />
                  ) : (
                    <div className="mt-2">
                      {item?.filename ? (
                        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2">
                          <span className="flex min-w-0 items-center gap-2 text-xs">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{item.filename}</span>
                          </span>
                          {!isDone && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setChecklistItem(
                                  task.task_id as string,
                                  level,
                                  {
                                    file_id: undefined,
                                    filename: undefined,
                                  },
                                )
                              }
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={locked}
                          isLoading={uploading === level}
                          onClick={() => inputRefs.current[level]?.click()}
                        >
                          <UploadIcon className="mr-1.5 h-3.5 w-3.5" />
                          Attach evidence
                        </Button>
                      )}
                      <input
                        ref={(el) => {
                          inputRefs.current[level] = el;
                        }}
                        type="file"
                        className="sr-only"
                        aria-label={`Attach ${meta.label} evidence`}
                        onChange={(e) => {
                          const picked = e.target.files?.[0];
                          if (picked) attach(level, picked);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  )}

                  {!isDone && !ready && !locked && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-warn">
                      <Paperclip className="h-3 w-3" />
                      {meta.evidence === "file"
                        ? "Attach a file to tick this level."
                        : "Write a short note to tick this level."}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex justify-end border-t pt-4">
            <DialogPrimitive.Close asChild>
              <Button variant="outline">Done</Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
