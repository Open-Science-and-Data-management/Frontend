import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import AppRoutes from "./routes/AppRoutes";
import { Login } from "./pages/login";
import { useCurrentUser } from "./store/authStore";

/** Everything but the sign-in page needs someone signed in. */
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useCurrentUser();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Routes>
      {/* Outside the shell: no sidebar or navbar before you've signed in. */}
      <Route path="/login" element={<Login />} />
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
