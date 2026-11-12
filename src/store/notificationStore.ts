import { create } from "zustand";
import { notificationsApi } from "@/api/notificationsApi";
import { onSessionChange } from "@/config/current-user";
import type { Notification } from "@/types/notification";

/**
 * The signed-in person's notifications, read from the server. The server
 * raises them (submissions, decisions, cancelled tasks) and only ever lists a
 * person's own. There's no push: `startPolling` reads them again every
 * minute and whenever the tab comes back into focus.
 */

const POLL_MS = 60_000;

interface NotificationState {
  notifications: Notification[];
  /** As the server counts it, across every page. */
  unread: number;
  status: "idle" | "loading" | "ready" | "error";
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unread: 0,
  status: "idle",

  load: async () => {
    if (get().status === "idle") set({ status: "loading" });
    try {
      const { notifications, unreadCount } = await notificationsApi.list();
      set({ notifications, unread: unreadCount, status: "ready" });
    } catch (err) {
      set({ status: "error" });
      throw err;
    }
  },

  markRead: async (id) => {
    const target = get().notifications.find((n) => n.notification_id === id);
    if (!target || target.read_at) return;
    set((s) => ({
      unread: Math.max(0, s.unread - 1),
      notifications: s.notifications.map((n) =>
        n.notification_id === id ? { ...n, read_at: new Date() } : n,
      ),
    }));
    await notificationsApi.markRead(id).catch(() => get().load());
  },

  markAllRead: async () => {
    await notificationsApi.markAllRead();
    await get().load();
  },

  remove: async (id) => {
    await notificationsApi.remove(id);
    await get().load();
  },

  clearAll: async () => {
    await notificationsApi.removeAll();
    await get().load();
  },

  unreadCount: () => get().unread,
}));

let timer: ReturnType<typeof setInterval> | null = null;

/** Keeps notifications fresh while someone is signed in. Returns a stop. */
export const startPolling = () => {
  const refresh = () =>
    void useNotificationStore
      .getState()
      .load()
      .catch(() => undefined);
  refresh();
  if (timer) clearInterval(timer);
  timer = setInterval(refresh, POLL_MS);
  const onFocus = () => {
    if (document.visibilityState === "visible") refresh();
  };
  document.addEventListener("visibilitychange", onFocus);
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener("visibilitychange", onFocus);
  };
};

onSessionChange(() =>
  useNotificationStore.setState({
    notifications: [],
    unread: 0,
    status: "idle",
  }),
);
