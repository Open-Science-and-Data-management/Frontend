import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

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
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/dmp/create" element={<CreateDmp />} />
        <Route path="/dmp/review" element={<ReviewSubmit />} />
        <Route path="/dmp/:id/edit" element={<ComingSoon label="Edit DMP" />} />
        <Route path="/dmp/status" element={<Status />} />
        <Route path="/tasks" element={<TaskDashboard />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/dmps" element={<MyDmps />} />
        {/* The dashboard has always lived at "/". */}
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/drafts" element={<Navigate to="/dmps" replace />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
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
