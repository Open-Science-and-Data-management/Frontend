import React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import { useToastStore } from "@/store/toastStore";
import { useOpenPlanMode } from "@/hooks/usePlanMode";
import { dmpSchema } from "@/schemas/dmp/dmp.schema";
import { diffPlans } from "@/config/plan-diff";
import {
  buildExport,
  downloadJson,
  exportSource,
  EXPORT_FORMATS,
  type ExportFormat,
} from "@/api/exportDmp";

/** Download the plan as a standards document, in either format. */
export const ExportPanel: React.FC = () => {
  const draft = useDmpStore((s) => s.draft);
  const status = useDmpStore((s) => s.status);
  const dmps = useDmpStore((s) => s.dmps);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const projects = useProjectStore((s) => s.projects);
  const toast = useToastStore((s) => s.toast);
  const planMode = useOpenPlanMode();
  const record = dmps.find((d) => d.dmp_id === currentDmpId);
  const { plan, version } = exportSource({ draft, record });
  const canExport = dmpSchema.safeParse(plan).success;
  // Edits since the version in force, which the file deliberately leaves out.
  const waiting = record?.versions.find((v) => v.status === "pending");
  const unexported = version !== undefined && diffPlans(plan, draft).length > 0;
  const projectName = projects.find(
    (p) => p.project_id === draft.project_id,
  )?.project_name;

  const run = (format: ExportFormat) => {
    const result = buildExport(format, {
      draft,
      status,
      record,
      dmpId: currentDmpId ?? "unsaved-dmp",
      planMode,
      projectName,
    });
    if (!result.ok) {
      toast({
        title: "Can't export yet",
        description: result.reason,
        variant: "destructive",
      });
      return;
    }
    downloadJson(result.json, result.filename);
    toast({ title: "Exported", description: result.filename });
  };

  return (
    <section
      aria-label="Export"
      className="rounded-lg border bg-card p-5 text-left"
    >
      <h2 className="text-sm font-semibold">
        Export as machine-actionable DMP
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {!canExport
          ? "Finish the readiness list first — both standards require those fields."
          : version !== undefined
            ? `Exports version ${version}, the version in force — JSON that validates against each standard's published schema.`
            : "JSON files that validate against each standard's published schema."}
      </p>
      {unexported && (
        <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
          {waiting
            ? `Version ${waiting.number}, still waiting on a decision, isn't included until it's in force.`
            : "Edits you haven't saved or submitted yet aren't included."}
        </p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(EXPORT_FORMATS) as ExportFormat[]).map((format) => (
          <Button
            key={format}
            variant="outline"
            disabled={!canExport}
            onClick={() => run(format)}
            className="h-auto justify-start whitespace-normal py-2 text-left"
          >
            <Download className="mr-2 h-4 w-4 shrink-0" />
            <span className="grid">
              <span>{EXPORT_FORMATS[format].label}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {EXPORT_FORMATS[format].detail}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
};
