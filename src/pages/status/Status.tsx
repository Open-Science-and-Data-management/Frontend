import React from "react";
import { formatTokensLeft, useQuotaStore } from "@/store/quotaStore";
import { reportAiError, syncQuota } from "@/store/aiErrors";
import { useChangeText } from "@/hooks/useChangeText";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  ListChecks,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportPanel } from "@/components/dmp/ExportPanel";
import { EditApprovedPlan } from "@/components/dmp/EditApprovedPlan";
import { VersionHistory } from "@/components/dmp/VersionHistory";
import { ReopenTasksPrompt } from "@/components/task/ReopenTasksPrompt";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AiProgress } from "@/components/ui/ai-progress";
import { estimateCost, generateTasks } from "@/api/aiApi";
import { outputsInForce, useDmpStore } from "@/store/dmpStore";
import { recordAiEvent } from "@/store/aiThread";
import { useTaskStore } from "@/store/taskStore";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/utils/cn";
import { activation, isActive } from "@/config/plan-mode";
import { useOpenPlanMode } from "@/hooks/usePlanMode";

const TRACKER_STAGES = ["Submitted", "Under review", "Decision"];
/** Independent plans never queue for anyone, so they have no review step. */
const SELF_STAGES = ["Drafted", "Finalized"];

const GENERATE_STEPS = [
  "Reading the approved plan",
  "Mapping outputs to lifecycle stages",
  "Drafting tasks",
];

export const Status: React.FC = () => {
  const changeText = useChangeText();
  const navigate = useNavigate();
  const { status, tasksGenerated, finalize, markTasksGenerated } =
    useDmpStore();
  const hasTokensFor = useQuotaStore((s) => s.hasTokensFor);
  const tokensLeft = useQuotaStore((s) => s.tokensLeft);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const addGeneratedTasks = useTaskStore((s) => s.addGeneratedTasks);
  const toast = useToastStore((s) => s.toast);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const dmps = useDmpStore((s) => s.dmps);
  const record = dmps.find((d) => d.dmp_id === currentDmpId);
  // Who approved the version in force, as recorded when they did.
  const decider = record?.versions.find(
    (v) => v.number === record.active_version,
  )?.approver;
  // A revision, as opposed to the first submission: something is already live.
  const revision =
    record?.active_version !== undefined
      ? record.versions.find((v) => v.status === "pending")
      : undefined;
  // A first submission the committee handed back: the plan is a draft again.
  const returned =
    status === "draft"
      ? [...(record?.versions ?? [])]
          .reverse()
          .find((v) => v.status === "rejected")
      : undefined;
  const [generating, setGenerating] = React.useState(false);
  const [step, setStep] = React.useState(0);

  // Tasks execute the approved plan: its outputs and dates, never edits
  // still waiting to be saved or decided.
  const inForce = record?.versions.find(
    (v) => v.number === record.active_version,
  )?.snapshot;
  const outputs = outputsInForce(record);
  const cost = estimateCost.generateTasks(outputs.length);
  const mode = useOpenPlanMode();
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
      const { tasks, token_count, usage } = await generateTasks({
        outputs: outputs.map((d) => ({
          dataset_id: d.dataset_id,
          title: d.title || "Untitled output",
          type: d.type,
          access: d.access,
        })),
        beginDate: inForce?.begin_date,
        endDate: inForce?.end_date,
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

      recordAiEvent(currentDmpId, {
        action: "generate_tasks",
        summary: `Generated ${tasks.length} task${tasks.length === 1 ? "" : "s"} from the approved plan`,
        detail: tasks
          .map((t) => t.title)
          .slice(0, 3)
          .join(", "),
        token_count,
        usage,
      });
      markTasksGenerated(currentDmpId);
      clearInterval(timer);
      setGenerating(false);
      toast({
        title: `${tasks.length} tasks generated`,
        description: `Used ${token_count.toLocaleString()} tokens.`,
      });
      // The tasks belong to the plan they were made for, wherever the person
      // is now; only take them to the board if they're still on that plan.
      if (useDmpStore.getState().currentDmpId === currentDmpId)
        navigate("/tasks");
    } catch (err) {
      clearInterval(timer);
      setGenerating(false);
      reportAiError(err, { what: "generate tasks", retry: runGeneration });
    } finally {
      syncQuota();
    }
  };

  if (returned) {
    return (
      <>
        <Helmet>
          <title>Status | DMP-Researcher</title>
        </Helmet>
        <div className="mx-auto max-w-xl space-y-6 py-10">
          <div className="text-center">
            <Undo2 className="mx-auto h-8 w-8 text-warn" />
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              Sent back for changes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {returned.approver
                ? `${returned.approver.name} (${returned.approver.position})`
                : "Your committee"}{" "}
              returned version {returned.number}. Revise the plan and submit it
              again.
            </p>
          </div>
          {returned.note && (
            <blockquote className="rounded-lg border border-warn/40 bg-warn-subtle/40 p-4 text-sm">
              “{returned.note}”
            </blockquote>
          )}
          <div className="flex justify-center gap-2">
            <Button asChild>
              <Link to="/dmp/create">Revise the plan</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

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
              ? `${route.by === "self" ? "You finalized this plan" : decider ? `${decider.name} (${decider.position}) approved this plan` : "Your committee approved this plan"}. You can now break it into tasks.`
              : route.reviewed
                ? "We’ll notify you as soon as your committee makes a decision."
                : "No committee reviews this plan. Finalize it yourself when you're ready; your evidence is what backs it up."}
          </p>
        </div>

        {revision && (
          <div className="rounded-lg border bg-card p-5 text-left">
            <h2 className="text-sm font-semibold">
              Version {revision.number} is waiting on a decision
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Version {record?.active_version} stays in force meanwhile, and its
              tasks keep running.
            </p>

            <ul className="mt-3 space-y-1.5">
              {revision.changes.map((change) => (
                <li key={change.path} className="text-xs">
                  <span className="font-medium">{change.label}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {changeText(change)}
                  </span>
                </li>
              ))}
            </ul>

            {route.by === "self" ? (
              <Button
                className="mt-4"
                size="sm"
                onClick={() => {
                  finalize();
                  toast({
                    title: `Version ${revision.number} is now in force`,
                  });
                }}
              >
                Finalize version {revision.number}
              </Button>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Your committee has it. You'll be notified when they decide.
              </p>
            )}
          </div>
        )}

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
                    {i < stages.length - 1 && (
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
                    {formatTokensLeft(tokensLeft())} left.
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
          <div className="rounded-lg border p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Nothing to do for now. Your committee is reviewing the version you
              submitted. You can keep editing; they'll see what you sent.
            </p>
          </div>
        )}

        {isApproved && record?.active_version !== undefined && (
          <EditApprovedPlan
            activeVersion={record.active_version}
            bySelf={route.by === "self"}
          />
        )}

        <ReopenTasksPrompt />

        <VersionHistory />

        <ExportPanel />

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
        description={`This will use about ${cost.toLocaleString()} of your ${formatTokensLeft(tokensLeft())} remaining tokens and add tasks for ${outputs.length} research output${outputs.length === 1 ? "" : "s"}. You can edit or delete them afterwards.`}
        confirmLabel="Generate tasks"
        confirmVariant="ai"
        onConfirm={runGeneration}
      />
    </>
  );
};
