import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CreateNotification, Notification } from "@/types/notification";
import { jsonStorage, storageKey } from "@/store/persist";
import { CURRENT_USER_ID } from "@/config/current-user";

const makeId = () => Math.random().toString(36).substring(2, 10);

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Seeds matching the seeded plans, so the screen isn't empty on first run. */
const seedNotifications = (): Notification[] => [
  {
    notification_id: "ntf-approved",
    user_id: CURRENT_USER_ID,
    type: "dmp_approved",
    title: "Your plan was approved",
    message:
      "The committee approved Urban Pollinator Genomics Data Management Plan.",
    link: "/dmps",
    dmp_id: "dmp-pollinator",
    created_at: daysAgo(12),
    read_at: daysAgo(11),
  },
  {
    notification_id: "ntf-submitted",
    user_id: CURRENT_USER_ID,
    type: "dmp_submitted",
    title: "Plan submitted for approval",
    message: "Coastal Sediment Archive DMP is waiting on the committee.",
    link: "/dmps",
    dmp_id: "dmp-sediment",
    created_at: daysAgo(3),
  },
];

interface NotificationState {
  notifications: Notification[];
  notify: (input: CreateNotification) => Notification;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: seedNotifications(),

      notify: (input) => {
        const notification: Notification = {
          ...input,
          notification_id: makeId(),
          created_at: new Date(),
        };
        // Newest first: the list is read top-down and never paged.
        set((state) => ({
          notifications: [notification, ...state.notifications],
        }));
        return notification;
      },

      markRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.notification_id === id && !n.read_at
              ? { ...n, read_at: new Date() }
              : n,
          ),
        })),

      markAllRead: () =>
        set((state) => {
          const now = new Date();
          return {
            notifications: state.notifications.map((n) =>
              n.read_at ? n : { ...n, read_at: now },
            ),
          };
        }),

      remove: (id) =>
        set((state) => ({
          notifications: state.notifications.filter(
            (n) => n.notification_id !== id,
          ),
        })),

      clearAll: () => set({ notifications: [] }),

      unreadCount: () => get().notifications.filter((n) => !n.read_at).length,
    }),
    {
      name: storageKey("notifications"),
      storage: jsonStorage,
      version: 1,
      partialize: (state) => ({ notifications: state.notifications }),
    },
  ),
);

/** Call sites raise events without importing the hook. */
export const notify = (input: CreateNotification) =>
  useNotificationStore.getState().notify(input);
