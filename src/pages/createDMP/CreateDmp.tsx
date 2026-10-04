import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock, Sparkles } from "lucide-react";
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
import { PlanChanges } from "@/components/dmp/PlanChanges";
import { AiAssistDialog } from "@/components/dmp/AiAssistDialog";
import {
  DMP_SECTIONS,
  SECTION_LABELS,
  useDmpReadiness,
  type DmpSection,
} from "@/hooks/useDmpReadiness";
import { useDmpStore } from "@/store/dmpStore";
import { isActive } from "@/config/plan-mode";

const STEPPER_STEPS = [
  { label: "Upload" },
  { label: "Analyze" },
  { label: "Review" },
  { label: "Submit" },
  { label: "Approved" },
];

// One list of sections, shared with the readiness checklist.
const SECTIONS = DMP_SECTIONS;
type Section = DmpSection;

const isSection = (value: string | null): value is Section =>
  SECTIONS.includes(value as Section);

const SECTION_ITEMS = SECTIONS.map((id) => ({ id, label: SECTION_LABELS[id] }));

export const CreateDmp: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { draft, resetDraft } = useDmpStore();
  const status = useDmpStore((s) => s.status);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [assistOpen, setAssistOpen] = React.useState(false);

  // The URL owns the active section so Review's per-section Edit links work
  // even when we're already on this route — local state would go stale,
  // since the component doesn't remount on a query-only change.
  const requested = searchParams.get("section");
  const section: Section = isSection(requested) ? requested : "general";
  const setSection = (next: Section) =>
    setSearchParams({ section: next }, { replace: true });

  const { checklistItems, canSubmit, unmetItems } = useDmpReadiness();
  // Once a version is in force, the question stops being "is this ready to
  // submit" and becomes "what does this change about what was agreed".
  const planIsActive = isActive(status);

  // What each section still needs, so the nav can say so without being opened.
  const outstanding = React.useMemo(() => {
    const counts: Record<string, number> = {};
    unmetItems.forEach((item) => {
      counts[item.section] = (counts[item.section] ?? 0) + 1;
    });
    return counts;
  }, [unmetItems]);

  const sectionItems = React.useMemo(
    () =>
      SECTION_ITEMS.map((item) => ({
        ...item,
        outstanding: outstanding[item.id] ?? 0,
      })),
    [outstanding],
  );

  const index = SECTIONS.indexOf(section);
  const previous = index > 0 ? SECTIONS[index - 1] : undefined;
  const next = index < SECTIONS.length - 1 ? SECTIONS[index + 1] : undefined;

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
              onClick={() => setAssistOpen(true)}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Ask AI to improve
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
              items={sectionItems}
              activeId={section}
              onSelect={(id) => setSection(id as Section)}
            />
          }
          sectionTabs={
            <SectionNav
              items={sectionItems}
              activeId={section}
              orientation="horizontal"
              onSelect={(id) => setSection(id as Section)}
            />
          }
          rail={
            <>
              <PlanChanges />
              <ReadyChecklist items={checklistItems} onNavigate={setSection} />
              {!planIsActive && (
                <Button
                  className="w-full"
                  disabled={!canSubmit}
                  onClick={() => navigate("/dmp/review")}
                >
                  Review &amp; submit
                </Button>
              )}
              {!planIsActive && !canSubmit && (
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
              {SECTION_LABELS[section]}
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

          {/* Finishing a section leaves you at the bottom of it — the way on
              should be here, not back at the top of the page. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex items-center gap-3">
              {previous ? (
                <Button variant="outline" onClick={() => setSection(previous)}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  {SECTION_LABELS[previous]}
                </Button>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground">
                Section {index + 1} of {SECTIONS.length}
              </span>
            </div>

            {next ? (
              <Button onClick={() => setSection(next)}>
                {SECTION_LABELS[next]}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : planIsActive ? (
              <span className="text-xs text-muted-foreground">
                Changes are reviewed in the panel on the right.
              </span>
            ) : (
              <div className="flex items-center gap-2">
                {!canSubmit && (
                  <span className="text-xs text-muted-foreground">
                    {unmetItems.length} still needed
                  </span>
                )}
                <Button
                  disabled={!canSubmit}
                  onClick={() => navigate("/dmp/review")}
                >
                  Review &amp; submit
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </PlanEditorLayout>
      </div>

      <AiAssistDialog open={assistOpen} onOpenChange={setAssistOpen} />

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
