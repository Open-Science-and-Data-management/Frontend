import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, ArrowRight, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AiProgress } from "@/components/ui/ai-progress";
import { QuotaIndicator } from "@/components/ui/quota-indicator";
import {
  FileDropzone,
  validateProposalFile,
} from "@/components/ui/file-dropzone";
import { CreateProjectDialog } from "@/components/project/CreateProjectDialog";
import { coverageGaps, estimateCost } from "@/api/aiApi";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";

const PROGRESS_STEPS = [
  "Reading proposal",
  "Extracting datasets",
  "Filling fields",
  "Suggesting task outline",
];

type Stage = "idle" | "confirming" | "analyzing" | "low-coverage";

export const Upload: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    tokenUsed,
    tokenLimit,
    hasToken,
    hasTokensFor,
    analyzeProposal,
    startManual,
  } = useDmpStore();
  const { projects, files, uploadFile, updateProject } = useProjectStore();

  const [projectId, setProjectId] = React.useState<string>(
    searchParams.get("project") ?? projects[0]?.project_id ?? "",
  );
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | undefined>();
  const [stage, setStage] = React.useState<Stage>("idle");
  const [progressStep, setProgressStep] = React.useState(0);

  const existingProposal = files.find(
    (f) =>
      f.project_id === projectId &&
      f.purpose === "proposal" &&
      !f.superseded_at,
  );

  const handleFileSelect = (selected: File) => {
    const error = validateProposalFile(selected);
    setFileError(error ?? undefined);
    setFile(error ? null : selected);
  };

  const runAnalysis = async () => {
    if (!file || !projectId) return;
    setStage("analyzing");
    setProgressStep(0);

    const stepTimer = setInterval(() => {
      setProgressStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1));
    }, 350);

    try {
      // The proposal is stored against the project before AI reads it.
      await uploadFile({ file, projectId, purpose: "proposal" });
      const { coverage } = await analyzeProposal(file, projectId);
      updateProject(projectId, { status: "active" });

      clearInterval(stepTimer);
      setProgressStep(PROGRESS_STEPS.length);
      if (coverage === "low") {
        setStage("low-coverage");
      } else {
        navigate("/dmp/create");
      }
    } catch {
      clearInterval(stepTimer);
      setStage("idle");
    }
  };

  const handleSkipAi = async () => {
    if (!projectId) return;
    if (file) {
      await uploadFile({ file, projectId, purpose: "proposal" });
    }
    startManual(projectId);
    navigate("/dmp/create");
  };

  const analyzeCost = file ? estimateCost.analyzeProposal(file) : 0;
  const canAffordAnalyze = file ? hasTokensFor(analyzeCost) : hasToken();
  const canAnalyze = Boolean(file) && Boolean(projectId) && canAffordAnalyze;

  return (
    <>
      <Helmet>
        <title>Upload proposal | DMP-Researcher</title>
      </Helmet>

      <div className="mx-auto max-w-xl space-y-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Upload your proposal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI will read it and draft a Data Management Plan for you to review.
          </p>
        </div>

        {stage === "analyzing" ? (
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ai">
              <Sparkles className="h-4 w-4" />
              Analyzing your proposal…
            </div>
            <AiProgress steps={PROGRESS_STEPS} activeIndex={progressStep} />
          </div>
        ) : stage === "low-coverage" ? (
          <LowCoverageFallback
            file={file}
            projectId={projectId}
            onContinue={() => navigate("/dmp/create")}
            onRetry={async (direction) => {
              if (!file) return;
              // Nothing has been edited by hand yet, so a second pass can
              // replace the draft outright.
              const { coverage } = await analyzeProposal(
                file,
                projectId,
                direction,
              );
              if (coverage === "ok") navigate("/dmp/create");
            }}
          />
        ) : (
          <>
            <div className="rounded-lg border bg-card p-4">
              <label htmlFor="upload-project" className="text-sm font-medium">
                Project
              </label>
              <p className="mb-2 text-xs text-muted-foreground">
                The proposal and its DMP belong to a project.
              </p>
              {projects.length === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateProjectOpen(true)}
                >
                  <FolderKanban className="mr-1.5 h-3.5 w-3.5" />
                  Create a project first
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Select
                    id="upload-project"
                    className="flex-1"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  >
                    {projects.map((project) => (
                      <option
                        key={project.project_id}
                        value={project.project_id}
                      >
                        {project.project_name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateProjectOpen(true)}
                  >
                    New
                  </Button>
                </div>
              )}
              {existingProposal && (
                <p className="mt-2 text-xs text-warn">
                  This project already has a proposal (
                  {existingProposal.filename}). Uploading another supersedes it
                  — the old one is kept as a previous version.
                </p>
              )}
            </div>

            <FileDropzone
              file={file}
              onFileSelect={handleFileSelect}
              onRemove={() => {
                setFile(null);
                setFileError(undefined);
              }}
              error={fileError}
            />

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-medium">AI tokens</p>
                <p className="text-xs text-muted-foreground">
                  {file
                    ? `Analyzing this file costs about ${analyzeCost.toLocaleString()} tokens`
                    : "Resets monthly · spent on analyzing and regenerating"}
                </p>
              </div>
              <QuotaIndicator used={tokenUsed} limit={tokenLimit} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                variant="ai"
                disabled={!canAnalyze}
                onClick={() => setStage("confirming")}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze & generate DMP
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={!projectId}
                onClick={handleSkipAi}
              >
                Skip AI — fill manually
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            {!canAffordAnalyze && (
              <p className="text-center text-xs text-warn">
                Not enough tokens left this month — you can still fill the DMP
                manually.
              </p>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={stage === "confirming"}
        onOpenChange={(open) => setStage(open ? "confirming" : "idle")}
        title="Analyze this proposal?"
        description={`This will use about ${analyzeCost.toLocaleString()} of your ${(tokenLimit - tokenUsed).toLocaleString()} remaining tokens this month. AI will draft a DMP for you to review — nothing is submitted automatically.`}
        confirmLabel="Analyze & generate"
        confirmVariant="ai"
        onConfirm={runAnalysis}
      />

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onCreated={(project) => setProjectId(project.project_id as string)}
      />
    </>
  );
};

/**
 * When the document was too thin to draft from, we ask rather than guess. The
 * answers become a direction and the proposal is read again — so the plan is
 * still AI-drafted from the researcher's own words, not invented.
 */
const LowCoverageFallback: React.FC<{
  file: File | null;
  projectId: string;
  onContinue: () => void;
  onRetry: (direction: string) => Promise<void>;
}> = ({ file, onContinue, onRetry }) => {
  const draft = useDmpStore((s) => s.draft);
  const gaps = React.useMemo(() => coverageGaps(draft), [draft]);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [retrying, setRetrying] = React.useState(false);

  const direction = gaps
    .map((gap) =>
      answers[gap.id]?.trim()
        ? `${gap.question} ${answers[gap.id].trim()}`
        : "",
    )
    .filter(Boolean)
    .join(" ");

  const answered = Object.values(answers).filter((a) => a.trim()).length;

  return (
    <div className="space-y-4 rounded-lg border border-warn/40 bg-warn-subtle/30 p-6">
      <div>
        <h2 className="font-semibold text-warn">
          AI needs a bit more to go on
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {file?.name ?? "Your proposal"} was thin on detail. Rather than
          guessing a whole plan, answer what you can — AI reads the proposal
          again with your answers as direction.
        </p>
      </div>

      <div className="space-y-3">
        {gaps.map((gap) => (
          <div key={gap.id}>
            <label
              htmlFor={`gap-${gap.id}`}
              className="mb-1 block text-sm font-medium"
            >
              {gap.question}
            </label>
            <Input
              id={`gap-${gap.id}`}
              placeholder={gap.placeholder}
              value={answers[gap.id] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [gap.id]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ai"
          isLoading={retrying}
          disabled={answered === 0 || !file}
          onClick={async () => {
            setRetrying(true);
            try {
              await onRetry(direction);
            } finally {
              setRetrying(false);
            }
          }}
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          Draft again with these answers
        </Button>
        <Button variant="outline" onClick={onContinue}>
          Skip and edit by hand
        </Button>
      </div>

      {answered === 0 && (
        <p className="text-xs text-muted-foreground">
          Answer at least one question, or carry on and fill the plan in
          yourself.
        </p>
      )}
    </div>
  );
};
