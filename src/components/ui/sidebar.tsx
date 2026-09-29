import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ListChecks,
  Bell,
  FileEdit,
  FolderKanban,
  Settings as SettingsIcon,
  HelpCircle,
  X,
  Home,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";

interface SidebarNavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarSection {
  label: string;
  items: SidebarNavItem[];
}

const SECTIONS: SidebarSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", to: "/home", icon: Home },
      { label: "My Tasks", to: "/tasks", icon: ListChecks },
      { label: "Notifications", to: "/notifications", icon: Bell },
      { label: "My Drafts", to: "/drafts", icon: FileEdit },
    ],
  },
  {
    label: "General",
    items: [
      { label: "Projects", to: "/projects", icon: FolderKanban },
      { label: "Settings", to: "/settings", icon: SettingsIcon },
      { label: "Help & Guide", to: "/help", icon: HelpCircle },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed?: boolean;
}

const SidebarNav: React.FC<{ onNavigate: () => void; collapsed?: boolean }> = ({
  onNavigate,
  collapsed,
}) => {
  const { pathname } = useLocation();

  return (
  <nav
    aria-label="Workspace navigation"
    className={cn(
      "flex h-full flex-col gap-6 overflow-y-auto py-4",
      collapsed ? "px-2" : "px-4",
    )}
  >
    {SECTIONS.map((section) => (
      <div key={section.label}>
        {collapsed ? (
          <div className="mx-auto mb-2 h-px bg-border" aria-hidden="true" />
        ) : (
          <h2 className="mb-2 px text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.label}
          </h2>
        )}
        <ul className="space-y-1">
          {section.items.map((item) => {
            const isActive =
              pathname === item.to || pathname.startsWith(`${item.to}/`);

            const link = (
              <NavLink
                to={item.to}
                onClick={onNavigate}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                    "flex items-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    collapsed
                      ? "mx-auto h-11 w-11 justify-center"
                      : "gap-2.5 px-2.5 py-2",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
              >
                <item.icon
                  className={cn(collapsed ? "h-4 w-4" : "h-4 w-4", "shrink-0")}
                />
                {!collapsed && item.label}
              </NavLink>
            );

            return (
              <li key={item.to}>
                {collapsed ? (
                  <Tooltip content={item.label}>{link}</Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </div>
    ))}
  </nav>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose, collapsed }) => {
  return (
    <>
      {/* Desktop: static column that can shrink to an icon rail */}
      <aside
        className={cn(
          "hidden shrink-0 border-r bg-card transition-[width] duration-200 md:block",
          collapsed ? "md:w-16" : "md:w-56",
        )}
      >
        {/* The rail keeps labels as tooltips, so nothing becomes unreachable */}
        <SidebarNav onNavigate={onClose} collapsed={collapsed} />
      </aside>

      {/* Mobile: off-canvas drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Workspace navigation"
            className="absolute inset-y-0 left-0 w-64 bg-card shadow-lg"
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          >
            <div className="flex items-center justify-between border-b p-4">
              <span className="font-semibold">Menu</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarNav onNavigate={onClose} />
          </div>
        </div>
      )}
    </>
  );
};
