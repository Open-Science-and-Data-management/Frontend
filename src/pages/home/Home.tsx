import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  CalendarClock,
  FileText,
  ListChecks,
  PenLine,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotaIndicator } from "@/components/ui/quota-indicator";
import {
  HowItWorksSteps,
  WhatToPrepare,
} from "@/components/onboarding/HowItWorks";
import { StatCard } from "@/components/dashboard/StatCard";
import { UpcomingTasks } from "@/components/dashboard/UpcomingTasks";
import { PlanApprovals } from "@/components/dashboard/PlanApprovals";
import { ProjectProgressList } from "@/components/dashboard/ProjectProgressList";
import { RecentNotifications } from "@/components/dashboard/RecentNotifications";
import { useResearcherDashboard } from "@/hooks/useResearcherDashboard";
import { draftHasContent, useDmpStore } from "@/store/dmpStore";
import { formatTokensLeft, useQuotaStore } from "@/store/quotaStore";
import { useCurrentUser } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { toLocalDay } from "@/utils/calendarDate";

const greeting = (hour: number) =>
  hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "1 in review · 1 approved · 1 draft", leaving out what there's none of. */
const joinCounts = (parts: [number, string][]) =>
  parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(" · ");

/**
 * First visit: nothing to report yet, so the page explains the flow instead.
 * Once there's a plan in the library the dashboard takes over.
 */
const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastStore((s) => s.toast);

  return (
    <div className="mx-auto max-w-3xl space-y-10 py-8">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Turn your research proposal into a Data Management Plan
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          AI drafts a FAIRer maDMP-compliant plan from your proposal. You check
          and confirm every field, and your committee makes the decision. AI
          never approves anything.
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
          className="rounded text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View a sample DMP
        </button>
      </div>

      <HowItWorksSteps />

      <WhatToPrepare aside={<QuotaIndicator />} />
    </div>
  );
};

/** The researcher's day: what's due, what's with the committee, how far along. */
const Dashboard: React.FC<{
  data: ReturnType<typeof useResearcherDashboard>;
}> = ({ data }) => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const draft = useDmpStore((s) => s.draft);
  const status = useDmpStore((s) => s.status);
  const quota = useQuotaStore((s) => s.quota);
  const tokensLeft = quota ? Math.max(0, quota.limit - quota.used) : null;

  const now = new Date();
  // A draft still in the editor is the most likely thing to pick back up.
  const openDraft =
    status === "draft" && draftHasContent(draft) ? draft : undefined;

  const summary = [
    data.dueThisWeek.length > 0 &&
      `${plural(data.dueThisWeek.length, "task")} due this week`,
    data.overdue.length > 0 && `${data.overdue.length} overdue`,
    data.waitingOnCommittee > 0 &&
      `${plural(data.waitingOnCommittee, "plan")} waiting on committee approval`,
  ].filter(Boolean) as string[];

  const summaryText =
    summary.length === 0
      ? "Nothing urgent. You're all caught up."
      : `You have ${
          summary.length === 1
            ? summary[0]
            : `${summary.slice(0, -1).join(", ")} and ${summary[summary.length - 1]}`
        }.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting(now.getHours())}
            {user ? `, ${user.name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{summaryText}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(now, "EEEE, MMMM d")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate("/upload")}>
          <Upload className="mr-2 h-4 w-4" />
          Upload proposal
        </Button>
        {openDraft ? (
          <Button onClick={() => navigate("/dmp/create")}>
            <PenLine className="mr-2 h-4 w-4" />
            Continue “{openDraft.title?.trim() || "Untitled DMP"}”
          </Button>
        ) : (
          <Button onClick={() => navigate("/tasks")}>
            <ListChecks className="mr-2 h-4 w-4" />
            Open my tasks
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My DMPs"
          value={data.library.length}
          icon={FileText}
          to="/dmps"
          footer={
            joinCounts([
              [data.planCounts.pending, "in review"],
              [data.planCounts.approved, "approved"],
              [data.planCounts.draft, "draft"],
            ]) || "No plans yet"
          }
        />
        <StatCard
          label="Open tasks"
          value={data.openTasks.length}
          icon={ListChecks}
          to="/tasks"
          footer={
            data.openTasks.length === 0
              ? "Nothing open"
              : joinCounts([
                  [data.inProgressCount, "in progress"],
                  [data.openTasks.length - data.inProgressCount, "to do"],
                ])
          }
        />
        <StatCard
          label="Due this week"
          value={data.dueThisWeek.length}
          icon={CalendarClock}
          to="/tasks"
          footer={[
            data.overdue.length > 0 && `${data.overdue.length} overdue`,
            data.nextDue
              ? `Next due: ${format(toLocalDay(data.nextDue.task.end_date as Date), "EEE, MMM d")}`
              : "Nothing due soon",
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <StatCard
          label="AI tokens"
          value={formatTokensLeft(tokensLeft)}
          icon={Sparkles}
          iconClassName="border-ai/30 bg-ai-subtle text-ai"
          to="/upload"
          footer={
            quota ? `left of ${quota.limit.toLocaleString()}` : "Loading…"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <UpcomingTasks items={data.upcoming} />
          <PlanApprovals items={data.approvals} />
        </div>
        <div className="min-w-0 space-y-6">
          <ProjectProgressList items={data.progress} />
          <RecentNotifications />
        </div>
      </div>
    </div>
  );
};

export const Home: React.FC = () => {
  const data = useResearcherDashboard();

  return (
    <>
      <Helmet>
        <title>Dashboard | DMP-Researcher</title>
      </Helmet>
      {data.library.length > 0 ? <Dashboard data={data} /> : <Welcome />}
    </>
  );
};
