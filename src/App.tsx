import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import AppRoutes from "./routes/AppRoutes";
import { Login } from "./pages/login";
import { Landing } from "./pages/landing";
import { useCurrentUser } from "./store/authStore";

/**
 * Everything but the public pages needs someone signed in. Signed out, the
 * front door ("/") is the landing page; any deeper link goes to sign-in and
 * comes back afterwards.
 */
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useCurrentUser();
  const location = useLocation();
  if (!user) {
    if (location.pathname === "/") return <Landing />;
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Routes>
      {/* Outside the shell: no sidebar or navbar before you've signed in. */}
      <Route path="/login" element={<Login />} />
      {/* The landing page, reachable whether signed in or not. */}
      <Route path="/welcome" element={<Landing />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <MainLayout>
              <AppRoutes />
            </MainLayout>
          </RequireAuth>
        }
      />
    </Routes>
  );
};

export default App;
