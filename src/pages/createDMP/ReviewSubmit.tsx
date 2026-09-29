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

const STEPPER_STEPS = [
  { label: "Upload" },
  { label: "Analyze" },
  { label: "Review" },
  { label: "Submit" },
  { label: "Approved" },
];

export const ReviewSubmit: React.FC = () => {
  const navigate = useNavigate();
  const draft = useDmpStore((s) => s.draft);
  const submitForApproval = useDmpStore((s) => s.submitForApproval);
  const toast = useToastStore((s) => s.toast);
  const { checklistItems, canSubmit, unmetItems } = useDmpReadiness();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const goToSection = (section: string) =>
    navigate(`/dmp/create?section=${section}`);

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

  // The only confirmation in the whole authoring flow — fields are edited
  // freely, and the plan is confirmed once here.
  const handleSubmit = () => {
    if (!canSubmit) return;
    submitForApproval();
    toast({ title: "Submitted for committee review" });
    setConfirmOpen(false);
    navigate("/dmp/status");
  };

  return (
    <>
      <Helmet>
        <title>Review & submit | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Stepper steps={STEPPER_STEPS} activeIndex={3} />
          <Button variant="ghost" size="sm" onClick={() => navigate("/dmp/create")}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to editing
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review &amp; submit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This is exactly what your committee will receive. Check it over —
            you can still edit any section before submitting.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <DmpReview onEditSection={goToSection} />
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <ReadyChecklist items={checklistItems} />

            {canSubmit ? (
              <>
                <Button className="w-full" onClick={() => setConfirmOpen(true)}>
                  <Send className="mr-2 h-4 w-4" />
                  Submit for approval
                </Button>
                <p className="text-xs text-muted-foreground">
                  Your committee reviews and approves the plan — nothing is
                  approved automatically.
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-warn/40 bg-warn-subtle/40 p-4">
                <p className="flex items-center gap-1.5 text-sm font-medium text-warn">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Not ready to submit
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {unmetItems.map((item) => (
                    <li key={item.label}>· {item.label}</li>
                  ))}
                </ul>
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/dmp/create")}
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
        title="Submit this plan for approval?"
        description="Your committee will review it as it stands now. You can keep editing while it's pending, but they'll see this version."
        confirmLabel="Submit for approval"
        cancelLabel="Keep reviewing"
        onConfirm={handleSubmit}
      />
    </>
  );
};
