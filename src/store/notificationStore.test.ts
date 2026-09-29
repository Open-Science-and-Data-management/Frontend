import { beforeEach, describe, expect, it } from "vitest";
import { notify, useNotificationStore } from "@/store/notificationStore";
import { CURRENT_USER_ID } from "@/config/current-user";

const event = { user_id: CURRENT_USER_ID, type: "dmp_approved" as const };

beforeEach(() => {
  localStorage.clear();
  useNotificationStore.setState({ notifications: [] });
});

describe("notificationStore", () => {
  it("stamps an id and time, and arrives unread", () => {
    const created = notify({ ...event, title: "Your plan was approved" });

    expect(created.notification_id).toBeTruthy();
    expect(created.created_at).toBeInstanceOf(Date);
    expect(created.read_at).toBeUndefined();
    expect(useNotificationStore.getState().unreadCount()).toBe(1);
  });

  it("keeps the newest first", () => {
    notify({ ...event, title: "First" });
    notify({ ...event, title: "Second" });

    expect(
      useNotificationStore.getState().notifications.map((n) => n.title),
    ).toEqual(["Second", "First"]);
  });

  it("marks one read without touching the others", () => {
    notify({ ...event, title: "First" });
    const second = notify({ ...event, title: "Second" });

    useNotificationStore.getState().markRead(second.notification_id as string);

    const [newest, oldest] = useNotificationStore.getState().notifications;
    expect(newest.read_at).toBeInstanceOf(Date);
    expect(oldest.read_at).toBeUndefined();
    expect(useNotificationStore.getState().unreadCount()).toBe(1);
  });

  it("does not move read_at when something is marked read twice", () => {
    const one = notify({ ...event, title: "Once" });
    useNotificationStore.getState().markRead(one.notification_id as string);
    const first = useNotificationStore.getState().notifications[0].read_at;

    useNotificationStore.getState().markRead(one.notification_id as string);

    expect(useNotificationStore.getState().notifications[0].read_at).toBe(
      first,
    );
  });

  it("marks all read and clears the badge", () => {
    notify({ ...event, title: "A" });
    notify({ ...event, title: "B" });

    useNotificationStore.getState().markAllRead();

    expect(useNotificationStore.getState().unreadCount()).toBe(0);
  });

  it("removes one and clears all", () => {
    const a = notify({ ...event, title: "A" });
    notify({ ...event, title: "B" });

    useNotificationStore.getState().remove(a.notification_id as string);
    expect(useNotificationStore.getState().notifications).toHaveLength(1);

    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });
});
