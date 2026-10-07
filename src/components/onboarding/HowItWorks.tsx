import React from "react";
import { CheckCircle2, FileText, Sparkles, Upload } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * The flow, explained once. The public landing page, a new researcher's
 * first screen and the Help page all draw from here, so they can't drift.
 */
export const HOW_IT_WORKS_STEPS = [
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

export const FAQS = [
  {
    q: "What file formats can I upload?",
    a: "Currently .docx proposals, up to 20MB.",
  },
  {
    q: "Does AI ever submit a plan on its own?",
    a: "No — AI only drafts and suggests. A person always confirms required fields, and your committee makes the final approval decision.",
  },
  {
    q: "What happens to my AI generation quota?",
    a: "You get a monthly quota for analyzing proposals and regenerating fields. It resets on the 1st.",
  },
  {
    q: "Can I edit a plan after it's approved?",
    a: "Yes — edits are classified as minor or major based on what changed, and major edits go back to your committee for approval.",
  },
];

/** The three numbered steps, as cards. `compact` is the Help page's size. */
export const HowItWorksSteps: React.FC<{ compact?: boolean }> = ({
  compact,
}) => (
  <div className="grid gap-4 sm:grid-cols-3">
    {HOW_IT_WORKS_STEPS.map((step, i) => (
      <div
        key={step.title}
        className={cn("rounded-lg border bg-card", compact ? "p-4" : "p-5")}
      >
        <div
          className={cn("flex items-center gap-2", compact ? "mb-2" : "mb-3")}
        >
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-muted text-xs font-semibold",
              compact ? "h-6 w-6" : "h-7 w-7",
            )}
          >
            {i + 1}
          </span>
          <step.icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className={cn("font-semibold", compact && "text-sm")}>
          {step.title}
        </h3>
        <p
          className={cn(
            "mt-1 text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {step.description}
        </p>
      </div>
    ))}
  </div>
);

/** What to have ready, with room on the right for a contextual extra. */
export const WhatToPrepare: React.FC<{ aside?: React.ReactNode }> = ({
  aside,
}) => (
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
    {aside}
  </div>
);

export const FaqList: React.FC = () => (
  <div className="space-y-4">
    {FAQS.map((faq) => (
      <div key={faq.q} className="rounded-lg border bg-card p-4">
        <p className="text-sm font-medium">{faq.q}</p>
        <p className="mt-1 text-sm text-muted-foreground">{faq.a}</p>
      </div>
    ))}
  </div>
);
