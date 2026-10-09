import React from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import {
  NOTIFICATION_ICONS,
  NOTIFICATION_TONES,
} from "@/config/notification-style";
import type { Notification } from "@/types/notification";
import { cn } from "@/utils/cn";

const LIMIT = 4;

/** The latest few of the signed-in user's notifications. */
export const RecentNotifications: React.FC<{ description?: string }> = ({
  description = "Approvals, returns, and task updates.",
}) => {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId) ?? undefined;
  const all = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const mine = React.useMemo(
    () =>
      all
        .filter((n) => n.user_id === userId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime()),
    [all, userId],
  );
  const unread = mine.filter((n) => !n.read_at).length;

  const open = (n: Notification) => {
    markRead(n.notification_id as string);
    if (n.link) navigate(n.link);
  };

  return (
    <DashboardSection
      title="Notifications"
      description={description}
      action={
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 shrink-0"
          disabled={unread === 0}
          onClick={() => markAllRead(userId)}
        >
          Mark all read
        </Button>
      }
    >
      {mine.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <Bell className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">No notifications yet</p>
        </div>
      ) : (
        <>
          <ul className="-mx-2">
            {mine.slice(0, LIMIT).map((n) => {
              const Icon = NOTIFICATION_ICONS[n.type];
              return (
                <li key={n.notification_id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        NOTIFICATION_TONES[n.type],
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm",
                          n.read_at ? "font-normal" : "font-semibold",
                        )}
                      >
                        {n.title}
                      </span>
                      {n.message && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {n.message}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(n.created_at, { addSuffix: true })}
                      </span>
                      {!n.read_at && (
                        <span
                          className="h-2 w-2 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {mine.length > LIMIT && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full"
              onClick={() => navigate("/notifications")}
            >
              See all {mine.length}
            </Button>
          )}
        </>
      )}
    </DashboardSection>
  );
};
