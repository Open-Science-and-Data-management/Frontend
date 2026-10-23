import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  Hourglass,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/StatCard";
import { AwaitingReviewList } from "@/components/dashboard/AwaitingReviewList";
import { RecentDecisions } from "@/components/dashboard/RecentDecisions";
import { ProjectProgressList } from "@/components/dashboard/ProjectProgressList";
import { useCommitteeDashboard } from "@/hooks/useCommitteeDashboard";
import { useCurrentUser } from "@/store/authStore";

const greeting = (hour: number) =>
  hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);

/** The committee member's day: what's waiting, for how long, and what's moving. */
export const CommitteeHome: React.FC = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const data = useCommitteeDashboard();
  const now = new Date();

  const summary =
    data.waitingCount === 0
      ? "Nothing is waiting for your decision. You're all caught up."
      : `${data.waitingCount === 1 ? "1 plan is" : `${data.waitingCount} plans are`} waiting for your decision${
          data.oldest && data.waitingCount > 1
            ? `. The oldest has been waiting ${days(data.oldest.daysWaiting)}`
            : data.oldest && data.oldest.daysWaiting > 0
              ? `, submitted ${days(data.oldest.daysWaiting)} ago`
              : ""
        }.`;

  return (
    <>
      <Helmet>
        <title>Dashboard | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {greeting(now.getHours())}
              {user ? `, ${user.name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(now, "EEEE, MMMM d")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* The queue is oldest-first, so "next" is the longest wait. */}
          <Button
            disabled={!data.oldest}
            onClick={() =>
              data.oldest && navigate(`/review/${data.oldest.plan.dmp_id}`)
            }
          >
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Review next plan
          </Button>
          <Button variant="outline" onClick={() => navigate("/projects")}>
            <FolderKanban className="mr-2 h-4 w-4" />
            Browse projects
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Waiting my review"
            value={data.waitingCount}
            icon={ClipboardCheck}
            to="/review"
            footer={
              data.waitingCount === 0
                ? "Queue is empty"
                : `${data.submittedThisWeek} submitted this week`
            }
          />
          <StatCard
            label="Approved by you"
            value={data.approvedByMe}
            icon={CheckCircle2}
            to="/review"
            footer={
              data.decisionCount === 0
                ? "No decisions yet"
                : `of ${data.decisionCount} decision${data.decisionCount === 1 ? "" : "s"} · ${data.returnedByMe} sent back`
            }
          />
          <StatCard
            label="Longest waiting"
            value={data.oldest ? days(data.oldest.daysWaiting) : "None"}
            icon={Hourglass}
            to={data.oldest ? `/review/${data.oldest.plan.dmp_id}` : "/review"}
            footer={
              data.oldest
                ? `${data.oldest.plan.title} · v${data.oldest.version.number}`
                : "Nothing waiting"
            }
          />
          <StatCard
            label="Projects overseeing"
            value={data.overseenCount}
            icon={ListChecks}
            to="/projects"
            footer={
              data.projectsWithOverdue > 0
                ? `${data.projectsWithOverdue} with overdue tasks`
                : "No overdue tasks"
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <AwaitingReviewList
              items={data.awaiting}
              total={data.waitingCount}
            />
            <RecentDecisions items={data.decisions} />
          </div>
          <div className="min-w-0 space-y-6">
            <ProjectProgressList
              items={data.progress}
              description="How the projects you oversee are getting on."
            />
          </div>
        </div>
      </div>
    </>
  );
};
