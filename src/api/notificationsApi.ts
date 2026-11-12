import { http } from "@/api/http";
import type { Notification } from "@/types/notification";

/**
 * The signed-in person's notifications (`/notifications`). The server raises
 * them itself (submissions, decisions, cancelled tasks…); the client only
 * reads, marks and deletes. There's no push: the app polls.
 */

type Wire = Omit<Notification, "created_at" | "read_at"> & {
  created_at: string;
  read_at: string | null;
};

const toNotification = (n: Wire): Notification =>
  ({
    ...n,
    created_at: new Date(n.created_at),
    read_at: n.read_at ? new Date(n.read_at) : undefined,
    link: n.link ?? undefined,
    dmp_id: n.dmp_id ?? undefined,
    project_id: n.project_id ?? undefined,
  }) as Notification;

export const notificationsApi = {
  /** The newest page and the unread count. */
  list: async (limit = 100) => {
    const page = await http.get<{
      data: Wire[];
      unread_count: number;
      has_more: boolean;
    }>("/notifications", { query: { limit } });
    return {
      notifications: page.data.map(toNotification),
      unreadCount: page.unread_count,
    };
  },
  markRead: (id: string) => http.post(`/notifications/${id}/read`),
  markAllRead: () => http.post("/notifications/read_all"),
  remove: (id: string) => http.delete(`/notifications/${id}`),
  removeAll: () => http.delete("/notifications"),
};
