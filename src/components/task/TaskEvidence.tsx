import React from "react";
import { useQuotaStore } from "@/store/quotaStore";
import { reportAiError, syncQuota } from "@/store/aiErrors";
import {
  FileText,
  Link2,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload as UploadIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useTaskStore } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
import { useDmpStore } from "@/store/dmpStore";
import { recordAiEvent } from "@/store/aiThread";
import { useToastStore } from "@/store/toastStore";
import { generateTaskChecklist } from "@/api/aiApi";
import {
  awaitingVerification,
  classifyPastedEvidence,
  evidenceSatisfies,
  looksLikeDoi,
  REQUIREMENT_COPY,
  requirementFor,
} from "@/config/task-evidence";
import type { Task } from "@/types/task";
import { cn } from "@/utils/cn";

const STEP_DIRECTIONS = [
  "More detail",
  "Keep it brief",
  "Focus on preservation",
  "Add quality checks",
];

interface TaskEvidenceProps {
  task: Task;
}

/**
 * The execution half of a task: the checklist that drives progress, and the
 * evidence that makes closing it legitimate.
 */
export const TaskEvidence: React.FC<TaskEvidenceProps> = ({ task }) => {
  const {
    addChecklistItem,
    renameChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    replaceChecklist,
    setEvidence,
    clearEvidence,
    completeTask,
    reopenTask,
  } = useTaskStore();
  const { projects, uploadFile } = useProjectStore();
  const draftProjectId = useDmpStore((s) => s.draft.project_id);
  const dmps = useDmpStore((s) => s.dmps);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const hasTokensFor = useQuotaStore((s) => s.hasTokensFor);
  const toast = useToastStore((s) => s.toast);

  const [newStep, setNewStep] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draftLabel, setDraftLabel] = React.useState("");
  const [linkValue, setLinkValue] = React.useState("");
  const [direction, setDirection] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [redrafting, setRedrafting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const plan = dmps.find((d) => d.dmp_id === task.dmp_id);
  const projectId =
    (task.dmp_id === currentDmpId ? draftProjectId : undefined) ??
    plan?.project_id ??
    draftProjectId ??
    projects[0]?.project_id;

  const checklist = task.checklist ?? [];
  const doneCount = checklist.filter((i) => i.done).length;
  const requirement = requirementFor(task);
  const copy = REQUIREMENT_COPY[requirement];
  const satisfied = evidenceSatisfies(task);
  const unverified = awaitingVerification(task);
  const isDone = task.status === "done";
  const taskId = task.task_id as string;

  const attach = async (file: File) => {
    if (!projectId) {
      toast({
        title: "No project to attach evidence to",
        description: "Create a project first.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const record = await uploadFile({
        file,
        projectId,
        purpose: "task_deliverable",
      });
      setEvidence(taskId, {
        type: "file",
        ref: record.file_id as string,
        label: record.filename,
      });
      toast({ title: `${file.name} attached` });
    } finally {
      setUploading(false);
    }
  };

  const attachLink = () => {
    const value = linkValue.trim();
    if (!value) return;
    setEvidence(taskId, classifyPastedEvidence(value));
    setLinkValue("");
  };

  const close = () => {
    if (completeTask(taskId)) {
      toast({ title: "Task closed", description: task.title });
    } else {
      toast({
        title: "Evidence needed first",
        description: copy.hint,
        variant: "destructive",
      });
    }
  };

  const redraft = async () => {
    setRedrafting(true);
    // The task's own output is what the steps are for; the rest is context.
    const outputs = plan?.draft.dataset ?? [];
    const own = task.dataset_id
      ? outputs.find((d) => d.dataset_id === task.dataset_id)
      : undefined;
    try {
      const { steps, token_count, usage } = await generateTaskChecklist({
        taskTitle: task.title,
        lifecycleStage: task.lifecycle_stage,
        taskOutput: own && {
          dataset_id: own.dataset_id as string,
          title: own.title || "Untitled output",
          type: own.type,
          access: own.access,
          personal_data: own.personal_data,
          repository: own.preservation?.repository,
          duration: own.preservation?.duration,
        },
        otherOutputs: outputs
          .filter((d) => d !== own)
          .map((d) => d.title || "Untitled output"),
        direction,
      });

      replaceChecklist(taskId, steps);
      recordAiEvent(task.dmp_id, {
        action: "redraft_steps",
        summary: `Redrafted the steps for "${task.title}"`,
        detail: [
          direction.trim() || "no direction given",
          `${steps.length} steps`,
        ].join(" · "),
        token_count,
        usage,
      });
      toast({
        title: `${steps.length} steps drafted`,
        description: `Steps already ticked were kept · ${token_count.toLocaleString()} tokens.`,
      });
      setDirection("");
    } catch (err) {
      reportAiError(err, { what: "draft the steps", retry: redraft });
    } finally {
      setRedrafting(false);
      syncQuota();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {doneCount} of {checklist.length} step
            {checklist.length === 1 ? "" : "s"} done
          </span>
          <span className="tabular-nums">{task.progress_percent}%</span>
        </div>
        <ProgressBar
          value={task.progress_percent}
          label={`${task.title} progress`}
        />
      </div>

      {/* Checklist — no dates, no status of its own, just the steps. */}
      <div className="space-y-1.5">
        {checklist.map((item) => (
          <div key={item.item_id} className="group flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.done}
              disabled={isDone}
              aria-label={item.label}
              onChange={() => toggleChecklistItem(taskId, item.item_id)}
              className="h-4 w-4 shrink-0 rounded border-input accent-primary"
            />
            {editing === item.item_id ? (
              <Input
                autoFocus
                value={draftLabel}
                aria-label={`Rename ${item.label}`}
                className="h-8"
                onChange={(e) => setDraftLabel(e.target.value)}
                onBlur={() => {
                  renameChecklistItem(taskId, item.item_id, draftLabel);
                  setEditing(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setEditing(null);
                }}
              />
            ) : (
              <button
                type="button"
                disabled={isDone}
                onClick={() => {
                  setEditing(item.item_id);
                  setDraftLabel(item.label);
                }}
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  item.done && "text-muted-foreground line-through",
                )}
              >
                {item.label}
              </button>
            )}
            {!isDone && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                aria-label={`Remove ${item.label}`}
                onClick={() => removeChecklistItem(taskId, item.item_id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}

        {!isDone && (
          <div className="flex items-center gap-2 pt-1">
            <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={newStep}
              aria-label="New checklist step"
              placeholder="Add a step"
              className="h-8"
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newStep.trim()) {
                  addChecklistItem(taskId, newStep);
                  setNewStep("");
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Evidence — what the stage demands before this can be closed. */}
      <div className="space-y-2 rounded-md border bg-background p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Evidence</p>
          <Chip
            variant={
              requirement === "declared"
                ? "neutral"
                : requirement === "system_verified"
                  ? "ai"
                  : "warn"
            }
          >
            {requirement !== "declared" && <Lock className="h-3 w-3" />}
            {copy.label}
          </Chip>
        </div>
        <p className="text-xs text-muted-foreground">{copy.hint}</p>

        {task.evidence.type !== "none" ? (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-2">
            <span className="flex min-w-0 items-center gap-2 text-xs">
              {task.evidence.type === "file" ? (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : task.evidence.type === "rdm_deposit" ? (
                <ShieldCheck className="h-4 w-4 shrink-0 text-ok" />
              ) : (
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">
                {task.evidence.label ?? task.evidence.ref}
              </span>
            </span>
            {!isDone && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="Remove evidence"
                onClick={() => clearEvidence(taskId)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ) : (
          !isDone && (
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                isLoading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <UploadIcon className="mr-1.5 h-3.5 w-3.5" />
                Attach a file
              </Button>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                aria-label="Attach output file"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) attach(picked);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-2">
                <Input
                  value={linkValue}
                  aria-label="Evidence link or DOI"
                  placeholder="…or paste a link / DOI"
                  className="h-8"
                  onChange={(e) => setLinkValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && attachLink()}
                />
                <Button
                  size="sm"
                  disabled={!linkValue.trim()}
                  onClick={attachLink}
                >
                  Add
                </Button>
              </div>
            </div>
          )
        )}

        {unverified && (
          <p className="text-xs text-warn">
            {looksLikeDoi(task.evidence?.ref ?? "")
              ? "A DOI on its own doesn't say what it identifies, so this counts as a link for now. It becomes verified when the repository confirms the deposit."
              : "Accepted for now. It becomes verified once the repository confirms the deposit."}
          </p>
        )}
      </div>

      {isDone ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Closed{" "}
            {task.completed_at
              ? new Date(task.completed_at).toLocaleDateString()
              : ""}{" "}
            by {task.completed_by ?? "you"}.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reopenTask(taskId)}
          >
            Reopen
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <Button className="w-full" disabled={!satisfied} onClick={close}>
            Mark task done
          </Button>
          {!satisfied && <p className="text-xs text-warn">{copy.hint}</p>}
        </div>
      )}

      {/* Redraft the steps from the plan, steered in your own words. */}
      <div className="rounded-md border border-dashed p-3">
        <p className="text-xs font-medium">Redraft these steps from the plan</p>
        <Input
          className="mt-2 h-8"
          value={direction}
          aria-label="Direction for the AI"
          placeholder="e.g. more detail, or focus on preservation"
          onChange={(e) => setDirection(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STEP_DIRECTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className="rounded-full border px-2 py-0.5 text-xs transition-colors hover:border-ai hover:text-ai focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {d}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ai"
          className="mt-2"
          isLoading={redrafting}
          disabled={isDone || !hasTokensFor(400)}
          onClick={redraft}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Redraft steps
        </Button>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Steps you've already ticked are kept.
        </p>
      </div>
    </div>
  );
};
