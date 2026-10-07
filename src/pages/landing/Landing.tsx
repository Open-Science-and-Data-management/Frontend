import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  FaqList,
  HowItWorksSteps,
  WhatToPrepare,
} from "@/components/onboarding/HowItWorks";
import { useCurrentUser } from "@/store/authStore";
import { homePathFor } from "@/config/roles";

/** Who the app is for — the two sides a visitor might be on. */
const AUDIENCES = [
  {
    icon: Users,
    title: "For researchers",
    description:
      "Upload a proposal, let AI draft the plan, then check every field yourself and submit it — and track the tasks it turns into.",
  },
  {
    icon: ShieldCheck,
    title: "For committee members",
    description:
      "See each submitted plan exactly as it was sent, what changed in a revision, and approve it or send it back with comments.",
  },
];

/**
 * The public front door: what DMP-Researcher is and how it works, for someone
 * who hasn't used it before. Shown at "/" when nobody is signed in, and at
 * "/welcome" for anyone.
 */
export const Landing: React.FC = () => {
  const user = useCurrentUser();
  // Already signed in (they came via /welcome): the button goes back in.
  const start = user
    ? { to: homePathFor(user.role), label: "Go to your dashboard" }
    : { to: "/login", label: "Get started" };

  return (
    <>
      <Helmet>
        <title>DMP-Researcher — Data Management Plans, drafted with AI</title>
      </Helmet>

      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-40 border-b bg-background">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
            <Link to="/" className="text-xl font-bold">
              Logo
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button size="sm" variant={user ? "outline" : "default"} asChild>
                <Link to={user ? start.to : "/login"}>
                  {user ? "Open app" : "Sign in"}
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 space-y-14 px-6 py-12">
          <section className="space-y-5 text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Turn your research proposal into a Data Management Plan
            </h1>
            <p className="mx-auto max-w-xl text-muted-foreground">
              AI drafts a FAIRer maDMP-compliant plan from your proposal. You
              review, edit, and confirm every field — AI never approves
              anything; your committee does.
            </p>
            <Button size="lg" asChild>
              <Link to={start.to}>
                {start.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </section>

          <section className="space-y-4">
            <h2 className="text-center text-lg font-semibold">How it works</h2>
            <HowItWorksSteps />
            <WhatToPrepare />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            {AUDIENCES.map((audience) => (
              <div
                key={audience.title}
                className="rounded-lg border bg-card p-5"
              >
                <audience.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-semibold">{audience.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {audience.description}
                </p>
              </div>
            ))}
          </section>

          <section className="space-y-4">
            <h2 className="text-center text-lg font-semibold">
              Frequently asked questions
            </h2>
            <FaqList />
          </section>
        </main>

        <footer className="border-t py-4">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} DMP-Researcher · MIT License
          </p>
        </footer>
      </div>
    </>
  );
};
