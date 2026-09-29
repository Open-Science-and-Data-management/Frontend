import React from "react";
import { Helmet } from "react-helmet-async";
import { Upload, Sparkles, CheckCircle2 } from "lucide-react";

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

const FAQS = [
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

export const HelpGuide: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Help & Guide | DMP-Researcher</title>
      </Helmet>

      <div className="mx-auto max-w-2xl space-y-10">
        <h1 className="text-2xl font-bold tracking-tight">Help & Guide</h1>

        <section>
          <h2 className="mb-3 font-semibold">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {i + 1}
                  </span>
                  <step.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-semibold">Frequently asked questions</h2>
          {FAQS.map((faq) => (
            <div key={faq.q} className="rounded-lg border bg-card p-4">
              <p className="text-sm font-medium">{faq.q}</p>
              <p className="mt-1 text-sm text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </section>
      </div>
    </>
  );
};
