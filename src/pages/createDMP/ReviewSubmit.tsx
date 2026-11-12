import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DmpReview } from "@/components/dmp/DmpReview";
import { ReadyChecklist } from "@/components/dmp/ReadyChecklist";
import { useDmpReadiness } from "@/hooks/useDmpReadiness";
import { useDmpStore } from "@/store/dmpStore";
import { useToastStore } from "@/store/toastStore";
import { activation, planStepIndex, planSteps } from "@/config/plan-mode";
import { useOpenPlanMode } from "@/hooks/usePlanMode";

export const ReviewSubmit: React.FC = () => {
  const navigate = useNavigate();
  const draft = useDmpStore((s) => s.draft);
  const submitForApproval = useDmpStore((s) => s.submitForApproval);
  const finalize = useDmpStore((s) => s.finalize);
  const mode = useOpenPlanMode();
  const route = activation(mode);
  const status = useDmpStore((s) => s.status);
  const toast = useToastStore((s) => s.toast);
  const { checklistItems, canSubmit, unmetItems } = useDmpReadiness();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // The server takes a plan's first submission once. After that, changes
  // go through revisions from the editor, which need a version in force.
  const versions = useDmpStore(
    (s) => s.dmps.find((d) => d.dmp_id === s.currentDmpId)?.versions,
  );
  const submitted = (versions?.length ?? 0) > 0;
  // Every version sent back and none in force: the server has no way to take
  // the plan again yet (submit says already_submitted, revisions say
  // plan_not_in_force), so nothing here offers to.
  const stuck =
    submitted &&
    !versions?.some((v) => v.status === "approved" || v.status === "pending");

  const goToSection = (section: string, field?: string) =>
    navigate(
      `/dmp/create?section=${section}${field ? `&field=${encodeURIComponent(field)}` : ""}`,
    );

  if (!draft.title && !draft.description) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-medium">Nothing to review yet</p>
        <p className="text-sm text-muted-foreground">
          Start a plan before submitting it for approval.
        </p>
        <Button onClick={() => navigate("/upload")}>Start a DMP</Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-medium">
          {stuck
            ? "This plan can't be resubmitted yet"
            : "This plan has already been submitted"}
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          {stuck
            ? "Your committee sent it back, and the server doesn't accept a second submission of a plan that was never approved. You can keep editing the draft; ask your administrator to reopen the plan."
            : "Changes to it are saved as minor edits or sent to your committee as a new version from the editor."}
        </p>
        <Button onClick={() => navigate("/dmp/create")}>
          Back to the editor
        </Button>
      </div>
    );
  }

  // The only confirmation in the whole authoring flow — fields are edited
  // freely, and the plan is confirmed once here. Which transition it runs is
  // the project's mode; where it lands — an active plan — is the same either way.
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setConfirmOpen(false);
    // The server checks the plan again and may refuse; the store says why.
    const ok =
      route.by === "self" ? await finalize() : await submitForApproval();
    if (!ok) return;
    toast({
      title:
        route.by === "self"
          ? "Plan finalized"
          : "Submitted for committee review",
    });
    navigate("/dmp/status");
  };

  return (
    <>
      <Helmet>
        <title>Review & submit | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Stepper
            steps={planSteps(mode)}
            activeIndex={planStepIndex(status, true)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dmp/create")}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to editing
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Review &amp; submit
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This is exactly what your committee will receive. Check it over. You
            can still edit any section before submitting.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <DmpReview onEditSection={goToSection} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <ReadyChecklist items={checklistItems} onNavigate={goToSection} />

            {canSubmit ? (
              <>
                <Button className="w-full" onClick={() => setConfirmOpen(true)}>
                  <Send className="mr-2 h-4 w-4" />
                  {route.action}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {route.by === "self"
                    ? "No committee reviews this plan. Finalizing makes it active and unlocks its tasks, and your evidence is what backs it up."
                    : "Your committee reviews and approves the plan. Nothing is approved automatically."}
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-warn/40 bg-warn-subtle/40 p-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-warn">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Not ready to submit
                </p>
                {/* No list here: the checklist above names them, by section. */}
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    goToSection(
                      unmetItems[0]?.section ?? "general",
                      unmetItems[0]?.fieldId,
                    )
                  }
                >
                  Go fix these
                </Button>
              </div>
            )}
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          route.by === "self"
            ? "Finalize this plan?"
            : "Submit this plan for approval?"
        }
        description={
          route.by === "self"
            ? "It becomes active as it stands now and its tasks open up. You can raise a new version later."
            : "Your committee will review it as it stands now. You can keep editing while it's pending, but they'll see this version."
        }
        confirmLabel={route.action}
        cancelLabel="Keep reviewing"
        onConfirm={handleSubmit}
      />
    </>
  );
};
