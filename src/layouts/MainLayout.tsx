import React from "react";
import { Navbar } from "@/components/ui/navbar";
import { Sidebar } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Toaster } from "@/components/ui/toast";
import { AiChatPanel } from "@/components/dmp/AiChatPanel";
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
    <div className="min-h-screen bg-background">
      <Navbar
        onMenuClick={() => setMobileNavOpen(true)}
        onToggleSidebar={toggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
        onToggleChat={() => setChatOpen((o) => !o)}
        chatOpen={chatOpen}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <QuotaBar />
          <ThemeToggle />
        </div>
      </Navbar>
      <div
        className={cn(
          "transition-[margin] duration-200",
          chatOpen && "xl:mr-96",
        )}
      >
        <div className="flex min-h-dvh">
          <Sidebar
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            collapsed={sidebarCollapsed}
          />
          <main className="container mx-auto flex-1 py-6 px-4">{children}</main>
        </div>

        <footer className="border-t py-4 text-center text-sm text-muted-foreground">
          <div className="container mx-auto">
            <p>© {new Date().getFullYear()} Luis Alamo. MIT License.</p>
          </div>
        </footer>
      </div>
      <AiChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <Toaster />
    </div>
    </ConfirmProvider>
  );
};
