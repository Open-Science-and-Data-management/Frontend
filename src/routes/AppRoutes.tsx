import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Import pages
import { Home } from "@/pages/home";
import { Upload } from "@/pages/upload";
import { CreateDmp, ReviewSubmit } from "@/pages/createDMP";
import { Status } from "@/pages/status";
import { TaskDashboard } from "@/pages/tasks";
import { Notifications } from "@/pages/notifications";
import { MyDmps } from "@/pages/dmps";
import { Projects, ProjectDetail } from "@/pages/projects";
import { Settings } from "@/pages/settings";
import { HelpGuide } from "@/pages/help";

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
        <Route
          path="/dmp/:id/edit"
          element={<ComingSoon label="Edit DMP" />}
        />
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
