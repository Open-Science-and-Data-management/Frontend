import React from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AiProgress } from "@/components/ui/ai-progress";
import { estimateCost, generateTasks } from "@/api/aiApi";
import { useDmpStore } from "@/store/dmpStore";
import { recordAiEvent } from "@/store/aiThread";
import { useTaskStore } from "@/store/taskStore";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/utils/cn";
import { activation, isActive } from "@/config/plan-mode";
import { usePlanMode } from "@/hooks/usePlanMode";

const TRACKER_STAGES = ["Submitted", "Under review", "Decision"];
/** Independent plans never queue for anyone, so they have no review step. */
const SELF_STAGES = ["Drafted", "Finalized"];

const GENERATE_STEPS = [
  "Reading the approved plan",
  "Mapping outputs to lifecycle stages",
  "Drafting tasks",
];

export const Status: React.FC = () => {
  const navigate = useNavigate();
  const {
    draft,
    status,
    tasksGenerated,
    approve,
    finalize,
    markTasksGenerated,
    hasTokensFor,
    tokensLeft,
  } = useDmpStore();
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const addGeneratedTasks = useTaskStore((s) => s.addGeneratedTasks);
  const toast = useToastStore((s) => s.toast);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [step, setStep] = React.useState(0);

  const outputs = draft.dataset ?? [];
  const cost = estimateCost.generateTasks(outputs.length);
  const mode = usePlanMode(draft.project_id);
  const route = activation(mode);
  const stages = route.reviewed ? TRACKER_STAGES : SELF_STAGES;
  // Everything below asks whether the plan is active, not who made it so.
  const isApproved = isActive(status);
  const stageIndex = isApproved ? stages.length - 1 : route.reviewed ? 1 : 0;

  const runGeneration = async () => {
    if (!currentDmpId) {
      toast({ title: "Open a plan first", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setStep(0);
    const timer = setInterval(
      () => setStep((s) => Math.min(s + 1, GENERATE_STEPS.length - 1)),
      380,
    );

    try {
      const { tasks, token_count } = await generateTasks({
        outputs: outputs.map((d) => ({
          dataset_id: d.dataset_id,
          title: d.title || "Untitled output",
          type: d.type,
          access: d.access,
        })),
        beginDate: draft.begin_date,
        endDate: draft.end_date,
      });

      addGeneratedTasks(
        tasks.map((t) => ({
          // The plan these tasks came from, so the board can scope to it.
          dmp_id: currentDmpId,
          dataset_id: t.dataset_id,
          title: t.title,
          details: t.details,
          lifecycle_stage: t.lifecycle_stage,
          priority: t.priority,
          status: "todo" as const,
          progress_percent: 0,
          // Per the data model, AI-created tasks are marked as such.
          generated_by: "ai" as const,
        })),
      );

      useDmpStore.setState((s) => ({ tokenUsed: s.tokenUsed + token_count }));
      recordAiEvent(currentDmpId, {
        action: "generate_tasks",
        summary: `Generated ${tasks.length} task${tasks.length === 1 ? "" : "s"} from the approved plan`,
        detail: tasks
          .map((t) => t.title)
          .slice(0, 3)
          .join(", "),
        token_count,
      });
      markTasksGenerated();
      clearInterval(timer);
      setGenerating(false);
      toast({
        title: `${tasks.length} tasks generated`,
        description: `Used ${token_count.toLocaleString()} tokens.`,
      });
      navigate("/tasks");
    } catch {
      clearInterval(timer);
      setGenerating(false);
      toast({ title: "Couldn't generate tasks", variant: "destructive" });
    }
  };

  return (
    <>
      <Helmet>
        <title>Status | DMP-Researcher</title>
      </Helmet>

      <div className="mx-auto max-w-xl space-y-6 py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {isApproved
              ? route.activeLabel
              : route.reviewed
                ? "Pending review"
                : "Ready to finalize"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isApproved
              ? `${route.by === "self" ? "You finalized this plan" : "Your committee approved this plan"}. You can now break it into tasks.`
              : route.reviewed
                ? "We’ll notify you as soon as your committee makes a decision."
                : "No committee reviews this plan — finalize it yourself when you're ready, and your evidence carries the weight."}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <ol className="flex items-center justify-between">
            {stages.map((stage, i) => {
              const state =
                i < stageIndex
                  ? "done"
                  : i === stageIndex
                    ? "active"
                    : "upcoming";
              const isDecisionDone = isApproved && i === stageIndex;
              return (
                <li
                  key={stage}
                  className="flex flex-1 flex-col items-center gap-2 text-center"
                >
                  <div className="flex w-full items-center">
                    {i > 0 && (
                      <div
                        className={cn(
                          "h-px flex-1",
                          state === "upcoming" ? "bg-border" : "bg-ok",
                        )}
                      />
                    )}
                    {(state === "done" || isDecisionDone) && (
                      <CheckCircle2 className="h-6 w-6 shrink-0 text-ok" />
                    )}
                    {state === "active" && !isDecisionDone && (
                      <Clock className="h-6 w-6 shrink-0 text-primary" />
                    )}
                    {state === "upcoming" && (
                      <Circle className="h-6 w-6 shrink-0 text-muted-foreground" />
                    )}
                    {i < TRACKER_STAGES.length - 1 && (
                      <div
                        className={cn(
                          "h-px flex-1",
                          i < stageIndex ? "bg-ok" : "bg-border",
                        )}
                      />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      state === "upcoming" && "text-muted-foreground",
                    )}
                  >
                    {stage}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* There's no queue to wait in when you sign your own plan off. */}
          {!isApproved && route.reviewed && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Estimated decision: within 5 business days
            </p>
          )}
        </div>

        {isApproved ? (
          <div className="rounded-lg border bg-card p-6 text-center">
            {generating ? (
              <>
                <div className="mb-4 flex items-center justify-center gap-2 text-sm font-medium text-ai">
                  <Sparkles className="h-4 w-4" />
                  Generating tasks…
                </div>
                <AiProgress
                  steps={GENERATE_STEPS}
                  activeIndex={step}
                  className="mx-auto max-w-xs text-left"
                />
              </>
            ) : tasksGenerated ? (
              <>
                <ListChecks className="mx-auto h-8 w-8 text-ok" />
                <p className="mt-2 font-medium">Tasks created</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your plan has been broken into tasks you can track.
                </p>
                <Button className="mt-4" variant="outline" asChild>
                  <Link to="/tasks">View tasks</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="font-medium">Break this plan into tasks</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  AI drafts one task per lifecycle stage for each of your{" "}
                  {outputs.length} research output
                  {outputs.length === 1 ? "" : "s"}. You can edit them after.
                </p>
                <Button
                  className="mt-4"
                  variant="ai"
                  disabled={outputs.length === 0 || !hasTokensFor(cost)}
                  onClick={() => setConfirmOpen(true)}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate tasks
                </Button>
                {!hasTokensFor(cost) && (
                  <p className="mt-2 text-xs text-warn">
                    Needs about {cost.toLocaleString()} tokens; you have{" "}
                    {tokensLeft().toLocaleString()} left.
                  </p>
                )}
              </>
            )}
          </div>
        ) : route.by === "self" ? (
          // Nobody else to wait for: the researcher signs their own plan off.
          <div className="rounded-lg border p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Finalizing makes the plan active and unlocks its tasks. You can
              still raise a new version later.
            </p>
            <Button
              className="mt-2"
              size="sm"
              onClick={() => {
                finalize();
                toast({ title: "Plan finalized" });
              }}
            >
              {route.action}
            </Button>
          </div>
        ) : (
          // No committee UI exists yet, so approval is simulated here.
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Demo only — stands in for the committee decision.
            </p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              onClick={() => {
                approve();
                toast({ title: "Plan approved by committee" });
              }}
            >
              Simulate approval
            </Button>
          </div>
        )}

        <div className="text-center">
          <Button variant="outline" asChild>
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Generate tasks from this plan?"
        description={`This will use about ${cost.toLocaleString()} of your ${tokensLeft().toLocaleString()} remaining tokens and add tasks for ${outputs.length} research output${outputs.length === 1 ? "" : "s"}. You can edit or delete them afterwards.`}
        confirmLabel="Generate tasks"
        confirmVariant="ai"
        onConfirm={runGeneration}
      />
    </>
  );
};
