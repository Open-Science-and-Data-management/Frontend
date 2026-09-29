import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Upload, Sparkles, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotaIndicator } from "@/components/ui/quota-indicator";
import { useDmpStore } from "@/store/dmpStore";
import { useToastStore } from "@/store/toastStore";

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    description: "Share your research proposal as a .docx file.",
  },
  {
    icon: Sparkles,
    title: "AI drafts",
    description: "AI reads it and drafts a FAIRer maDMP-compliant plan.",
  },
  {
    icon: CheckCircle2,
    title: "Review & submit",
    description: "You review, confirm, and submit it to your committee.",
  },
];

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { tokenUsed, tokenLimit } = useDmpStore();
  const toast = useToastStore((s) => s.toast);

  return (
    <>
      <Helmet>
        <title>DMP-Researcher</title>
      </Helmet>

      <div className="mx-auto max-w-3xl space-y-10 py-8">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Turn your research proposal into a Data Management Plan
          </h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            AI drafts a FAIRer maDMP-compliant plan from your proposal. You
            review, edit, and confirm every field — AI never approves
            anything; your committee does.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button size="lg" onClick={() => navigate("/upload")}>
            Create your first DMP
          </Button>
          <button
            type="button"
            onClick={() =>
              toast({
                title: "Sample DMP coming soon",
                description: "We're preparing a walkthrough example.",
              })
            }
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            View a sample DMP
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-lg border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <step.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 rounded-lg border bg-muted/30 p-5 sm:flex-row">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">What to prepare</p>
              <p className="text-xs text-muted-foreground">
                A research proposal in .docx format, up to 20MB.
              </p>
            </div>
          </div>
          <QuotaIndicator used={tokenUsed} limit={tokenLimit} />
        </div>
      </div>
    </>
  );
};
