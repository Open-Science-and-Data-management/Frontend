import React from "react";
import { Link } from "react-router-dom";
import { Menu, PanelLeftClose, PanelLeftOpen, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
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
    "rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <header className="sticky top-0 w-full border-b bg-background z-40">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">Logo</span>
          </Link>
          <Helmet>
            <title>Logo</title>
            <meta
              name="description"
              content="AI-assisted Data Management Plan authoring, reviewed and approved by humans."
            />
          </Helmet>
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
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
        </div>

        <div className="flex items-center gap-2">
          {onToggleChat && (
            <button
              type="button"
              onClick={onToggleChat}
              aria-label={chatOpen ? "Close AI assistant" : "Open AI assistant"}
              aria-expanded={chatOpen}
              className={cn(
                iconButton,
                chatOpen && "bg-ai-subtle text-ai hover:bg-ai-subtle hover:text-ai",
              )}
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          )}
          {children}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="hidden md:inline-flex"
          >
            <Link to="/upload">
              <Plus className="mr-1 h-4 w-4" />
              New DMP
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
};
