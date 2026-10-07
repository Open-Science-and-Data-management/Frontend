import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { FaqList, HowItWorksSteps } from "@/components/onboarding/HowItWorks";

export const HelpGuide: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Help & Guide | DMP-Researcher</title>
      </Helmet>

      <div className="mx-auto max-w-2xl space-y-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Help & Guide</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            New to DMP-Researcher?{" "}
            <Link
              to="/welcome"
              className="text-primary underline-offset-4 hover:underline"
            >
              See the welcome page
            </Link>{" "}
            for an overview.
          </p>
        </div>

        <section>
          <h2 className="mb-3 font-semibold">How it works</h2>
          <HowItWorksSteps compact />
        </section>

        <section className="space-y-4">
          <h2 className="font-semibold">Frequently asked questions</h2>
          <FaqList />
        </section>
      </div>
    </>
  );
};
