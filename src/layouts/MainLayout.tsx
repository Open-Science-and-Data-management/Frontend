import React from "react";
import { Navbar } from "@/components/ui/navbar";
import { Sidebar } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toast";
// Hidden until it's opened, so its tool layer shouldn't be in the first load.
const AiChatPanel = React.lazy(() =>
  import("@/components/dmp/AiChatPanel").then((m) => ({
    default: m.AiChatPanel,
  })),
);
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { cn } from "@/utils/cn";
import { QuotaBar } from "@/components/ui/quota-indicator";

const SIDEBAR_KEY = "sidebar-collapsed";

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
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
            onToggleChat={() => setChatOpen((o) => !o)}
            chatOpen={chatOpen}
          >
            <QuotaBar />
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

        {chatOpen && (
          <React.Suspense fallback={null}>
            <AiChatPanel open onClose={() => setChatOpen(false)} />
          </React.Suspense>
        )}
        <Toaster />
      </div>
    </ConfirmProvider>
  );
};
