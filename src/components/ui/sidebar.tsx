import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ListChecks,
  Bell,
  FileText,
  FolderKanban,
  Settings as SettingsIcon,
  HelpCircle,
  X,
  Home,
  ClipboardCheck,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore, useCurrentUser } from "@/store/authStore";
import { usePendingReviewCount } from "@/hooks/useDmpLibrary";
import { isReviewer } from "@/config/roles";
import { cn } from "@/utils/cn";

type BadgeKind = "notifications" | "reviews";

interface SidebarNavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Which count the item carries, if any. */
  badge?: BadgeKind;
}

interface SidebarSection {
  label: string;
  items: SidebarNavItem[];
}

/** How a count reads to a screen reader, per kind. */
const BADGE_NOUN: Record<BadgeKind, string> = {
  notifications: "unread",
  reviews: "waiting",
};

/** Committee members read and decide; they don't draft, so no editor or tasks. */
const REVIEWER_SECTIONS: SidebarSection[] = [
  {
    label: "Review",
    items: [
      { label: "Dashboard", to: "/", icon: Home },
      {
        label: "Review queue",
        to: "/review",
        icon: ClipboardCheck,
        badge: "reviews",
      },
      { label: "Projects", to: "/projects", icon: FolderKanban },
      {
        label: "Notifications",
        to: "/notifications",
        icon: Bell,
        badge: "notifications",
      },
    ],
  },
  {
    label: "General",
    items: [
      { label: "Settings", to: "/settings", icon: SettingsIcon },
      { label: "Help & Guide", to: "/help", icon: HelpCircle },
    ],
  },
];

const RESEARCHER_SECTIONS: SidebarSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", to: "/", icon: Home },
      { label: "My Tasks", to: "/tasks", icon: ListChecks },
      {
        label: "Notifications",
        to: "/notifications",
        icon: Bell,
        badge: "notifications",
      },
      { label: "My DMPs", to: "/dmps", icon: FileText },
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
  const user = useCurrentUser();
  const userId = useAuthStore((s) => s.userId);
  const unread = useNotificationStore(
    (s) =>
      s.notifications.filter((n) => !n.read_at && n.user_id === userId).length,
  );
  const waiting = usePendingReviewCount();
  const counts: Record<BadgeKind, number> = {
    notifications: unread,
    reviews: waiting,
  };
  const SECTIONS = isReviewer(user?.role)
    ? REVIEWER_SECTIONS
    : RESEARCHER_SECTIONS;

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
              const count = item.badge ? counts[item.badge] : 0;

              const link = (
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  aria-label={
                    count > 0
                      ? `${item.label}, ${count} ${BADGE_NOUN[item.badge!]}`
                      : collapsed
                        ? item.label
                        : undefined
                  }
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
                  <span className="relative shrink-0">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {/* Collapsed: a dot, since there's no room for a count. */}
                    {collapsed && count > 0 && (
                      <span
                        className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {count > 0 && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );

              return (
                <li key={item.to}>
                  {collapsed ? (
                    <Tooltip
                      content={
                        count > 0
                          ? `${item.label} (${count} ${BADGE_NOUN[item.badge!]})`
                          : item.label
                      }
                    >
                      {link}
                    </Tooltip>
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

export const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  collapsed,
}) => {
  return (
    <>
      {/* Desktop: static column that can shrink to an icon rail */}
      <aside
        className={cn(
          // Sticks under the header so navigation stays put on long pages.
          "hidden shrink-0 self-start border-r bg-card transition-[width] duration-200 md:sticky md:top-16 md:block md:h-[calc(100dvh-4rem)]",
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
