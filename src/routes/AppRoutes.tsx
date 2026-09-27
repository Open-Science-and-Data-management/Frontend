import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import pages
import { TaskDashboard } from '@/pages/tasks';

const AppRoutes: React.FC = () => {
  return (
    <React.Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <Routes>
        {/* Main routes */}
        <Route path="/" element={<Navigate to="/tasks" replace />} />
        <Route path="/tasks" element={<TaskDashboard />} />

        {/* 404 route */}
        <Route path="*" element={<div className="flex h-screen items-center justify-center">Page not found</div>} />
      </Routes>
    </React.Suspense>
  );
};

export default AppRoutes;
