import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useCurrentUser } from "@/store/authStore";
import {
  homePathFor,
  isReviewer,
  isResearcher,
  seesPlans,
} from "@/config/roles";

/**
 * Keeps each side to its own screens. Landing on the other side's page — an
 * old bookmark, a notification link — goes to your own start page instead.
 */
const ForSide: React.FC<{
  side: "researcher" | "reviewer" | "plans";
  children: React.ReactElement;
}> = ({ side, children }) => {
  const role = useCurrentUser()?.role;
  const onSide =
    side === "reviewer"
      ? isReviewer(role)
      : side === "researcher"
        ? isResearcher(role)
        : seesPlans(role);
  return onSide ? children : <Navigate to={homePathFor(role)} replace />;
};

const researcher = (element: React.ReactElement) => (
  <ForSide side="researcher">{element}</ForSide>
);
const reviewer = (element: React.ReactElement) => (
  <ForSide side="reviewer">{element}</ForSide>
);
/** Screens about plans and their projects: not for admin. */
const plans = (element: React.ReactElement) => (
  <ForSide side="plans">{element}</ForSide>
);

/**
 * Routes load on demand. The Suspense boundary below was already here but
 * nothing was lazy, so every screen — editor, AI dialogs, task board — shipped
 * in the first bundle whatever page you opened.
 */
const page = <T, K extends keyof T>(load: () => Promise<T>, name: K) =>
  React.lazy(() =>
    load().then((module) => ({
      default: module[name] as React.ComponentType,
    })),
  );

const Home = page(() => import("@/pages/home"), "Home");
const Upload = page(() => import("@/pages/upload"), "Upload");
const CreateDmp = page(() => import("@/pages/createDMP"), "CreateDmp");
const ReviewSubmit = page(() => import("@/pages/createDMP"), "ReviewSubmit");
const Status = page(() => import("@/pages/status"), "Status");
const TaskDashboard = page(() => import("@/pages/tasks"), "TaskDashboard");
const Notifications = page(
  () => import("@/pages/notifications"),
  "Notifications",
);
const MyDmps = page(() => import("@/pages/dmps"), "MyDmps");
const Projects = page(() => import("@/pages/projects"), "Projects");
const ProjectDetail = page(() => import("@/pages/projects"), "ProjectDetail");
const Settings = page(() => import("@/pages/settings"), "Settings");
const HelpGuide = page(() => import("@/pages/help"), "HelpGuide");
const ReviewQueue = page(() => import("@/pages/review"), "ReviewQueue");
const ReviewDetail = page(() => import("@/pages/review"), "ReviewDetail");
const CommitteeHome = page(() => import("@/pages/review"), "CommitteeHome");

/** "/" is each side's own dashboard. */
const DashboardHome: React.FC = () => {
  const role = useCurrentUser()?.role;
  if (isReviewer(role)) return <CommitteeHome />;
  if (isResearcher(role)) return <Home />;
  return <AdminHome />;
};

/**
 * Admin has no screens yet. It lands here rather than on either side: it has
 * no access to plans, so neither the editor nor the review queue is its own.
 */
const AdminHome: React.FC = () => (
  <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
    <p className="text-lg font-medium">Admin</p>
    <p className="max-w-md text-sm text-muted-foreground">
      Managing users, project members and AI quotas is coming in a later phase.
      Admin accounts don&rsquo;t open plans: those are for their researchers and
      the committee.
    </p>
  </div>
);

const ComingSoon: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
    <p className="text-lg font-medium">{label}</p>
    <p className="text-sm text-muted-foreground">
      This screen is coming in a later phase.
    </p>
  </div>
);

const AppRoutes: React.FC = () => {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <Routes>
        {/* Researcher DMP flow */}
        <Route path="/upload" element={researcher(<Upload />)} />
        <Route path="/dmp/create" element={researcher(<CreateDmp />)} />
        <Route path="/dmp/review" element={researcher(<ReviewSubmit />)} />
        <Route
          path="/dmp/:id/edit"
          element={researcher(<ComingSoon label="Edit DMP" />)}
        />
        <Route path="/dmp/status" element={researcher(<Status />)} />
        <Route path="/tasks" element={researcher(<TaskDashboard />)} />
        <Route path="/dmps" element={researcher(<MyDmps />)} />

        {/* Committee */}
        <Route path="/review" element={reviewer(<ReviewQueue />)} />
        <Route path="/review/:dmpId" element={reviewer(<ReviewDetail />)} />

        {/* Both sides */}
        <Route path="/" element={<DashboardHome />} />
        <Route path="/notifications" element={<Notifications />} />
        {/* The dashboard has always lived at "/". */}
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/drafts" element={<Navigate to="/dmps" replace />} />
        <Route path="/projects" element={plans(<Projects />)} />
        <Route path="/projects/:projectId" element={plans(<ProjectDetail />)} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<HelpGuide />} />

        {/* 404 route */}
        <Route
          path="*"
          element={
            <div className="flex h-screen items-center justify-center">
              Page not found
            </div>
          }
        />
      </Routes>
    </React.Suspense>
  );
};

export default AppRoutes;
