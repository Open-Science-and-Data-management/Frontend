import React from "react";
import { Navbar } from "@/components/ui/navbar";
import { Sidebar } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { cn } from "@/utils/cn";
import { QuotaBar } from "@/components/ui/quota-indicator";
import { useCurrentUser } from "@/store/authStore";
import { useQuotaStore } from "@/store/quotaStore";
import { useAssistantStore } from "@/store/assistantStore";
import { isReviewer } from "@/config/roles";

const SIDEBAR_KEY = "sidebar-collapsed";

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  // The token budget is for drafting; reviewers only read.
  const user = useCurrentUser();
  const reviewer = isReviewer(user?.role);
  // The plan editor docks the assistant; the shell only makes room for it.
  const chatOpen = useAssistantStore((s) => s.open);
  // The budget is the signed-in account's, read from the server — on sign-in
  // and whenever the account changes, then after every AI call.
  React.useEffect(() => {
    // Never show one account's budget to the next.
    useQuotaStore.setState({ quota: null, status: "idle" });
    if (user?.user_id) void useQuotaStore.getState().refresh();
  }, [user?.user_id]);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(
    () => localStorage.getItem(SIDEBAR_KEY) === "true",
  );

  const toggleSidebar = () =>
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });

  return (
    <ConfirmProvider>
      <div className="min-h-dvh bg-background">
        {/* One column for the whole app, so the header, sidebar, content and
            footer share an edge instead of each finding their own. */}
        <div
          className={cn(
            "flex min-h-dvh flex-col transition-[margin] duration-200",
            chatOpen && "xl:mr-96",
          )}
        >
          <Navbar
            onMenuClick={() => setMobileNavOpen(true)}
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
          >
            {!reviewer && <QuotaBar />}
          </Navbar>

          <div className="flex flex-1">
            <Sidebar
              open={mobileNavOpen}
              onClose={() => setMobileNavOpen(false)}
              collapsed={sidebarCollapsed}
            />
            <main className="min-w-0 flex-1">
              <div className="mx-auto w-full max-w-7xl px-6 py-6">
                {children}
              </div>
            </main>
          </div>

          <footer className="border-t py-4">
            <div className="mx-auto w-full max-w-7xl px-6 text-center text-sm text-muted-foreground">
              <p>© {new Date().getFullYear()} DMP-Researcher · MIT License</p>
            </div>
          </footer>
        </div>

        <Toaster />
      </div>
    </ConfirmProvider>
  );
};
