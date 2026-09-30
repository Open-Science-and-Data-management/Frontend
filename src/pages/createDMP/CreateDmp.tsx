import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { AutosaveIndicator } from "@/components/ui/autosave-indicator";
import { SectionNav } from "@/components/ui/section-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PlanEditorLayout } from "@/layouts/PlanEditorLayout";
import { GeneralSection } from "@/components/dmp/GeneralSection";
import { EthicalSection } from "@/components/dmp/EthicalSection";
import { SystemInfoSection } from "@/components/dmp/SystemInfoSection";
import { DatasetList } from "@/components/dmp/DatasetList";
import { ContributorList } from "@/components/dmp/ContributorList";
import { CostList } from "@/components/dmp/CostList";
import { ReadyChecklist } from "@/components/dmp/ReadyChecklist";
import { BatchRegenerateModal } from "@/components/dmp/BatchRegenerateModal";
import { useDmpReadiness } from "@/hooks/useDmpReadiness";
import { useDmpStore } from "@/store/dmpStore";

const STEPPER_STEPS = [
  { label: "Upload" },
  { label: "Analyze" },
  { label: "Review" },
  { label: "Submit" },
  { label: "Approved" },
];

const SECTIONS = ["general", "dataset", "ethical", "people", "system"] as const;
type Section = (typeof SECTIONS)[number];

const isSection = (value: string | null): value is Section =>
  SECTIONS.includes(value as Section);

const SECTION_ITEMS: { id: Section; label: string }[] = [
  { id: "general", label: "General" },
  { id: "dataset", label: "Research outputs" },
  { id: "ethical", label: "Ethical" },
  { id: "people", label: "People & cost" },
  { id: "system", label: "System info" },
];

const SECTION_TITLES: Record<Section, string> = {
  general: "General",
  dataset: "Research outputs",
  ethical: "Ethical",
  people: "People & cost",
  system: "System info",
};

export const CreateDmp: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { draft, resetDraft } = useDmpStore();
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [batchOpen, setBatchOpen] = React.useState(false);

  // The URL owns the active section so Review's per-section Edit links work
  // even when we're already on this route — local state would go stale,
  // since the component doesn't remount on a query-only change.
  const requested = searchParams.get("section");
  const section: Section = isSection(requested) ? requested : "general";
  const setSection = (next: Section) =>
    setSearchParams({ section: next }, { replace: true });

  const { checklistItems, canSubmit } = useDmpReadiness();

  return (
    <>
      <Helmet>
        <title>Create DMP | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Stepper steps={STEPPER_STEPS} activeIndex={2} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <AutosaveIndicator value={draft} />
            <Button
              variant="outline"
              size="sm"
              className="text-ai"
              onClick={() => setBatchOpen(true)}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Batch regenerate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDiscardOpen(true)}
            >
              Cancel
            </Button>
          </div>
        </div>

        <PlanEditorLayout
          sectionNav={
            <SectionNav
              items={SECTION_ITEMS}
              activeId={section}
              onSelect={(id) => setSection(id as Section)}
            />
          }
          sectionTabs={
            <SectionNav
              items={SECTION_ITEMS}
              activeId={section}
              orientation="horizontal"
              onSelect={(id) => setSection(id as Section)}
            />
          }
          rail={
            <>
              <ReadyChecklist items={checklistItems} onNavigate={setSection} />
              <Button
                className="w-full"
                disabled={!canSubmit}
                onClick={() => navigate("/dmp/review")}
              >
                Review &amp; submit
              </Button>
              {!canSubmit && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                  Complete the checklist above to unlock submission.
                </p>
              )}
            </>
          }
        >
          {section !== "dataset" && (
            <h1 className="text-2xl font-bold tracking-tight">
              {SECTION_TITLES[section]}
            </h1>
          )}
          {section === "general" && <GeneralSection />}
          {section === "dataset" && <DatasetList />}
          {section === "ethical" && <EthicalSection />}
          {section === "people" && (
            <div className="space-y-8">
              <ContributorList />
              <CostList />
            </div>
          )}
          {section === "system" && <SystemInfoSection />}
        </PlanEditorLayout>
      </div>

      <BatchRegenerateModal open={batchOpen} onOpenChange={setBatchOpen} />

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard this draft?"
        description="Your progress is auto-saved as you go. Discard it and return home, or keep editing."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        confirmVariant="destructive"
        onConfirm={() => {
          resetDraft();
          navigate("/");
        }}
      />
    </>
  );
};
