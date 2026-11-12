import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useNotificationStore } from "@/store/notificationStore";
import { useCurrentUser } from "@/store/authStore";
import { useDmpStore } from "@/store/dmpStore";
import { useToastStore } from "@/store/toastStore";
import { isReviewer } from "@/config/roles";
import type { Notification } from "@/types/notification";
import { cn } from "@/utils/cn";
import {
  NOTIFICATION_ICONS,
  NOTIFICATION_TONES,
} from "@/config/notification-style";

const ICONS = NOTIFICATION_ICONS;
const TONES = NOTIFICATION_TONES;

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const user = useCurrentUser();
  // The server only ever lists the signed-in person's own.
  const notifications = useNotificationStore((s) => s.notifications);
  const status = useNotificationStore((s) => s.status);
  const unread = useNotificationStore((s) => s.unread);
  const load = useNotificationStore((s) => s.load);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAll = useNotificationStore((s) => s.markAllRead);
  const removeOne = useNotificationStore((s) => s.remove);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const toast = useToastStore((s) => s.toast);

  React.useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  const failed = (title: string) => (err: unknown) =>
    toast({
      title,
      description: err instanceof Error ? err.message : undefined,
      variant: "destructive",
    });
  const markAllRead = () =>
    void markAll().catch(failed("Couldn't mark them read"));
  const remove = (id: string) =>
    void removeOne(id).catch(failed("Couldn't delete it"));

  // Newest first, whatever order the store happens to hold them in.
  const ordered = React.useMemo(
    () =>
      [...notifications].sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime(),
      ),
    [notifications],
  );

  // The server links to a plan (`/dmps/:id`); each side has its own page
  // for one: reviewers review it, its author follows its status.
  const open = (notification: Notification) => {
    void markRead(notification.notification_id as string);
    const dmpId =
      notification.dmp_id ?? notification.link?.match(/^\/dmps\/([^/]+)/)?.[1];
    if (dmpId) {
      if (isReviewer(user?.role)) navigate(`/review/${dmpId}`);
      else {
        useDmpStore.getState().openDmp(dmpId);
        navigate("/dmp/status");
      }
      return;
    }
    if (notification.project_id) navigate(`/projects/${notification.project_id}`);
  };

  const handleClearAll = async () => {
    const ok = await confirm({
      title: "Clear all notifications?",
      description: "They're deleted and can't be restored.",
      confirmLabel: "Clear all",
    });
    if (ok) void clearAll().catch(failed("Couldn't clear them"));
  };

  return (
    <>
      <Helmet>
        <title>Notifications | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unread > 0
                ? `${unread} unread of ${notifications.length}`
                : `${notifications.length} notification${notifications.length === 1 ? "" : "s"}, all read`}
            </p>
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={markAllRead}
                disabled={unread === 0}
              >
                Mark all read
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearAll}>
                Clear all
              </Button>
            </div>
          )}
        </div>

        {status === "loading" ? (
          <p className="py-10 text-center text-sm text-muted-foreground" role="status">
            Loading notifications…
          </p>
        ) : status === "error" && notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Couldn't load notifications"
            description="Check your connection, then try again."
            action={
              <Button variant="outline" size="sm" onClick={() => void load().catch(() => undefined)}>
                Try again
              </Button>
            }
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="You'll see updates here when your committee reviews a plan, or when AI finishes drafting one."
          />
        ) : (
          <ul className="space-y-3">
            {ordered.map((notification) => {
              const Icon = ICONS[notification.type];
              const isUnread = !notification.read_at;

              return (
                <li key={notification.notification_id}>
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 transition-colors",
                      isUnread ? "bg-card" : "bg-muted/30",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        TONES[notification.type],
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <button
                      type="button"
                      onClick={() => open(notification)}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "truncate",
                            isUnread ? "font-semibold" : "font-medium",
                          )}
                        >
                          {notification.title}
                        </p>
                        {isUnread && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-primary"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                      {notification.message && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(notification.created_at, {
                          addSuffix: true,
                        })}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        remove(notification.notification_id as string)
                      }
                      aria-label={`Dismiss ${notification.title}`}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
};
