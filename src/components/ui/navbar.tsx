import React from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserMenu } from "@/components/ui/user-menu";
import { Helmet } from "react-helmet-async";

interface NavbarProps {
  children?: React.ReactNode;
  onMenuClick?: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  onToggleChat?: () => void;
  chatOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  children,
  onMenuClick,
  onToggleSidebar,
  sidebarCollapsed,
  onToggleChat,
  chatOpen,
}) => {
  const iconButton =
    "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <header className="sticky top-0 z-40 w-full bg-background">
      <div className="flex h-16 items-center border-b">
        <div
          className={cn(
            "flex h-full shrink-0 items-center gap-1 px-4 md:border-r",
            sidebarCollapsed
              ? "md:w-16 md:justify-center md:px-2"
              : "md:w-56 md:justify-between",
          )}
        >
          {!sidebarCollapsed && (
            <Link to="/" className="flex items-center">
              <span className="text-xl font-bold">Logo</span>
            </Link>
          )}
          <Helmet>
            <meta
              name="description"
              content="AI-assisted Data Management Plan authoring, reviewed and approved by humans."
            />
          </Helmet>
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label={
                sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              aria-pressed={sidebarCollapsed}
              className={cn(iconButton, "hidden md:inline-flex")}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>
          )}
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open menu"
              className={cn(iconButton, "md:hidden")}
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {sidebarCollapsed && (
            <Link to="/" className="md:hidden">
              <span className="text-xl font-bold">Logo</span>
            </Link>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 px-6">
          <div className="flex items-center gap-1.5">
            {children}
            {onToggleChat && (
              <button
                type="button"
                onClick={onToggleChat}
                aria-label={
                  chatOpen ? "Close AI assistant" : "Open AI assistant"
                }
                aria-expanded={chatOpen}
                className={cn(
                  iconButton,
                  chatOpen &&
                    "bg-ai-subtle text-ai hover:bg-ai-subtle hover:text-ai",
                )}
              >
                <MessageSquare className="h-5 w-5" />
              </button>
            )}
          </div>

          <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};
