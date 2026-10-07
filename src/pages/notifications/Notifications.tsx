import React from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CheckCircle2,
  FileUp,
  ListChecks,
  Send,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useNotificationStore } from "@/store/notificationStore";
import type { Notification } from "@/types/notification";
import { cn } from "@/utils/cn";

const ICONS: Record<Notification["type"], LucideIcon> = {
  dmp_submitted: Send,
  dmp_approved: CheckCircle2,
  dmp_finalized: CheckCircle2,
  tasks_generated: ListChecks,
  tasks_cancelled: ListChecks,
  proposal_superseded: FileUp,
};

const TONES: Record<Notification["type"], string> = {
  dmp_submitted: "bg-warn-subtle text-warn",
  dmp_approved: "bg-ok-subtle text-ok",
  dmp_finalized: "bg-ok-subtle text-ok",
  tasks_generated: "bg-primary/10 text-primary",
  tasks_cancelled: "bg-primary/10 text-primary",
  proposal_superseded: "bg-muted text-muted-foreground",
};

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const remove = useNotificationStore((s) => s.remove);
  const clearAll = useNotificationStore((s) => s.clearAll);

  const unread = notifications.filter((n) => !n.read_at).length;

  // Newest first, whatever order the store happens to hold them in.
  const ordered = React.useMemo(
    () =>
      [...notifications].sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime(),
      ),
    [notifications],
  );

  const open = (notification: Notification) => {
    markRead(notification.notification_id as string);
    if (notification.link) navigate(notification.link);
  };

  const handleClearAll = async () => {
    const ok = await confirm({
      title: "Clear all notifications?",
      description: "They're removed from this device and can't be restored.",
      confirmLabel: "Clear all",
    });
    if (ok) clearAll();
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

        {notifications.length === 0 ? (
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
